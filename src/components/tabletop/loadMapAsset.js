import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';

export function disposeModel(root){
  const textures=new Set(),materials=new Set(),geometries=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
export async function loadMapAsset(bundle){
  const urls=new Map(),blobs=[];let missing='';
  for(const file of bundle.files){
    const [header,base64]=file.data.split(',');
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:header.slice(5).split(';')[0]||'application/octet-stream'}));
    urls.set(file.name.toLowerCase(),url);blobs.push(url);
  }
  const manager=new THREE.LoadingManager();
  let started=0;const itemStart=manager.itemStart.bind(manager);manager.itemStart=url=>{started++;itemStart(url);};
  let finish;const resources=new Promise(resolve=>{finish=resolve;});
  manager.onLoad=()=>finish();manager.onError=url=>{missing=url;};
  manager.setURLModifier(url=>{
    if(url.startsWith('data:')||url.startsWith('blob:'))return url;
    const path=decodeURIComponent(url).replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();
    const exact=urls.get(path);if(exact)return exact;
    const matches=[...urls].filter(([name])=>name.split('/').pop()===path.split('/').pop());
    if(matches.length===1)return matches[0][1];
    throw Error(`Arquivo de apoio ausente: ${path.split('/').pop()}. Selecione o modelo junto com os materiais e texturas.`);
  });
  const main=bundle.files.find(f=>f.name===bundle.main),extension=bundle.main.split('.').pop().toLowerCase();
  const bytes=Uint8Array.from(atob(main.data.split(',')[1]),c=>c.charCodeAt(0));
  let model;
  try{
    if(['png','jpg','jpeg','webp'].includes(extension)){
      const texture=await new THREE.TextureLoader(manager).loadAsync(urls.get(main.name.toLowerCase()));texture.colorSpace=THREE.SRGBColorSpace;
      const ratio=texture.image.width/texture.image.height;
      model=new THREE.Mesh(new THREE.PlaneGeometry(ratio,1),new THREE.MeshStandardMaterial({map:texture,transparent:true,side:THREE.DoubleSide,roughness:1}));
      model.rotation.x=-Math.PI/2;
    }else if(['glb','gltf'].includes(extension)){
      model=(await new GLTFLoader(manager).parseAsync(extension==='gltf'?new TextDecoder().decode(bytes):bytes.buffer,'')).scene;
    }else if(extension==='fbx')model=new FBXLoader(manager).parse(bytes.buffer,'');
    else{
      const loader=new OBJLoader(manager),text=new TextDecoder().decode(bytes);
      const mtlName=text.match(/^mtllib\s+(.+)$/m)?.[1]?.trim();
      const mtl=bundle.files.find(f=>f.name.toLowerCase()===mtlName?.toLowerCase())||bundle.files.find(f=>f.name.toLowerCase().endsWith('.mtl'));
      if(mtlName&&!mtl)throw Error(`Inclua o material ${mtlName} na importação.`);
      if(mtl){const material=new MTLLoader(manager).parse(atob(mtl.data.split(',')[1]),'');material.preload();loader.setMaterials(material);}
      model=loader.parse(text);
      // Texture requests started by MTL must finish before releasing their URLs.

    }
    if(started)await resources;
    if(missing)throw Error('Uma textura não pôde ser carregada. Verifique os arquivos de apoio.');
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty()||![size.x,size.y,size.z].every(Number.isFinite)||Math.max(size.x,size.y,size.z)<=0)throw Error('O arquivo não contém uma geometria visível.');
    const normalized=new THREE.Group(),wrapper=new THREE.Group();normalized.add(model);
    const center=bounds.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    normalized.scale.setScalar((bundle.kind==='terrain'?30:5)/Math.max(size.x,size.y,size.z));
    wrapper.add(normalized);return wrapper;
  }catch(e){if(model)disposeModel(model);throw e;}
  finally{blobs.forEach(url=>URL.revokeObjectURL(url));}
}
