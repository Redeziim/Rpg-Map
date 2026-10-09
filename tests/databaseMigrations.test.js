import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createHash,scryptSync} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createApplication} from '../server/app.js';
import {DATABASE_TABLES,LEGACY_DATABASE_TABLES,DATABASE_USER_VERSION,DATABASE_APPLICATION_ID} from '../server/databaseSchema.js';
import {createBackup,restoreBackup,verifyBackup} from '../scripts/databaseRecovery.js';
import {defaultPointTypes} from '../src/shared/pointTypes.js';
import {testMapImage} from './fixtures/mapImages.js';

const password='local-migration-review-2026';
const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const sha=value=>createHash('sha256').update(value).digest('hex');
const fileHash=path=>sha(readFileSync(path));
const cleanup=directory=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});};
function tableRows(db,definitions=DATABASE_TABLES){return Object.fromEntries(Object.keys(definitions).filter(name=>db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(name)).map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));}
function seedLegacy(path,{library=true,history=true,feedback=true}={}){
  const db=new DatabaseSync(path);
  db.exec(Object.entries(LEGACY_DATABASE_TABLES).filter(([name])=>name!=='note_assets'||library).filter(([name])=>name!=='note_versions'||history).filter(([name])=>name!=='feedback'||feedback).map(([,sql])=>sql+';').join('\n'));
  const salt='local-salt-2026',passwordHash=scryptSync(password,salt,64).toString('hex');
  for(const username of ['owner','player','outsider'])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(username,username,passwordHash,salt);
  const first={points:[{id:'port',name:'Porto antigo',x:10,y:10,type:'cidade',description:'Local de teste'}],mapImage:testMapImage,sheetFields:[],sheetFont:'cinzel',masterNotes:'Texto reservado antigo',turnOrder:['player'],activePlayer:'player',playerSheets:{player:{values:{},extraFields:[],observations:'Diário antigo do jogador'}},statusBarsData:{},importMetadata:{source:'local',keep:true}};
  const board={nodes:[{id:'point',kind:'text',x:100,y:70,text:'Ponto do porto',pointId:'port',tags:['Pista']},{id:'image',kind:'image',x:350,y:70,text:'Brasão',...(library?{assetId:'image'}:{src:'data:image/png;base64,'+imageBytes.toString('base64')})}],edges:[{id:'link',from:'point',to:'image',label:'Revela'}],strokes:[{id:'line',path:'M 10 10 L 30 30'}]};
  const second={...first,masterNotes:'Texto legado mantido em paralelo',masterNotebooks:[{id:'named',title:'Nota existente',body:'Corpo existente',board,version:7,sharedWith:['player']}],playerSheets:{player:{values:{},observations:'Texto paralelo',notebooks:[{id:'mine',title:'Nota privada do jogador',body:'Privado',version:3}]}},mapStrokes:[{id:'old-public',path:'M 10 10 L 20 20',color:'#abc123',author:'player'},{id:'private',path:'M 10 10 L 20 20',color:'#123abc',author:'owner',visibility:'master'}],mapFog:{enabled:true,width:80,height:45,areas:[{x:0,y:0,width:30,height:30}]},mapScale:{cellSize:10,cellDistance:2,unit:'km',offsetX:0,offsetY:0},mapPositions:{enabled:true,markers:{player:{x:10,y:10,version:'marker'}},generation:'preserved-generation'},mapLegend:defaultPointTypes().map((entry,index)=>index?entry:{...entry,label:'Portos e cidades',color:'#123456'}),mapRoutes:[{id:'route',name:'Rota privada',color:'#abcd12',status:'planned',visibility:'master',waypoints:[{x:10,y:10},{x:20,y:20}],archived:false}],campaignScenes:[{id:'scene',title:'Cena compartilhada',body:'Preparação',pointIds:['port'],visibility:'table',version:5,archived:false}],mapObjects:[{id:'asset',assetId:'asset',name:'terreno.obj',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1]}]};
  for(const [id,state,revision] of [['first',first,5],['second',second,9]]){
    db.prepare('INSERT INTO rooms VALUES(?,?,?,?,?)').run(id,id,'owner',JSON.stringify(state),revision);
    for(const [user,role] of [['owner','admin'],['player','player']])db.prepare('INSERT INTO members VALUES(?,?,?)').run(id,user,role);
  }
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha('session-test'),'player',Date.now()+600000);
  db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?)').run('invite','first',sha('invitation-test'),'player',Date.now()+600000,'owner');
  db.prepare('INSERT INTO map_assets VALUES(?,?,?,?)').run('asset','second',JSON.stringify({main:'terreno.obj',kind:'terrain',files:[{name:'terreno.obj',data:'data:text/plain;base64,dGVycmVubw=='}],bytes:7}),7);
  if(library)db.prepare('INSERT INTO note_assets VALUES(?,?,?,?,?,?,?,?,?)').run('image','second','owner',sha(imageBytes),'Brasão.png','image/png',imageBytes,imageBytes.length,Date.now());
  if(history)db.prepare('INSERT INTO note_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('second','@master','named',7,'Nota existente',JSON.stringify({title:'Nota existente',body:'Corpo existente',board}),JSON.stringify(['player']),JSON.stringify(library?['image']:[]),JSON.stringify({nodes:2,edges:1,strokes:1,characters:15}),1234,'owner','save',100);
  db.close();return {first,second,board};
}

