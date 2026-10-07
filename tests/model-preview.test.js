import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createApplication} from '../server/app.js';
import {createMapAssetBlob,readMapAssetBlob} from '../src/components/tabletop/mapAssetTransfer.js';
import {loadMapAsset,disposeModel} from '../src/components/tabletop/loadMapAsset.js';
import {loadModelPreview} from '../src/components/tabletop/loadModelPreview.js';
import {Box3,Vector3,Scene} from 'three';

const geometry='v 0 0 0\nv 2 0 0\nv 0 1 0\nv 0 0 2\nf 1 2 3\nf 1 4 2\n';
const bundle=placement=>({main:'preview.obj',kind:'structure',files:[{name:'preview.obj',blob:new Blob([geometry])}],...(placement?{placement}:{})});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-preview-')),cookies={},users={};let app,base;
  async function start(){app=createApplication({dbPath:join(directory,'review.sqlite'),exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const closed=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await closed;app=null;}
  async function call(who,path,method='GET',data,headers={}){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data&&!(data instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},body:data instanceof Blob?data:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return response;}
  await start();for(const who of ['owner','master','player']){const response=await call(who,'/auth/register','POST',{username:who,password:'local-preview-review'});users[who]=(await response.json()).id;}
  const root='/rooms/'+(await (await call('owner','/rooms','POST',{name:'Prévia descartável'})).json()).id;
  for(const [who,role]of [['master','master'],['player','player']])assert.equal((await call('owner',root+'/members','POST',{username:who,role})).status,200);
  return {root,users,call,start,stop,async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('publishing a preview keeps its shown position, rotation and scale without changing the original package',async()=>{
  const f=await fixture(),placement={position:[12,3,-8],rotation:[0,Math.PI/2,0],scale:[2,1,3]};let preview,confirmed;
  try{
    preview=await loadMapAsset(bundle());preview.position.fromArray(placement.position);preview.rotation.set(...placement.rotation);preview.scale.fromArray(placement.scale);
    const bounds=new Box3().setFromObject(preview);assert.deepEqual(bounds.getSize(new Vector3()).toArray().map(v=>Math.round(v*100)/100),[15,2.5,10]);
    const prepared=await (await f.call('master',f.root+'/map-imports','POST',{})).json();
    const response=await f.call('master',f.root+'/map-assets?importId='+prepared.id,'POST',createMapAssetBlob(bundle(placement)));assert.equal(response.status,201);
    const published=await response.json(),item=published.state.mapObjects[0];assert.deepEqual(item.position,placement.position);assert.deepEqual(item.rotation,placement.rotation);assert.deepEqual(item.scale,placement.scale);
    const source=await (await f.call('player',f.root+'/map-assets/'+item.assetId,'GET',undefined,{Accept:'application/vnd.grimorio.map-asset'})).blob(),download=await readMapAssetBlob(source);
    assert.equal(download.placement,undefined);assert.equal(await download.files[0].blob.text(),geometry);
    confirmed=await loadMapAsset(download);confirmed.position.fromArray(item.position);confirmed.rotation.set(...item.rotation);confirmed.scale.fromArray(item.scale);
    const actual=new Box3().setFromObject(confirmed);assert.ok(actual.min.distanceTo(bounds.min)<1e-8);assert.ok(actual.max.distanceTo(bounds.max)<1e-8);
    assert.equal(published.import.phase,'confirmed');assert.equal(published.state.mapObjects.length,1);
  }finally{if(preview)disposeModel(preview);if(confirmed)disposeModel(confirmed);await f.close();}
});

test('local previews show their placement, can be cancelled and recreated, and do not publish or retain their released resources',async()=>{
  const f=await fixture(),scene=new Scene(),placement={position:[10,2,-4],rotation:[0,0,0],scale:[2,1,1]};
  try{
    const before=await (await f.call('player',f.root)).json();
    for(let cycle=0;cycle<4;cycle++){
      const preview=await loadModelPreview(bundle(),{placement});scene.add(preview);
      assert.deepEqual(new Box3().setFromObject(preview).getSize(new Vector3()).toArray(),[10,2.5,5]);
      assert.deepEqual(new Box3().setFromObject(preview).min.toArray(),[5,2,-6.5]);
      let disposed=0,count=0;const resources=new Set();preview.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[])resources.add(material);});
      for(const resource of resources){count++;resource.addEventListener('dispose',()=>disposed++);}
      scene.remove(preview);disposeModel(preview);disposeModel(preview);assert.equal(disposed,count);assert.equal(scene.children.length,0);
    }
    const controller=new AbortController(),pending=loadModelPreview(bundle(),{placement,signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
    const after=await (await f.call('player',f.root)).json();assert.equal(after.revision,before.revision);assert.deepEqual(after.state.mapObjects,[]);
    const exported=await (await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).json();assert.deepEqual((await (await f.call('owner',exported.downloadUrl.replace(/^\/api/,''))).json()).assets.models,[]);
  }finally{await f.close();}
});

test('changed access or invalid preview values refuse publication; a valid placement survives export and restart',async()=>{
  const f=await fixture(),placement={position:[7,1,9],rotation:[0,.5,0],scale:[1.5,1.5,1.5]},source=bundle(placement),packet=createMapAssetBlob(source);
  try{
    await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'});
    assert.equal((await f.call('master',f.root+'/map-assets','POST',packet)).status,403);
    assert.equal((await f.call('player',f.root+'/map-assets','POST',packet)).status,403);
    assert.equal((await f.call('owner',f.root+'/map-assets?mapViewMode=player','POST',packet)).status,403);
    const legacy={main:source.main,kind:source.kind,files:[{name:source.main,data:'data:text/plain;base64,'+Buffer.from(geometry).toString('base64')}]};
    for(const invalid of [{...placement,scale:[0,1,1]},{...placement,position:[10001,0,0]},{...placement,rotation:[null,0,0]},{position:[0,0,0]},{...placement,unexpected:true}])assert.equal((await f.call('owner',f.root+'/map-assets','POST',{...legacy,placement:invalid})).status,400);
    assert.equal((await (await f.call('owner',f.root)).json()).state.mapObjects.length,0);assert.equal(await source.files[0].blob.text(),geometry);
    const created=await f.call('owner',f.root+'/map-assets','POST',packet);assert.equal(created.status,201);const item=(await created.json()).state.mapObjects[0];
    const exported=await (await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).json(),portable=await (await f.call('owner',exported.downloadUrl.replace(/^\/api/,''))).json();
    assert.deepEqual(portable.state.mapObjects[0].position,placement.position);assert.deepEqual(portable.state.mapObjects[0].scale,placement.scale);
    await f.stop();await f.start();const restored=await (await f.call('player',f.root)).json();assert.equal(restored.state.mapObjects.length,1);assert.deepEqual(restored.state.mapObjects[0],item);
    const oldClient=await f.call('owner',f.root+'/map-assets','POST',createMapAssetBlob(bundle()));assert.equal(oldClient.status,201);assert.deepEqual((await oldClient.json()).state.mapObjects[1].position,[0,0,0]);
  }finally{await f.close();}
});
