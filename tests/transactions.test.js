import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';

const bundle={main:'terrain.obj',kind:'terrain',files:[{name:'terrain.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3').toString('base64')}]};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await sleep(10);}throw Error('Evento esperado não chegou.');}
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-transactions-')),dbPath=join(directory,'room.sqlite'),cookies={},users={};
  let app,base;const streams=[];
  const originalError=console.error;
  console.error=(...args)=>{if(args[0]?.message!=='tx-probe')originalError(...args);};
  async function start(){app=createApplication({dbPath,rateLimit:false,heartbeatMs:3600000});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,headers:response.headers,data:response.headers.get('content-type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};
  }
  await start();
  for(const username of ['owner','alice','master','outsider']){const result=await call(username,'/auth/register','POST',{username,password:'local-transaction-review-2026'});assert.equal(result.status,200);users[username]=result.data.id;}
  const room=(await call('owner','/rooms','POST',{name:'Mesa de transações'})).data.id,root=`/rooms/${room}`;
  for(const [username,role] of [['alice','player'],['master','master']])assert.equal((await call('owner',root+'/members','POST',{username,role})).status,200);
  return {
    directory,dbPath,cookies,users,root,room,call,get app(){return app;},
    view:async(who='owner')=>(await call(who,root)).data,
    fault(name,table,event,when='',rollback=false){app.db.exec(`CREATE TEMP TRIGGER ${name} BEFORE ${event} ON ${table} ${when} BEGIN SELECT RAISE(${rollback?'ROLLBACK':'ABORT'},'tx-probe'); END;`);},
    clear(name){app.db.exec(`DROP TRIGGER ${name}`);},
    async events(who='alice'){
      const abort=new AbortController(),response=await fetch(base+root+'/events',{headers:{Cookie:cookies[who]},signal:abort.signal}),reader=response.body.getReader(),frames=[];let pending='';
      const decoder=new TextDecoder();
      const finished=(async()=>{try{while(true){const chunk=await reader.read();if(chunk.done)return;pending+=decoder.decode(chunk.value,{stream:true});while(pending.includes('\n\n')){const end=pending.indexOf('\n\n'),frame=pending.slice(0,end);pending=pending.slice(end+2);if(frame.startsWith('event: room\n'))frames.push(JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6)));}}}catch(error){if(!abort.signal.aborted)throw error;}})();
      const stream={frames,async quiet(count){await sleep(30);assert.equal(frames.length,count,'falha não pode emitir sucesso pelo SSE');},async close(){abort.abort();await finished;}};streams.push(stream);await until(()=>frames.length===1);return stream;
    },
    async restart(){for(const stream of streams.splice(0))await stream.close();app.close();await start();},
    async close(){for(const stream of streams.splice(0))await stream.close();app?.close();console.error=originalError;assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});},
  };
}
function sameRoom(before,after){assert.equal(after.revision,before.revision);assert.deepEqual(after.state,before.state);assert.deepEqual(after.members,before.members);}

