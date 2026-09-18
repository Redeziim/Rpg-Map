// Adapted from 3d-dice/dice-box src/components/physics.worker.js (MIT).
// The world, convex colliders and rigid bodies use Dice Box's Ammo/Bullet runtime.
// Adaptations: Node execution, manual gesture, hexagonal container and frame recording.
import AmmoJS from './ammo.js';
import {readFileSync} from 'node:fs';
export const Ammo=await new AmmoJS({wasmBinary:readFileSync(new URL('./ammo.wasm.wasm',import.meta.url))});
export function createPhysics(config,AmmoRuntime=Ammo){
  const Ammo=AmmoRuntime;
  const allocated=[];
  const own=value=>{allocated.push(value);return value;};
  const vector=(x,y,z)=>own(new Ammo.btVector3(x,y,z));
  const collisionConfiguration=own(new Ammo.btDefaultCollisionConfiguration());
  const broadphase=own(new Ammo.btDbvtBroadphase());
  const solver=own(new Ammo.btSequentialImpulseConstraintSolver());
  const dispatcher=own(new Ammo.btCollisionDispatcher(collisionConfiguration));
  const world=own(new Ammo.btDiscreteDynamicsWorld(dispatcher,broadphase,solver,collisionConfiguration));
  world.setGravity(vector(0,-config.gravity,0));
  const bodies=[];
  function convex(vertices){
    const shape=own(new Ammo.btConvexHullShape());
    const point=own(new Ammo.btVector3(0,0,0));
    for(const v of vertices){point.setValue(...v);shape.addPoint(point,true);}
    shape.setMargin(.005);return shape;
  }
  function box(x,y,z){return own(new Ammo.btBoxShape(vector(x,y,z)));}
  function rigidBody(shape,{mass=0,pos=[0,0,0],quat=[0,0,0,1]}={}){
    const transform=own(new Ammo.btTransform());transform.setIdentity();transform.setOrigin(vector(...pos));transform.setRotation(own(new Ammo.btQuaternion(...quat)));
    const motionState=own(new Ammo.btDefaultMotionState(transform));
    const inertia=vector(0,0,0);if(mass>0)shape.calculateLocalInertia(mass,inertia);
    const info=own(new Ammo.btRigidBodyConstructionInfo(mass,motionState,shape,inertia));
    const body=own(new Ammo.btRigidBody(info));
    body.setFriction(config.friction);body.setRestitution(config.restitution);body.setDamping(config.linearDamping,config.angularDamping);
    if(mass>0){body.setActivationState(4);body.setCcdMotionThreshold(.25);body.setCcdSweptSphereRadius(.15);}
    world.addRigidBody(body);bodies.push(body);return body;
  }
  return {Ammo,world,convex,box,rigidBody,vector,own,destroy(){for(const body of bodies)world.removeRigidBody(body);for(const value of allocated.reverse())Ammo.destroy(value);}};
}
