import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DICE_SIDES, getDieDefinition, readDieFace, sampleOrientation, settleOrientation, percentileValue } from '../src/components/diceGeometry.js';

for (const sides of DICE_SIDES) {
  test(`d${sides}: every numbered face is unique and readable after settling`, () => {
    const {faces}=getDieDefinition(sides);
    assert.equal(faces.length,sides);
    assert.deepEqual(faces.map(f=>f.value).sort((a,b)=>a-b),Array.from({length:sides},(_,i)=>i+1));
    for(const face of faces){
      const orientation=new THREE.Quaternion().setFromUnitVectors(face.normal,new THREE.Vector3(0,sides===4?-1:1,0));
      assert.equal(readDieFace(sides,orientation).value,face.value);
    }
    let seed=421;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<1000;i++){
      const q=sampleOrientation(random),before=readDieFace(sides,q),settled=settleOrientation(sides,q);
      assert.equal(readDieFace(sides,settled).value,before.value);
      const height=before.normal.clone().applyQuaternion(settled).y;
      assert.ok(Math.abs(height-(sides===4?-1:1))<1e-6);
    }
  });
}
test('percentile dice cover 1–100 exactly once, with 00 + 0 = 100',()=>{
  const outcomes=[];
  for(let tens=1;tens<=10;tens++)for(let units=1;units<=10;units++)outcomes.push(percentileValue(tens,units));
  assert.deepEqual(outcomes.sort((a,b)=>a-b),Array.from({length:100},(_,i)=>i+1));
  assert.equal(percentileValue(10,10),100);
});
