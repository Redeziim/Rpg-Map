import {BufferAttribute,BufferGeometry,Float32BufferAttribute} from 'three';
import {retainModel} from './modelResources.js';

function cancelled(signal){signal?.throwIfAborted();}
async function simplify(data,signal){
  cancelled(signal);
  if(typeof Worker==='undefined')return (await import('./simplifyGeometry.js')).simplifyGeometry(data);
  return new Promise((resolve,reject)=>{
    let worker,timer;
    const finish=(error,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(signal.reason);
    try{
      worker=new Worker(new URL('./qualityWorker.js',import.meta.url),{type:'module'});
      worker.onmessage=event=>event.data.error?finish(Error(event.data.error)):finish(null,event.data.result);
      worker.onerror=()=>finish(Error('Simplificação indisponível.'));
      timer=setTimeout(()=>finish(Error('A simplificação demorou demais.')),10000);
      signal?.addEventListener('abort',abort,{once:true});
      worker.postMessage(data,[...(data.index?[data.index.buffer]:[]),...Object.values(data.attributes).map(a=>a.array.buffer)]);
    }catch(error){finish(error);}
  });
}
export function modelQualityStats(root){
  let vertices=0,triangles=0,texturePixels=0;const textures=new Set();
  root.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
  for(const texture of textures)texturePixels+=(texture.image?.width||0)*(texture.image?.height||0);
  return {vertices,triangles,texturePixels};
}
export async function applyModelQuality(root,{signal,ratio,error=.01,geometryOnly=false}={}){
  if(ratio!==undefined&&(!Number.isFinite(ratio)||ratio<=0||ratio>=1)||!Number.isFinite(error)||error<=0)throw Error('Redução de geometria inválida.');
  cancelled(signal);retainModel(root);const before=modelQualityStats(root),meshes=[],textures=new Set(),geometries=new Map();let skipped=0;
  // Relative to this source: small models retain half their faces; dense models
  // aim at a smaller share, with a 10% floor and the same silhouette error bound.
  const geometryRatio=ratio??Math.max(.1,Math.min(.5,60000/Math.max(1,before.triangles)));
  try{
  root.traverse(o=>{if(o.isMesh)meshes.push(o);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
  for(const mesh of meshes){
    cancelled(signal);const source=mesh.geometry;
    if(mesh.isSkinnedMesh||Object.keys(source.morphAttributes).length||mesh.isInstancedMesh||source.drawRange.start!==0||Number.isFinite(source.drawRange.count)){skipped++;continue;}
    if(geometries.has(source)){mesh.geometry=geometries.get(source);continue;}
    if((source.index?.count||source.attributes.position.count)<300)continue;
    const attributes={};
    for(const [name,a]of Object.entries(source.attributes)){const array=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.getComponent(i,k);attributes[name]={array,itemSize:a.itemSize};}
    try{
      const data=await simplify({attributes,index:source.index?Uint32Array.from(source.index.array):null,groups:source.groups,ratio:geometryRatio,error},signal);cancelled(signal);
      if(data.index.length>=(source.index?.count||source.attributes.position.count))skipped++;
      const reduced=new BufferGeometry();for(const [name,a]of Object.entries(data.attributes))reduced.setAttribute(name,new Float32BufferAttribute(a.array,a.itemSize));reduced.setIndex(new BufferAttribute(data.index,1));for(const group of data.groups)reduced.addGroup(group.start,group.count,group.materialIndex);reduced.computeBoundingBox();reduced.computeBoundingSphere();
      geometries.set(source,reduced);mesh.geometry=reduced;
    }catch(error){cancelled(signal);skipped++;}
  }
  for(const texture of textures){
    if(geometryOnly)break;
    cancelled(signal);const image=texture.image,width=image?.width,height=image?.height;
    if(!width||!height||Math.max(width,height)<=64)continue;
    if(texture.isDataTexture||texture.isCompressedTexture||texture.isCubeTexture||texture.isVideoTexture){skipped++;continue;}
    try{
      const textureRatio=Math.min(before.texturePixels>16000000?.25:.5,1024/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*textureRatio));canvas.height=Math.max(1,Math.round(height*textureRatio));
      const context=canvas.getContext('2d');if(!context)throw Error('Canvas indisponível.');context.drawImage(image,0,0,canvas.width,canvas.height);
      texture.dispose();texture.image=canvas;texture.needsUpdate=true;
      // A glTF ImageBitmap can be shared by texture objects; close it after all copies.
    }catch{skipped++;}
  }
  root.userData.qualityReport={before,after:modelQualityStats(root),skipped};return root;
  }finally{retainModel(root);}
}
