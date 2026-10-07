import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';
import {DatabaseSync} from 'node:sqlite';
import {createBackup,restoreBackup,verifyBackup} from '../scripts/databaseRecovery.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-room-audit-')),dbPath=join(directory,'test.sqlite'),cookies={},users={};
  let app,base,port=0;
  async function start(path=dbPath){
    app=createApplication({dbPath:path,rateLimit:false});
    for(let attempt=0;attempt<10;attempt++){
      await new Promise(done=>app.server.listen(port,'127.0.0.1',done));port=app.server.address().port;base=`http://127.0.0.1:${port}/api`;
      try{const response=await fetch(base+'/health',{headers:{Connection:'close'}});await response.body.cancel();break;}
      catch(error){await new Promise(done=>app.server.close(done));if(error.cause?.message!=='bad port'||attempt===9)throw error;port=0;}
    }
  }
  async function stop(){const stopped=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await stopped;app=null;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',Connection:'close',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  await start();
  for(const username of ['owner','master','alice','bob','outsider']){const result=await call(username,'/auth/register','POST',{username,password:'local-audit-test-password'});assert.equal(result.status,200);users[username]=result.data.id;}
  const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Livro de registros'})).data.id;
  return {directory,dbPath,users,cookies,root,call,start,stop,get app(){return app;},async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('registro administrativo identifica autores, conserva ordem e páginas e exige acesso atual de mestre',async()=>{
  const f=await fixture();
  try{
    const audit=f.root+'/audit';
    const initial=await f.call('owner',audit);assert.equal(initial.status,200);assert.deepEqual(initial.data.entries.map(e=>e.action),['room.created']);assert.equal(initial.data.entries[0].actor.username,'owner');
    assert.equal((await f.call('owner',f.root+'/members','POST',{username:'master',role:'master'})).status,200);
    assert.equal((await f.call('master',f.root+'/members','POST',{username:'alice'})).status,200);
    const invite=await f.call('master',f.root+'/invites','POST',{role:'player'});assert.equal(invite.status,201);
    assert.equal((await f.call('bob','/join','POST',{code:invite.data.code})).status,200);
    assert.equal((await f.call('bob','/join','POST',{code:invite.data.code})).status,200);
    assert.equal((await f.call('master',f.root+'/invites/'+invite.data.id,'DELETE')).status,200);
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.alice,'PATCH',{role:'master',actor:'outsider'})).status,200);
    const all=await f.call('master',audit);assert.equal(all.status,200);
    assert.deepEqual(all.data.entries.map(e=>e.action),['member.role','turns.changed','invite.revoked','member.joined','invite.created','member.added','member.added','room.created']);
    assert.deepEqual(all.data.entries.map(e=>e.actor.username),['owner','owner','master','bob','master','master','owner','owner']);
    assert.equal(all.data.entries[0].details.target,'alice');assert.equal(all.data.entries[0].details.fromRole,'player');assert.equal(all.data.entries[0].details.role,'master');
    assert.equal(JSON.stringify(all.data).includes(invite.data.code),false);assert.equal(JSON.stringify(all.data).includes('password'),false);
    for(const entry of all.data.entries){assert.ok(Number.isSafeInteger(entry.sequence));assert.ok(entry.createdAt>0);assert.ok(Number.isSafeInteger(entry.revision));}
    const page=await f.call('owner',audit+'?limit=2');assert.equal(page.data.entries.length,2);assert.ok(page.data.nextBefore);
    const next=await f.call('owner',audit+'?limit=2&before='+page.data.nextBefore);assert.deepEqual([...page.data.entries,...next.data.entries].map(e=>e.sequence),all.data.entries.slice(0,4).map(e=>e.sequence));
    for(const suffix of ['?before=NaN','?limit=101','?category=secret'])assert.equal((await f.call('owner',audit+suffix)).status,400);
    assert.equal((await f.call('owner',audit+'?mapViewMode=player')).status,403);
    assert.equal((await f.call('bob',audit+'?mapViewMode=master')).status,403);assert.equal((await f.call('outsider',audit)).status,403);assert.equal((await f.call('',audit)).status,401);
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'})).status,200);assert.equal((await f.call('master',audit)).status,403);
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.alice,'DELETE')).status,200);assert.equal((await f.call('alice',audit)).status,403);
    const other=(await f.call('outsider','/rooms','POST',{name:'Outra mesa'})).data;
    assert.equal((await f.call('owner','/rooms/'+other.id+'/audit')).status,403);
    assert.deepEqual((await f.call('outsider','/rooms/'+other.id+'/audit')).data.entries.map(e=>e.action),['room.created']);
    assert.equal(JSON.stringify((await f.call('bob',f.root)).data).includes('audit'),false);
  }finally{await f.close();}
});

