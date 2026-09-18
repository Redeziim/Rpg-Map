import AmmoFactory from 'ammojs-typed';
import {readFileSync} from 'node:fs';
import {createPhysics} from './vendor/dice-box/physics.js';
import {getDieDefinition,readDieFace} from '../src/components/diceGeometry.js';
import {Quaternion} from 'three';
const Ammo=await AmmoFactory();
export const tower=JSON.parse(readFileSync(new URL('../public/assets/structures/tower.json',import.meta.url)));
export function simulateStructureThrow(dice,random,settings,structure){
  const p=createPhysics(settings,Ammo);
  try{
    const mesh=p.own(new Ammo.btTriangleMesh(true,true));
    const points=[p.vector(0,0,0),p.vector(0,0,0),p.vector(0,0,0)];
    for(const triangle of structure.triangles){triangle.forEach((index,i)=>points[i].setValue(...structure.vertices[index]));mesh.addTriangle(...points,false);}
    const shape=p.own(new Ammo.btBvhTriangleMeshShape(mesh,true,true));shape.setMargin(.003);p.rigidBody(shape);
    p.rigidBody(p.box(12,.2,12),{pos:[0,-.22,0]});
    const bodies=[],shapes=new Map(),releaseMs=dice.map((_,i)=>i*350),spawn=structure.spawn;
    const transform=p.own(new Ammo.btTransform());
    const pose=(body,i)=>{if(!body)return [...spawn,...dice[i].initial];body.getMotionState().getWorldTransform(transform);const v=transform.getOrigin(),q=transform.getRotation();return [v.x(),v.y(),v.z(),q.x(),q.y(),q.z(),q.w()];};
    const frames=[];const record=()=>frames.push(dice.map((_,i)=>pose(bodies[i],i).map(v=>Math.round(v*10000)/10000)));
    let still=0,settled=false;
    for(let step=0;step<3600;step++){
      for(let i=bodies.length;i<dice.length&&step/120*1000>=releaseMs[i];i++){
        const die=dice[i];if(!shapes.has(die.sides))shapes.set(die.sides,p.convex(getDieDefinition(die.sides).faces.flatMap(f=>f.vertices.map(v=>[v.x*.35,v.y*.35,v.z*.35]))));
        const body=p.rigidBody(shapes.get(die.sides),{mass:settings.mass,pos:[spawn[0]+(random()-.5)*.12,spawn[1],spawn[2]+(random()-.5)*.12],quat:die.initial});
        body.setLinearVelocity(p.vector(0,-.5,0));body.setAngularVelocity(p.vector(...Array.from({length:3},()=>(random()-.5)*settings.spinForce/settings.mass)));bodies.push(body);
      }
      if(step%4===0)record();p.world.stepSimulation(1/120,1,1/120);
      const previous=frames.at(-19);
      const quiet=bodies.length===dice.length&&previous&&bodies.every((b,i)=>{const now=pose(b,i),before=previous[i];const distance=Math.hypot(...now.slice(0,3).map((v,j)=>v-before[j]));const dot=Math.abs(now.slice(3).reduce((n,v,j)=>n+v*before[j+3],0));return distance<.02&&dot>.999;});
      still=quiet?still+1:0;if(still>=72){settled=true;break;}
    }
    record();let cocked=!settled;
    bodies.forEach((b,i)=>{const values=pose(b,i);dice[i].position=values.slice(0,3);dice[i].target=values.slice(3);const q=new Quaternion(...dice[i].target),face=readDieFace(dice[i].sides,q);dice[i].value=face.value;
      if(face.normal.clone().applyQuaternion(q).y*(dice[i].sides===4?-1:1)<.96||values[1]>2||Math.abs(values[0])>11||Math.abs(values[2])>11)cocked=true;
    });
    return {engine:'dice-box-ammo-mesh',frames,frameMs:1000/30,duration:(frames.length-1)*1000/30,cocked,releaseMs,dieScale:.35};
  }finally{p.destroy();}
}
