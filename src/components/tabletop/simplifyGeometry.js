import {MeshoptSimplifier} from 'meshoptimizer/simplifier';

// Runs in a worker in the browser. Input is a copy: source assets are never rewritten.
export async function simplifyGeometry(data){
  await MeshoptSimplifier.ready;
  if(!MeshoptSimplifier.supported)throw Error('Simplificação indisponível neste navegador.');
  const entries=Object.entries(data.attributes),position=data.attributes.position;
  const count=position.array.length/3,unique=new Map(),remap=new Uint32Array(count),original=[];
  // Weld only identical complete vertices, retaining UV, normal and color seams.
  for(let i=0;i<count;i++){
    let key='';for(const [,attribute]of entries)for(let k=0;k<attribute.itemSize;k++)key+=attribute.array[i*attribute.itemSize+k]+',';
    let index=unique.get(key);if(index===undefined){index=original.length;unique.set(key,index);original.push(i);}remap[i]=index;
  }
  const attributes={};
  for(const [name,attribute]of entries){const array=new Float32Array(original.length*attribute.itemSize);for(let i=0;i<original.length;i++)for(let k=0;k<attribute.itemSize;k++)array[i*attribute.itemSize+k]=attribute.array[original[i]*attribute.itemSize+k];attributes[name]={itemSize:attribute.itemSize,array};}
  const input=data.index||Uint32Array.from({length:count},(_,i)=>i),indices=Uint32Array.from(input,i=>remap[i]);
  const perceptual=entries.filter(([name])=>['normal','uv','color'].includes(name)),stride=perceptual.reduce((n,[,a])=>n+a.itemSize,0);
  const appearance=new Float32Array(original.length*stride),weights=[];let offset=0;
  for(const [name,a]of perceptual){weights.push(...Array(a.itemSize).fill(name==='uv'?.5:.1));for(let i=0;i<original.length;i++)for(let k=0;k<a.itemSize;k++)appearance[i*stride+offset+k]=attributes[name].array[i*a.itemSize+k];offset+=a.itemSize;}
  const groups=data.groups.length?data.groups:[{start:0,count:indices.length,materialIndex:0}],parts=[],resultGroups=[];let total=0;
  for(const group of groups){
    const part=indices.slice(group.start,group.start+group.count),target=Math.max(36,Math.floor(part.length*(data.ratio??.5)/3)*3),error=data.error??.01;
    const result=part.length>target?stride?MeshoptSimplifier.simplifyWithAttributes(part,attributes.position.array,3,appearance,stride,weights,null,target,error,['LockBorder']):MeshoptSimplifier.simplify(part,attributes.position.array,3,target,error,['LockBorder']):[part];
    parts.push(result[0]);resultGroups.push({start:total,count:result[0].length,materialIndex:group.materialIndex});total+=result[0].length;
  }
  const index=new Uint32Array(total);let at=0;for(const part of parts){index.set(part,at);at+=part.length;}
  const [compact,used]=MeshoptSimplifier.compactMesh(index);
  for(const attribute of Object.values(attributes)){const array=new Float32Array(used*attribute.itemSize);for(let i=0;i<original.length;i++)if(compact[i]!==0xffffffff)for(let k=0;k<attribute.itemSize;k++)array[compact[i]*attribute.itemSize+k]=attribute.array[i*attribute.itemSize+k];attribute.array=array;}
  return {attributes,index,groups:data.groups.length?resultGroups:[]};
}
