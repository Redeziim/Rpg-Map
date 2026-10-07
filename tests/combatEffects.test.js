import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';

test('combat effects expire on confirmed rounds/turns, preserve manual effects, and respect visibility and recovery',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-combat-effects-')),dbPath=join(directory,'review.sqlite'),cookies={};let app,base,controller;
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['owner','master','alice'])await call(username,'/auth/register','POST',{username,password:'local-effects-review'});
    const room=(await call('owner','/rooms','POST',{name:'Condições de teste'})).body,root='/rooms/'+room.id;
    for(const [username,role]of [['master','master'],['alice','player']])await call('owner',root+'/members','POST',{username,role});
    let view=(await call('master',root)).body;
    const act=async(action,extra={})=>{const result=await call('master',root+'/turns','POST',{action,version:view.state.combat.version,...extra});assert.equal(result.status,200,JSON.stringify(result.body));view=result.body;return view.state.combat;};
    await act('next');
    const originalEffect={player:'alice',name:'Proteção',origin:'Poção',visibility:'all',duration:{kind:'rounds',remaining:2},version:view.state.combat.version,operationId:randomUUID(),requestedAt:Date.now()};
    await act('effect-add',originalEffect);
    const effectRevision=view.revision;
    const repeatedEffect=(await call('master',root+'/turns','POST',{action:'effect-add',...originalEffect})).body;
    assert.equal(repeatedEffect.state.combat.effects.length,1);assert.equal(repeatedEffect.revision,effectRevision);
    assert.equal(view.state.combat.schemaVersion,2);assert.equal(view.state.stateVersion,7);
    const rounds=view.state.combat.effects[0].id;
    await act('effect-add',{player:'alice',name:'Até agir',origin:'',visibility:'all',duration:{kind:'next-turn',remaining:1}});
    const untilTurn=view.state.combat.effects[1].id;
    await act('effect-add',{player:'owner',name:'Segredo do mestre',origin:'Origem reservada',visibility:'master',duration:{kind:'manual',remaining:null}});
    const manual=view.state.combat.effects[2].id;
    const effect=(combat,id)=>combat.effects.find(entry=>entry.id===id);
    const playerView=(await call('alice',root)).body;
    assert.equal(playerView.state.combat.effects.length,2);assert.equal(JSON.stringify(playerView).includes('Segredo do mestre'),false);assert.equal(JSON.stringify(playerView).includes('Origem reservada'),false);
    assert.equal((await call('owner',root+'?mapViewMode=player')).body.state.combat.effects.length,2);
    for(const who of ['alice','owner'])assert.equal((await call(who,root+'/turns?mapViewMode=player','POST',{action:'effect-remove',effectId:rounds,version:view.state.combat.version})).status,403);
    for(const duration of [{kind:'rounds',remaining:0},{kind:'rounds',remaining:100},{kind:'next-turn',remaining:3},{kind:'manual',remaining:1},{kind:'rounds',remaining:2,extra:true}])assert.equal((await call('master',root+'/turns','POST',{action:'effect-add',player:'alice',name:'Inválido',origin:'',visibility:'all',duration,version:view.state.combat.version})).status,400);
    assert.equal((await call('master',root+'/turns','POST',{action:'effect-add',player:'missing',name:'Inválido',origin:'',visibility:'all',duration:{kind:'manual',remaining:null},version:view.state.combat.version})).status,400);
    controller=new AbortController();const stream=await fetch(base+root+'/events?mapViewMode=player',{headers:{Cookie:cookies.alice},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}),reader=stream.body.getReader(),decoder=new TextDecoder();let buffer='';
    const event=async()=>{while(!buffer.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value,{stream:true});}const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(frame.split('data: ')[1]);};
    assert.equal((await event()).state.combat.effects.length,2);
    const oldVersion=view.state.combat.version;
    await act('skip');assert.equal(view.state.combat.activeId,'alice');assert.equal(effect(view.state.combat,untilTurn).duration.remaining,0);assert.equal(effect(view.state.combat,rounds).duration.remaining,2);
    const pushed=await event();assert.equal(effect(pushed.state.combat,untilTurn).duration.remaining,0);assert.equal(effect(pushed.state.combat,manual),undefined);controller.abort();
    assert.equal((await call('master',root+'/turns','POST',{action:'effect-remove',effectId:rounds,version:oldVersion})).status,409);
    const identified={action:'skip',version:view.state.combat.version,operationId:randomUUID(),requestedAt:Date.now()};
    view=(await call('master',root+'/turns','POST',identified)).body;
    assert.equal(view.state.combat.round,2);assert.equal(effect(view.state.combat,rounds).duration.remaining,1);
    assert.equal((await call('master',root+'/turns','POST',identified)).body.state.combat.effects.find(entry=>entry.id===rounds).duration.remaining,1);
    const revision=view.revision;
    await act('select',{player:'owner'});assert.equal(view.revision,revision);
    await act('remove',{player:'alice'});
    await act('effect-add',{player:'owner',name:'Uma vez',origin:'',visibility:'all',duration:{kind:'next-turn',remaining:1}});const solo=view.state.combat.effects.at(-1).id;
    await act('skip');assert.equal(view.state.combat.round,3);assert.equal(effect(view.state.combat,rounds).duration.remaining,1);assert.equal(effect(view.state.combat,solo).duration.remaining,0);
    await act('effect-remove',{effectId:solo});
    await act('include',{player:'alice'});await act('skip');await act('skip');assert.equal(effect(view.state.combat,rounds).duration.remaining,0);assert.equal(effect(view.state.combat,manual).duration.remaining,null);
    await act('end');await act('next');assert.equal(effect(view.state.combat,manual).duration.remaining,null);
    await act('add',{name:'Guarda',kind:'npc'});const npc=view.state.combat.npcs[0].id;
    await act('effect-add',{player:npc,name:'Lento',origin:'',visibility:'all',duration:{kind:'manual',remaining:null}});await act('remove',{player:npc});assert.equal(view.state.combat.effects.some(entry=>entry.actorId===npc),false);
    const exportRequest=(await call('alice',root+'/exports','POST',{viewMode:'player'})).body;
    const portable=(await call('alice',exportRequest.downloadUrl.replace(/^\/api/,''))).body;
    assert.equal(portable.state.combat.effects.length,2);assert.equal(JSON.stringify(portable).includes('Segredo do mestre'),false);
    await act('effect-remove',{effectId:untilTurn});assert.equal(effect(view.state.combat,untilTurn),undefined);
    const beforeFailure=view.state.combat;
    app.db.exec("CREATE TEMP TRIGGER fail_effect BEFORE UPDATE ON rooms BEGIN SELECT RAISE(ABORT,'effect failure'); END");
    assert.equal((await call('master',root+'/turns','POST',{action:'effect-remove',effectId:rounds,version:beforeFailure.version})).status,500);
    assert.deepEqual((await call('master',root)).body.state.combat,beforeFailure);app.db.exec('DROP TRIGGER fail_effect');
    const backup=join(directory,'backup.sqlite'),restored=join(directory,'restored.sqlite');await createBackup(dbPath,backup);await restoreBackup(backup,restored);await stop();await start(restored);
    assert.deepEqual((await call('master',root)).body.state.combat,view.state.combat);
    // Prepare a genuine previous-format room; startup must preserve its combat, not reconstruct it.
    await stop();const db=new DatabaseSync(dbPath),raw=JSON.parse(db.prepare('SELECT state FROM rooms WHERE id=?').get(room.id).state);raw.stateVersion=5;raw.combat.schemaVersion=1;delete raw.combat.effects;
    try{db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(raw),room.id);db.prepare('DELETE FROM room_state_migrations WHERE room_id=? AND version=6').run(room.id);}finally{db.close();}
    await start();const migrated=(await call('master',root)).body;assert.equal(migrated.state.stateVersion,7);assert.equal(migrated.state.combat.schemaVersion,2);assert.deepEqual(migrated.state.combat.effects,[]);
    for(const field of ['order','npcs','excluded','initiative','activeId','round','version'])assert.deepEqual(migrated.state.combat[field],raw.combat[field]);
    await stop();await start();assert.equal((await call('master',root)).body.revision,migrated.revision);
  }finally{controller?.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
