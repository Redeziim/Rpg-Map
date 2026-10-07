import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createApplication} from '../server/app.js';
import {Box3,Vector3} from 'three';
import {loadMapAsset,disposeModel} from '../src/components/tabletop/loadMapAsset.js';

const media='application/vnd.grimorio.map-asset';
const geometry=Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3\n');
const files=[{name:'model.obj',mime:'text/plain',bytes:geometry},{name:'apoio.bin',mime:'application/octet-stream',bytes:Buffer.alloc(2*1024*1024,17)}];
function packet(entries=files,extra={}){
  const header=Buffer.from(JSON.stringify({version:1,main:'model.obj',kind:'structure',files:entries.map(file=>({name:file.name,mime:file.mime,size:file.bytes.length})),...extra}));
  const prefix=Buffer.alloc(8);prefix.write('GRM1');prefix.writeUInt32BE(header.length,4);
  return new Blob([prefix,header,...entries.map(file=>file.bytes)],{type:media});
}
async function unpack(blob){
  const prefix=Buffer.from(await blob.slice(0,8).arrayBuffer());assert.equal(prefix.subarray(0,4).toString(),'GRM1');
  const end=8+prefix.readUInt32BE(4),header=JSON.parse(await blob.slice(8,end).text());let offset=end;
  const entries=[];for(const file of header.files){entries.push({...file,bytes:Buffer.from(await blob.slice(offset,offset+file.size).arrayBuffer())});offset+=file.size;}
  assert.equal(blob.size,offset);return {...header,files:entries};
}
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-model-transfer-')),cookies={},users={};let app,base;
  async function start(){
    app=createApplication({dbPath:join(directory,'test.sqlite'),exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
    for(let attempt=0;attempt<10;attempt++){
      await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;
      try{const probe=await fetch(base+'/health',{headers:{Connection:'close'}});await probe.body.cancel();return;}
      catch(error){await new Promise(done=>app.server.close(done));if(error.cause?.message!=='bad port'||attempt===9)throw error;}
    }
  }
  async function stop(){const closed=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await closed;app=null;}
  async function request(who,path,method='GET',body,headers={}){
    let response;try{response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(body&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof Blob?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});}catch(error){throw Error(`${who} ${method} ${path} did not respond`,{cause:error});}
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return response;
  }
  await start();
  for(const who of ['owner','master','player','outsider']){const response=await request(who,'/auth/register','POST',{username:who,password:'local-binary-model-review'});assert.equal(response.status,200);users[who]=(await response.json()).id;}
  const root='/rooms/'+(await (await request('owner','/rooms','POST',{name:'Transferência 3D'})).json()).id;
  for(const [who,role]of [['master','master'],['player','player']])assert.equal((await request('owner',root+'/members','POST',{username:who,role})).status,200);
  return {root,users,request,start,stop,async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('native binary files publish one object, download exact bytes and retain legacy/export compatibility after restart',async()=>{
  const f=await fixture();
  try{
    const source=packet(),created=await f.request('master',f.root+'/map-assets','POST',source);
    assert.equal(created.status,201);const room=await created.json(),item=room.state.mapObjects[0];assert.equal(room.state.mapObjects.length,1);
    const download=await f.request('player',f.root+'/map-assets/'+item.assetId,'GET',undefined,{Accept:media});assert.equal(download.status,200);
    const wire=await download.blob(),bundle=await unpack(wire);assert.equal(bundle.main,'model.obj');assert.equal(bundle.kind,'structure');
    for(let i=0;i<files.length;i++)assert.deepEqual(bundle.files[i].bytes,files[i].bytes);
    const legacy=await (await f.request('player',f.root+'/map-assets/'+item.assetId)).json();
    assert.deepEqual(Buffer.from(legacy.files[1].data.split(',')[1],'base64'),files[1].bytes);assert.ok(wire.size<Buffer.byteLength(JSON.stringify(legacy))*.76);
    const ready=await (await f.request('owner',f.root+'/exports','POST',{viewMode:'master'})).json();
    const portable=await (await f.request('owner',ready.downloadUrl.replace(/^\/api/,''))).json();
    assert.deepEqual(Buffer.from(portable.assets.models[0].files[1].data.split(',')[1],'base64'),files[1].bytes);
    await f.stop();await f.start();const reopened=await f.request('player',f.root+'/map-assets/'+item.assetId,'GET',undefined,{Accept:media});assert.equal(reopened.status,200);
    assert.deepEqual((await unpack(await reopened.blob())).files[1].bytes,files[1].bytes);
  }finally{await f.close();}
});

test('binary transfers keep cache representations separate and enforce access, bounded metadata and complete bodies',async()=>{
  const f=await fixture();
  try{
    const created=await (await f.request('master',f.root+'/map-assets','POST',packet())).json(),item=created.state.mapObjects[0],path=f.root+'/map-assets/'+item.assetId;
    const response=await f.request('player',path,'GET',undefined,{Accept:media}),etag=response.headers.get('etag');await response.body.cancel();
    assert.equal((await f.request('player',path,'GET',undefined,{Accept:media,'If-None-Match':etag})).status,304);
    const json=await f.request('player',path,'GET',undefined,{'If-None-Match':etag});assert.equal(json.status,200);assert.match(json.headers.get('vary'),/accept/i);assert.notEqual(json.headers.get('etag'),etag);await json.body.cancel();
    assert.equal((await f.request('outsider',path,'GET',undefined,{Accept:media,'If-None-Match':etag})).status,403);
    const small=packet([files[0]]);
    assert.equal((await f.request('player',f.root+'/map-assets','POST',small)).status,403);
    assert.equal((await f.request('owner',f.root+'/map-assets?mapViewMode=player','POST',small)).status,403);
    assert.equal((await f.request('owner',f.root+'/map-objects/'+item.id+'?mapViewMode=player','PATCH',{position:[1,0,0]})).status,403);
    assert.equal((await f.request('owner',f.root+'/map-objects/'+item.id+'?mapViewMode=player','DELETE')).status,403);
    for(const [index,invalid]of [small.slice(0,small.size-1,media),new Blob([small,'extra'],{type:media}),packet([files[0]],{version:2}),packet([files[0]],{files:[{name:'../model.obj',mime:'text/plain',size:geometry.length}]}),packet([files[0]],{files:[{name:'model.obj',mime:'text/plain',size:51*1024*1024}]})].entries()){
      let rejected;try{rejected=await f.request('master',f.root+'/map-assets','POST',invalid);}catch(error){throw Error(`Invalid packet ${index} did not return an HTTP error`,{cause:error});}assert.ok([400,413].includes(rejected.status));await rejected.body.cancel();
    }
    assert.equal((await (await f.request('owner',f.root)).json()).state.mapObjects.length,1);
    assert.equal((await f.request('owner',f.root+'/members/'+f.users.player,'DELETE')).status,200);
    assert.equal((await f.request('player',path,'GET',undefined,{Accept:media,'If-None-Match':etag})).status,403);
  }finally{await f.close();}
});

test('native files and legacy packages open the same geometry without changing source files; missing resources reject cleanly',async()=>{
  // Node lacks this DOM event; keep the real loaders, fetch and binary resources.
  const progressEvent=globalThis.ProgressEvent;
  globalThis.ProgressEvent=progressEvent||class extends Event{constructor(type,fields={}){super(type);Object.assign(this,fields);}};
  try{
  const native={main:'model.obj',kind:'structure',files:files.map(file=>Object.freeze({name:file.name,blob:new Blob([file.bytes],{type:file.mime})}))};
  const legacy={main:'model.obj',kind:'structure',files:files.map(file=>Object.freeze({name:file.name,data:`data:${file.mime};base64,${file.bytes.toString('base64')}`}))};
  const {createMapAssetBlob,readMapAssetBlob}=await import('../src/components/tabletop/mapAssetTransfer.js');
  const vertices=Buffer.from(new Float32Array([0,0,0,1,0,0,0,0,1]).buffer);
  const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'mesh.bin',byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,0,1]}]};
  const gltf={main:'nested/model.gltf',kind:'structure',files:[{name:'nested/model.gltf',blob:new Blob([JSON.stringify(document)],{type:'model/gltf+json'})},{name:'nested/mesh.bin',blob:new Blob([vertices],{type:'application/octet-stream'})}]};
  const embedded={...document,buffers:[{byteLength:36}]},json=Buffer.from(JSON.stringify(embedded)),jsonLength=Math.ceil(json.length/4)*4;
  const glbBytes=Buffer.alloc(12+8+jsonLength+8+vertices.length);
  glbBytes.writeUInt32LE(0x46546c67,0);glbBytes.writeUInt32LE(2,4);glbBytes.writeUInt32LE(glbBytes.length,8);
  glbBytes.writeUInt32LE(jsonLength,12);glbBytes.writeUInt32LE(0x4e4f534a,16);glbBytes.fill(32,20,20+jsonLength);json.copy(glbBytes,20);
  glbBytes.writeUInt32LE(vertices.length,20+jsonLength);glbBytes.writeUInt32LE(0x004e4942,24+jsonLength);vertices.copy(glbBytes,28+jsonLength);
  const glb={main:'model.glb',kind:'structure',files:[{name:'model.glb',blob:new Blob([glbBytes],{type:'model/gltf-binary'})}]};
  const gltfLegacy={...gltf,files:[{name:'nested/model.gltf',data:`data:model/gltf+json;base64,${Buffer.from(JSON.stringify(document)).toString('base64')}`},{name:'nested/mesh.bin',data:`data:application/octet-stream;base64,${vertices.toString('base64')}`} ]};
  const glbLegacy={...glb,files:[{name:'model.glb',data:`data:model/gltf-binary;base64,${glbBytes.toString('base64')}`} ]};
  const legacyResponse=await readMapAssetBlob(new Blob([JSON.stringify(legacy)],{type:'application/json'}));
  for(const bundle of [native,legacy,legacyResponse,gltf,gltfLegacy,glb,glbLegacy]){
    const root=await loadMapAsset(bundle);try{const box=new Box3().setFromObject(root),size=box.getSize(new Vector3());assert.equal(size.x,5);assert.equal(size.z,5);assert.equal(box.min.y,0);}finally{disposeModel(root);}
  }
  const encoded=createMapAssetBlob(native),decoded=await readMapAssetBlob(encoded);assert.equal(encoded.size,packet().size);
  assert.deepEqual(Buffer.from(await decoded.files[1].blob.arrayBuffer()),files[1].bytes);assert.equal(native.files[0].blob.size,geometry.length);
  const missing={main:'model.obj',kind:'structure',files:[{name:'model.obj',blob:new Blob(['mtllib absent.mtl\n'+geometry.toString()])}]};
  await assert.rejects(loadMapAsset(missing),/Inclua o material/);
  }finally{if(progressEvent)globalThis.ProgressEvent=progressEvent;else delete globalThis.ProgressEvent;}
});
