import test from 'node:test';
import assert from 'node:assert/strict';
import {markerScreenScale,mapCoordinates,strokeNear} from '../src/components/mapStrokeGeometry.js';

test('point markers shrink on zoom in and grow on zoom out',()=>{
  assert.ok(markerScreenScale(3)<markerScreenScale(1));
  assert.ok(markerScreenScale(.5)>markerScreenScale(1));
});

test('eraser picks the top eligible stroke using displayed map coordinates',()=>{
  const strokes=[
    {id:'older',author:'a',path:'M 10 10 L 90 10'},
    {id:'newer',author:'b',path:'M 50 0 L 50 80'}
  ];
  const rect={left:100,top:200,width:200,height:200};
  const position=mapCoordinates(200,210,rect,100,100);
  assert.deepEqual(position,{x:50,y:5});
  assert.equal(strokeNear(strokes,position.x,position.y,4)?.id,'newer');
  assert.equal(strokeNear(strokes,position.x,position.y,6,item=>item.author==='a')?.id,'older');
  assert.equal(strokeNear(strokes,95,95,4),null);
});
