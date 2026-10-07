import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';

test('notes: the trash keeps a note until its owner empties it, and hides it from everyone else',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-trash-')),dbPath=join(directory,'trash.sqlite'),cookies={};let app,base;
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['owner','alice','bob'])await call(username,'/auth/register','POST',{username,password:'local-trash-review'});
    const room=(await call('owner','/rooms','POST',{name:'Lixeira de teste'})).body,root='/rooms/'+room.id;
    await call('owner',root+'/members','POST',{username:'alice',role:'player'});await call('owner',root+'/members','POST',{username:'bob',role:'player'});
    const note=randomUUID(),mine=n=>(n.state.playerSheets.alice?.notebooks||[]).find(item=>item.id===note);
    assert.equal((await call('alice',`${root}/notes/alice/${note}`,'PATCH',{title:'Plano secreto',body:'Texto da nota'})).status,200);
    assert.equal((await call('alice',`${root}/notes/alice/${note}/share`,'PATCH',{sharedWith:['bob'],version:1})).status,200);
    assert.equal((await call('bob',root)).body.state.sharedNotebooks.length,1);
    // Only the owner trashes, and a stale version is refused.
    assert.equal((await call('bob',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:true,version:2})).status,403);
    assert.equal((await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:true,version:1})).status,409);
    assert.equal((await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:'sim',version:2})).status,400);
    const trashed=await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:true,version:2});assert.equal(trashed.status,200);
    assert.equal(mine(trashed.body).trashed,true);assert.equal(mine(trashed.body).version,3);assert.ok(mine(trashed.body).trashedAt>0);
    // Gone for the person it was shared with; still held for the owner; frozen for editing and sharing.
    assert.equal((await call('bob',root)).body.state.sharedNotebooks.length,0);
    assert.equal((await call('bob',root)).body.state.playerSheets.alice,undefined);
    assert.equal((await call('alice',`${root}/notes/alice/${note}`,'PATCH',{title:'Novo nome',body:'x',version:3})).status,409);
    assert.equal((await call('alice',`${root}/notes/alice/${note}/share`,'PATCH',{sharedWith:[],version:3})).status,409);
    // Nothing deletes by age: age the record by a year and run maintenance.
    app.db.prepare("UPDATE rooms SET state=json_set(state,'$.playerSheets.alice.notebooks[0].trashedAt',?) WHERE id=?").run(Date.now()-366*86400000,room.id);
    app.maintenance.runOnce();assert.equal(mine((await call('alice',root)).body)?.trashed,true);
    // Restore brings back the content, bumps the version and reopens sharing for bob.
    const restored=await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:false,version:3});assert.equal(restored.status,200);
    assert.equal(mine(restored.body).trashed,undefined);assert.equal(mine(restored.body).version,4);assert.equal(mine(restored.body).body,'Texto da nota');
    assert.equal((await call('bob',root)).body.state.sharedNotebooks.length,1);
    const history=(await call('alice',`${root}/notes/alice/${note}/history`)).body.versions.map(item=>item.kind);assert.ok(history.includes('trash')&&history.includes('restore'));
    // Trashed notes do not count toward the 30-note limit; the trash itself is capped at 60.
    await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:true,version:4});
    for(let i=0;i<30;i++)assert.equal((await call('alice',`${root}/notes/alice/${randomUUID()}`,'PATCH',{title:'Nota '+i,body:''})).status,200);
    assert.equal((await call('alice',`${root}/notes/alice/${randomUUID()}`,'PATCH',{title:'Extra',body:''})).status,400);
    assert.equal((await call('alice',`${root}/notes/alice/${note}/trash`,'PATCH',{trashed:false,version:5})).status,400);
    // Exports follow the same visibility.
    const exported=async who=>{const job=(await call(who,root+'/exports','POST',{viewMode:who==='owner'?'master':'player'})).body;return (await call(who,job.downloadUrl.replace(/^\/api/,''))).body;};
    assert.equal(JSON.stringify(await exported('bob')).includes('Plano secreto'),false);
    // Only the owner empties; emptying removes the note and its history for good, and survives restart and backup.
    assert.equal((await call('bob',`${root}/notes/alice/trash`,'DELETE')).status,403);
    assert.equal((await call('owner',`${root}/notes/alice/trash`,'DELETE')).status,403);
    const emptied=await call('alice',`${root}/notes/alice/trash`,'DELETE');assert.equal(emptied.status,200);
    assert.equal(mine(emptied.body),undefined);assert.equal((await call('alice',`${root}/notes/alice/${note}/history`)).status,404);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM note_versions WHERE note_id=?').get(note).n,0);
    assert.equal((await call('alice',root)).body.state.playerSheets.alice.notebooks.length,30);
    // The master notebook behaves the same way, in master mode only.
    const reserved=randomUUID();
    assert.equal((await call('owner',`${root}/notes/@master/${reserved}`,'PATCH',{title:'Segredo do mestre',body:''})).status,200);
    assert.equal((await call('alice',`${root}/notes/@master/${reserved}/trash`,'PATCH',{trashed:true,version:1})).status,403);
    assert.equal((await call('owner',`${root}/notes/@master/${reserved}/trash?mapViewMode=player`,'PATCH',{trashed:true,version:1})).status,403);
    assert.equal((await call('owner',`${root}/notes/@master/${reserved}/trash`,'PATCH',{trashed:true,version:1})).status,200);
    await stop();await start();
    assert.equal((await call('owner',root)).body.state.masterNotebooks[0].trashed,true);
    const backupPath=join(directory,'backup.sqlite'),restoredPath=join(directory,'restored.sqlite');
    await createBackup(dbPath,backupPath);await restoreBackup(backupPath,restoredPath);await stop();await start(restoredPath);
    assert.equal((await call('owner',root)).body.state.masterNotebooks[0].trashed,true);
    assert.equal((await call('owner',`${root}/notes/@master/trash`,'DELETE')).status,200);
    assert.equal((await call('owner',root)).body.state.masterNotebooks.length,0);
  }finally{if(app)await stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