test('ação e registro são atômicos; migração, retenção, reinício e restauração conservam o histórico confirmado',async()=>{
  const f=await fixture();
  const originalError=console.error;console.error=(...args)=>{if(args[0]?.message!=='audit-probe')originalError(...args);};
  try{
    const audit=f.root+'/audit',before=(await f.call('owner',f.root)).data;
    await f.stop();
    // A real version-1 database: preserve its original tables, state and sessions.
    const old=new DatabaseSync(f.dbPath);old.exec('DROP TABLE scene_media; DROP TABLE combat_operations; DROP TABLE dice_live; DROP TABLE dice_receipts; DROP TABLE dice_rolls; DROP INDEX idx_map_imports_expires; DROP TABLE map_imports; DROP INDEX idx_sessions_expires; DROP INDEX idx_invites_expires; DROP TABLE room_audit; DELETE FROM schema_migrations WHERE version>=2; PRAGMA user_version=1;');old.close();
    const oldBackup=join(f.directory,'version1.sqlite');await createBackup(f.dbPath,oldBackup);const oldBytes=readFileSync(oldBackup);
    assert.equal((await verifyBackup(oldBackup)).database.userVersion,1);
    const migrated=join(f.directory,'migrated.sqlite');await restoreBackup(oldBackup,migrated);await f.start(migrated);
    assert.deepEqual((await f.call('owner',f.root)).data.state,before.state);assert.equal((await f.call('owner',f.root)).data.revision,before.revision);
    assert.deepEqual((await f.call('owner',audit)).data.entries,[],'migração não inventa ações anteriores');
    f.app.db.exec("CREATE TEMP TRIGGER reject_audit BEFORE INSERT ON room_audit BEGIN SELECT RAISE(ABORT,'audit-probe'); END;");
    assert.equal((await f.call('owner',f.root+'/notes/@master/probe','PATCH',{title:'Teste',body:'Não deve salvar'})).status,500);
    assert.equal((await f.call('owner',f.root+'/members','POST',{username:'alice'})).status,500);
    assert.equal((await f.call('owner',f.root+'/invites','POST',{role:'player'})).status,500);
    assert.deepEqual((await f.call('owner',f.root)).data.state,before.state);assert.deepEqual((await f.call('owner',f.root)).data.members,before.members);assert.equal((await f.call('owner',f.root)).data.revision,before.revision);
    assert.equal((await f.call('owner',f.root+'/notes/@master/probe/history')).status,404);assert.deepEqual((await f.call('owner',f.root+'/invites')).data,[]);assert.deepEqual((await f.call('owner',audit)).data.entries,[]);
    f.app.db.exec('DROP TRIGGER reject_audit;');
    for(let i=0;i<1006;i++)assert.equal((await f.call('owner',f.root+'/state','PATCH',{sheetFont:i%2?'cinzel':'fell'})).status,200);
    const first=(await f.call('owner',audit+'?limit=100')).data;assert.equal(first.retention,1000);assert.equal(first.entries[0].sequence,1006);
    let entries=[...first.entries],cursor=first.nextBefore;
    while(cursor){const page=(await f.call('owner',audit+'?limit=100&before='+cursor)).data;entries.push(...page.entries);cursor=page.nextBefore;}
    assert.equal(entries.length,1000);assert.equal(new Set(entries.map(e=>e.sequence)).size,1000);assert.equal(entries.at(-1).sequence,7);
    await f.stop();await f.start(migrated);assert.deepEqual((await f.call('owner',audit+'?limit=100')).data,first);
    const backup=join(f.directory,'current.sqlite'),restored=join(f.directory,'restored.sqlite');await createBackup(migrated,backup);
    assert.equal((await verifyBackup(backup)).database.counts.room_audit,1000);await restoreBackup(backup,restored);await f.stop();await f.start(restored);
    assert.deepEqual((await f.call('owner',audit+'?limit=100')).data,first);
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{sheetFont:'fell'})).status,200);assert.equal((await f.call('owner',audit)).data.entries[0].sequence,1007);
    assert.deepEqual(readFileSync(oldBackup),oldBytes);
    const bad=join(f.directory,'invalid-audit.sqlite');copyFileSync(backup,bad);const corrupt=new DatabaseSync(bad);corrupt.prepare('UPDATE room_audit SET details=? WHERE sequence=1006').run('{"private":"conteúdo que não pertence ao registro"}');corrupt.close();
    await assert.rejects(verifyBackup(bad,{allowLegacy:true}),/registro de alterações/i);
  }finally{console.error=originalError;await f.close();}
});

