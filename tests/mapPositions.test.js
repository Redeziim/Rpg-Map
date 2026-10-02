import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {emptyMapPositions,canShareMapPosition,visibleMapPositions} from '../src/shared/mapPositions.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-positions-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){
    app=createApplication({dbPath,rateLimit:false});
    // Windows may assign an ephemeral port that Fetch blocks (for example, 4045).
    for(let attempt=0;attempt<10;attempt++){
      await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
      base=`http://127.0.0.1:${app.server.address().port}/api`;
      try{
        const probe=await fetch(base+'/health',{headers:{Connection:'close'},signal:AbortSignal.timeout(5000)});
        await probe.body.cancel();return;
      }catch(error){
        await new Promise(done=>app.server.close(done));
        if(error.cause?.message!=='bad port'||attempt===9)throw error;
      }
    }
  }
  try{
  await start();
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};
  }
  const users={};
  for(const username of ['owner','master','player','second','outsider']){
    const registered=await request(username,'/auth/register','POST',{username,password:'local-position-review-2026'});assert.equal(registered.status,200);users[username]=registered.body.id||registered.body.user?.id;
  }
  const root='/rooms/'+(await request('owner','/rooms','POST',{name:'Posições na jornada'})).body.id;
  for(const [username,role] of [['master','master'],['player','player'],['second','player']])assert.equal((await request('owner',root+'/members','POST',{username,role})).status,200);
  const image='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#c7ab76'}}).png().toBuffer()).toString('base64');
  await request('master',root+'/state','PATCH',{mapImage:image});
  const view=who=>request(who,root).then(result=>result.body);
  const enable=async enabled=>{const room=await view('master');return request('master',root+'/map-position-settings','PATCH',{enabled,version:room.mapPositionSettingsVersion});};
  const place=async (who,position,room)=>{room||=await view(who);return request(who,root+'/map-position?mapViewMode=player','PATCH',{position,version:room.ownMapPositionVersion,settingsVersion:room.mapPositionSettingsVersion});};
  return {request,root,image,users,cookies,view,enable,place,get base(){return base;},restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
  }catch(error){app?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});throw error;}
}

test('positions require room opt-in and personal sharing, enforce ownership and reject stale changes',async()=>{
  const f=await fixture();
  try{
    const initial=await f.view('player');assert.equal(initial.state.mapPositions.enabled,false);assert.deepEqual(initial.state.mapPositions.markers,{});assert.equal(initial.hasOwnMapPosition,false);
    assert.deepEqual(emptyMapPositions().markers,{});assert.equal(canShareMapPosition('master','player'),false);assert.equal(canShareMapPosition('admin','master'),false);
    assert.equal((await f.place('player',{x:30,y:20})).status,409);
    for(const [who,query] of [['player','?mapViewMode=master'],['owner','?mapViewMode=player'],['outsider','']])assert.equal((await f.request(who,f.root+'/map-position-settings'+query,'PATCH',{enabled:true,version:initial.mapPositionSettingsVersion})).status,403);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapPositions:{enabled:true,markers:{}}})).status,400);
    assert.equal((await f.enable(true)).status,200);const draft=await f.view('player');assert.deepEqual(draft.state.mapPositions.markers,{});
    assert.equal((await f.place('outsider',{x:30,y:20})).status,403);
    for(const position of [{x:-1,y:0},{x:80,y:20},{x:10,y:50},{x:1.2,y:2},{x:1,y:2,author:'second'}])assert.equal((await f.place('player',position)).status,400);
    const bad=await f.request('player',f.root+'/map-position','PATCH',{position:{x:30,y:20},version:draft.ownMapPositionVersion,settingsVersion:draft.mapPositionSettingsVersion,userId:f.users.second});assert.equal(bad.status,400);
    const saved=await f.place('player',{x:30,y:20},draft);assert.equal(saved.status,200);assert.equal(saved.body.state.mapPositions.markers[f.users.player].x,30);
    assert.equal((await f.place('second',{x:40,y:25})).status,200);
    assert.equal((await f.place('player',{x:35,y:20},saved.body)).status,200); // Other players do not invalidate this draft.
    assert.equal((await f.place('player',null,saved.body)).status,409);
    assert.equal((await f.place('player',{x:31,y:20},draft)).status,409);
    const room=await f.view('master');assert.equal(Object.keys(room.state.mapPositions.markers).length,2);assert.equal(room.state.mapPositions.markers[f.users.second].x,40);assert.equal(room.state.mapImage,f.image);
    assert.deepEqual(visibleMapPositions({...room.state.mapPositions,enabled:false},room.members,true),{});
    assert.equal((await f.request('master',f.root+'/map-position-settings','PATCH',{enabled:false,version:initial.mapPositionSettingsVersion})).status,409);
  }finally{f.close();}
});

