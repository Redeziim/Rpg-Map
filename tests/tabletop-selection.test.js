import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createApplication} from '../server/app.js';
import {DatabaseSync} from 'node:sqlite';
import {createBackup,restoreBackup,verifyBackup} from '../scripts/databaseRecovery.js';

const bundle={main:'piece.obj',kind:'structure',files:[{name:'piece.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n').toString('base64')}]};
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-selection-')),cookies={},users={};let app,base;
  const dbPath=join(directory,'review.sqlite');
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const closed=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await closed;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  await start();for(const who of ['owner','master','player'])users[who]=(await call(who,'/auth/register','POST',{username:who,password:'local-selection-review'})).body.id;
  const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Grupos descartáveis'})).body.id;
  for(const [who,role]of [['master','master'],['player','player']])await call('owner',root+'/members','POST',{username:who,role});
  async function action(view,action,ids,extra={},who='master'){return call(who,root+'/map-object-actions','POST',{version:view.mapObjectsVersion,action,ids,...extra});}
  return {root,users,call,action,start,stop,dbPath,directory,async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('grouping preserves world poses; group rotation and uniform size move every member; copies share the original package',async()=>{
  const f=await fixture();try{
    let view=(await f.call('master',f.root+'/map-assets','POST',{...bundle,placement:{position:[-2,0,0],rotation:[0,0,0],scale:[2,1,3]}})).body;
    view=(await f.call('master',f.root+'/map-assets','POST',{...bundle,placement:{position:[2,0,0],rotation:[0,0,0],scale:[1,2,1]}})).body;
    const before=structuredClone(view.state.mapObjects),ids=before.map(item=>item.id);
    const grouped=await f.action(view,'group',ids,{name:'Portão'});assert.equal(grouped.status,200);view=grouped.body;
    assert.equal(view.state.mapGroups[0].name,'Portão');assert.equal(view.state.mapGroups.length,1);
    for(let i=0;i<2;i++)for(const key of ['position','rotation','scale'])assert.deepEqual(view.state.mapObjects[i][key],before[i][key]);
    const moved=await f.action(view,'transform',ids,{delta:{position:[10,0,0],rotation:[0,Math.PI/2,0],scale:2}});assert.equal(moved.status,200);view=moved.body;
    const rounded=value=>value.map(v=>Math.round(v*1e6)/1e6);
    assert.deepEqual(rounded(view.state.mapObjects[0].position),[10,0,4]);assert.deepEqual(rounded(view.state.mapObjects[1].position),[10,0,-4]);
    assert.deepEqual(view.state.mapObjects[0].scale,[4,2,6]);assert.deepEqual(rounded(view.state.mapObjects[0].rotation),[0,1.570796,0]);
    const copied=await f.action(view,'duplicate',ids);assert.equal(copied.status,200);view=copied.body;
    assert.equal(view.state.mapObjects.length,4);assert.equal(view.state.mapGroups.length,2);assert.notEqual(view.state.mapGroups[0].id,view.state.mapGroups[1].id);
    assert.equal(new Set(view.state.mapObjects.map(item=>item.id)).size,4);
    assert.deepEqual(view.state.mapObjects.slice(2).map(item=>item.assetId),before.map(item=>item.assetId));
    const exported=(await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).body;
    const portable=(await f.call('owner',exported.downloadUrl.replace(/^\/api/,''))).body;assert.equal(portable.assets.models.length,2);
    const saved=structuredClone(view.state.mapObjects.slice(0,2));const split=await f.action(view,'ungroup',ids);assert.equal(split.status,200);
    for(let i=0;i<2;i++){assert.equal(split.body.state.mapObjects[i].groupId,null);for(const key of ['position','rotation','scale'])assert.deepEqual(split.body.state.mapObjects[i][key],saved[i][key]);}
  }finally{await f.close();}
});

test('locks and changed permissions refuse all transforms; stale batches cannot overwrite or duplicate and invalid batches stay atomic',async()=>{
  const f=await fixture();try{
    let view=(await f.call('master',f.root+'/map-assets','POST',bundle)).body;
    view=(await f.call('master',f.root+'/map-assets','POST',bundle)).body;const ids=view.state.mapObjects.map(item=>item.id);
    const locked=await f.action(view,'lock',[ids[0]],{locked:true});assert.equal(locked.status,200);view=locked.body;assert.equal(view.state.mapObjects[0].locked,true);
    for(const patch of [{position:[1,2,3]},{rotation:[0,1,0]},{scale:[2,2,2]}])assert.equal((await f.call('master',f.root+'/map-objects/'+ids[0],'PATCH',patch)).status,423);
    assert.equal((await f.action(view,'transform',ids,{delta:{position:[4,0,0]}})).status,423);
    assert.deepEqual((await f.call('master',f.root)).body.state.mapObjects,view.state.mapObjects);
    for(const who of ['player','owner'])assert.equal((await f.call(who,f.root+'/map-object-actions'+(who==='owner'?'?mapViewMode=player':''),'POST',{version:view.mapObjectsVersion,action:'lock',ids,locked:false})).status,403);
    view=(await f.action(view,'lock',ids,{locked:false})).body;
    const stale=structuredClone(view),changed=await f.action(view,'transform',ids,{delta:{position:[1,0,0]}});assert.equal(changed.status,200);view=changed.body;
    assert.equal((await f.action(stale,'transform',ids,{delta:{position:[99,0,0]}})).status,409);assert.equal((await f.action(stale,'duplicate',ids)).status,409);
    assert.equal((await f.call('master',f.root+'/map-objects/'+ids[0],'PATCH',{expectedVersion:stale.state.mapObjects[0].version,position:[99,0,0]})).status,409);
    assert.equal((await f.action(view,'transform',ids,{patches:[{id:ids[0],position:[9,0,0]},{id:ids[1],scale:[0,1,1]}]})).status,400);
    assert.deepEqual((await f.call('master',f.root)).body.state.mapObjects,view.state.mapObjects);
    view=(await f.action(view,'group',ids,{name:'Dois'})).body;
    assert.equal((await f.call('master',f.root+'/map-objects/'+ids[0],'PATCH',{position:[8,0,0]})).status,409);
    view=(await f.action(view,'lock',[ids[0]],{locked:true})).body;assert.ok(view.state.mapObjects.every(item=>item.locked));
    await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'});
    assert.equal((await f.action(view,'lock',ids,{locked:false})).status,403);assert.equal((await f.call('master',f.root+'/map-objects/'+ids[1],'DELETE')).status,403);
  }finally{await f.close();}
});

test('old backups migrate once; groups and locks survive restart and shared packages are removed only after their last object',async()=>{
  const f=await fixture();try{
    let view=(await f.call('master',f.root+'/map-assets','POST',{...bundle,placement:{position:[3,2,1],rotation:[0,.5,0],scale:[2,1,3]}})).body;
    const original=structuredClone(view.state.mapObjects[0]);await f.stop();
    // Setup a real version-1 database from the public import, without touching the package.
    const old=new DatabaseSync(f.dbPath),state={...JSON.parse(old.prepare('SELECT state FROM rooms WHERE id=?').get(view.id).state),stateVersion:1};delete state.mapGroups;
    state.mapObjects=state.mapObjects.map(({version,locked,groupId,...item})=>item);old.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(state),view.id);
    old.prepare('INSERT INTO room_state_migrations VALUES(?,?,?,?,?,?)').run(view.id,1,0,0,1,Date.now());old.close();
    const backup=join(f.directory,'old.sqlite'),restored=join(f.directory,'restored.sqlite');await createBackup(f.dbPath,backup);assert.equal((await verifyBackup(backup)).database.roomStateVersions[1],1);await restoreBackup(backup,restored);
    const previousRevision=view.revision;await f.start(restored);view=(await f.call('master',f.root)).body;assert.equal(view.state.stateVersion,7);assert.deepEqual(view.state.mapObjects[0],original);assert.deepEqual(view.state.mapGroups,[]);assert.equal(view.revision,previousRevision+1);
    const revision=view.revision;await f.stop();await f.start(restored);view=(await f.call('master',f.root)).body;assert.equal(view.revision,revision);
    view=(await f.action(view,'duplicate',[original.id])).body;const ids=view.state.mapObjects.map(item=>item.id);view=(await f.action(view,'group',ids,{name:'Travessia'})).body;
    view=(await f.action(view,'lock',ids,{locked:true})).body;const saved=structuredClone(view.state.mapObjects),groups=structuredClone(view.state.mapGroups);
    const exported=(await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).body,portable=(await f.call('owner',exported.downloadUrl.replace(/^\/api/,''))).body;assert.deepEqual(portable.state.mapGroups,groups);assert.equal(portable.assets.models.length,1);
    await f.stop();await f.start(restored);view=(await f.call('player',f.root)).body;assert.deepEqual(view.state.mapObjects,saved);assert.deepEqual(view.state.mapGroups,groups);
    assert.equal((await f.call('owner',f.root+'/map-objects/'+ids[0],'DELETE')).status,200);assert.equal((await f.call('player',f.root+'/map-assets/'+original.assetId)).status,200);
    view=(await f.call('master',f.root)).body;assert.equal(view.state.mapGroups.length,1);assert.equal((await f.action(view,'remove',[ids[1]])).status,200);
    assert.equal((await f.call('player',f.root+'/map-assets/'+original.assetId)).status,404);view=(await f.call('master',f.root)).body;assert.deepEqual(view.state.mapGroups,[]);assert.deepEqual(view.state.mapObjects,[]);
  }finally{await f.close();}
});
