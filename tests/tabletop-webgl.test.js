import test from 'node:test';
import assert from 'node:assert/strict';
import * as recovery from '../src/components/tabletop/webglRecovery.js';

test('unavailable WebGL attempts one automatic recovery then offers manual retry',()=>{
  let rebuilds=0;const states=[];
  const lifecycle=recovery.createWebGLRecovery({onChange:state=>states.push(state),onRebuild:()=>rebuilds++});
  const first=lifecycle.begin();lifecycle.failed(first);assert.equal(rebuilds,1);assert.equal(states.at(-1).phase,'recovering');
  const automatic=lifecycle.begin();lifecycle.failed(automatic);assert.equal(rebuilds,1);assert.equal(states.at(-1).phase,'unavailable');
  lifecycle.retry();assert.equal(rebuilds,2);const manual=lifecycle.begin();lifecycle.ready(manual);assert.equal(states.at(-1).phase,'ready');
  lifecycle.dispose();
});
test('late creation, loss and restoration callbacks cannot revive a failed or departed scene',()=>{
  const states=[];let rebuilds=0;const lifecycle=recovery.createWebGLRecovery({onChange:state=>states.push(state),onRebuild:()=>rebuilds++});
  const departed=lifecycle.begin();lifecycle.ready(departed);lifecycle.lost(departed);
  const current=lifecycle.begin();lifecycle.ready(departed);lifecycle.failed(departed);lifecycle.lost(departed);assert.equal(rebuilds,1);
  lifecycle.failed(current);lifecycle.ready(current);assert.equal(states.at(-1).phase,'unavailable','late readiness cannot revive a failed renderer');
  const count=states.length;lifecycle.dispose();lifecycle.ready(current);lifecycle.lost(current);lifecycle.failed(current);lifecycle.retry();assert.equal(lifecycle.begin(),null);
  assert.equal(states.length,count);assert.equal(rebuilds,1);
});
test('a lost scene recovers once and duplicate loss events cannot restart it repeatedly',()=>{
  const states=[];let rebuilds=0;const lifecycle=recovery.createWebGLRecovery({onChange:state=>states.push(state),onRebuild:()=>rebuilds++});
  const first=lifecycle.begin();lifecycle.ready(first);lifecycle.lost(first);lifecycle.lost(first);
  assert.equal(rebuilds,1);assert.equal(states.at(-1).phase,'recovering');
  const restored=lifecycle.begin();lifecycle.ready(restored);assert.equal(states.at(-1).phase,'ready');
  lifecycle.lost(restored);assert.equal(states.at(-1).phase,'unavailable');assert.equal(rebuilds,1);
  lifecycle.retry();assert.equal(rebuilds,2);lifecycle.dispose();
});
