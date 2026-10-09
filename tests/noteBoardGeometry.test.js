import test from 'node:test';
import assert from 'node:assert/strict';
import {anchor,grownBoard,routeBetween,MAX_HEIGHT,MAX_WIDTH} from '../src/components/noteBoardGeometry.js';

const card=(x,y,w=200,h=72)=>({x,y,w,h});

test('a connection leaves the side that faces the other card and ends on the opposite side',()=>{
  const right=routeBetween(card(0,0),card(400,10));
  assert.equal(right.from,'right');assert.equal(right.to,'left');
  assert.ok(right.d.startsWith('M200 36C'),'starts at the right edge, halfway down the first card');
  assert.ok(right.d.endsWith('400 46'),'ends at the left edge of the second card');
  const below=routeBetween(card(0,0),card(10,300));
  assert.equal(below.from,'bottom');assert.equal(below.to,'top');
  const left=routeBetween(card(500,0),card(0,0));
  assert.equal(left.from,'left');assert.equal(left.to,'right');
  const above=routeBetween(card(0,400),card(0,0));
  assert.equal(above.from,'top');assert.equal(above.to,'bottom');
});

test('the side follows the real card size, so a tall card is left from its side and not from a guessed corner',()=>{
  assert.deepEqual(anchor(card(100,100,200,200),'right'),{x:300,y:200});
  assert.deepEqual(anchor(card(100,100,200,200),'bottom'),{x:200,y:300});
  assert.deepEqual(anchor(card(100,100,200,200),'left'),{x:100,y:200});
  assert.deepEqual(anchor(card(100,100,200,200),'top'),{x:200,y:100});
});

test('the label point sits on the curve, between the two cards',()=>{
  const {mid}=routeBetween(card(0,0),card(400,0));
  assert.ok(mid.x>200&&mid.x<400);assert.equal(mid.y,36);
});

test('cards stacked on top of each other still produce a finite path',()=>{
  const same=routeBetween(card(50,50),card(50,50));
  assert.ok(/^M[-\d. ]+C[-\d. ]+$/.test(same.d));
  assert.ok(Number.isFinite(same.mid.x)&&Number.isFinite(same.mid.y));
});

test('the board grows in whole steps when a card nears the edge, and never beyond the server limits',()=>{
  assert.deepEqual(grownBoard({width:960,height:620},100,100),{width:960,height:620});
  assert.deepEqual(grownBoard({width:960,height:620},700,100),{width:1440,height:620});
  assert.deepEqual(grownBoard({width:960,height:620},100,400),{width:960,height:930});
  const huge=grownBoard({width:960,height:620},99999,99999);
  assert.equal(huge.width,MAX_WIDTH);assert.equal(huge.height,MAX_HEIGHT);
  for(const x of [0,300,740,1500,3600]){
    const {width,height}=grownBoard({width:960,height:620},x,x/2);
    assert.ok(Number.isInteger(width)&&Number.isInteger(height));
    assert.ok(width>=960&&width<=3840&&height>=620&&height<=2480);
  }
  assert.deepEqual(grownBoard({},0,0),{width:960,height:620});
});
