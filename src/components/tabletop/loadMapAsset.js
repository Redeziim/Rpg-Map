import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {mapAssetDataInfo} from '../../shared/mapAssetTransfer.js';
import {resolveMapResource} from '../../shared/mapAssetResources.js';
import {retainModel,disposeModel} from './modelResources.js';
export {retainModel,disposeModel} from './modelResources.js';

export async function loadMapAsset(bundle,{quality='original',signal}={}){
  if(!['original','light'].includes(quality))throw Error('Escolha uma qualidade válida: Original ou Leve.');
  signal?.throwIfAborted();
  const files=new Map(bundle.files.map(file=>[file.name.toLowerCase(),file])),urls=new Map(),decoded=new Map();let missing='';
  function legacyBytes(file){
    if(!decoded.has(file)){
      const raw=atob(mapAssetDataInfo(file.data).encoded),bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);decoded.set(file,bytes);
    }
    return decoded.get(file);
  }
  const bytes=file=>file.blob?file.blob.arrayBuffer():Promise.resolve(legacyBytes(file).buffer);
  const text=file=>file.blob?file.blob.text():Promise.resolve(new TextDecoder().decode(legacyBytes(file)));
  function fileUrl(file){
    if(!urls.has(file))urls.set(file,URL.createObjectURL(file.blob||new Blob([legacyBytes(file)],{type:mapAssetDataInfo(file.data).mime})));
    return urls.get(file);
  }
  const manager=new THREE.LoadingManager();
  let started=0;const itemStart=manager.itemStart.bind(manager);manager.itemStart=url=>{started++;itemStart(url);};
  let finish;const resources=new Promise(resolve=>{finish=resolve;});
  manager.onLoad=()=>finish();manager.onError=url=>{missing=url;};
  manager.setURLModifier(url=>{
    if(url.startsWith('blob:')){urls.set(url,url);return url;}
    if(url.startsWith('data:'))return url;
    const name=resolveMapResource([...files.keys()],'',url);return fileUrl(files.get(name));
  });
  const main=bundle.files.find(f=>f.name===bundle.main),extension=bundle.main.split('.').pop().toLowerCase();
  if(!main)throw Error('Selecione o arquivo principal do modelo.');
  const base=main.name.slice(0,main.name.lastIndexOf('/')+1);
  let model,wrapper,partialReleased=false;const partial=new THREE.Group(),pending=new Set();
  const capture=value=>{
    if(!value)return value;
    const add=node=>{const entry=new THREE.Object3D();entry.geometry=node.geometry;entry.material=node.material;entry.skeleton=node.skeleton;partial.add(entry);};
    if(value.traverse)value.traverse(add);else add(value.isMaterial?{material:value}:{material:{map:value}});
    return value;
  };
  const track=promise=>{const task=Promise.resolve(promise).then(capture);pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));return task;};
  const settle=async()=>{while(pending.size)await Promise.allSettled([...pending]);if(started)await resources;};
  const cleanup=()=>{if(partialReleased){disposeModel(wrapper);return;}if(model)capture(model);retainModel(partial);if(wrapper)disposeModel(wrapper);else if(model)disposeModel(model);disposeModel(partial);partialReleased=true;};
  try{
    if(['png','jpg','jpeg','webp'].includes(extension)){
      const texture=await track(new THREE.TextureLoader(manager).loadAsync(fileUrl(main)));texture.colorSpace=THREE.SRGBColorSpace;
      const ratio=texture.image.width/texture.image.height;
      model=new THREE.Mesh(new THREE.PlaneGeometry(ratio,1),new THREE.MeshStandardMaterial({map:texture,transparent:true,side:THREE.DoubleSide,roughness:1}));
      model.rotation.x=-Math.PI/2;
    }else if(['glb','gltf'].includes(extension)){
      const loader=new GLTFLoader(manager).register(parser=>({
        name:'GRIM_resource_lifecycle',
        loadMaterial:index=>track(parser.loadMaterial(index)),
        loadMesh:index=>track(parser.loadMesh(index)),
        loadTexture:index=>track(parser.loadTexture(index)),
        afterRoot:result=>{result.scenes.forEach(capture);}
      }));
      model=(await loader.parseAsync(extension==='gltf'?await text(main):await bytes(main),base)).scene;
    }else if(extension==='fbx'){
      const data=await bytes(main),create=URL.createObjectURL;
      // r170 FBX creates URLs even for unused embedded images. Capture only
      // during its synchronous parse, restoring the platform API before yield.
      try{URL.createObjectURL=blob=>{const url=create.call(URL,blob);urls.set(url,url);return url;};model=new FBXLoader(manager).parse(data,base);}
      finally{URL.createObjectURL=create;}
    }
    else{
      const loader=new OBJLoader(manager),source=await text(main);
      const references=[...source.matchAll(/^mtllib\s+(.+)$/gm)].map(match=>match[1].trim());
      let materials;
      try{materials=references.map(reference=>files.get(resolveMapResource([...files.keys()],main.name,reference)));}
      catch(error){throw Error(`Inclua o material na importação. ${error.message}`);}
      if(!materials.length){const fallback=bundle.files.find(file=>file.name.toLowerCase().endsWith('.mtl'));if(fallback)materials=[fallback];}
      const creators=[];
      for(const mtl of materials){const material=new MTLLoader(manager).parse(await text(mtl),mtl.name.slice(0,mtl.name.lastIndexOf('/')+1));creators.push(material);try{material.preload();}finally{Object.values(material.materials).forEach(capture);}}
      if(creators.length)loader.setMaterials({create:name=>creators.findLast(creator=>name in creator.materialsInfo)?.create(name)});
      model=loader.parse(source);
      // Texture requests started by MTL must finish before releasing their URLs.

    }
    await settle();
    if(missing)throw Error('Uma textura não pôde ser carregada. Verifique os arquivos de apoio.');
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty()||![size.x,size.y,size.z].every(Number.isFinite)||Math.max(size.x,size.y,size.z)<=0)throw Error('O arquivo não contém uma geometria visível.');
    const normalized=new THREE.Group();wrapper=new THREE.Group();normalized.add(model);
    const center=bounds.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    normalized.scale.setScalar((bundle.kind==='terrain'?30:5)/Math.max(size.x,size.y,size.z));
    wrapper.add(normalized);
    // Keep the displayed scene, then release unused scenes and MTL/glTF inputs.
    retainModel(wrapper);retainModel(partial);disposeModel(partial);partialReleased=true;
    signal?.throwIfAborted();
    if(quality==='light')await (await import('./modelQuality.js')).applyModelQuality(wrapper,{signal});
    return retainModel(wrapper);
  }catch(e){await settle();cleanup();throw e;}
  finally{for(const url of new Set(urls.values()))URL.revokeObjectURL(url);decoded.clear();}
}
