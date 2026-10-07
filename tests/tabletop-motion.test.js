import test from 'node:test';
import assert from 'node:assert/strict';
import {Object3D} from 'three';

test('remote position, rotation and scale move through intermediate poses and finish exactly at the confirmed target',async()=>{
  const {createRemoteMotion}=await import('../src/components/tabletop/remoteMotion.js');
  const motion=createRemoteMotion(),mesh=new Object3D();
  motion.receive(mesh,{position:[10,0,0],rotation:[0,Math.PI,0],scale:[2,2,2]},0);
  assert.equal(mesh.position.x,0);assert.equal(motion.active,true);
  motion.frame(90);assert.ok(mesh.position.x>0&&mesh.position.x<10);assert.equal(mesh.scale.x,1.5);assert.ok(Math.abs(mesh.rotation.y)>0||Math.abs(mesh.rotation.x)>0);
  motion.frame(180);assert.equal(mesh.position.x,10);assert.equal(mesh.scale.x,2);assert.ok(Math.abs(mesh.quaternion.y-1)<1e-9);assert.equal(motion.active,false);
});

test('local edits and reduced motion are immediate; removal, hidden-page settlement and disposal stop future frames',async()=>{
  const {createRemoteMotion}=await import('../src/components/tabletop/remoteMotion.js');
  const motion=createRemoteMotion(),mesh=new Object3D(),target=x=>({position:[x,0,0],rotation:[0,0,0],scale:[1,1,1]});
  motion.receive(mesh,target(10),0);motion.setReducedMotion(true);assert.equal(mesh.position.x,10);assert.equal(motion.active,false);
  motion.receive(mesh,target(20),1);assert.equal(mesh.position.x,20);
  motion.setReducedMotion(false);motion.receive(mesh,target(30),2,{immediate:true});assert.equal(mesh.position.x,30);assert.equal(motion.active,false);
  motion.receive(mesh,target(40),3);motion.cancel(mesh);motion.frame(200);assert.equal(mesh.position.x,30);
  motion.receive(mesh,target(40),201);motion.finish();assert.equal(mesh.position.x,40);assert.equal(motion.active,false);
  motion.receive(mesh,target(50),202);motion.dispose();motion.receive(mesh,target(100),203);motion.frame(400);assert.equal(mesh.position.x,40);assert.equal(motion.active,false);
});

test('new updates retarget the displayed pose without jumping; duplicate and older snapshots cannot restart or reverse it',async()=>{
  const {createRemoteMotion}=await import('../src/components/tabletop/remoteMotion.js');
  const motion=createRemoteMotion(),mesh=new Object3D(),target=x=>({position:[x,0,0],rotation:[0,0,0],scale:[1,1,1]});
  motion.receive(mesh,target(10),0,{revision:5});motion.frame(60);const visible=mesh.position.x;
  motion.receive(mesh,target(20),60,{revision:6});assert.equal(mesh.position.x,visible);
  motion.frame(150);const middle=mesh.position.x;assert.ok(middle>visible&&middle<20);
  motion.receive(mesh,target(20),150,{revision:6});motion.receive(mesh,target(-50),150,{revision:5});assert.equal(mesh.position.x,middle);
  motion.frame(240);assert.equal(mesh.position.x,20);assert.equal(motion.active,false);
});
