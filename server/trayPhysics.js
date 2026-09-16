import {TRAY_WALLS,DEFAULT_PHYSICS} from '../src/shared/trayConfig.js';
import {getDieDefinition,readDieFace} from '../src/components/diceGeometry.js';
import {Quaternion} from 'three';
import {Ammo,createPhysics} from './vendor/dice-box/physics.js';

export function simulateThrow(dice,gesture,random,settings=DEFAULT_PHYSICS){
  const physics=createPhysics(settings);
  try{
    const {world,rigidBody,vector}=physics;
    rigidBody(physics.box(8,.2,8),{pos:[0,-.2,0]});
    for(const w of TRAY_WALLS)rigidBody(physics.box(.18,1.05,3.5),{pos:[Math.cos(w.angle)*(w.distance+.18),1.05,Math.sin(w.angle)*(w.distance+.18)],quat:[0,Math.sin(-w.angle/2),0,Math.cos(-w.angle/2)]});
    const shapes=new Map();
    const bodies=dice.map((die,i)=>{
      if(!shapes.has(die.sides))shapes.set(die.sides,physics.convex(getDieDefinition(die.sides).faces.flatMap(f=>f.vertices.map(v=>[v.x*.55,v.y*.55,v.z*.55]))));
      const body=rigidBody(shapes.get(die.sides),{mass:settings.mass,pos:[gesture.x+(i%5-(Math.min(dice.length,5)-1)/2)*1.28,settings.startingHeight,gesture.z+(Math.floor(i/5)-(Math.ceil(dice.length/5)-1)/2)*1.28],quat:die.initial});
      body.setLinearVelocity(vector(gesture.vx*settings.throwForce/settings.mass,1,gesture.vz*settings.throwForce/settings.mass));
      body.setAngularVelocity(vector(...Array.from({length:3},()=>(random()-.5)*settings.spinForce/settings.mass)));
      return body;
    });
    const transform=physics.own(new Ammo.btTransform());
    const pose=b=>{b.getMotionState().getWorldTransform(transform);const p=transform.getOrigin(),q=transform.getRotation();return [p.x(),p.y(),p.z(),q.x(),q.y(),q.z(),q.w()];};
    const frames=[];const record=()=>frames.push(bodies.map(b=>pose(b).map(v=>Math.round(v*10000)/10000)));
    record();let still=0,settled=false;
    for(let step=0;step<1440;step++){
      world.stepSimulation(1/120,1,1/120);
      if((step+1)%4===0)record();
      const quiet=bodies.every(b=>b.getLinearVelocity().length()<.08&&b.getAngularVelocity().length()<.08);
      still=quiet?still+1:0;if(still>=72){settled=true;break;}
    }
    record();let cocked=!settled;
    bodies.forEach((b,i)=>{
      const values=pose(b);dice[i].position=values.slice(0,3);dice[i].target=values.slice(3);
      const q=new Quaternion(...dice[i].target),face=readDieFace(dice[i].sides,q);dice[i].value=face.value;
      if(face.normal.clone().applyQuaternion(q).y*(dice[i].sides===4?-1:1)<.96||TRAY_WALLS.some(w=>values[0]*Math.cos(w.angle)+values[2]*Math.sin(w.angle)>w.distance))cocked=true;
    });
    return {engine:'dice-box-ammo',frames,frameMs:1000/30,duration:(frames.length-1)*1000/30,cocked};
  }finally{physics.destroy();}
}
