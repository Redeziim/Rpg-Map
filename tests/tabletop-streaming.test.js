import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {PerspectiveCamera,Scene,Mesh,SphereGeometry,MeshStandardMaterial,Box3,Vector3} from 'three';
import {OBJExporter} from 'three/examples/jsm/exporters/OBJExporter.js';
import {createMapAssetBlob,readMapAssetBlob} from '../src/components/tabletop/mapAssetTransfer.js';
import {createSceneStream} from '../src/components/tabletop/sceneStreaming.js';
import {retainModel,disposeModel} from '../src/components/tabletop/modelResources.js';

const item=(id,position=[0,0,0])=>({id,assetId:id,name:id,kind:'structure',position,rotation:[0,0,0],scale:[1,1,1]});
const view=(position=[0,4,20],target=[0,0,0])=>{const camera=new PerspectiveCamera(45,1,.05,20000);camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld();return camera;};
async function until(predicate,message){const end=Date.now()+3000;while(!predicate()){assert.ok(Date.now()<end,message);await new Promise(resolve=>setTimeout(resolve,5));}}
async function fixture({dense=false,held=true}={}){
  let source='v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
  if(dense){const mesh=new Mesh(new SphereGeometry(1,64,32),new MeshStandardMaterial());source=new OBJExporter().parse(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  const blob=createMapAssetBlob({main:'model.obj',kind:'structure',files:[{name:'model.obj',blob:new Blob([source])}]}),bytes=Buffer.from(await blob.arrayBuffer());
  const requests=[],open=new Map(),errors=new Set();let maximum=0;
  const server=createServer((request,response)=>{
    const id=request.url.slice(1);requests.push(id);open.set(id,response);maximum=Math.max(maximum,open.size);
    response.once('close',()=>{if(open.get(id)===response)open.delete(id);});
    if(errors.has(id)){response.writeHead(503);response.end('Unavailable');return;}
    const finish=()=>{response.setHeader('Content-Type',blob.type);response.end(bytes);};
    response.finishAsset=finish;if(!held)finish();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const fetchBundle=async(object,signal)=>{const response=await fetch(base+'/'+object.assetId,{signal});if(!response.ok)throw Error(`HTTP ${response.status}`);return readMapAssetBlob(await response.blob());};
  return {requests,open,errors,source,fetchBundle,get maximum(){return maximum;},release(id){open.get(id)?.finishAsset();},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

test('scene loads selected and visible nearby objects first through HTTP, with at most two loads and distant objects deferred',async()=>{
  const f=await fixture(),scene=new Scene(),stream=createSceneStream({fetchBundle,onModel:(id,model)=>scene.add(model),onRemove:(id,model)=>scene.remove(model)});
  function fetchBundle(object,signal){return f.fetchBundle(object,signal);}
  try{
    stream.update({objects:[item('far',[5000,0,0]),item('near-b',[3,0,0]),item('selected',[1000,0,0]),item('near-a')],selected:['selected'],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>f.requests.length>=2,'two first HTTP requests arrive');
    assert.deepEqual(new Set(f.requests),new Set(['selected','near-a']));assert.equal(stream.getSnapshot().active,2);
    f.release('selected');await until(()=>f.requests.includes('near-b'),'the next visible object loads as a slot opens');
    f.release('near-a');f.release('near-b');await until(()=>stream.getSnapshot().pending===0,'visible scene completes');
    assert.equal(f.maximum,2);assert.equal(stream.models.size,3);assert.equal(scene.children.length,3);assert.equal(stream.getSnapshot().deferred,1);assert.ok(!f.requests.includes('far'));
  }finally{stream.dispose();await f.close();}
});

test('camera, selection, quality and teardown reprioritize real HTTP loads without publishing abandoned models or errors',async()=>{
  const f=await fixture(),scene=new Scene(),errors=[],stream=createSceneStream({fetchBundle:f.fetchBundle,onModel:(id,model)=>scene.add(model),onRemove:(id,model)=>scene.remove(model),onError:(item,error)=>errors.push(error)});
  const objects=[item('near-a'),item('near-b',[3,0,0]),item('far',[5000,0,0])];
  try{
    stream.update({objects,selected:[],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>f.open.size===2,'near loads start');
    stream.update({objects,selected:[],camera:view(),quality:'original',qualityMode:'original',reserve:1});
    await until(()=>f.open.size===1&&stream.getSnapshot().active===1,'private preview reservation frees one physical slot');
    stream.update({objects,selected:[],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>f.open.size===2,'normal concurrency resumes after preview');
    stream.update({objects,selected:['far'],camera:view([5000,4,20],[5000,0,0]),quality:'original',qualityMode:'original'});
    await until(()=>f.open.has('far'),'selected object takes the released slot');
    assert.ok(!f.open.has('near-a'));assert.ok(!f.open.has('near-b'));f.release('far');
    await until(()=>stream.models.has('far'),'the selected object reaches the scene');assert.deepEqual([...stream.models.keys()],['far']);
    stream.update({objects,selected:[],camera:view(),quality:'light',qualityMode:'light',paused:true});
    assert.equal(stream.models.size,0);assert.equal(stream.getSnapshot().active,0);
    stream.update({objects,selected:[],camera:view(),quality:'light',qualityMode:'light'});
    await until(()=>f.open.size===2,'loading resumes in current camera');
    stream.update({objects,selected:[],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>f.requests.filter(id=>id==='near-a').length===3,'new quality replaces both old loads');
    f.release('near-a');f.release('near-b');await until(()=>stream.getSnapshot().pending===0,'only the new quality reaches the scene');
    assert.equal(stream.models.size,2);assert.equal(scene.children.length,2);assert.deepEqual(errors,[]);assert.ok(f.maximum<=2);
    f.errors.add('bad');stream.update({objects:[...objects,item('bad')],selected:['bad'],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>stream.getSnapshot().failed===1,'real HTTP failure is reported once');assert.equal(errors.length,1);assert.match(errors[0].message,/503/);
    f.errors.clear();stream.retry();await until(()=>f.open.has('bad'),'explicit retry starts a fresh HTTP request');f.release('bad');await until(()=>stream.models.has('bad'),'recovered model becomes visible');assert.equal(stream.getSnapshot().failed,0);
    stream.update({objects:[...objects,item('late',[0,0,1])],selected:['late'],camera:view(),quality:'original',qualityMode:'original'});
    await until(()=>f.open.has('late'),'late load starts');stream.dispose();
    await until(()=>!f.open.has('late'),'teardown aborts the pending HTTP response');assert.equal(scene.children.length,0);assert.equal(stream.models.size,0);assert.equal(errors.length,1,'cancellation is not reported as an error');
  }finally{stream.dispose();await f.close();}
});

test('real distant geometry uses fewer triangles, restores near or selected detail, and keeps originals and shared resources until last disposal',async()=>{
  const f=await fixture({dense:true,held:false}),scene=new Scene(),stream=createSceneStream({fetchBundle:f.fetchBundle,onModel:(id,model)=>scene.add(model),onRemove:(id,model)=>scene.remove(model)});
  const objects=[item('lod')],triangles=()=>{let value=0;scene.traverseVisible(node=>{if(node.isMesh)value+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;});return value;};
  let clone;
  try{
    stream.update({objects,selected:[],camera:view([0,6,120]),quality:'original',qualityMode:'auto'});
    await until(()=>stream.models.has('lod')&&stream.getSnapshot().pending===0,'distance representation finishes');
    const root=stream.models.get('lod');assert.ok(triangles()<1200,`${triangles()} distant triangles`);assert.equal(scene.children.length,1);
    stream.update({objects,selected:[],camera:view([0,4,12]),quality:'original',qualityMode:'auto'});
    assert.equal(triangles(),3968);assert.equal(stream.models.get('lod'),root);
    const bounds=new Box3().setFromObject(root).getSize(new Vector3());assert.ok(Math.abs(bounds.x-5)<.1);assert.ok(Math.abs(bounds.y-5)<.1);
    stream.update({objects,selected:[],camera:view([0,6,120]),quality:'original',qualityMode:'auto'});assert.ok(triangles()<1200);
    stream.update({objects,selected:['lod'],camera:view([0,6,120]),quality:'original',qualityMode:'auto'});assert.equal(triangles(),3968);
    stream.update({objects,selected:[],camera:view([0,6,120]),quality:'original',qualityMode:'original'});assert.equal(triangles(),3968);assert.equal(f.requests.length,1,'camera and selection do not download again');
    const original=await f.fetchBundle(objects[0]);assert.equal(await original.files[0].blob.text(),f.source,'canonical HTTP package is unchanged');
    const releases=new Map();root.traverse(node=>{for(const resource of [node.geometry,...(node.material?Array.isArray(node.material)?node.material:[node.material]:[])])if(resource&&!releases.has(resource)){releases.set(resource,0);resource.addEventListener('dispose',()=>releases.set(resource,releases.get(resource)+1));}});
    clone=retainModel(root.clone(true));stream.dispose();assert.equal(scene.children.length,0);assert.ok(releases.size>=3);assert.ok([...releases.values()].every(count=>count===0),'the remaining clone owns both representations');
    disposeModel(clone);clone=null;assert.ok([...releases.values()].every(count=>count===1),'all resources release exactly once');
  }finally{if(clone)disposeModel(clone);stream.dispose();await f.close();}
});