test('migrações persistem legado de texto e quadros, preservam dados/privacidade e não repetem atualização ao reiniciar',()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-migrations-preserve-'));
  try{
    for(const [library,history,feedback] of [[false,false,false],[false,false,true],[true,false,true],[true,true,true]]){
      const path=join(directory,`${library}-${history}-${feedback}.sqlite`),seed=seedLegacy(path,{library,history,feedback});
      const original=new DatabaseSync(path,{readOnly:true}),before=tableRows(original,LEGACY_DATABASE_TABLES);original.close();
      let app=createApplication({dbPath:path,rateLimit:false});
      try{
        assert.deepEqual(app.migration,{schemaApplied:DATABASE_USER_VERSION,roomsMigrated:2});
        assert.equal(app.db.prepare('PRAGMA user_version').get().user_version,DATABASE_USER_VERSION);assert.equal(app.db.prepare('PRAGMA application_id').get().application_id,DATABASE_APPLICATION_ID);
        const after=tableRows(app.db);for(const [name,rows] of Object.entries(before))if(name!=='rooms')assert.deepEqual(after[name],rows,name);
        const first=JSON.parse(after.rooms[0].state),second=JSON.parse(after.rooms[1].state);
        assert.equal(first.stateVersion,7);assert.equal(after.rooms[0].revision,6);assert.equal(after.rooms[1].revision,10);
        assert.equal(first.masterNotebooks.length,1);assert.equal(first.masterNotebooks[0].body,seed.first.masterNotes);assert.deepEqual(first.masterNotebooks[0].sharedWith,[]);
        assert.equal(first.playerSheets.player.notebooks[0].body,seed.first.playerSheets.player.observations);
        assert.deepEqual(first.playerSheets.owner.notebooks,[]);assert.deepEqual(first.statusBarsData.player,{avatar:null,bars:[]});assert.deepEqual(first.importMetadata,seed.first.importMetadata);
        assert.equal(second.masterNotebooks.length,1);assert.equal(second.masterNotebooks[0].version,7);assert.deepEqual(second.masterNotebooks[0].sharedWith,['player']);
        assert.deepEqual(second.masterNotebooks[0].board,{...seed.board,width:960,height:620});assert.equal(second.playerSheets.player.notebooks[0].version,3);
        for(const field of ['points','mapImage','mapFog','mapScale','mapPositions','masterNotes'])assert.deepEqual(second[field],seed.second[field],field);
        assert.deepEqual(second.campaignScenes,seed.second.campaignScenes.map(scene=>({...scene,mediaId:null})));assert.deepEqual(second.mapObjects,seed.second.mapObjects.map(item=>({...item,version:1,locked:false,groupId:null,references:[]})));assert.deepEqual(second.mapGroups,[]);
        assert.deepEqual(second.mapStrokes[0],{...seed.second.mapStrokes[0],visibility:'table'});assert.deepEqual(second.mapStrokes[1],seed.second.mapStrokes[1]);
        assert.equal(after.schema_migrations.length,DATABASE_USER_VERSION);assert.equal(after.room_state_migrations.length,2);assert.equal(after.note_versions.length,history?1:0);
        app.close();app=createApplication({dbPath:path,rateLimit:false});assert.deepEqual(app.migration,{schemaApplied:0,roomsMigrated:0});assert.deepEqual(tableRows(app.db),after);
      }finally{app.close();}
    }
    const previous=join(directory,'previous-v2.sqlite');seedLegacy(previous);
    let app=createApplication({dbPath:previous,rateLimit:false});
    const rooms=app.db.prepare('SELECT id,state,revision FROM rooms ORDER BY id').all();app.close();
    const v2=new DatabaseSync(previous);
    v2.exec('DROP TABLE timeline_versions; DROP TABLE timeline_entries; DROP TABLE scene_media; DROP TABLE combat_operations; DROP TABLE dice_live; DROP TABLE dice_receipts; DROP TABLE dice_rolls; DROP INDEX idx_map_imports_expires; DROP TABLE map_imports; DROP INDEX idx_sessions_expires; DROP INDEX idx_invites_expires; DELETE FROM schema_migrations WHERE version>=3; PRAGMA user_version=2;');v2.close();
    app=createApplication({dbPath:previous,rateLimit:false});
    try{assert.deepEqual(app.migration,{schemaApplied:DATABASE_USER_VERSION-2,roomsMigrated:0});assert.deepEqual(app.db.prepare('SELECT id,state,revision FROM rooms ORDER BY id').all(),rooms);assert.equal(app.db.prepare('PRAGMA quick_check').get().quick_check,'ok');}
    finally{app.close();}
  }finally{cleanup(directory);}
});

