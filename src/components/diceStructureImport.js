import * as THREE from 'three';
import {unzipSync,strFromU8} from 'three/examples/jsm/libs/fflate.module.js';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeModel} from './tabletop/loadMapAsset.js';
function parse3MF(buffer){
  const zip=unzipSync(new Uint8Array(buffer)),models=new Map();
  for(const [path,bytes]of Object.entries(zip))if(path.endsWith('.model'))models.set(path,new DOMParser().parseFromString(strFromU8(bytes),'application/xml'));
  const rel=zip['_rels/.rels'];const entry=rel?new DOMParser().parseFromString(strFromU8(rel),'application/xml').getElementsByTagName('Relationship')[0]?.getAttribute('Target')?.replace(/^\//,''):null;
  const rootPath=entry||'3D/3dmodel.model',root=models.get(rootPath);if(!root)throw Error('O arquivo 3MF não contém um modelo.');
  const transform=node=>{const t=node.getAttribute('transform')?.trim().split(/\s+/).map(Number);return t?.length===12?new THREE.Matrix4().set(t[0],t[3],t[6],t[9],t[1],t[4],t[7],t[10],t[2],t[5],t[8],t[11],0,0,0,1):new THREE.Matrix4();};
  function build(path,id,depth=0){
    if(depth>16)throw Error('Modelo 3MF muito complexo.');
    const doc=models.get(path),obj=[...(doc?.getElementsByTagName('object')||[])].find(o=>o.getAttribute('id')===id);if(!obj)throw Error('Peça 3MF ausente.');
    const group=new THREE.Group(),mesh=obj.getElementsByTagName('mesh')[0];
    if(mesh){const positions=[...mesh.getElementsByTagName('vertex')].flatMap(v=>['x','y','z'].map(a=>Number(v.getAttribute(a))));const indices=[...mesh.getElementsByTagName('triangle')].flatMap(v=>['v1','v2','v3'].map(a=>Number(v.getAttribute(a))));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));}
    for(const c of obj.getElementsByTagName('component')){const p=c.getAttribute('p:path')?.replace(/^\//,'')||path;const child=build(p,c.getAttribute('objectid'),depth+1);child.applyMatrix4(transform(c));group.add(child);}
    return group;
  }
  const scene=new THREE.Group();for(const item of root.getElementsByTagName('item')){const node=build(rootPath,item.getAttribute('objectid'));node.applyMatrix4(transform(item));scene.add(node);}scene.rotation.x=-Math.PI/2;return scene;
}
export async function importDiceStructure(file){
  if(file.size>30*1024*1024)throw Error('Use um modelo com até 30 MB.');
  const buffer=await file.arrayBuffer(),ext=file.name.split('.').pop().toLowerCase();let model;
  try{
    if(ext==='3mf')model=parse3MF(buffer);
    else if(ext==='stl'){model=new THREE.Mesh(new STLLoader().parse(buffer),new THREE.MeshStandardMaterial());model.rotation.x=-Math.PI/2;}
    else if(ext==='obj')model=new OBJLoader().parse(new TextDecoder().decode(buffer));
    else if(ext==='glb'){
      const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw Error('Use GLB com todos os recursos incorporados.');});
      model=(await new GLTFLoader(manager).parseAsync(buffer,'')).scene;
    }else throw Error('Use 3MF, STL, OBJ ou GLB.');
    model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const scale=14/Math.max(size.x,size.y,size.z);if(!Number.isFinite(scale)||box.isEmpty())throw Error('O arquivo não contém geometria.');
    const vertices=[],triangles=[];model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index;const offset=vertices.length;
      for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);vertices.push([+( (v.x-center.x)*scale).toFixed(5),+((v.y-box.min.y)*scale).toFixed(5),+((v.z-center.z)*scale).toFixed(5)]);}
      for(let i=0;i<(index?index.count:p.count);i+=3)triangles.push([0,1,2].map(j=>offset+(index?index.getX(i+j):i+j)));
    });
    if(triangles.length>60000||vertices.length>180000)throw Error('Modelo muito detalhado. Reduza para até 60 mil triângulos.');
    const top=vertices.filter(v=>v[1]>size.y*scale*.9);const bounds=new THREE.Box3().setFromPoints(top.map(v=>new THREE.Vector3(...v))),opening=bounds.getCenter(new THREE.Vector3());
    return {name:file.name.slice(0,120),vertices,triangles,spawn:[opening.x,size.y*scale+2.5,opening.z]};
  }finally{if(model)disposeModel(model);}
}