test('modelo e objeto são publicados ou revertidos juntos; remover um objeto conserva arquivos ainda usados',async()=>{
  const f=await fixture();
  try{
    const events=await f.events(),initial=await f.view();let attemptedId;
    // System-boundary fault: observe the generated ID, then fail the subsequent room write.
    f.app.db.function('capture_asset_id',id=>{attemptedId=id;return 0;});
    f.app.db.exec('CREATE TEMP TRIGGER capture_asset AFTER INSERT ON map_assets BEGIN SELECT capture_asset_id(NEW.id); END;');
    f.fault('reject_model_room','rooms','UPDATE');
    assert.equal((await f.call('owner',f.root+'/map-assets','POST',bundle)).status,500);
    sameRoom(initial,await f.view());assert.equal((await f.call('owner',f.root+'/map-assets/'+attemptedId)).status,404);await events.quiet(1);f.clear('reject_model_room');
    // A pre-existing oversized room must not leave an imported file when the 20 MB save limit fails.
    const originalState=JSON.parse(f.app.db.prepare('SELECT state FROM rooms WHERE id=?').get(f.room).state);
    f.app.db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify({...originalState,legacyPadding:'x'.repeat(20*1024*1024+1)}),f.room);
    const tooLarge=await f.view();
    assert.equal((await f.call('owner',f.root+'/map-assets','POST',bundle)).status,413);assert.equal((await f.call('owner',f.root+'/map-assets/'+attemptedId)).status,404);sameRoom(tooLarge,await f.view());await events.quiet(1);
    f.app.db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(originalState),f.room);
    const created=await f.call('owner',f.root+'/map-assets','POST',bundle);assert.equal(created.status,201);const item=created.data.state.mapObjects[0];
    const retained=await f.view();await until(()=>events.frames.length===2);
    f.fault('reject_model_delete','map_assets','DELETE','',true);
    assert.equal((await f.call('owner',f.root+'/map-objects/'+item.id,'DELETE')).status,500);
    sameRoom(retained,await f.view());assert.deepEqual((await f.call('alice',f.root+'/map-assets/'+item.assetId)).data.files,bundle.files);await events.quiet(2);f.clear('reject_model_delete');
    f.fault('reject_model_transform','rooms','UPDATE');
    assert.equal((await f.call('owner',f.root+'/map-objects/'+item.id,'PATCH',{position:[4,5,6]})).status,500);sameRoom(retained,await f.view());f.clear('reject_model_transform');
    // A restored/legacy room may contain two objects referencing the same immutable bundle.
    const sharedState={...JSON.parse(f.app.db.prepare('SELECT state FROM rooms WHERE id=?').get(f.room).state),mapObjects:[item,{...item,id:'second-instance',name:'Segunda instância'}]};
    f.app.db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE id=?').run(JSON.stringify(sharedState),f.room);
    const beforeDelete=await f.view();
    const firstRemoved=await f.call('owner',f.root+'/map-objects/'+item.id,'DELETE');assert.equal(firstRemoved.status,200);assert.equal(firstRemoved.data.revision,beforeDelete.revision+1);
    assert.equal((await f.call('alice',f.root+'/map-assets/'+item.assetId)).status,200,'outro objeto ainda precisa dos arquivos');
    await f.restart();assert.equal((await f.call('alice',f.root+'/map-assets/'+item.assetId)).status,200);assert.equal((await f.view()).state.mapObjects[0].id,'second-instance');
    assert.equal((await f.call('owner',f.root+'/map-objects/second-instance','DELETE')).status,200);assert.equal((await f.call('alice',f.root+'/map-assets/'+item.assetId)).status,404);
    await f.restart();assert.deepEqual((await f.view()).state.mapObjects,[]);
  }finally{await f.close();}
});

