import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,SphereGeometry,MeshStandardMaterial,Box3,Vector3} from 'three';
import {OBJExporter} from 'three/examples/jsm/exporters/OBJExporter.js';
import {loadMapAsset,disposeModel} from '../src/components/tabletop/loadMapAsset.js';

function denseBundle(segments=64){
  const mesh=new Mesh(new SphereGeometry(1,segments,segments/2),new MeshStandardMaterial());
  const source=new OBJExporter().parse(mesh);mesh.geometry.dispose();mesh.material.dispose();
  return {main:'sphere.obj',kind:'structure',files:[{name:'sphere.obj',blob:new Blob([source],{type:'text/plain'})}]};
}
function counts(root){let vertices=0,triangles=0;root.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {vertices,triangles};}

test('Leve displays fewer triangles and vertex bytes, retains scale, and Original can reopen unchanged',async()=>{
  const bundle=denseBundle(),source=await bundle.files[0].blob.text(),original=await loadMapAsset(bundle),light=await loadMapAsset(bundle,{quality:'light'});
  try{
    const full=counts(original),reduced=counts(light);
    assert.ok(reduced.triangles<full.triangles*.7,`${reduced.triangles} versus ${full.triangles}`);
    assert.ok(reduced.vertices<full.vertices);
    const size=new Box3().setFromObject(light).getSize(new Vector3());assert.ok(Math.abs(size.x-5)<.1);assert.ok(Math.abs(size.y-5)<.1);
    assert.equal(await bundle.files[0].blob.text(),source);
    const reopened=await loadMapAsset(bundle,{quality:'original'});try{assert.deepEqual(counts(reopened),full);}finally{disposeModel(reopened);}
  }finally{disposeModel(original);disposeModel(light);}
});

test('Leve reduces heavier models more relative to their original while keeping the silhouette and source intact',async()=>{
  const bundle=denseBundle(512),source=await bundle.files[0].blob.text(),original=await loadMapAsset(bundle),light=await loadMapAsset(bundle,{quality:'light'});
  try{
    const full=counts(original),reduced=counts(light);assert.ok(full.triangles>250000);
    assert.ok(reduced.triangles<full.triangles*.3,`${reduced.triangles} versus ${full.triangles}`);
    const size=new Box3().setFromObject(light).getSize(new Vector3());for(const value of size)assert.ok(Math.abs(value-5)<.1);
    assert.equal(await bundle.files[0].blob.text(),source);
    const restored=await loadMapAsset(bundle,{quality:'original'});try{assert.deepEqual(counts(restored),full);}finally{disposeModel(restored);}
  }finally{disposeModel(original);disposeModel(light);}
});

test('quality changes reject invalid options, cancel abandoned loads and preserve deformable GLTF geometry',async()=>{
  await assert.rejects(loadMapAsset(denseBundle(),{quality:'ultra'}),/qualidade/i);
  const controller=new AbortController();controller.abort();await assert.rejects(loadMapAsset(denseBundle(),{quality:'light',signal:controller.signal}),{name:'AbortError'});
  const later=new AbortController(),pending=loadMapAsset(denseBundle(),{quality:'light',signal:later.signal});later.abort();await assert.rejects(pending,{name:'AbortError'});
  const previous=globalThis.ProgressEvent;globalThis.ProgressEvent=previous||class extends Event{constructor(type,fields={}){super(type);Object.assign(this,fields);}};
  const buffer=Buffer.from(new Float32Array([0,0,0,1,0,0,0,0,1,0,.1,0,0,.1,0,0,.1,0]).buffer);
  const document={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},targets:[{POSITION:1}]}]}],buffers:[{uri:`data:application/octet-stream;base64,${buffer.toString('base64')}`,byteLength:72}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,0,1]},{bufferView:1,componentType:5126,count:3,type:'VEC3',min:[0,.1,0],max:[0,.1,0]}]};
  try{
    const root=await loadMapAsset({main:'pose.gltf',kind:'structure',files:[{name:'pose.gltf',blob:new Blob([JSON.stringify(document)])}]},{quality:'light'});
    try{assert.equal(counts(root).triangles,1);let morph;root.traverse(o=>{if(o.isMesh)morph=o.geometry.morphAttributes.position;});assert.equal(morph[0].count,3);assert.equal(root.userData.qualityReport.skipped,1);}finally{disposeModel(root);}
  }finally{if(previous)globalThis.ProgressEvent=previous;else delete globalThis.ProgressEvent;}
});

test('automatic quality adapts to device and sustained load while manual choices and personal storage prevail',async()=>{
  const {createQualityController,readQualityPreference,writeQualityPreference}=await import('../src/components/tabletop/qualityPolicy.js');
  const small=createQualityController({hardware:{memory:2,cores:2,maxTextureSize:2048}});assert.equal(small.quality,'light');
  const strong=createQualityController({hardware:{memory:8,cores:12,maxTextureSize:16384}});assert.equal(strong.quality,'original');
  strong.observeComplexity({triangles:600000,texturePixels:0});assert.equal(strong.quality,'light');
  strong.setMode('original');strong.observeComplexity({triangles:900000,texturePixels:50000000});for(let i=0;i<40;i++)strong.observeRender(60);assert.equal(strong.quality,'original');
  strong.setMode('auto');for(let i=0;i<10;i++)strong.observeRender(60);assert.equal(strong.quality,'original','a single short burst does not change quality');
  for(let i=0;i<30;i++)strong.observeRender(60);assert.equal(strong.quality,'light');
  for(let i=0;i<100;i++)strong.observeRender(1);assert.equal(strong.quality,'light','automatic mode does not oscillate');
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  writeQualityPreference('one','room','light',storage);assert.equal(readQualityPreference('one','room',storage),'light');
  assert.equal(readQualityPreference('two','room',storage),'auto');assert.equal(readQualityPreference('one','other',storage),'auto');
  const unavailable={getItem(){throw Error('full');},setItem(){throw Error('full');}};assert.equal(readQualityPreference('one','room',unavailable),'auto');assert.equal(writeQualityPreference('one','room','original',unavailable),false);
});