test('versão futura, estado inválido e históricos inconsistentes impedem abertura e revertem toda a migração',()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-migrations-rollback-'));
  function mutate(path,fn){const db=new DatabaseSync(path);try{fn(db);}finally{db.close();}}
  function rejectUnchanged(path,expected){const bytes=fileHash(path),db=new DatabaseSync(path,{readOnly:true}),before=tableRows(db);db.close();let unexpectedApp;try{assert.throws(()=>{unexpectedApp=createApplication({dbPath:path});},expected);}finally{unexpectedApp?.close();}assert.equal(fileHash(path),bytes);const check=new DatabaseSync(path,{readOnly:true});try{assert.deepEqual(tableRows(check),before);}finally{check.close();}}
  try{
    for(const [name,bad,expected] of [['json','not JSON',/JSON inválido/],['future',JSON.stringify({stateVersion:99}),/Versão do estado/],['array',JSON.stringify([]),/Estado de mesa inválido/],['broken-notes',JSON.stringify({masterNotebooks:[{id:'bad',title:'Bad',board:{nodes:{},edges:[],strokes:[]}}]}),/Estado de mesa inválido/],['broken-turns',JSON.stringify({turnOrder:'uma ordem inválida'}),/Estado de mesa inválido/]]){
      const path=join(directory,name+'.sqlite');seedLegacy(path,{library:false,history:false});
      mutate(path,db=>db.prepare('UPDATE rooms SET state=? WHERE id=?').run(bad,'second'));
      rejectUnchanged(path,expected);
      const check=new DatabaseSync(path,{readOnly:true});assert.equal(check.prepare('PRAGMA user_version').get().user_version,0);assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='schema_migrations'").get().n,0);check.close();
      if(name==='json'){mutate(path,db=>db.prepare('UPDATE rooms SET state=(SELECT state FROM rooms WHERE id=?) WHERE id=?').run('first','second'));const app=createApplication({dbPath:path});assert.deepEqual(app.migration,{schemaApplied:DATABASE_USER_VERSION,roomsMigrated:2});app.close();}
    }
    for(const [name,sql,expected,current] of [['future-db','PRAGMA user_version=99',/Versão de banco/,false],['other-app','PRAGMA application_id=12345',/Versão de banco/,false],['unknown-schema','ALTER TABLE rooms ADD COLUMN extra TEXT',/Esquema/,false],['foreign-key',"PRAGMA foreign_keys=OFF; INSERT INTO members VALUES('missing','owner','player')",/Referências/,false],['schema-ledger','DELETE FROM schema_migrations',/Histórico de migrações do banco/,true],['room-ledger','UPDATE room_state_migrations SET version=99',/Histórico de migrações de mesa/,true]]){
      const path=join(directory,name+'.sqlite');seedLegacy(path);if(current){const app=createApplication({dbPath:path});app.close();}
      mutate(path,db=>db.exec(sql));rejectUnchanged(path,expected);
    }
    const missing=join(directory,'current-missing-state.sqlite');seedLegacy(missing);const app=createApplication({dbPath:missing});app.close();
    mutate(missing,db=>{const row=db.prepare('SELECT state FROM rooms WHERE id=?').get('first'),state=JSON.parse(row.state);delete state.mapStrokes;db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(state),'first');});rejectUnchanged(missing,/Estado de mesa inválido/);
  }finally{cleanup(directory);}
});

