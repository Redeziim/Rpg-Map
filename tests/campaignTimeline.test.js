import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';

test('timeline: authorship, privacy, paging, conflicts, restore, export and recovery',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-timeline-')),dbPath=join(directory,'timeline.sqlite'),cookies={};let app,base;
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  const draft=(extra={})=>({id:randomUUID(),kind:'session',date:'2026-03-01',title:'Primeira sessão',body:'Chegada ao porto.',...extra});
  try{
    await start();for(const username of ['owner','mestre','alice','outsider'])await call(username,'/auth/register','POST',{username,password:'local-timeline-review'});
    const room=(await call('owner','/rooms','POST',{name:'Campanha de teste'})).body,root='/rooms/'+room.id,line=root+'/timeline';
    await call('owner',root+'/members','POST',{username:'mestre',role:'master'});await call('owner',root+'/members','POST',{username:'alice',role:'player'});
    // Two scenes: one published, one reserved. Links to the reserved one must never reach a player.
    const open=randomUUID(),hidden=randomUUID();
    assert.equal((await call('mestre',root+'/campaign-scenes','POST',{id:open,title:'Cena aberta',body:'',pointIds:[],visibility:'table'})).status,201);
    assert.equal((await call('mestre',root+'/campaign-scenes','POST',{id:hidden,title:'Cena reservada',body:'',pointIds:[],visibility:'master'})).status,201);

    // Only the master writes. The author is the session user, never the payload.
    assert.equal((await call('alice',line,'POST',draft())).status,403);
    assert.equal((await call('outsider',line)).status,403);
    assert.equal((await call('mestre',line,'POST',draft({author:'alice'}))).status,400);
    assert.equal((await call('mestre',line,'POST',draft({date:'2026-02-30'}))).status,400);
    assert.equal((await call('mestre',line,'POST',draft({title:'   '}))).status,400);
    assert.equal((await call('mestre',line,'POST',draft({pointIds:['nao-existe']}))).status,400);
    assert.equal((await call('mestre',line,'POST',draft({sceneIds:[randomUUID()]}))).status,400);
    assert.equal((await call('owner',line+'?mapViewMode=player','POST',draft())).status,403);

    const first=draft({sceneIds:[open,hidden]});
    const created=await call('mestre',line,'POST',first);assert.equal(created.status,201);
    assert.equal(created.body.entry.author,'mestre');assert.equal(created.body.entry.visibility,'master');assert.equal(created.body.entry.version,1);
    // A lost response is repeated with the same identity and does not duplicate.
    const repeated=await call('mestre',line,'POST',first);assert.equal(repeated.status,200);assert.equal(repeated.body.entry.id,first.id);
    assert.equal((await call('mestre',line,'POST',{...first,title:'Outro texto'})).status,409);

    // Reserved by default: invisible to players, in page, detail and snapshot revision.
    const playerRevision=(await call('alice',root)).body.timelineRevision;
    assert.deepEqual((await call('alice',line)).body.entries,[]);
    assert.equal((await call('alice',line+'/'+first.id)).status,404);
    assert.equal((await call('mestre',line+'/'+first.id)).body.entry.title,'Primeira sessão');

    // Publishing changes what the player sees; links never expose the reserved scene.
    const published=await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:1,visibility:'table'});assert.equal(published.status,200);assert.equal(published.body.entry.version,2);
    assert.notEqual((await call('alice',root)).body.timelineRevision,playerRevision);
    const seen=(await call('alice',line)).body.entries;assert.equal(seen.length,1);assert.deepEqual(seen[0].sceneIds,[open]);
    assert.deepEqual((await call('mestre',line+'/'+first.id)).body.entry.sceneIds.sort(),[open,hidden].sort());
    assert.equal((await call('alice',line+'/'+first.id,'PATCH',{expectedVersion:2,title:'x'})).status,403);

    // A stale edit keeps both sides: the server answers with the current entry for review.
    const stale=await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:1,title:'Título antigo'});
    assert.equal(stale.status,409);assert.equal(stale.body.details.current.version,2);
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{title:'sem versão'})).status,400);

    // Ordering by event date, then creation time, then id; pages carry the collection revision.
    for(let i=0;i<24;i++)assert.equal((await call('mestre',line,'POST',draft({date:i%2?'2026-04-10':'2026-04-09',title:'Registro '+i,visibility:'table',kind:i%3?'decision':'session'}))).status,201);
    let page=(await call('alice',line)).body;assert.equal(page.entries.length,20);assert.equal(page.hasMore,true);assert.equal(page.entries[0].date,'2026-04-10');
    const ids=page.entries.map(entry=>entry.id),cursor=page.next,pageRevision=page.revision;
    const query=`?before=${cursor.date},${cursor.createdAt},${cursor.id}&revision=${pageRevision}`;
    const second=(await call('alice',line+query)).body;assert.equal(second.entries.length,5);assert.equal(second.hasMore,false);
    assert.equal(new Set([...ids,...second.entries.map(entry=>entry.id)]).size,25);assert.equal(second.entries.at(-1).id,first.id);
    assert.equal((await call('alice',line+'?kind=decision')).body.entries.every(entry=>entry.kind==='decision'),true);
    assert.equal((await call('alice',line+'?kind=invalid')).status,400);
    // A change between pages refuses the old cursor instead of mixing two versions of the list.
    await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:2,body:'Texto novo.'});
    assert.equal((await call('alice',line+query)).status,409);
    assert.equal((await call('alice',line+`?before=2026-04-10,1,${cursor.id}`)).status,409);
    assert.equal((await call('alice',line+'?before=lixo&revision=x')).status,400);

    // History keeps every version; restoring writes a new one and never rewrites the past.
    const versions=(await call('mestre',line+'/'+first.id+'/versions')).body.versions;assert.deepEqual(versions.map(item=>item.version),[3,2,1]);
    assert.equal((await call('alice',line+'/'+first.id+'/versions')).status,403);
    const restored=await call('mestre',line+'/'+first.id+'/restore','POST',{version:1,expectedVersion:3});
    assert.equal(restored.status,200);assert.equal(restored.body.entry.version,4);assert.equal(restored.body.entry.body,'Chegada ao porto.');assert.equal(restored.body.entry.visibility,'master');

    // Archiving removes the entry from readers and keeps it restorable by a master.
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:4,archived:true})).status,200);
    assert.equal((await call('mestre',line+'?archived=1')).body.entries.map(entry=>entry.id).includes(first.id),true);
    assert.equal((await call('alice',line+'?archived=1')).status,403);
    assert.equal((await call('mestre',line)).body.entries.some(entry=>entry.id===first.id),false);
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:5,archived:false})).body.entry.archived,false);

    // Preparação is the master's own note for the next session: reserved by kind, never published, never listed for players.
    assert.equal((await call('mestre',line,'POST',draft({kind:'prep',visibility:'table'}))).status,400);
    const prep=draft({kind:'prep',title:'Roteiro da próxima sessão'});
    assert.equal((await call('mestre',line,'POST',prep)).status,201);
    assert.equal((await call('mestre',line+'/'+prep.id,'PATCH',{expectedVersion:1,visibility:'table'})).status,400);
    assert.equal((await call('mestre',line+'?kind=prep')).body.entries.map(entry=>entry.id).join(),prep.id);
    assert.equal((await call('alice',line+'?kind=prep')).body.entries.length,0);assert.equal((await call('alice',line+'/'+prep.id)).status,404);
    // Turning a published entry into a preparation needs the reserved visibility in the same edit.
    const live=(await call('mestre',line+'/'+first.id)).body.entry;assert.equal(live.visibility,'master');
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:live.version,visibility:'table'})).status,200);
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:live.version+1,kind:'prep'})).status,400);
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:live.version+1,kind:'prep',visibility:'master'})).status,200);
    assert.equal((await call('alice',line+'/'+first.id)).status,404);
    assert.equal((await call('mestre',line+'/'+first.id,'PATCH',{expectedVersion:live.version+2,kind:'session'})).status,200);
    const versionCount=(await call('mestre',line+'/'+first.id+'/versions')).body.versions.length;
    // Audit holds the action type only, never the text.
    const audit=(await call('owner',root+'/audit')).body.entries;assert.ok(audit.some(entry=>entry.action==='timeline.changed'&&Object.keys(entry.details).length===0));

    // Export carries reserved entries only for a master and respects the viewer's projection.
    const exportFor=async(who,body)=>{const job=(await call(who,root+'/exports','POST',body)).body;return {job,data:(await call(who,job.downloadUrl.replace(/^\/api/,''))).body};};
    const master=await exportFor('owner',{viewMode:'master'}),player=await exportFor('alice',{viewMode:'player'});
    assert.equal(master.data.timeline.length,26);assert.equal(master.job.counts.timeline,26);
    assert.equal(player.data.timeline.length,24);assert.equal(player.data.timeline.every(entry=>entry.visibility==='table'&&!entry.archived),true);
    assert.equal(JSON.stringify(player.data).includes(hidden),false);

    // Restart, backup and restore keep entries, versions and their order.
    const before=(await call('mestre',line)).body.entries;
    await stop();await start();
    assert.deepEqual((await call('mestre',line)).body.entries,before);
    const backupPath=join(directory,'backup.sqlite'),restoredPath=join(directory,'restored.sqlite');
    await createBackup(dbPath,backupPath);await restoreBackup(backupPath,restoredPath);await stop();await start(restoredPath);
    assert.deepEqual((await call('mestre',line)).body.entries,before);
    assert.equal((await call('mestre',line+'/'+first.id+'/versions')).body.versions.length,versionCount);
    // Recovery rejects a record the API would never have accepted, without publishing a backup.
    app.db.prepare("UPDATE timeline_entries SET entry_date='2026-13-45' WHERE id=?").run(first.id);
    await assert.rejects(createBackup(restoredPath,join(directory,'invalid.sqlite')),/linha do tempo/i);
  }finally{if(app)await stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
