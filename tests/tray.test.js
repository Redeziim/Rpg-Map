import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion} from 'three';
import {createTrayRoll} from '../server/tray.js';
import {readDieFace,percentileValue} from '../src/components/diceGeometry.js';
test('shared tray result matches every visible landing face including percentile dice',()=>{
  for(const sides of [4,6,8,10,12,20,100]){
    const roll=createTrayRoll('player',[{sides,qty:3,sign:-1}],'carmesim');
    for(const die of roll.dice)assert.equal(readDieFace(die.sides,new Quaternion().fromArray(die.target)).value,die.value);
    const values=sides===100?[0,2,4].map(i=>percentileValue(roll.dice[i].value,roll.dice[i+1].value)):roll.dice.map(d=>d.value);
    assert.deepEqual(roll.parts[0].rolls,values);assert.equal(roll.total,roll.cocked?null:-values.reduce((a,b)=>a+b,0));
    assert.ok(roll.frames.length>2);
    assert.deepEqual(roll.frames.at(-1).map(d=>d.slice(3)),roll.dice.map(d=>d.target.map(v=>Math.round(v*10000)/10000)));
    assert.ok(roll.duration>1000);
  }
  for(const terms of [[],null,[{sides:7,qty:1,sign:1}],[{sides:6,qty:1.2,sign:1}],[{sides:100,qty:11,sign:1}]])assert.throws(()=>createTrayRoll('player',terms,'carmesim'));
});

test('throw rejects fabricated force and samples fresh rotation each time',()=>{
  const terms=[{sides:6,qty:2,sign:1}];
  for(const gesture of [{x:99,z:0,vx:1,vz:1},{x:0,z:0,vx:100,vz:1},{x:0,z:0,vx:NaN,vz:0}])assert.throws(()=>createTrayRoll('p',terms,'carmesim',gesture));
  const a=createTrayRoll('p',terms,'carmesim',{x:0,z:0,vx:7,vz:-3});
  const b=createTrayRoll('p',terms,'carmesim',{x:0,z:0,vx:-7,vz:3});
  assert.notDeepEqual(a.dice[0].initial,b.dice[0].initial);
  assert.ok(a.frames[2][0][0]>a.frames[0][0][0]);
  assert.ok(b.frames[2][0][0]<b.frames[0][0][0]);
});

test('physical dice rebound from tray walls and stay over its floor',async()=>{
  const {simulateThrow}=await import('../server/trayPhysics.js');
  const dice=[{sides:6,initial:[0,0,0,1]}];
  const result=simulateThrow(dice,{x:0,z:0,vx:12,vz:0},()=>.5);
  const positions=result.frames.map(f=>f[0][0]);
  assert.ok(Math.max(...positions)>4);
  assert.ok(positions.some((x,i)=>i>0&&x<positions[i-1]-.005),'die rebounds after wall contact');
  for(const frame of result.frames){assert.ok(Math.abs(frame[0][0])<6);assert.ok(frame[0][1]>.2);}
});

test('Dice Box engine validates physics settings and honors launch height',()=>{
  const terms=[{sides:6,qty:1,sign:1}];
  assert.throws(()=>createTrayRoll('p',terms,'carmesim',undefined,{gravity:999}));
  assert.throws(()=>createTrayRoll('p',terms,'carmesim',undefined,{friction:'0.5'}));
  const roll=createTrayRoll('p',terms,'carmesim',undefined,{startingHeight:1.6,friction:.8});
  assert.equal(roll.engine,'dice-box-ammo');assert.equal(roll.physics.friction,.8);
  assert.equal(roll.frames[0][0][1],1.6);
});
