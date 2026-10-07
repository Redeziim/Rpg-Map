import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createApplication} from '../server/app.js';
import sharp from 'sharp';

const triangle='v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3\n';
const file=(name,text,mime='text/plain')=>({name,data:`data:${mime};base64,${Buffer.from(text).toString('base64')}`});
const bundle=(files,main=files[0].name)=>({main,kind:'structure',files});
function packet(source){
  const contents=source.files.map(file=>Buffer.from(file.data.split(',')[1],'base64'));
  const header=Buffer.from(JSON.stringify({version:1,main:source.main,kind:source.kind,files:source.files.map((file,i)=>({name:file.name,mime:file.data.slice(5,file.data.indexOf(';')),size:contents[i].length}))}));
  const prefix=Buffer.alloc(8);prefix.write('GRM1');prefix.writeUInt32BE(header.length,4);return new Blob([prefix,header,...contents],{type:'application/vnd.grimorio.map-asset'});
}
async function fixture(options={}){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-model-validation-'));
  const app=createApplication({dbPath:join(directory,'review.sqlite'),exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{},...options});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,cookies={};
  async function call(path,method='GET',data,signal,headers={},who='owner'){
    const binary=data instanceof Blob;
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(!binary?{'Content-Type':'application/json'}:{}),...headers},body:binary?data:data?JSON.stringify(data):undefined,signal:signal||AbortSignal.timeout(60000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:response.headers.get('content-type')?.includes('application/vnd.grimorio.map-asset')?await response.blob():await response.json()};
  }
  assert.equal((await call('/auth/register','POST',{username:'owner',password:'model-validation-local'})).status,200);
  const root='/rooms/'+(await call('/rooms','POST',{name:'Conferência de modelos'})).data.id;
  return {app,base,root,call,close:async()=>{const closed=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await closed;assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('detailed triangles and quad faces can be imported, then resized together without changing proportions or the asset',async()=>{
  const f=await fixture();
  try{
    const source='v 0 0 0\nv 2 0 0\nv 2 1 0\nv 0 1 0\n'+'f 1 2 3 4\n'.repeat(175000);
    const imported=await f.call(f.root+'/map-assets','POST',packet(bundle([file('detailed-quads.obj',source)])));
    assert.equal(imported.status,201,imported.data.error);
    let view=imported.data;const object=view.state.mapObjects[0];
    const placed=await f.call(f.root+'/map-object-actions','POST',{action:'transform',ids:[object.id],version:view.mapObjectsVersion,patches:[{id:object.id,position:[3,2,1],rotation:[0,.3,0],scale:[2,1,3]}]});
    assert.equal(placed.status,200);view=placed.data;
    const resized=await f.call(f.root+'/map-object-actions','POST',{action:'transform',ids:[object.id],version:view.mapObjectsVersion,delta:{scale:2}});
    assert.equal(resized.status,200);const changed=resized.data.state.mapObjects[0];
    assert.deepEqual(changed.scale,[4,2,6]);assert.deepEqual(changed.position,[3,2,1]);
    assert.ok(Math.abs(changed.rotation[1]-.3)<1e-10);assert.equal(changed.assetId,object.assetId);
    const saved=await f.call(f.root+'/map-assets/'+object.assetId);
    assert.equal(saved.status,200);assert.equal(saved.data.files[0].data,file('detailed-quads.obj',source).data);
  }finally{await f.close();}
});

test('a rejected model explains the missing resource and leaves the room unchanged',async()=>{
  const f=await fixture();
  try{
    const before=(await f.call(f.root)).data;
    const response=await f.call(f.root+'/map-assets','POST',bundle([file('house.obj','mtllib absent.mtl\n'+triangle)]));
    assert.equal(response.status,400);assert.match(response.data.error,/absent\.mtl/);
    const after=(await f.call(f.root)).data;
    assert.deepEqual(after.state.mapObjects,before.state.mapObjects);assert.equal(after.revision,before.revision);
    for(const invalid of [
      bundle([file('fake.obj','<html>not a mesh</html>')]),
      bundle([file('bad-index.obj',triangle.replace('f 1 2 3','f 1 2 99'))]),
      bundle([file('nonfinite.obj',triangle.replace('v 1 0 0','v NaN 0 0'))]),
      bundle([file('fake.fbx','not an FBX model')]),
      bundle([file('fake.glb','not a GLB model','model/gltf-binary')]),
      bundle([file('image.png','not a PNG','image/png')]),
      bundle([file('house.obj','mtllib house.mtl\n'+triangle),file('house.mtl','newmtl house\nmap_Kd https://example.com/private.png')]),
      bundle([file('absent.gltf',JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'missing.bin',byteLength:36}]}),'model/gltf+json')])
    ]){
      const rejected=await f.call(f.root+'/map-assets','POST',packet(invalid));
      assert.equal(rejected.status,400,invalid.main);assert.ok(invalid.files.some(file=>rejected.data.error.includes(file.name)),rejected.data.error);
      assert.equal((await f.call(f.root)).data.revision,before.revision);
    }
    const oversized='v 0 0 0\nv 1 0 0\nv 0 0 1\n'+'f 1 2 3\n'.repeat(2000001);
    assert.equal((await f.call(f.root+'/map-assets','POST',packet(bundle([file('dense.obj',oversized)])))).status,413);
    const png=await sharp({create:{width:4,height:4,channels:3,background:'#ffffff'}}).png().toBuffer();
    const huge=Buffer.from(png);huge.writeUInt32BE(16001,16);
    assert.equal((await f.call(f.root+'/map-assets','POST',packet(bundle([file('huge.png',huge,'image/png')])))).status,413);
    const ambiguous=bundle([file('house.obj','mtllib house.mtl\n'+triangle),file('house.mtl','newmtl house\nmap_Kd paint.png'),file('one/paint.png',png,'image/png'),file('two/paint.png',png,'image/png')]);
    assert.equal((await f.call(f.root+'/map-assets','POST',ambiguous)).status,400);
    assert.equal((await f.call(f.root)).data.revision,before.revision);
  }finally{await f.close();}
});

