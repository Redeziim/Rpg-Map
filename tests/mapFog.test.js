import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {createMapFogRenderer} from '../server/mapFog.js';
import {emptyMapFog,coverMapArea,revealMapArea,isMapPointRevealed,isMapStrokeRevealed} from '../src/shared/mapFog.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-fog-')),dbPath=join(directory,'room.sqlite'),cookies={};
  let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}`;}
  await start();
  async function raw(who,path,method='GET',data){
    const response=await fetch(base+(path.startsWith('/api/')?path:'/api'+path),{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  async function request(...args){const response=await raw(...args);return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player','outsider'])assert.equal((await request(username,'/auth/register','POST',{username,password:'local-fog-review-2026'})).status,200);
  const room=(await request('owner','/rooms','POST',{name:'Áreas da jornada'})).body.id,root=`/rooms/${room}`;
  for(const [username,role] of [['master','master'],['player','player']])assert.equal((await request('owner',root+'/members','POST',{username,role})).status,200);
  const original=await sharp({create:{width:80,height:50,channels:3,background:'#d04020'}}).png().toBuffer(),image='data:image/png;base64,'+original.toString('base64');
  let state=(await request('master',root)).body;
  state=(await request('master',root+'/state','PATCH',{mapImage:image,pointsVersion:state.pointsVersion,points:[{id:'visible',x:10,y:10,name:'Porto conhecido',description:'Visível'},{id:'hidden',x:60,y:40,name:'Segredo proibido',description:'Conteúdo oculto'}]})).body;
  await request('master',root+'/map-strokes','POST',{path:'M 10 10 L 20 20',color:'#abcdef'});
  await request('master',root+'/map-strokes','POST',{path:'M 10 10 L 70 40',color:'#abcdef'});
  return {request,raw,room,root,image,original,cookies,get base(){return base;},get db(){return app.db;},restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('revealed areas support covering holes and never expose a stroke across an unrevealed gap',()=>{
  const whole={x:0,y:0,width:100,height:100},cut={x:40,y:40,width:20,height:20};
  const areas=coverMapArea([whole],cut),fog={...emptyMapFog(),enabled:true,areas};
  assert.equal(areas.length,4);
  assert.equal(areas.reduce((sum,area)=>sum+area.width*area.height,0),9600);
  assert.equal(isMapPointRevealed(fog,{x:50,y:50}),false);
  assert.equal(isMapStrokeRevealed(fog,{path:'M 10 50 L 90 50'}),false);
  assert.equal(isMapStrokeRevealed(fog,{path:'M 10 10 L 90 10 L 90 90'}),true);
  assert.equal(isMapStrokeRevealed({...fog,areas:[{x:0,y:0,width:50,height:100},{x:50,y:0,width:50,height:100}]},{path:'M 10 50 L 90 50'}),true);
  assert.equal(isMapPointRevealed(fog,{x:100,y:100}),false);
  assert.deepEqual(revealMapArea(areas,whole),[whole]);
  assert.deepEqual(revealMapArea([whole],cut),[whole]);
  assert.equal(isMapStrokeRevealed(fog,{path:'invalid'}),false);
  assert.deepEqual(coverMapArea(areas,{x:120,y:120,width:20,height:20}),areas);
});

test('API protects actual image pixels, points and stroke geometry with role, mode and version checks',async()=>{
  const f=await fixture();
  try{
    let state=(await f.request('master',f.root)).body;
    for(const [who,query] of [['player','?mapViewMode=master'],['owner','?mapViewMode=player'],['outsider','']])assert.equal((await f.request(who,f.root+'/map-fog'+query,'PATCH',{operation:'enable',version:state.fogVersion})).status,403);
    const stale=state.fogVersion;
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:stale})).body;
    assert.equal(state.state.mapFog.enabled,true);assert.equal(state.state.mapFog.width,80);assert.equal(state.state.points.length,2);
    assert.equal((await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',version:stale,area:{x:0,y:0,width:40,height:30}})).status,409);
    for(const area of [{x:-1,y:0,width:10,height:10},{x:0,y:0,width:90,height:10},{x:0.5,y:0,width:10,height:10},{x:0,y:0,width:10,height:10,extra:'bad'}])assert.equal((await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',version:state.fogVersion,area})).status,400);
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',version:state.fogVersion,area:{x:0,y:0,width:40,height:30}})).body;
    const player=(await f.request('player',f.root)).body;
    assert.deepEqual(player.state.points.map(point=>point.id),['visible']);assert.equal(player.state.mapStrokes.length,1);
    assert.ok(!JSON.stringify(player).includes('Segredo proibido'));assert.ok(!JSON.stringify(player).includes('70 40'));assert.ok(!JSON.stringify(player).includes(f.image));
    const response=await f.raw('player',player.state.mapImage+'&mapViewMode=master');
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const {data,info}=await sharp(Buffer.from(await response.arrayBuffer())).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const pixel=(x,y)=>Array.from(data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3));
    assert.deepEqual(pixel(10,10),[208,64,32]);assert.deepEqual(pixel(60,40),[21,25,19]);
    const adminPlayer=await f.raw('owner',f.root+'/map-image?mapViewMode=player'),master=await f.raw('master',f.root+'/map-image');
    assert.notDeepEqual(Buffer.from(await adminPlayer.arrayBuffer()),f.original);assert.deepEqual(Buffer.from(await master.arrayBuffer()),f.original);
    assert.equal((await f.raw('outsider',player.state.mapImage)).status,403);
    assert.equal((await f.request('player',f.root+'/map-strokes','POST',{path:'M 10 10 L 70 40',color:'#aabbcc'})).status,403);
    assert.equal((await f.request('player',f.root+'/map-strokes','POST',{path:'M 11 11 L 21 21',color:'#aabbcc'})).status,201);
    const hiddenStroke=state.state.mapStrokes.find(stroke=>stroke.path.includes('70 40'));
    assert.equal((await f.request('player',f.root+'/map-strokes/'+hiddenStroke.id,'DELETE')).status,404);
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'cover',version:state.fogVersion,area:{x:8,y:8,width:15,height:15}})).body;
    assert.equal((await f.request('player',f.root)).body.state.points.length,0);
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'disable',version:state.fogVersion})).body;
    assert.equal((await f.request('player',f.root)).body.state.points.length,2);
    assert.equal((await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:state.fogVersion})).body.state.mapFog.areas.length,4);
    const render=createMapFogRenderer(),jobs=Array.from({length:4},(_,index)=>render(String(index),f.image,{width:80,height:50,areas:[]}));
    assert.equal(render('0',f.image,{width:80,height:50,areas:[]}),jobs[0]);
    await assert.rejects(render('overflow',f.image,{width:80,height:50,areas:[]}),error=>error.status===503);
    for(const buffer of await Promise.all(jobs))assert.equal((await sharp(buffer).metadata()).width,80);
  }finally{f.close();}
});

test('SSE and server restart retain the protected view; replacing the image resets fog',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    let state=(await f.request('master',f.root)).body;
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:state.fogVersion})).body;
    const response=await fetch(f.base+'/api'+f.root+'/events',{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    const first=await event();assert.equal(first.state.points.length,0);assert.ok(first.state.mapImage.startsWith('/api/rooms/'));
    state=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',version:state.fogVersion,area:{x:0,y:0,width:30,height:30}})).body;
    const changed=await event();assert.deepEqual(changed.state.points.map(point=>point.id),['visible']);assert.notEqual(changed.state.mapImage,first.state.mapImage);assert.equal(changed.state.mapStrokes.length,1);
    assert.equal(changed.mapImageVersion,first.mapImageVersion);
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();
    const restored=(await f.request('player',f.root)).body;
    assert.deepEqual(restored.state.mapFog,state.state.mapFog);assert.equal(restored.state.points.length,1);assert.equal((await f.raw('player',restored.state.mapImage)).status,200);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:f.image})).status,200);
    const reset=(await f.request('player',f.root)).body;assert.equal(reset.state.mapFog.enabled,false);assert.equal(reset.state.mapImage,f.image);assert.equal(reset.state.mapStrokes.length,0);assert.equal(reset.state.points.length,2);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:'data:image/png;base64,iVBORw0KGgo='})).status,400);
    assert.equal((await f.request('master',f.root)).body.state.mapImage,f.image);
    // A legacy database can still contain an invalid image saved before upload validation.
    const legacy=JSON.parse(f.db.prepare('SELECT state FROM rooms WHERE id=?').get(f.room).state);
    legacy.mapImage='data:image/png;base64,iVBORw0KGgo=';
    f.db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(legacy),f.room);
    const invalid=(await f.request('master',f.root)).body;
    assert.equal((await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:invalid.fogVersion})).status,422);
    assert.equal((await f.request('master',f.root)).body.state.mapFog.enabled,false);
  }finally{controller.abort();f.close();}
});