test('alterações importantes registram somente tipos e autores; conteúdo privado e ações recusadas ficam fora do registro',async()=>{
  const f=await fixture();
  try{
    const audit=f.root+'/audit',view=async()=> (await f.call('owner',f.root)).data;
    const write=async(who,path,data,method='PATCH')=>{const result=await f.call(who,f.root+path,method,data);assert.ok(result.status===200||result.status===201,JSON.stringify(result));return result.data;};
    await write('owner','/members',{username:'alice'},'POST');
    await write('owner','/state',{mapImage:testMapImage});
    let room=await view();await write('owner','/state',{points:[{id:'secret',name:'Nome oculto do porto',description:'Descrição secreta',x:1,y:1,type:'cidade'}],pointsVersion:room.pointsVersion});
    room=await view();await write('owner','/points/secret',{name:'Outro título reservado',version:room.pointVersions.secret});
    await write('owner','/state',{sheetFields:[{id:'journal',type:'text',label:'Campo reservado'}],sheetFont:'fell'});
    await write('alice','/sheets/alice',{values:{journal:'Valor privado da ficha'}});
    await write('alice','/profiles/alice',{avatar:testMapImage});
    await write('owner','/notes/@master/secret-note',{title:'Título privado da nota',body:'Texto confidencial'});
    let list=(await f.call('owner',audit)).data;
    assert.ok(list.entries.some(e=>e.action==='note.changed'));
    const count=list.entries.length;
    await write('alice','/notes/alice/diary',{title:'Diário só meu',body:'Anotação privada individual'});
    await write('alice','/sheets/alice',{observations:'Observações privadas individuais'});
    assert.equal((await f.call('owner',audit)).data.entries.length,count,'notas pessoais privadas não geram metadados para a equipe');
    await write('alice','/notes/alice/diary/share',{sharedWith:['owner'],version:1});
    await write('alice','/notes/alice/diary',{title:'Diário só meu',body:'Alteração compartilhada',version:2});
    room=await view();await write('owner','/map-fog',{operation:'enable',version:room.fogVersion});
    room=await view();await write('owner','/map-position-settings',{enabled:true,version:room.mapPositionSettingsVersion});
    await write('owner','/campaign-scenes',{id:'scene',title:'Cena reservada',body:'Texto da cena',pointIds:['secret']},'POST');
    await write('owner','/turns',{action:'next',version:(await f.call('owner',f.root)).data.state.combat.version},'POST');
    const bundle={main:'private-name.obj',kind:'terrain',files:[{name:'private-name.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3').toString('base64')}]};
    const imported=await write('owner','/map-assets',bundle,'POST');await write('owner','/map-objects/'+imported.state.mapObjects[0].id,{position:[4,5,6]});
    list=(await f.call('owner',audit)).data;
    for(const action of ['map.image','map.points','sheet.template','sheet.changed','profile.changed','note.changed','note.access','map.fog','map.positions','campaign.changed','turns.changed','tabletop.changed'])assert.ok(list.entries.some(e=>e.action===action),action);
    const raw=JSON.stringify(list);
    for(const secret of ['Nome oculto','Descrição secreta','Título privado','Texto confidencial','Diário só meu','Anotação privada','Observações privadas','Valor privado','Campo reservado','Cena reservada','Texto da cena','private-name.obj','data:image/','data:text/'])assert.equal(raw.includes(secret),false,secret);
    const notes=(await f.call('owner',audit+'?category=notes')).data.entries;assert.ok(notes.length>=3);assert.ok(notes.every(e=>e.action.startsWith('note.')));
    assert.equal((await f.call('alice',f.root+'/points/secret','PATCH',{name:'Tentativa recusada',version:'old'})).status,403);
    assert.equal((await f.call('owner',f.root+'/notes/@master/secret-note','PATCH',{title:'Outro',body:'',version:999})).status,409);
    await write('owner','/state',{sheetFont:'fell'});
    assert.deepEqual((await f.call('owner',audit)).data.entries,list.entries,'ações sem mudança e recusadas não viram alterações confirmadas');
  }finally{await f.close();}
});
