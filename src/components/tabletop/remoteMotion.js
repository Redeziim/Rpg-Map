import {Vector3,Quaternion,Euler} from 'three';

export function createRemoteMotion({duration=180,reducedMotion=false}={}){
  const moving=new Map(),targets=new Map();let reduced=reducedMotion,closed=false;
  const pose=item=>({position:new Vector3().fromArray(item.position),quaternion:new Quaternion().setFromEuler(new Euler(...item.rotation,'XYZ')),scale:new Vector3().fromArray(item.scale)});
  const equal=(a,b)=>a.position.equals(b.position)&&Math.abs(a.quaternion.dot(b.quaternion))>1-1e-12&&a.scale.equals(b.scale);
  const apply=(mesh,target)=>{mesh.position.copy(target.position);mesh.quaternion.copy(target.quaternion);mesh.scale.copy(target.scale);};
  const step=(mesh,entry,time)=>{
    const progress=Math.min(1,Math.max(0,(time-entry.started)/duration)),amount=progress*progress*(3-2*progress);
    mesh.position.lerpVectors(entry.from.position,entry.to.position,amount);mesh.quaternion.slerpQuaternions(entry.from.quaternion,entry.to.quaternion,amount);mesh.scale.lerpVectors(entry.from.scale,entry.to.scale,amount);
    if(progress===1){apply(mesh,entry.to);moving.delete(mesh);}
  };
  return {
    get active(){return moving.size>0;},
    receive(mesh,item,time,{immediate=false,revision}={}){
      if(closed)return;
      const target=pose(item),last=targets.get(mesh);
      if(Number.isFinite(revision)&&Number.isFinite(last?.revision)&&revision<last.revision)return;
      target.revision=revision??last?.revision;
      if(!immediate&&last&&equal(last,target)){last.revision=target.revision;return;}
      if(moving.has(mesh))step(mesh,moving.get(mesh),time);
      targets.set(mesh,target);
      const from={position:mesh.position.clone(),quaternion:mesh.quaternion.clone(),scale:mesh.scale.clone()};
      if(immediate||reduced||equal(from,target)){moving.delete(mesh);apply(mesh,target);return;}
      moving.set(mesh,{from,to:target,started:time});
    },
    frame(time){for(const [mesh,entry]of moving)step(mesh,entry,time);return moving.size>0;},
    cancel(mesh){moving.delete(mesh);targets.delete(mesh);},
    setReducedMotion(value){reduced=value;if(value){for(const [mesh,entry]of moving)apply(mesh,entry.to);moving.clear();}},
    finish(){for(const [mesh,entry]of moving)apply(mesh,entry.to);moving.clear();},
    dispose(){closed=true;moving.clear();targets.clear();}
  };
}
