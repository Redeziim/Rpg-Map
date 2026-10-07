import {loadMapAsset} from './loadMapAsset.js';
import {mapAssetPlacement} from '../../shared/mapAssetTransfer.js';

// The local preview uses the same normalization and resources as published models.
export async function loadModelPreview(bundle,{placement,quality='original',signal}={}){
  const pose=mapAssetPlacement(placement),root=await loadMapAsset(bundle,{quality,signal});
  root.position.fromArray(pose.position);root.rotation.set(...pose.rotation);root.scale.fromArray(pose.scale);
  return root;
}