test('timeouts, cancellation and incompatible old packages keep confirmed data recoverable and the API responsive',async()=>{
  const timed=await fixture({modelValidationTimeoutMs:1});
  try{
    const before=(await timed.call(timed.root)).data;
    const rejected=await timed.call(timed.root+'/map-assets','POST',bundle([file('house.obj',triangle)]));
    assert.equal(rejected.status,503);assert.match(rejected.data.error,/demorou/);
    assert.equal((await timed.call(timed.root)).data.revision,before.revision);
    assert.equal((await timed.call('/health')).status,200);
  }finally{await timed.close();}
  const f=await fixture({modelValidationMaxWorkers:1});
  try{
    const before=(await f.call(f.root)).data,controller=new AbortController();let finished=false;
    const heavy='v 0 0 0\nv 1 0 0\nv 0 0 1\n'+'f 1 2 3\n'.repeat(200000);
    const importing=f.call(f.root+'/map-assets','POST',bundle([file('heavy.obj',heavy)]),controller.signal).finally(()=>{finished=true;});
    const aborted=assert.rejects(importing,{name:'AbortError'});
    await new Promise(done=>setTimeout(done,50));
    assert.equal((await f.call('/health')).status,200);assert.equal(finished,false,'health responds while the import is unfinished');
    const busy=await f.call(f.root+'/map-assets','POST',bundle([file('small.obj',triangle)]));assert.equal(busy.status,503);
    controller.abort();await aborted;
    await new Promise(done=>setTimeout(done,100));
    assert.equal((await f.call(f.root)).data.revision,before.revision);
    assert.equal((await f.call(f.root+'/map-assets','POST',bundle([file('small.obj',triangle)]))).status,201,'worker slot becomes reusable');
    const master=await f.call('/auth/register','POST',{username:'master',password:'model-validation-local'},undefined,{},'master');
    assert.equal((await f.call(f.root+'/members','POST',{username:'master',role:'master'})).status,200);
    let masterFinished=false;
    const publishing=f.call(f.root+'/map-assets','POST',bundle([file('master-heavy.obj',heavy)]),undefined,{},'master').finally(()=>{masterFinished=true;});
    await new Promise(done=>setTimeout(done,50));assert.equal(masterFinished,false);
    const object=(await f.call(f.root)).data.state.mapObjects[0];
    assert.equal((await f.call(f.root+'/map-objects/'+object.id,'PATCH',{position:[9,0,9]})).status,200);
    assert.equal((await f.call(f.root+'/members/'+master.data.id,'PATCH',{role:'player'})).status,200);
    assert.equal((await publishing).status,403,'revoked editor cannot publish after validation');
    const current=(await f.call(f.root)).data;assert.equal(current.state.mapObjects.length,1);assert.deepEqual(current.state.mapObjects[0].position,[9,0,9]);
    const sharedId='shared-validation',sharedBundle=bundle([file('shared.obj',triangle)]);
    f.app.db.prepare('INSERT INTO map_assets VALUES(?,?,?,?)').run(sharedId,f.root.split('/').at(-1),JSON.stringify(sharedBundle),32);
    const a=new AbortController(),one=f.call(f.root+'/map-assets/'+sharedId,'GET',undefined,a.signal,{Accept:'application/vnd.grimorio.map-asset'}),cancelled=assert.rejects(one,{name:'AbortError'});
    const two=f.call(f.root+'/map-assets/'+sharedId,'GET',undefined,undefined,{Accept:'application/vnd.grimorio.map-asset'});
    await new Promise(done=>setTimeout(done,40));a.abort();await cancelled;assert.equal((await two).status,200,'one cancelled viewer does not stop the other');
    // Seed a pre-validation package as an old database fixture; observe recovery
    // through HTTP, rather than using database queries as assertions.
    const legacy=bundle([file('legacy.obj',triangle.replace('v 1 0 0','v NaN 0 0'))]),id='legacy-model-validation';
    f.app.db.prepare('INSERT INTO map_assets VALUES(?,?,?,?)').run(id,f.root.split('/').at(-1),JSON.stringify(legacy),40);
    const raw=await f.call(f.root+'/map-assets/'+id);assert.equal(raw.status,200);assert.deepEqual(raw.data.files,legacy.files);
    const unsafe=await f.call(f.root+'/map-assets/'+id,'GET',undefined,undefined,{Accept:'application/vnd.grimorio.map-asset'});
    assert.equal(unsafe.status,400);assert.match(unsafe.data.error,/legacy\.obj/);
    assert.deepEqual((await f.call(f.root+'/map-assets/'+id)).data.files,legacy.files,'old package is preserved for recovery');
  }finally{await f.close();}
});

