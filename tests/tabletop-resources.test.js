import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMapAsset,disposeModel} from '../src/components/tabletop/loadMapAsset.js';
import * as THREE from 'three';
import * as resources from '../src/components/tabletop/loadMapAsset.js';

const bundle={main:'triangle.obj',kind:'structure',files:[{name:'triangle.obj',blob:new Blob(['v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3\n'])}]};
test('repeated model lifecycles release real geometry and materials once, including repeated cleanup',async()=>{
  for(let cycle=0;cycle<5;cycle++){
    const root=await loadMapAsset(bundle),events=new Map();
    root.traverse(node=>{for(const resource of [node.geometry,...(node.material?Array.isArray(node.material)?node.material:[node.material]:[])])if(resource&&!events.has(resource)){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}});
    disposeModel(root);disposeModel(root);assert.ok(events.size>=2);
    for(const releases of events.values())assert.equal(releases,1,'each owned resource is released once');
  }
});
test('failed and cancelled real GLTF loads close decoded images and revoke temporary URLs, including late delivery',async()=>{
  const oldBitmap=globalThis.createImageBitmap,oldSelf=globalThis.self,oldProgress=globalThis.ProgressEvent;
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL,live=new Set();let decoded=0,closed=0,arrived,release;
  globalThis.self=globalThis;globalThis.ProgressEvent=oldProgress||class extends Event{constructor(type,fields){super(type);Object.assign(this,fields);}};
  URL.createObjectURL=blob=>{const url=create.call(URL,blob);live.add(url);return url;};URL.revokeObjectURL=url=>{live.delete(url);revoke.call(URL,url);};
  globalThis.createImageBitmap=async()=>{decoded++;arrived();await new Promise(resolve=>{release=resolve;});return {width:2,height:2,close:()=>closed++};};
  const positions=Buffer.from(new Float32Array([0,0,0,1,0,0,0,0,1]).buffer);
  const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[{uri:'pixel.png'}],buffers:[{uri:`data:application/octet-stream;base64,${positions.toString('base64')}`,byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,0,1]}]};
  const packaged=doc=>({main:'scene.gltf',kind:'structure',files:[{name:'scene.gltf',blob:new Blob([JSON.stringify(doc)])},{name:'pixel.png',blob:new Blob(['decoded by the image boundary'])}]});
  try{
    for(const failure of ['parse','abort']){
      const controller=new AbortController(),called=new Promise(resolve=>{arrived=resolve;});
      const doc=structuredClone(document);if(failure==='parse')doc.meshes[0].primitives.push({attributes:{POSITION:99},material:0});
      const pending=loadMapAsset(packaged(doc),{signal:controller.signal});const rejected=assert.rejects(pending,failure==='abort'?{name:'AbortError'}:undefined);
      await called;if(failure==='abort')controller.abort();release();await rejected;
      assert.equal(closed,decoded,'an image decoded before failure or delivered after cancellation is closed');assert.equal(live.size,0);
    }
  }finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;for(const url of live)revoke.call(URL,url);if(oldBitmap)globalThis.createImageBitmap=oldBitmap;else delete globalThis.createImageBitmap;if(oldSelf)globalThis.self=oldSelf;else delete globalThis.self;if(oldProgress)globalThis.ProgressEvent=oldProgress;else delete globalThis.ProgressEvent;}
});
test('shared geometry, textures and bitmap images remain alive until their last model is removed',async()=>{
  const first=await loadMapAsset(bundle);let closed=0;
  const image={width:2,height:2,close:()=>closed++},texture=new THREE.Texture(image);
  const mesh=first.children[0].children[0].children[0];mesh.material.map=texture;
  const second=first.clone(true),third=first.clone(true);
  third.children[0].children[0].children[0].material=mesh.material.clone();
  third.children[0].children[0].children[0].material.map=texture.clone();
  resources.retainModel(first);resources.retainModel(second);resources.retainModel(third);
  const releases=new Map();for(const item of [mesh.geometry,mesh.material,texture]){releases.set(item,0);item.addEventListener('dispose',()=>releases.set(item,releases.get(item)+1));}
  disposeModel(first);assert.deepEqual([...releases.values()],[0,0,0]);assert.equal(closed,0);
  disposeModel(second);assert.deepEqual([...releases.values()],[0,1,1]);assert.equal(closed,0);
  disposeModel(third);assert.deepEqual([...releases.values()],[1,1,1]);assert.equal(closed,1);
  disposeModel(third);assert.equal(closed,1);
  let uniformsClosed=0;const uniformImage={width:2,height:2,close:()=>uniformsClosed++};
  const skin=new THREE.SkinnedMesh(new THREE.BufferGeometry(),new THREE.ShaderMaterial({uniforms:{layers:{value:[new THREE.Texture(uniformImage)]}}}));
  skin.skeleton=new THREE.Skeleton([new THREE.Bone()]);const clone=skin.clone();
  resources.retainModel(skin);resources.retainModel(clone);skin.skeleton.computeBoneTexture();let bonesReleased=0;
  skin.skeleton.boneTexture.addEventListener('dispose',()=>bonesReleased++);
  disposeModel(skin);assert.equal(bonesReleased,0);assert.equal(uniformsClosed,0);
  disposeModel(clone);assert.equal(bonesReleased,1);assert.equal(uniformsClosed,1,'shader uniform images are also released');
});
