import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStructure} from '../server/structures.js';
import {simulateStructureThrow,tower} from '../server/structurePhysics.js';
import {DEFAULT_PHYSICS} from '../src/shared/trayConfig.js';
import {readDieFace} from '../src/components/diceGeometry.js';
import {Quaternion} from 'three';
test('tower uses supplied geometry, staggers release and records physical faces',()=>{
  let seed=12345;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const dice=[{sides:6,initial:[0,0,0,1]},{sides:20,initial:[0,0,0,1]}];
  const result=simulateStructureThrow(dice,random,{...DEFAULT_PHYSICS,friction:.12,restitution:.55,angularDamping:.12,linearDamping:.12},tower);
  assert.equal(tower.triangles.length,46498);assert.deepEqual(result.releaseMs,[0,350]);
  assert.ok(result.frames.some(frame=>frame[0][1]<tower.spawn[1]-3));
  for(const die of dice)assert.equal(die.value,readDieFace(die.sides,new Quaternion(...die.target)).value);
  assert.ok(result.frames.flat(2).every(Number.isFinite));
});
test('custom collision structures reject invalid indices, excessive geometry and coordinates',()=>{
  const shape={name:'Test',vertices:[[0,0,0],[1,0,0],[0,0,1]],triangles:[[0,1,2]],spawn:[0,2,0]};
  assert.deepEqual(validateStructure(shape),shape);
  for(const patch of [{triangles:[[0,1,9]]},{spawn:[0,Infinity,0]},{vertices:[[100,0,0]]},{name:''},{triangles:Array(60001).fill([0,1,2])}])assert.throws(()=>validateStructure({...shape,...patch}));
});
