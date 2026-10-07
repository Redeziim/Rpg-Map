import {Euler,Quaternion,Vector3} from 'three';

export function selectionCenter(items){
  const center=new Vector3();for(const item of items)center.add(new Vector3().fromArray(item.position));
  return center.divideScalar(items.length||1).toArray();
}

// Flat world poses keep grouping lossless. Uniform group scaling avoids shear.
export function transformSelection(items,{position=[0,0,0],rotation=[0,0,0],scale=1},pivot=selectionCenter(items)){
  const center=new Vector3().fromArray(pivot),offset=new Vector3().fromArray(position),turn=new Quaternion().setFromEuler(new Euler(...rotation,'XYZ'));
  return items.map(item=>({id:item.id,
    position:new Vector3().fromArray(item.position).sub(center).multiplyScalar(scale).applyQuaternion(turn).add(center).add(offset).toArray(),
    rotation:new Euler().setFromQuaternion(turn.clone().multiply(new Quaternion().setFromEuler(new Euler(...item.rotation,'XYZ'))),'XYZ').toArray().slice(0,3),
    scale:item.scale.map(value=>value*scale)
  }));
}

export function expandSelection(objects,ids){
  const selected=new Set(ids),groups=new Set(objects.filter(item=>selected.has(item.id)&&item.groupId).map(item=>item.groupId));
  return objects.filter(item=>selected.has(item.id)||groups.has(item.groupId)).map(item=>item.id);
}
