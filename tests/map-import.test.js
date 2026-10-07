import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpRequest} from 'node:http';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';
import {createApplication} from '../server/app.js';
import {createMapAssetBlob} from '../src/components/tabletop/mapAssetTransfer.js';

const packet=()=>createMapAssetBlob({main:'triangle.obj',kind:'structure',files:[{name:'triangle.obj',blob:new Blob(['v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3\n'])}]});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-import-')),cookies={},users={};let app,base;
  async function start(dbPath=join(directory,'review.sqlite')){app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const closed=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await closed;app=null;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data&&!(data instanceof Blob)?{'Content-Type':'application/json'}:{})},body:data instanceof Blob?data:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,data:await response.json()};
  }
  await start();
  for(const who of ['owner','master','player']){const result=await call(who,'/auth/register','POST',{username:who,password:'local-model-import-review'});assert.equal(result.status,200);users[who]=result.data.id;}
  const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Importação descartável'})).data.id;
  for(const [who,role]of [['master','master'],['player','player']])assert.equal((await call('owner',root+'/members','POST',{username:who,role})).status,200);
  return {root,users,call,start,stop,directory,get base(){return base;},cookie:who=>cookies[who],async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('model import has a private receipt and publishes a single confirmed object with warnings and current state',async()=>{
  const f=await fixture();
  try{
    const before=(await f.call('owner',f.root)).data;
    const prepared=await f.call('master',f.root+'/map-imports','POST',{});assert.equal(prepared.status,201);
    assert.equal(prepared.data.phase,'prepared');assert.match(prepared.data.id,/^[a-f0-9-]{36}$/);
    const path=f.root+'/map-imports/'+prepared.data.id;
    assert.equal((await f.call('master',path)).data.phase,'prepared');
    assert.equal((await f.call('owner',path)).status,404,'another master cannot inspect a private import receipt');
    const created=await f.call('master',f.root+'/map-assets?importId='+prepared.data.id,'POST',packet());assert.equal(created.status,201);
    assert.equal(created.data.import.phase,'confirmed');assert.equal(created.data.import.objectId,created.data.state.mapObjects[0].id);
    const receipt=(await f.call('master',path)).data;assert.equal(receipt.phase,'confirmed');assert.deepEqual(receipt.warnings,created.data.modelValidation.warnings);
    const current=(await f.call('player',f.root)).data;assert.equal(current.state.mapObjects.length,1);assert.equal(current.revision,before.revision+1);
    assert.equal((await f.call('player',f.root+'/map-imports','POST',{})).status,403);
    assert.equal((await f.call('owner',f.root+'/map-imports?mapViewMode=player','POST',{})).status,403);
  }finally{await f.close();}
});

async function waitForPhase(f,path,phase){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){const value=(await f.call('master',path)).data;if(value.phase===phase)return value;await new Promise(done=>setTimeout(done,10));}
  assert.fail('Importação não chegou à etapa '+phase);
}
test('cancelling before upload, during transfer or during validation prevents partial publication and cannot cancel another author',async()=>{
  const f=await fixture();let slow;
  try{
    const prepared=(await f.call('master',f.root+'/map-imports','POST',{})).data,path=f.root+'/map-imports/'+prepared.id;
    assert.equal((await f.call('owner',path,'DELETE')).status,404);
    assert.equal((await f.call('master',path,'DELETE')).data.phase,'cancelled');
    assert.equal((await f.call('master',f.root+'/map-assets?importId='+prepared.id,'POST',packet())).status,409);
    const transferring=(await f.call('master',f.root+'/map-imports','POST',{})).data,transferPath=f.root+'/map-imports/'+transferring.id;
    slow=httpRequest(f.base+f.root+'/map-assets?importId='+transferring.id,{method:'POST',headers:{Cookie:f.cookie('master'),'Content-Type':'application/vnd.grimorio.map-asset','Content-Length':packet().size}});
    slow.on('error',()=>{});slow.write(Buffer.from(await packet().slice(0,12).arrayBuffer()));
    await waitForPhase(f,transferPath,'uploading');
    assert.equal((await f.call('master',transferPath,'DELETE')).data.phase,'cancelled');slow.destroy();slow=null;
    const checking=(await f.call('master',f.root+'/map-imports','POST',{})).data,checkingPath=f.root+'/map-imports/'+checking.id;
    const geometry=Array.from({length:60000},(_,i)=>`v ${i%3} ${Math.floor(i/3)%2} ${i%5}`).join('\n')+'\n'+Array.from({length:19999},(_,i)=>`f ${i*3+1} ${i*3+2} ${i*3+3}`).join('\n');
    const heavy=createMapAssetBlob({main:'heavy.obj',kind:'structure',files:[{name:'heavy.obj',blob:new Blob([geometry])}]});
    const uploading=f.call('master',f.root+'/map-assets?importId='+checking.id,'POST',heavy);
    await waitForPhase(f,checkingPath,'checking');assert.equal((await f.call('master',checkingPath,'DELETE')).data.phase,'cancelled');
    assert.equal((await uploading).status,499);assert.equal((await f.call('master',checkingPath)).data.phase,'cancelled');
    assert.equal((await f.call('player',f.root)).data.state.mapObjects.length,0);
    const exported=(await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).data;
    const portable=(await f.call('owner',exported.downloadUrl.replace(/^\/api/,''))).data;assert.deepEqual(portable.assets.models,[]);
  }finally{slow?.destroy();await f.close();}
});

