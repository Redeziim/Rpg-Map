import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';

test('shared roll is recorded once with confirmed results and survives a repeated request and restart',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-roll-history-')),dbPath=join(directory,'review.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['owner','alice','outsider'])await call(username,'/auth/register','POST',{username,password:'local-roll-review'});
    const room=(await call('owner','/rooms','POST',{name:'Dados de teste'})).body,root='/rooms/'+room.id;
    await call('owner',root+'/members','POST',{username:'alice',role:'player'});
    const initial=(await call('owner',root)).body;
    await call('owner',root+'/turns','POST',{action:'next',version:initial.state.combat.version});
    const request={operationId:randomUUID(),requestedAt:Date.now(),terms:[{sides:6,qty:2,sign:1},{sides:100,qty:1,sign:-1}],skinId:'carmesim',origin:'group'};
    const rolled=await call('alice',root+'/tray-rolls','POST',request);assert.equal(rolled.status,201);
    const history=await call('owner',root+'/dice-history');assert.equal(history.status,200);
    assert.equal(history.body.entries.length,1);
    const entry=history.body.entries[0];assert.equal(entry.id,rolled.body.trayRoll.id);
    assert.equal(entry.author,'alice');assert.equal(entry.expression,'2d6 − 1d100');assert.equal(entry.origin,'group');
    assert.equal(entry.context.roomName,'Dados de teste');assert.equal(entry.context.combat.activeId,'owner');assert.equal(entry.context.combat.round,1);
    assert.ok(entry.createdAt>=request.requestedAt);assert.deepEqual(entry.parts,rolled.body.trayRoll.parts);assert.equal(entry.total,rolled.body.trayRoll.total);
    assert.equal(Object.hasOwn(entry,'frames'),false);
    const repeated=await call('alice',root+'/tray-rolls','POST',request);assert.equal(repeated.status,200);
    assert.equal(repeated.body.rollReceipt.id,entry.id);assert.equal(repeated.body.revision,rolled.body.revision);
    assert.equal((await call('owner',root+'/dice-history')).body.entries.length,1);
    assert.equal((await call('alice',root+'/tray-rolls','POST',{...request,skinId:'madeira'})).status,409);
    assert.equal((await call('outsider',root+'/dice-history')).status,403);
    await stop();await start();
    const restored=(await call('alice',root)).body;assert.equal(restored.trayRoll.id,entry.id);
    assert.deepEqual(restored.diceHistory,[entry]);assert.equal(restored.revision,rolled.body.revision);
    assert.equal((await call('alice',root+'/tray-rolls','POST',request)).body.rollReceipt.id,entry.id);
    const exported=(await call('owner',root+'/exports','POST',{viewMode:'master'})).body;
    const portable=(await call('owner',exported.downloadUrl.replace(/^\/api/,''))).body;
    assert.deepEqual(portable.diceHistory,[entry]);assert.equal(exported.counts.diceRolls,1);
    const backupPath=join(directory,'backup.sqlite'),restoredPath=join(directory,'restored.sqlite');
    await createBackup(dbPath,backupPath);await restoreBackup(backupPath,restoredPath);await stop();
    app=createApplication({dbPath:restoredPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
    await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;
    assert.deepEqual((await call('alice',root+'/dice-history')).body.entries,[entry]);
    assert.equal((await call('alice',root+'/tray-rolls','POST',request)).body.rollReceipt.id,entry.id);
    // Fixture setup for retention: older confirmed records, with a known d6 result.
    const old={...entry,author:'owner',expression:'1d6',parts:[{sides:6,qty:1,sign:1,rolls:[6]}],total:6,cocked:false};
    const ownerId=(await call('owner',root)).body.members.find(member=>member.username==='owner').id;
    const insert=app.db.prepare('INSERT INTO dice_rolls VALUES(?,?,?,?,?)');
    for(let i=0;i<500;i++){const id=randomUUID(),createdAt=Date.now()-600000-i;insert.run(id,room.id,ownerId,createdAt,JSON.stringify({...old,id,createdAt}));}
    app.db.prepare('DELETE FROM dice_live WHERE room_id=?').run(room.id);
    const fresh={...request,operationId:randomUUID(),requestedAt:Date.now()};
    assert.equal((await call('alice',root+'/tray-rolls','POST',fresh)).status,201);
    let page=(await call('alice',root+'/dice-history')).body,records=[...page.entries];
    while(page.hasMore){page=(await call('alice',root+'/dice-history?before='+page.entries.at(-1).id)).body;records.push(...page.entries);}
    assert.equal(records.length,500);assert.equal(new Set(records.map(record=>record.id)).size,500);
    assert.equal((await call('alice',root+'/tray-rolls','POST',request)).body.rollReceipt.id,entry.id);
    // An expired operation must stay expired even after its receipt is removed.
    const expiredRequest={...request,requestedAt:Date.now()-8*86400000};
    app.db.prepare('UPDATE dice_receipts SET requested_at=?,expires=? WHERE operation_id=?').run(expiredRequest.requestedAt,Date.now()-1000,request.operationId);
    assert.equal((await call('alice',root+'/tray-rolls','POST',expiredRequest)).status,410);
    app.maintenance.runOnce();
    assert.equal((await call('alice',root+'/tray-rolls','POST',expiredRequest)).status,410);
    // Recovery should reject incompatible log contents, without publishing a backup.
    app.db.prepare("UPDATE dice_rolls SET entry='{}' WHERE id=?").run(entry.id);
    await assert.rejects(createBackup(restoredPath,join(directory,'invalid.sqlite')),/rolagem/i);
  }finally{if(app)await stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