test('complete OBJ, GLTF, GLB, FBX and terrain images publish through JSON or binary without changing their files',async()=>{
  const f=await fixture();
  try{
    const png=await sharp({create:{width:4,height:4,channels:3,background:'#dc4b32'}}).png().toBuffer();
    const vertices=Buffer.from(new Float32Array([0,0,0,1,0,0,0,0,1]).buffer);
    const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'../buffers/mesh.bin',byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,0,1]}]};
    const gltf=bundle([file('models/house.gltf',JSON.stringify(document),'model/gltf+json'),file('buffers/mesh.bin',vertices,'application/octet-stream')]);
    const json=Buffer.from(JSON.stringify({...document,buffers:[{byteLength:36}]})),size=Math.ceil(json.length/4)*4,glb=Buffer.alloc(28+size+vertices.length);
    glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(size,12);glb.writeUInt32LE(0x4e4f534a,16);glb.fill(32,20,20+size);json.copy(glb,20);glb.writeUInt32LE(vertices.length,20+size);glb.writeUInt32LE(0x004e4942,24+size);vertices.copy(glb,28+size);
    const models=[
      bundle([file('models/house.obj','mtllib ../materials/house.mtl\nusemtl house\n'+triangle),file('materials/house.mtl','newmtl house\nKd 1 1 1\nmap_Kd ../textures/paint.png'),file('textures/paint.png',png,'image/png')]),
      gltf,bundle([file('house.glb',glb,'model/gltf-binary')]),
      bundle([file('morph.fbx',readFileSync(new URL('./fixtures/morph_test.fbx',import.meta.url)),'application/octet-stream')]),
      bundle([file('floor.png',png,'image/png')])
    ];
    for(const [i,model]of models.entries()){
      const published=await f.call(f.root+'/map-assets','POST',i%2?model:packet(model));
      assert.equal(published.status,201,JSON.stringify(published.data));
      assert.equal(published.data.state.mapObjects.length,i+1);assert.ok(published.data.modelValidation.vertices>0);
      const object=published.data.state.mapObjects.at(-1),downloaded=await f.call(f.root+'/map-assets/'+object.assetId);
      assert.deepEqual(downloaded.data.files,model.files);assert.equal(downloaded.data.main,model.main);
    }
  }finally{await f.close();}
});
