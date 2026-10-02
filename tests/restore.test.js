import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,copyFileSync,existsSync,readdirSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/app.js';
import {DATABASE_TABLES,LEGACY_DATABASE_TABLES} from '../server/databaseSchema.js';
import {createBackup,restoreBackup,verifyBackup,inspectDatabase} from '../scripts/databaseRecovery.js';
import {testMapImage} from './fixtures/mapImages.js';
import {defaultMapLegend} from '../src/shared/mapExploration.js';

const password='local-recovery-test-2026';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const cleanup=directory=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});};
const cli=(script,args,env={})=>spawnSync(process.execPath,[`scripts/${script}.js`,...args],{cwd:process.cwd(),env:{...process.env,...env},encoding:'utf8'});
function bareDatabase(path,{legacy=false}={}){
  const db=new DatabaseSync(path);
  db.exec(Object.entries(LEGACY_DATABASE_TABLES).filter(([name])=>!legacy||!['note_assets','note_versions'].includes(name)).map(([,sql])=>sql+';').join('\n'));
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('owner','owner','hash','salt');
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?,?)').run('room','Campanha de teste','owner',JSON.stringify({points:[],sheetFields:[],playerSheets:{},statusBarsData:{},masterNotes:'Conteúdo privado de validação'}),7);
  db.prepare('INSERT INTO members VALUES(?,?,?)').run('room','owner','admin');
  db.close();
}
async function httpApplication(dbPath,cookies={}){
  const app=createApplication({dbPath,rateLimit:false});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:response.headers.get('content-type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};
  }
  return {app,base,cookies,request};
}

test('backup WAL restaurado em banco novo preserva contas, permissões, histórico, imagem, arquivos 3D e eventos',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-restore-full-'));
  const source=join(directory,'active.sqlite'),backup=join(directory,'backup.sqlite'),destination=join(directory,'restored.sqlite');
  let active,restored;const controller=new AbortController();
  try{
    active=await httpApplication(source);
    for(const who of ['owner','player','outsider'])assert.equal((await active.request(who,'/auth/register','POST',{username:who,password})).status,200);
    const room=(await active.request('owner','/rooms','POST',{name:'Campanha restaurada'})).body.id,root='/rooms/'+room;
    assert.equal((await active.request('owner',root+'/members','POST',{username:'player',role:'player'})).status,200);
    assert.equal((await active.request('owner',root+'/state','PATCH',{mapImage:testMapImage})).status,200);
    const uploaded=(await active.request('owner',root+'/note-assets','POST',{name:'Brasão privado.png',src:png})).body;
    const board={nodes:[{id:'image',kind:'image',x:10,y:10,text:'Brasão',assetId:uploaded.id}],edges:[],strokes:[],width:960,height:620};
    assert.equal((await active.request('owner',root+'/notes/@master/secret','PATCH',{title:'Segredo do mestre',body:'Texto que não deve aparecer no relatório',board})).status,200);
    assert.equal((await active.request('owner',root+'/notes/@master/secret','PATCH',{title:'Segredo revisado',body:'Versão nova',board,version:1})).status,200);
    assert.equal((await active.request('player',root+'/notes/player/journal','PATCH',{title:'Diário',body:'Anotação do jogador',board:{nodes:[],edges:[],strokes:[]}})).status,200);
    const bundle={main:'terreno.obj',kind:'terrain',files:[{name:'terreno.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3').toString('base64')}]};
    assert.equal((await active.request('owner',root+'/map-assets','POST',bundle)).status,201);
    const before=(await active.request('owner',root)).body;
    assert.equal((await active.request('owner',root+'/map-routes','POST',{id:'private',name:'Rota secreta',color:'#abc123',status:'planned',visibility:'master',waypoints:[{x:10,y:10},{x:20,y:20}],imageVersion:before.mapImageVersion})).status,200);
    assert.equal((await active.request('owner',root+'/map-legend','PATCH',{version:before.mapLegendVersion,legend:defaultMapLegend().map((entry,index)=>index?entry:{...entry,label:'Portos'})})).status,200);
    const invite=(await active.request('owner',root+'/invites','POST',{role:'player'})).body;
    const frozen=(await active.request('owner',root)).body;
    const sourceHash=hash(source),walHash=hash(source+'-wal');
    const backupResult=cli('backup',[backup],{DB_PATH:source});assert.equal(backupResult.status,0,backupResult.stderr);
    assert.equal(hash(source),sourceHash);assert.equal(hash(source+'-wal'),walHash);
    assert.equal((await active.request('owner',root+'/notes/@master/after','PATCH',{title:'Após backup',body:'Não pertence à cópia'})).status,200);
    const activeAfter=(await active.request('owner',root)).body;
    const restoreResult=cli('restore',[backup,destination],{DB_PATH:source});assert.equal(restoreResult.status,0,restoreResult.stderr);
    assert.equal(hash(backup),hash(destination));assert.equal((await active.request('owner',root)).body.revision,activeAfter.revision);
    const report=JSON.parse(readFileSync(destination+'.restore.json','utf8'));
    assert.equal(report.database.counts.note_assets,1);assert.ok(report.database.counts.note_versions>=3);assert.equal(report.database.counts.map_assets,1);
    assert.equal(JSON.stringify(report).includes('Segredo'),false);assert.equal(JSON.stringify(report).includes('Texto que não'),false);
    const ro=new DatabaseSync(backup,{readOnly:true}),copy=new DatabaseSync(destination,{readOnly:true});
    try{for(const name of Object.keys(DATABASE_TABLES))assert.deepEqual(copy.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all(),ro.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all());}finally{copy.close();ro.close();}
    restored=await httpApplication(destination,{...active.cookies});
    assert.deepEqual((await restored.request('owner','/health')).body,{ok:true});
    const view=(await restored.request('owner',root)).body;
    assert.equal(view.revision,frozen.revision);assert.deepEqual(view.state,frozen.state);assert.deepEqual(view.members,frozen.members);
    assert.deepEqual((await restored.request('owner',root+'/note-assets/'+uploaded.id)).body,Buffer.from(png.split(',')[1],'base64'));
    assert.deepEqual((await restored.request('player',root+'/map-assets/'+frozen.state.mapObjects[0].assetId)).body.files,bundle.files);
    assert.equal((await restored.request('player',root+'/note-assets/'+uploaded.id)).status,404);
    assert.equal((await restored.request('outsider',root)).status,403);
    assert.equal((await restored.request('player',root)).body.state.masterNotebooks,undefined);
    assert.deepEqual((await restored.request('player',root)).body.state.mapRoutes,[]);
    assert.equal((await restored.request('owner',root+'/notes/@master/secret/history')).body.versions.length,2);
    assert.equal((await restored.request('owner','/auth/login','POST',{username:'owner',password})).status,200);
    assert.equal((await restored.request('outsider','/join','POST',{code:invite.code})).status,200);
    const event=await fetch(restored.base+root+'/events',{headers:{Cookie:restored.cookies.player},signal:controller.signal}),reader=event.body.getReader();
    const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/event: room/);assert.doesNotMatch(first,/Segredo revisado|Rota secreta/);
    controller.abort();await reader.cancel().catch(()=>{});
    assert.equal((await restored.request('owner',root+'/notes/@master/restored-only','PATCH',{title:'Somente restaurado',body:'Independente'})).status,200);
    assert.equal((await active.request('owner',root)).body.state.masterNotebooks.some(note=>note.id==='restored-only'),false);
  }finally{controller.abort();restored?.app.close();active?.app.close();cleanup(directory);}
});

