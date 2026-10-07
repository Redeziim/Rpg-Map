import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,copyFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup,verifyBackup} from '../scripts/databaseRecovery.js';

test('combat command with a lost response is confirmed once and returns current state after restart and access changes',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-combat-recovery-')),dbPath=join(directory,'review.sqlite'),cookies={};let app,base;
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['owner','master','alice','outsider'])await call(username,'/auth/register','POST',{username,password:'local-combat-recovery'});
    const room=(await call('owner','/rooms','POST',{name:'Retomada de teste'})).body,root='/rooms/'+room.id;
    for(const [username,role]of [['master','master'],['alice','player']])await call('owner',root+'/members','POST',{username,role});
    let view=(await call('master',root)).body;
    view=(await call('master',root+'/turns','POST',{action:'add',name:'Guarda da ponte',kind:'enemy',version:view.state.combat.version})).body;
    const original={action:'next',version:view.state.combat.version,operationId:randomUUID(),requestedAt:Date.now()};
    const status=await new Promise((done,reject)=>{
      const payload=JSON.stringify(original),request=httpRequest(base+root+'/turns',{method:'POST',headers:{Cookie:cookies.master,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},response=>{response.destroy();done(response.statusCode);});
      request.on('error',reject);request.end(payload);
    });
    assert.equal(status,200);
    const receiptPath=root+'/turn-operations/'+original.operationId+'?requestedAt='+original.requestedAt;
    const checked=await call('master',receiptPath);assert.equal(checked.status,200);
    assert.equal(checked.body.combatOperation.phase,'confirmed');assert.equal(checked.body.combatOperation.changed,true);
    assert.equal(checked.body.state.combat.activeId,'owner');assert.equal(checked.body.state.combat.round,1);
    assert.equal(checked.body.state.combat.version,original.version+1);
    const revision=checked.body.revision;
    const repeat=await call('master',root+'/turns','POST',original);assert.equal(repeat.status,200);assert.equal(repeat.body.revision,revision);
    assert.equal((await call('master',root+'/turns','POST',{...original,action:'skip'})).status,409);
    view=(await call('owner',root+'/turns','POST',{action:'skip',version:repeat.body.state.combat.version})).body;
    assert.equal(view.state.combat.activeId,'alice');
    const oldReplay=(await call('master',root+'/turns','POST',original)).body;
    assert.equal(oldReplay.state.combat.activeId,'alice');assert.equal(oldReplay.combatOperation.resultVersion,original.version+1);
    const simultaneous={action:'skip',version:view.state.combat.version,operationId:randomUUID(),requestedAt:Date.now()};
    const pair=await Promise.all([call('master',root+'/turns','POST',simultaneous),call('master',root+'/turns','POST',simultaneous)]);
    assert.deepEqual(pair.map(result=>result.status),[200,200]);view=(await call('master',root)).body;
    assert.equal(view.state.combat.version,simultaneous.version+1);assert.equal(view.state.combat.activeId,view.state.combat.npcs[0].id);assert.equal(view.state.combat.round,1);
    const other=(await call('alice',receiptPath)).body;assert.equal(other.combatOperation.phase,'unconfirmed');assert.equal(Object.hasOwn(other.combatOperation,'resultVersion'),false);
    assert.equal((await call('outsider',receiptPath)).status,403);
    // Inject a real SQLite failure; observe rollback and retry through HTTP.
    const failing={action:'skip',version:view.state.combat.version,operationId:randomUUID(),requestedAt:Date.now()};
    app.db.exec("CREATE TEMP TRIGGER fail_combat_confirmation BEFORE INSERT ON combat_operations BEGIN SELECT RAISE(ABORT,'confirmation failure'); END");
    assert.equal((await call('master',root+'/turns','POST',failing)).status,500);
    const afterFailure=(await call('master',root)).body;
    assert.deepEqual(afterFailure.state.combat,view.state.combat);assert.equal(afterFailure.revision,view.revision);
    assert.equal((await call('master',root+'/turn-operations/'+failing.operationId+'?requestedAt='+failing.requestedAt)).body.combatOperation.phase,'unconfirmed');
    app.db.exec('DROP TRIGGER fail_combat_confirmation');
    view=(await call('master',root+'/turns','POST',failing)).body;
    assert.equal(view.state.combat.activeId,'owner');assert.equal(view.state.combat.round,2);assert.equal(view.state.combat.version,failing.version+1);
    const backup=join(directory,'backup.sqlite'),restored=join(directory,'restored.sqlite');
    await createBackup(dbPath,backup);assert.equal((await verifyBackup(backup)).database.userVersion,8);
    await restoreBackup(backup,restored);await stop();await start(restored);const resumed=(await call('master',receiptPath)).body;
    assert.deepEqual(resumed.state.combat,view.state.combat);assert.equal(resumed.revision,view.revision);
    assert.equal(resumed.combatOperation.phase,'confirmed');
    const master=resumed.members.find(member=>member.username==='master');
    await call('owner',root+'/members/'+master.id,'PATCH',{role:'player'});
    assert.equal((await call('master',receiptPath)).body.role,'player');
    assert.equal((await call('master',root+'/turns','POST',original)).status,403);
    await call('owner',root+'/members/'+master.id,'DELETE');
    assert.equal((await call('master',receiptPath)).status,403);
    // A known v5 backup keeps its original schema/counts; only opening the restored copy migrates it.
    await stop();const previous=join(directory,'previous.sqlite');copyFileSync(backup,previous);
    const old=new DatabaseSync(previous);try{old.exec('DROP TABLE timeline_versions; DROP TABLE timeline_entries; DROP TABLE scene_media; DROP TABLE combat_operations; DELETE FROM schema_migrations WHERE version>=6; PRAGMA user_version=5;');}finally{old.close();}
    const oldBackup=join(directory,'previous-backup.sqlite'),oldRestored=join(directory,'previous-restored.sqlite');
    await createBackup(previous,oldBackup);const oldVerified=await verifyBackup(oldBackup);
    assert.equal(oldVerified.database.userVersion,5);assert.equal(Object.hasOwn(oldVerified.database.counts,'combat_operations'),false);
    await restoreBackup(oldBackup,oldRestored);await start(oldRestored);
    assert.deepEqual((await call('master',root)).body.state.combat,view.state.combat);
    const migrated=join(directory,'migrated.sqlite');await createBackup(oldRestored,migrated);
    assert.equal((await verifyBackup(migrated)).database.userVersion,8);assert.equal((await verifyBackup(oldBackup)).database.userVersion,5);
  }finally{if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
