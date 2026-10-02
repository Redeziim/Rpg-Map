import test from 'node:test';
import assert from 'node:assert/strict';
import {noteWindowRect,resizeNoteWindow} from '../src/components/noteWindowGeometry.js';

test('docked window grows sideways and upwards while keeping its bottom left anchor',()=>{
  const viewport={width:1440,height:900};
  const rect=noteWindowRect({x:900,y:850},viewport,{wide:true,docked:true});
  assert.equal(rect.x,8);assert.equal(rect.y+rect.height,892);
  const bigger=resizeNoteWindow(rect,180,100,viewport,true);
  assert.equal(bigger.width,1040);assert.equal(bigger.height,720);
  assert.equal(bigger.x,8);assert.equal(bigger.y+bigger.height,892);
  const next=noteWindowRect(bigger,{width:1280,height:800},{wide:true,docked:true});
  assert.equal(next.x,8);assert.equal(next.y+next.height,792);
});

test('floating window preserves its size while moving and stays entirely on screen',()=>{
  const viewport={width:1440,height:900};
  const rect=noteWindowRect({x:200,y:100,width:900,height:600},viewport,{wide:true});
  const moved=noteWindowRect({...rect,x:350,y:180},viewport,{wide:true});
  assert.deepEqual(moved,{x:350,y:180,width:900,height:600});
  const clamped=noteWindowRect({...moved,x:2000,y:-800},viewport,{wide:true});
  assert.equal(clamped.x+clamped.width,1432);assert.equal(clamped.y,8);
  const grown=resizeNoteWindow(moved,2000,2000,viewport);
  assert.equal(grown.x+grown.width,1432);assert.equal(grown.y+grown.height,892);
});

test('mobile and expanded layouts fit the viewport and do not overwrite the chosen size',()=>{
  const preference={x:110,y:80,width:920,height:650};
  assert.deepEqual(noteWindowRect(preference,{width:390,height:844},{wide:true,docked:true}),{x:8,y:186,width:374,height:650});
  assert.deepEqual(noteWindowRect({...preference,expanded:true},{width:390,height:320},{wide:true,docked:true}),{x:8,y:8,width:374,height:304});
  assert.equal(noteWindowRect(preference,{width:1440,height:900},{wide:true}).width,920);
  assert.equal(preference.width,920);
});