test('dois inícios aplicam uma só migração; backup antigo continua restaurável, API/SSE preservam privacidade e novas escritas ficam na versão atual',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-migrations-runtime-')),legacy=join(directory,'legacy.sqlite'),backup=join(directory,'old-backup.sqlite'),restored=join(directory,'restored.sqlite');
  let app;const abort=new AbortController(),cookies={};
  try{
    seedLegacy(legacy);const legacyBytes=fileHash(legacy);await createBackup(legacy,backup);
    const manifest=JSON.parse(readFileSync(backup+'.json','utf8'));delete manifest.database.roomStateVersions;writeFileSync(backup+'.json',JSON.stringify(manifest));
    assert.equal((await verifyBackup(backup)).database.userVersion,0);await restoreBackup(backup,restored);assert.equal(fileHash(legacy),legacyBytes);assert.equal(fileHash(restored),fileHash(backup));
    const worker="import {createApplication} from './server/app.js';const app=createApplication({dbPath:process.env.MIGRATION_TEST_DB,rateLimit:false});console.log(JSON.stringify(app.migration));app.close();";
    const start=()=>new Promise((done,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',worker],{cwd:process.cwd(),env:{...process.env,MIGRATION_TEST_DB:restored}});let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('exit',code=>code===0?done(JSON.parse(output.trim())):reject(Error(error)));});
    const starts=await Promise.all([start(),start()]);assert.equal(starts.reduce((sum,result)=>sum+result.schemaApplied,0),DATABASE_USER_VERSION);assert.equal(starts.reduce((sum,result)=>sum+result.roomsMigrated,0),2);
    app=createApplication({dbPath:restored,rateLimit:false});assert.deepEqual(app.migration,{schemaApplied:0,roomsMigrated:0});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${app.server.address().port}/api`;
    async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:response.headers.get('content-type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};}
    for(const who of ['owner','player','outsider'])assert.equal((await request(who,'/auth/login','POST',{username:who,password})).status,200);
    const player=(await request('player','/rooms/first')).body;assert.equal(player.state.stateVersion,7);assert.equal(player.state.masterNotebooks,undefined);assert.equal(player.state.playerSheets.player.notebooks[0].body,'Diário antigo do jogador');
    assert.equal((await request('outsider','/rooms/first')).status,403);
    const second=(await request('player','/rooms/second')).body;assert.equal(second.state.sharedNotebooks[0].version,7);assert.deepEqual(second.state.mapStrokes.map(stroke=>stroke.id),['old-public']);assert.equal('mapRoutes' in second.state,false);
    assert.deepEqual((await request('player','/rooms/second/note-assets/image')).body,imageBytes);
    const oldHistory=(await request('owner','/rooms/second/notes/@master/named/history/7')).body;assert.equal(oldHistory.board.width,undefined);
    const stream=await fetch(base+'/rooms/first/events',{headers:{Cookie:cookies.player},signal:abort.signal}),reader=stream.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const end=pending.indexOf('\n\n'),frame=pending.slice(0,end);pending=pending.slice(end+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    assert.equal(JSON.stringify(await event()).includes('Texto reservado antigo'),false);
    assert.equal((await request('owner','/rooms/first/state','PATCH',{masterNotes:'Texto antigo editado'})).status,200);assert.equal(JSON.stringify(await event()).includes('Texto antigo editado'),false);
    assert.equal((await request('player','/rooms/first/sheets/player','PATCH',{observations:'Diário editado'})).status,200);assert.equal((await event()).state.playerSheets.player.notebooks[0].version,2);
    assert.deepEqual((await request('owner','/rooms/first/notes/@master/legacy/history')).body.versions.map(version=>version.version),[2,1]);
    assert.deepEqual((await request('player','/rooms/first/notes/player/legacy/history')).body.versions.map(version=>version.version),[2,1]);
    assert.equal((await request('owner','/rooms/first/state','PATCH',{stateVersion:0})).status,400);
    const stroke=await request('player','/rooms/first/map-strokes','POST',{path:'M 1 1 L 2 2',color:'#abcdef'});assert.equal(stroke.status,201,JSON.stringify(stroke.body));await event();
    assert.equal((await request('player','/rooms/first/notes/player/new','PATCH',{title:'Nova',body:'',board:{nodes:[],edges:[],strokes:[]}})).status,200);await event();
    const first=JSON.parse(app.db.prepare('SELECT state FROM rooms WHERE id=?').get('first').state);assert.equal(first.mapStrokes[0].visibility,'table');assert.equal(first.playerSheets.player.notebooks.find(note=>note.id==='new').board.width,960);
    const fresh=(await request('owner','/rooms','POST',{name:'Mesa nova'})).body;assert.equal(fresh.state.stateVersion,7);assert.equal(fresh.state.masterNotebooks.length,0);assert.equal(app.db.prepare('SELECT count(*) AS n FROM room_state_migrations WHERE room_id=?').get(fresh.id).n,0);
    assert.equal((await request('constructor','/auth/register','POST',{username:'constructor',password})).status,400);assert.equal(app.db.prepare('SELECT count(*) AS n FROM users WHERE username=?').get('constructor').n,0);
    abort.abort();await reader.cancel().catch(()=>{});
    const currentBackup=join(directory,'current.sqlite');await createBackup(restored,currentBackup);assert.equal((await verifyBackup(currentBackup)).database.userVersion,DATABASE_USER_VERSION);
    assert.equal(fileHash(legacy),legacyBytes);assert.equal(fileHash(backup),manifest.file.sha256);
  }finally{abort.abort();app?.close();cleanup(directory);}
});