test('restauração recusa sobrescrita, origem ativa e argumentos inválidos, sem alterar arquivos e com publicação concorrente exclusiva',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-restore-paths-')),source=join(directory,'source.sqlite'),backup=join(directory,'backup.sqlite');
  try{
    bareDatabase(source);await createBackup(source,backup);
    const before=hash(backup),destination=join(directory,'result.sqlite');
    writeFileSync(destination,'arquivo anterior');
    await assert.rejects(restoreBackup(backup,destination),/já existe/);assert.equal(readFileSync(destination,'utf8'),'arquivo anterior');
    const zero=join(directory,'zero.sqlite');writeFileSync(zero,'');await assert.rejects(restoreBackup(backup,zero),/já existe/);assert.equal(readFileSync(zero).length,0);
    await assert.rejects(restoreBackup(backup,backup),/diferente/);
    const alias=join(directory,'alias.sqlite');linkSync(backup,alias);await assert.rejects(restoreBackup(backup,alias),/já existe/);
    for(const suffix of ['-wal','-shm','-journal','.json','.restore.json']){
      const blocked=join(directory,'blocked'+suffix.replace(/\W/g,'')+'.sqlite');writeFileSync(blocked+suffix,'preservar');
      await assert.rejects(restoreBackup(backup,blocked),/já existe/);assert.equal(existsSync(blocked),false);assert.equal(readFileSync(blocked+suffix,'utf8'),'preservar');
    }
    const live=createApplication({dbPath:join(directory,'live.sqlite')});
    try{await assert.rejects(restoreBackup(join(directory,'live.sqlite'),join(directory,'from-live.sqlite'),{allowLegacy:true}),/WAL/);}finally{live.close();}
    const concurrent=join(directory,'concurrent.sqlite'),results=await Promise.allSettled([restoreBackup(backup,concurrent),restoreBackup(backup,concurrent)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(hash(concurrent),before);assert.equal(existsSync(concurrent+'.restore.json'),true);
    for(const args of [[],[backup],[backup,destination,'--unknown'],['--verify',backup,destination],['--verify','--verify',backup]])assert.equal(cli('restore',args).status,1);
    const missing=join(directory,'missing.sqlite');assert.equal(cli('restore',[missing,join(directory,'no-file.sqlite')]).status,1);assert.equal(existsSync(missing),false);
    assert.equal(cli('restore',['--verify',backup]).status,0);assert.equal(cli('restore',['--help']).status,0);
    assert.equal(hash(backup),before);assert.equal(readdirSync(directory).some(name=>name.startsWith('.grimorio-recovery-')),false);
  }finally{cleanup(directory);}
});

test('verificação rejeita corrupção, checksum, versão futura, esquema e dados inválidos; legado conhecido exige opção explícita',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-restore-verify-')),source=join(directory,'source.sqlite'),backup=join(directory,'backup.sqlite');
  try{
    bareDatabase(source);await createBackup(source,backup);const before=hash(backup),manifest=JSON.parse(readFileSync(backup+'.json','utf8'));
    async function rejected(label,mutate,expected){
      const path=join(directory,label+'.sqlite'),destination=join(directory,label+'-restored.sqlite');copyFileSync(backup,path);copyFileSync(backup+'.json',path+'.json');
      await mutate(path);
      await assert.rejects(restoreBackup(path,destination,{allowLegacy:true}),expected);assert.equal(existsSync(destination),false);assert.equal(existsSync(destination+'.restore.json'),false);
    }
    const sql=(path,text)=>{const db=new DatabaseSync(path);try{db.exec(text);}finally{db.close();}};
    await rejected('checksum',path=>sql(path,"UPDATE rooms SET name='Mudança válida sem atualizar checksum'"),/checksum/);
    await rejected('future',path=>sql(path,'PRAGMA user_version=99'),/Versão de banco/);
    await rejected('wrong-app',path=>sql(path,'PRAGMA application_id=12345'),/Versão de banco/);
    await rejected('schema',path=>sql(path,'CREATE TABLE unexpected(value TEXT)'),/Esquema/);
    await rejected('incomplete-schema',path=>sql(path,'DROP TABLE note_assets'),/Esquema incompleto/);
    await rejected('json',path=>sql(path,"UPDATE rooms SET state='not json'"),/JSON inválido/);
    await rejected('json-shape',path=>sql(path,"UPDATE rooms SET state='[]'"),/Estrutura/);
    await rejected('foreign-key',path=>sql(path,"PRAGMA foreign_keys=OFF; INSERT INTO members VALUES('missing','owner','player')"),/referências/);
    await rejected('corrupt',path=>writeFileSync(path,readFileSync(path).subarray(0,65)),/malformed|database|integridade/i);
    await rejected('future-manifest',path=>writeFileSync(path+'.json',JSON.stringify({...manifest,formatVersion:99})),/manifesto/);
    await rejected('schema-manifest',path=>writeFileSync(path+'.json',JSON.stringify({...manifest,database:{...manifest.database,userVersion:7}})),/correspondem/);
    await rejected('corrupt-manifest',path=>writeFileSync(path+'.json','{broken'),/JSON inválido/);
    const old=join(directory,'old.sqlite'),oldRestored=join(directory,'old-restored.sqlite');bareDatabase(old,{legacy:true});const oldHash=hash(old);
    await assert.rejects(verifyBackup(old),/--allow-legacy/);
    assert.equal(cli('restore',['--verify',old,'--allow-legacy']).status,0);
    const result=await restoreBackup(old,oldRestored,{allowLegacy:true});assert.equal(result.legacy,true);assert.equal(result.database.schemaKind,'legacy-unversioned');assert.deepEqual(result.database.missingTables,['note_assets','note_versions']);assert.equal(hash(old),oldHash);
    const app=createApplication({dbPath:oldRestored});try{assert.equal(JSON.parse(app.db.prepare('SELECT state FROM rooms').get().state).masterNotes,'Conteúdo privado de validação');assert.equal(app.db.prepare('SELECT count(*) AS n FROM note_versions').get().n,0);}finally{app.close();}
    assert.equal(inspectDatabase(oldRestored).schemaKind,'current-versioned');
    const unknown=join(directory,'unknown.sqlite'),db=new DatabaseSync(unknown);db.exec('CREATE TABLE other(x TEXT)');db.close();await assert.rejects(verifyBackup(unknown,{allowLegacy:true}),/Esquema/);
    assert.equal(hash(backup),before);assert.equal(readdirSync(directory).some(name=>name.startsWith('.grimorio-recovery-')),false);
  }finally{cleanup(directory);}
});