test('falhas preservam nota, histórico, compartilhamento e imagens; a coleção independente continua recuperável',async()=>{
  const f=await fixture();
  try{
    assert.equal((await f.call('owner',f.root+'/members','POST',{username:'outsider',role:'player'})).status,200);
    const events=await f.events(),initial=await f.view();
    f.fault('reject_note_image','note_assets','INSERT');
    assert.equal((await f.call('alice',f.root+'/note-assets','POST',{name:'Brasão',src:png})).status,500);assert.deepEqual((await f.call('alice',f.root+'/note-assets')).data,[]);sameRoom(initial,await f.view());await events.quiet(1);f.clear('reject_note_image');
    const uploaded=await f.call('alice',f.root+'/note-assets','POST',{name:'Brasão',src:png});assert.equal(uploaded.status,201);const assetId=uploaded.data.id;
    const board={width:960,height:620,nodes:[{id:'crest',kind:'image',x:80,y:70,text:'Brasão',assetId}],edges:[],strokes:[]};
    const note=f.root+'/notes/alice/diario',history=note+'/history';
    assert.equal((await f.call('alice',note,'PATCH',{title:'Diário',body:'Texto original',board})).status,200);
    const before=await f.view(),oldHistory=(await f.call('alice',history)).data;await until(()=>events.frames.length===2);
    f.fault('reject_note_history','note_versions','INSERT','WHEN NEW.version=2');
    assert.equal((await f.call('alice',note,'PATCH',{version:1,title:'Texto tentado',body:'Não salvar pela metade',board})).status,500);
    sameRoom(before,await f.view());assert.deepEqual((await f.call('alice',history)).data,oldHistory);
    assert.equal((await f.call('alice',note+'/share','PATCH',{version:1,sharedWith:['outsider']})).status,500);sameRoom(before,await f.view());
    assert.equal((await f.call('outsider',f.root+'/note-assets/'+assetId)).status,404);assert.equal((await f.call('outsider',history)).status,403);await events.quiet(2);f.clear('reject_note_history');
    assert.equal((await f.call('alice',f.root+'/note-assets/'+assetId)).status,200);assert.equal((await f.call('alice',f.root+'/note-assets','POST',{name:'Mesmo brasão',src:png})).data.id,assetId);
    assert.equal((await f.call('alice',note+'/share','PATCH',{version:1,sharedWith:['outsider']})).status,200);
    for(let version=2;version<31;version++)assert.equal((await f.call('alice',note,'PATCH',{version,title:'Diário',body:`Edição ${version}`,board})).status,200);
    const beforePrune=await f.view(),beforeHistory=(await f.call('alice',history)).data;assert.equal(beforeHistory.versions.length,30);await until(()=>events.frames.at(-1).revision===beforePrune.revision);const count=events.frames.length;
    f.fault('reject_history_cleanup','note_versions','DELETE');
    assert.equal((await f.call('alice',note,'PATCH',{version:31,title:'Tentativa final',body:'Não perder a versão anterior',board})).status,500);
    sameRoom(beforePrune,await f.view());assert.deepEqual((await f.call('alice',history)).data,beforeHistory);assert.equal((await f.call('outsider',f.root+'/note-assets/'+assetId)).status,200);await events.quiet(count);f.clear('reject_history_cleanup');
    f.fault('reject_legacy_history','note_versions','INSERT');
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{masterNotes:'Não publicar parcialmente'})).status,500);
    assert.equal((await f.call('alice',f.root+'/sheets/alice','PATCH',{observations:'Não alterar só a ficha'})).status,500);sameRoom(beforePrune,await f.view());f.clear('reject_legacy_history');
    await f.restart();sameRoom(beforePrune,await f.view());assert.deepEqual((await f.call('alice',history)).data,beforeHistory);assert.equal((await f.call('outsider',f.root+'/note-assets/'+assetId)).status,200);
  }finally{await f.close();}
});