test('a lost confirmation is recovered after restart; cancelling or replaying it never duplicates or resurrects an object',async()=>{
  const f=await fixture();
  try{
    const prepared=(await f.call('master',f.root+'/map-imports','POST',{})).data,path=f.root+'/map-imports/'+prepared.id;
    const payload=Buffer.from(await packet().arrayBuffer());
    await new Promise((done,reject)=>{
      const upload=httpRequest(f.base+f.root+'/map-assets?importId='+prepared.id,{method:'POST',headers:{Cookie:f.cookie('master'),'Content-Type':packet().type,'Content-Length':payload.length}},response=>{response.destroy();done();});
      upload.on('error',reject);upload.end(payload);
    });
    let receipt=(await f.call('master',path)).data;assert.equal(receipt.phase,'confirmed');assert.ok(receipt.objectId);
    assert.equal((await f.call('master',path,'DELETE')).data.phase,'confirmed','cancellation cannot undo a committed import');
    const backup=join(f.directory,'backup.sqlite'),restored=join(f.directory,'restored.sqlite');
    await createBackup(join(f.directory,'review.sqlite'),backup);await restoreBackup(backup,restored);
    const previous=join(f.directory,'previous-v3.sqlite'),previousBackup=join(f.directory,'previous-backup.sqlite');copyFileSync(backup,previous);
    const oldDatabase=new DatabaseSync(previous);oldDatabase.exec('DROP TABLE timeline_versions; DROP TABLE timeline_entries; DROP TABLE scene_media; DROP TABLE combat_operations; DROP TABLE dice_live; DROP TABLE dice_receipts; DROP TABLE dice_rolls; DROP INDEX idx_map_imports_expires; DROP TABLE map_imports; DELETE FROM schema_migrations WHERE version>=4; PRAGMA user_version=3;');oldDatabase.close();
    await createBackup(previous,previousBackup);
    assert.equal(Object.hasOwn(JSON.parse(readFileSync(previousBackup+'.json','utf8')).database.counts,'map_imports'),false,'old manifests keep the table counts from their schema version');
    await restoreBackup(previousBackup,join(f.directory,'previous-restored.sqlite'));
    const damaged=join(f.directory,'damaged-receipt.sqlite');copyFileSync(backup,damaged);
    const damagedDatabase=new DatabaseSync(damaged);damagedDatabase.prepare('UPDATE map_imports SET result=? WHERE id=?').run('invalid-json',prepared.id);damagedDatabase.close();
    await assert.rejects(createBackup(damaged,join(f.directory,'rejected.sqlite')),/JSON inválido/);
    await f.stop();await f.start(restored);receipt=(await f.call('master',path)).data;assert.equal(receipt.phase,'confirmed');
    const replay=await f.call('master',f.root+'/map-assets?importId='+prepared.id,'POST',packet());assert.equal(replay.status,200);
    assert.equal(replay.data.import.objectId,receipt.objectId);assert.equal(replay.data.state.mapObjects.length,1);
    await f.call('master',f.root+'/map-objects/'+receipt.objectId,'PATCH',{position:[12,0,0]});
    const fresh=await f.call('master',f.root+'/map-assets?importId='+prepared.id,'POST',packet());assert.equal(fresh.data.state.mapObjects[0].position[0],12,'replay returns current state');
    assert.equal((await f.call('master',f.root+'/map-objects/'+receipt.objectId,'DELETE')).status,200);
    const removed=await f.call('master',f.root+'/map-assets?importId='+prepared.id,'POST',packet());assert.equal(removed.status,200);assert.equal(removed.data.state.mapObjects.length,0);
    const abandoned=(await f.call('master',f.root+'/map-imports','POST',{})).data;
    await f.stop();await f.start(restored);assert.equal((await f.call('master',f.root+'/map-imports/'+abandoned.id,'DELETE')).data.phase,'cancelled');
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.master,'DELETE')).status,200);
    assert.equal((await f.call('master',path)).status,403);
  }finally{await f.close();}
});
