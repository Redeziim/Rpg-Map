import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/app.js';

test('shared lighting is versioned and master-only; cameras remain personal and old scenes survive migration',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-lighting-')),dbPath=join(directory,'review.sqlite'),cookies={};let app,base,controller;
  async function start(){app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['owner','master','player'])await call(username,'/auth/register','POST',{username,password:'local-lighting-review'});
    const room=(await call('owner','/rooms','POST',{name:'Luz de teste'})).body,root='/rooms/'+room.id;
    for(const [username,role]of [['master','master'],['player','player']])await call('owner',root+'/members','POST',{username,role});
    assert.equal(room.state.tabletopLighting,'default');
    let view=(await call('master',root)).body;
    const initialVersion=view.tabletopLightingVersion;
    for(const who of ['player','owner'])assert.equal((await call(who,root+'/tabletop-lighting'+(who==='owner'?'?mapViewMode=player':''),'PATCH',{preset:'bright',version:initialVersion})).status,403);
    assert.equal((await call('master',root+'/tabletop-lighting','PATCH',{preset:'unknown',version:initialVersion})).status,400);
    assert.equal((await call('master',root+'/tabletop-lighting','PATCH',{preset:'bright',camera:[1,2,3],version:initialVersion})).status,400);
    controller=new AbortController();const stream=await fetch(base+root+'/events?mapViewMode=player',{headers:{Cookie:cookies.player},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}),reader=stream.body.getReader(),decoder=new TextDecoder();let buffer='';
    const event=async()=>{while(!buffer.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value,{stream:true});}const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(frame.split('data: ')[1]);};await event();
    const changed=await call('master',root+'/tabletop-lighting','PATCH',{preset:'bright',version:initialVersion});assert.equal(changed.status,200);view=changed.body;
    assert.equal((await event()).state.tabletopLighting,'bright');assert.notEqual(view.tabletopLightingVersion,initialVersion);assert.deepEqual(view.state.mapObjects,room.state.mapObjects);assert.equal(Object.hasOwn(view.state,'camera'),false);
    assert.equal((await call('owner',root+'/tabletop-lighting','PATCH',{preset:'dim',version:initialVersion})).status,409);
    view=(await call('owner',root+'/tabletop-lighting','PATCH',{preset:'dim',version:view.tabletopLightingVersion})).body;assert.equal((await event()).state.tabletopLighting,'dim');
    const exported=(await call('owner',root+'/exports','POST',{viewMode:'master'})).body,portable=(await call('owner',exported.downloadUrl.replace(/^\/api/,''))).body;assert.equal(portable.state.tabletopLighting,'dim');
    controller.abort();await stop();await start();view=(await call('master',root)).body;assert.equal(view.state.tabletopLighting,'dim');
    view=(await call('master',root+'/tabletop-lighting','PATCH',{preset:'default',version:view.tabletopLightingVersion})).body;assert.equal(view.state.tabletopLighting,'default');
    await stop();const legacyDb=new DatabaseSync(dbPath),legacy={...JSON.parse(legacyDb.prepare('SELECT state FROM rooms WHERE id=?').get(room.id).state),stateVersion:3};delete legacy.tabletopLighting;legacyDb.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(legacy),room.id);legacyDb.close();
    await start();const migrated=(await call('master',root)).body;assert.equal(migrated.state.stateVersion,7);assert.equal(migrated.state.tabletopLighting,'default');assert.equal(migrated.revision,view.revision+1);assert.deepEqual(migrated.state.mapObjects,view.state.mapObjects);
    await stop();await start();assert.equal((await call('master',root)).body.revision,migrated.revision);
  }finally{controller?.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