test('conta e sessão, entrada na mesa e mudanças de acesso são completas ou revertidas, com uma revisão e evento após confirmar',async()=>{
  const f=await fixture();
  try{
    f.fault('reject_new_session','sessions','INSERT');
    const failed=await f.call('new_account','/auth/register','POST',{username:'new_account',password:'local-transaction-review-2026'});assert.equal(failed.status,500);assert.equal(failed.headers.has('set-cookie'),false);f.clear('reject_new_session');
    assert.equal((await f.call('new_account','/auth/login','POST',{username:'new_account',password:'local-transaction-review-2026'})).status,401,'cadastro com falha não pode deixar uma conta pela metade');
    assert.equal((await f.call('new_account','/auth/register','POST',{username:'new_account',password:'local-transaction-review-2026'})).status,200);
    const events=await f.events('owner');
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{mapImage:testMapImage})).status,200);
    let alice=await f.view('alice');
    assert.equal((await f.call('owner',f.root+'/map-position-settings','PATCH',{enabled:true,version:alice.mapPositionSettingsVersion})).status,200);
    alice=await f.view('alice');
    assert.equal((await f.call('alice',f.root+'/map-position','PATCH',{position:{x:0,y:0},version:alice.ownMapPositionVersion,settingsVersion:alice.mapPositionSettingsVersion})).status,200);
    assert.equal((await f.call('owner',f.root+'/turns','POST',{action:'select',player:'alice'})).status,200);
    assert.equal((await f.call('alice',f.root+'/notes/alice/remember','PATCH',{title:'Lembrança',body:'Manter para um retorno à mesa'})).status,200);
    const beforeRemove=await f.view();await until(()=>events.frames.at(-1).revision===beforeRemove.revision);const removeCount=events.frames.length;
    f.fault('reject_member_state','rooms','UPDATE');
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.alice,'DELETE')).status,500);
    assert.equal((await f.call('alice',f.root)).status,200,'falha no salvamento não pode retirar o acesso');sameRoom(beforeRemove,await f.view());await events.quiet(removeCount);f.clear('reject_member_state');
    const removed=await f.call('owner',f.root+'/members/'+f.users.alice,'DELETE');assert.equal(removed.status,200);assert.equal(removed.data.revision,beforeRemove.revision+1);
    assert.equal(removed.data.state.mapPositions.markers[f.users.alice],undefined);assert.equal(removed.data.state.activePlayer,null);assert.equal(removed.data.state.turnOrder.includes('alice'),false);assert.equal((await f.call('alice',f.root)).status,403);
    await until(()=>events.frames.length===removeCount+1);
    assert.equal((await f.call('owner',f.root+'/members','POST',{username:'alice',role:'player'})).status,200);alice=await f.view('alice');assert.equal(alice.state.playerSheets.alice.notebooks[0].body,'Manter para um retorno à mesa');assert.equal(alice.hasOwnMapPosition,false);
    const invite=(await f.call('master',f.root+'/invites','POST',{role:'player'})).data;
    const beforeRole=await f.view(),beforeInvites=(await f.call('owner',f.root+'/invites')).data;await until(()=>events.frames.at(-1).revision===beforeRole.revision);const roleCount=events.frames.length;
    f.fault('reject_invite_cleanup','invites','DELETE');
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'})).status,500);
    assert.equal((await f.view('master')).role,'master');sameRoom(beforeRole,await f.view());assert.deepEqual((await f.call('owner',f.root+'/invites')).data,beforeInvites);await events.quiet(roleCount);f.clear('reject_invite_cleanup');
    const demoted=await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'});assert.equal(demoted.status,200);assert.equal(demoted.data.revision,beforeRole.revision+1);assert.equal((await f.view('master')).role,'player');assert.equal((await f.call('outsider','/join','POST',{code:invite.code})).status,404);
    const oldRooms=(await f.call('owner','/rooms')).data;
    f.fault('reject_room_creator','members','INSERT',`WHEN NEW.user_id='${f.users.owner}'`);
    assert.equal((await f.call('owner','/rooms','POST',{name:'Não criar pela metade'})).status,500);assert.deepEqual((await f.call('owner','/rooms')).data,oldRooms);f.clear('reject_room_creator');
    const created=await f.call('owner','/rooms','POST',{name:'Mesa completa'});assert.equal(created.status,201);assert.equal(created.data.role,'admin');assert.ok(created.data.state.playerSheets.owner);
    const joinInvite=(await f.call('owner',f.root+'/invites','POST',{role:'player'})).data,preJoin=await f.view();await until(()=>events.frames.at(-1).revision===preJoin.revision);const joinCount=events.frames.length;
    f.fault('reject_join_state','rooms','UPDATE');
    assert.equal((await f.call('outsider','/join','POST',{code:joinInvite.code})).status,500);assert.equal((await f.call('outsider',f.root)).status,403);sameRoom(preJoin,await f.view());await events.quiet(joinCount);f.clear('reject_join_state');
    const joined=await f.call('outsider','/join','POST',{code:joinInvite.code});assert.equal(joined.status,200);assert.equal(joined.data.revision,preJoin.revision+1);await until(()=>events.frames.length===joinCount+1);
    const complete=await f.view();await f.restart();sameRoom(complete,await f.view());assert.equal((await f.view('master')).role,'player');assert.equal((await f.view('outsider')).role,'player');
  }finally{await f.close();}
});
