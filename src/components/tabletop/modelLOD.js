import {LOD,Box3,Vector3} from 'three';
import {applyModelQuality,modelQualityStats} from './modelQuality.js';
import {retainModel,disposeModel} from './modelResources.js';

// Both representations keep the normalized asset origin. Only geometry changes;
// the distant clone shares materials/images, never mutating their texture size.
export async function createModelLOD(root,{signal}={}){
  const near=modelQualityStats(root);let eligible=false,special=false;
  root.traverse(node=>{if(!node.isMesh)return;const geometry=node.geometry;
    if(node.isSkinnedMesh||node.isInstancedMesh||Object.keys(geometry.morphAttributes).length)special=true;
    if((geometry.index?.count||geometry.attributes.position.count)>=300)eligible=true;
  });
  root.userData.streamingRadius=new Box3().setFromObject(root).getSize(new Vector3()).length()/2;
  if(!eligible||special)return root;
  const far=retainModel(root.clone(true));
  try{
    await applyModelQuality(far,{signal,ratio:.25,error:.03,geometryOnly:true});signal?.throwIfAborted();
    const distant=modelQualityStats(far);
    if(distant.triangles>=near.triangles*.9){disposeModel(far);return root;}
    const lod=new LOD();lod.autoUpdate=false;lod.addLevel(root,0);lod.addLevel(far,1,.18);
    lod.userData={...root.userData,lodStats:{near,distant,before:root.userData.qualityReport?.before||near,skipped:root.userData.qualityReport?.skipped||0}};
    retainModel(lod);disposeModel(root);disposeModel(far);
    return lod;
  }catch(error){disposeModel(far);disposeModel(root);throw error;}
}

export function updateModelLOD(root,camera,{selected=false,qualityMode='auto'}={}){
  if(!root.isLOD)return false;
  const previous=root.getCurrentLevel();root.updateMatrixWorld(true);
  const radius=Math.max(.1,(root.userData.streamingRadius||3)*Math.max(...root.scale.toArray().map(Math.abs)));
  root.levels[1].distance=selected||qualityMode==='original'?Number.MAX_VALUE:radius*18;
  root.update(camera);
  const stats=root.userData.lodStats;
  root.userData.qualityReport={before:stats.before,after:root.getCurrentLevel()?stats.distant:stats.near,skipped:stats.skipped};
  return previous!==root.getCurrentLevel();
}