test('fog hides position coordinates, forged modes cannot bypass it and removed players never regain old markers',async()=>{
  const f=await fixture();
  try{
    await f.enable(true);await f.place('player',{x:30,y:20});await f.place('second',{x:65,y:40});
    assert.equal((await f.place('master',{x:30,y:20})).status,403);
    let room=await f.view('master');room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:room.fogVersion})).body;
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',area:{x:20,y:10,width:30,height:20},version:room.fogVersion})).body;
    const player=await f.view('player'),second=await f.view('second');
    assert.deepEqual(Object.keys(player.state.mapPositions.markers),[f.users.player]);assert.equal(second.hasOwnMapPosition,true);assert.equal(second.state.mapPositions.markers[f.users.second],undefined);
    assert.equal(Object.keys(room.state.mapPositions.markers).length,2);assert.equal(Object.keys(visibleMapPositions(room.state.mapPositions,room.members,false,room.state.mapFog)).length,1);
    const forged=await f.request('player',f.root+'/map-position?mapViewMode=master','PATCH',{position:{x:65,y:40},version:player.ownMapPositionVersion,settingsVersion:player.mapPositionSettingsVersion});assert.equal(forged.status,403);
    assert.equal((await f.place('owner',{x:65,y:40})).status,403);assert.equal((await f.place('owner',{x:30,y:20})).status,200);
    assert.equal((await f.place('second',null,second)).status,200);assert.equal((await f.view('second')).hasOwnMapPosition,false);
    assert.equal((await f.request('owner',f.root+'/members/'+f.users.player,'PATCH',{role:'master'})).status,200);
    assert.equal((await f.view('master')).state.mapPositions.markers[f.users.player],undefined);
    await f.request('owner',f.root+'/members/'+f.users.player,'PATCH',{role:'player'});assert.equal((await f.view('player')).hasOwnMapPosition,false);
    await f.place('player',{x:30,y:20});await f.request('owner',f.root+'/members/'+f.users.player,'DELETE');
    assert.equal((await f.request('player',f.root)).status,403);assert.equal((await f.view('master')).state.mapPositions.markers[f.users.player],undefined);
    await f.request('owner',f.root+'/members','POST',{username:'player',role:'player'});assert.equal((await f.view('player')).hasOwnMapPosition,false);
  }finally{f.close();}
});

test('SSE shares positions and removals, restart retains them and disabling or replacing the map clears them',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    await f.enable(true);const room=await f.view('player');
    const response=await fetch(f.base+f.root+'/events',{headers:{Cookie:f.cookies.second},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    await event();await f.place('player',{x:30,y:20});const shared=await event();assert.equal(shared.state.mapPositions.markers[f.users.player].y,20);assert.equal(shared.mapImageUnchanged,true);assert.equal(shared.mapImageVersion,room.mapImageVersion);
    await f.place('player',null);const removed=await event();assert.deepEqual(removed.state.mapPositions.markers,{});await f.place('player',{x:30,y:20});await event();
    const master=await f.view('master');await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:master.fogVersion});const hidden=await event();assert.deepEqual(hidden.state.mapPositions.markers,{});assert.equal(hidden.hasOwnMapPosition,false);
    const ownHidden=await f.view('player');assert.equal(ownHidden.hasOwnMapPosition,true);assert.equal(JSON.stringify(ownHidden.state.mapPositions.markers),'{}');
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();assert.equal((await f.view('master')).state.mapPositions.markers[f.users.player].x,30);
    await f.enable(false);assert.deepEqual((await f.view('master')).state.mapPositions.markers,{});await f.enable(true);
    assert.equal((await f.place('player',{x:30,y:20},room)).status,409);assert.deepEqual((await f.view('master')).state.mapPositions.markers,{});
    let current=await f.view('master');await f.request('master',f.root+'/map-fog','PATCH',{operation:'disable',version:current.fogVersion});await f.place('player',{x:30,y:20});current=await f.view('player');
    const replacement='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#405070'}}).png().toBuffer()).toString('base64');
    const replaced=(await f.request('master',f.root+'/state','PATCH',{mapImage:replacement})).body;assert.equal(replaced.state.mapPositions.enabled,true);assert.deepEqual(replaced.state.mapPositions.markers,{});
    assert.equal((await f.place('player',{x:30,y:20},current)).status,409);
  }finally{controller.abort();f.close();}
});
