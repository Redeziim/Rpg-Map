import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';
import {visibleMapStrokes} from '../src/shared/mapLayers.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-layers-')),dbPath=join(directory,'room.sqlite'),cookies={};
  let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  for(const username of ['owner','master','player'])assert.equal((await request(username,'/auth/register','POST',{username,password:'local-layer-review-123'})).status,200);
  const room=(await request('owner','/rooms','POST',{name:'Camadas da exploração'})).body.id;
  for(const [username,role] of [['master','master'],['player','player']])assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username,role})).status,200);
  await request('owner',`/rooms/${room}/state`,'PATCH',{mapImage:testMapImage});
  return {room,request,get base(){return base;},cookies,restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('map layers retain legacy drawings and never reveal master strokes in player mode',()=>{
  const strokes=[{id:'own',author:'player'},{id:'other',author:'master'},{id:'secret',author:'player',visibility:'master'}];
  const settings={role:'player',username:'player'};
  assert.deepEqual(visibleMapStrokes(strokes,settings).map(x=>x.id),['own','other']);
  assert.deepEqual(visibleMapStrokes(strokes,{...settings,mine:false}).map(x=>x.id),['other']);
  assert.deepEqual(visibleMapStrokes(strokes,{...settings,others:false}).map(x=>x.id),['own']);
  assert.deepEqual(visibleMapStrokes(strokes,{...settings,role:'admin',viewMode:'player'}).map(x=>x.id),['own','other']);
  assert.equal(visibleMapStrokes(strokes,{...settings,role:'admin',viewMode:'master'}).length,3);
  assert.equal(strokes.length,3);
});

test('stroke audience is enforced by the API, preserves content and survives restart',async()=>{
  const f=await fixture(),path=`/rooms/${f.room}/map-strokes`,stroke={path:'M 10 20 L 30 40',color:'#ABCDEF'};
  try{
    for(const who of ['player','owner'])assert.equal((await f.request(who,path+'?mapViewMode=player','POST',{...stroke,visibility:'master'})).status,403);
    assert.equal((await f.request('player',path+'?mapViewMode=master','POST',{...stroke,visibility:'master'})).status,403);
    assert.equal((await f.request('master',path,'POST',{...stroke,visibility:'invalid'})).status,400);
    const secret=(await f.request('master',path,'POST',{...stroke,visibility:'master'})).body.state.mapStrokes[0];
    assert.equal(secret.visibility,'master');
    assert.equal((await f.request('player',`/rooms/${f.room}`)).body.state.mapStrokes.length,0);
    assert.equal((await f.request('player',`${path}/${secret.id}`,'DELETE')).status,404);
    assert.equal((await f.request('player',`${path}/${secret.id}`,'PATCH',{visibility:'table',previousVisibility:'master'})).status,403);
    assert.equal((await f.request('owner',`${path}/${secret.id}?mapViewMode=player`,'PATCH',{visibility:'table',previousVisibility:'master'})).status,403);
    assert.equal((await f.request('owner',`${path}/${secret.id}`,'PATCH',{visibility:'table',previousVisibility:'master'})).status,200);
    const revealed=(await f.request('player',`/rooms/${f.room}`)).body.state.mapStrokes[0];
    assert.equal(revealed.path,secret.path);assert.equal(revealed.color,secret.color);assert.equal(revealed.author,secret.author);
    assert.equal((await f.request('master',`${path}/${secret.id}`,'PATCH',{visibility:'master',previousVisibility:'master'})).status,409);
    assert.equal((await f.request('master',`${path}/${secret.id}`,'PATCH',{visibility:'master',previousVisibility:'table'})).status,200);
    assert.equal((await f.request('master',`${path}/${secret.id}`,'DELETE')).status,200);
    assert.equal((await f.request('master',path,'POST',secret)).status,201);
    await f.restart();
    assert.deepEqual((await f.request('master',`/rooms/${f.room}`)).body.state.mapStrokes,[secret]);
    assert.equal((await f.request('player',`/rooms/${f.room}`)).body.state.mapStrokes.length,0);
  }finally{f.close();}
});

test('SSE removes a newly private stroke from a player snapshot without sending its geometry',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    const created=(await f.request('master',`/rooms/${f.room}/map-strokes`,'POST',{path:'M 100 101 L 201 202',color:'#aabbcc'})).body.state.mapStrokes[0];
    const response=await fetch(`${f.base}/rooms/${f.room}/events`,{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();
    let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const at=pending.indexOf('\n\n'),frame=pending.slice(0,at);pending=pending.slice(at+2);return frame;}
    const first=await event();assert.ok(first.includes(created.id));
    await f.request('master',`/rooms/${f.room}/map-strokes/${created.id}`,'PATCH',{visibility:'master',previousVisibility:'table'});
    const changed=await event();assert.ok(!changed.includes(created.id));assert.ok(!changed.includes(created.path));
    const snapshot=JSON.parse(changed.split('\n').find(line=>line.startsWith('data: ')).slice(6));assert.equal(snapshot.state.mapStrokes.length,0);
    controller.abort();await reader.cancel().catch(()=>{});
  }finally{controller.abort();f.close();}
});
