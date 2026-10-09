import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup,verifyBackup} from '../scripts/databaseRecovery.js';
import {SHEET_MODEL_LIMITS,SheetModelError,cleanModelName,cleanSheetFields} from '../src/shared/sheetModels.js';

const fields=()=>[{type:'text',label:'Personagem',tab:'Identidade'},{type:'number',label:'Força',tab:'Atributos'},{type:'formula',label:'Mod. Força',tab:'Atributos',formula:'piso((Força-10)/2)'},{type:'status',label:'Vida',tab:'Combate'}];

test('shared rules: fields are cleaned, ids dropped, and bad input is refused with a readable reason',()=>{
  const clean=cleanSheetFields([{id:'f_1',type:'text',label:'  Nome   do  herói ',tab:'  ',extra:1},{type:'formula',label:'Dobro',tab:'Contas',formula:' Nome*2 '}]);
  assert.deepEqual(clean,[{type:'text',label:'Nome do herói',tab:'Geral'},{type:'formula',label:'Dobro',tab:'Contas',formula:'Nome*2'}]);
  for(const bad of [[],null,'x',[null],[{type:'script',label:'A'}],[{type:'text',label:''}],[{type:'text',label:'A'},{type:'number',label:'a'}],[{type:'formula',label:'F'}],[{type:'text',label:'A\u0000B'}],[{type:'text',label:'x'.repeat(SHEET_MODEL_LIMITS.label+1)}]])
    assert.throws(()=>cleanSheetFields(bad),SheetModelError);
  assert.throws(()=>cleanSheetFields(Array.from({length:SHEET_MODEL_LIMITS.fields+1},(_,index)=>({type:'text',label:`Campo ${index}`}))),/200/);
  assert.equal(cleanModelName('  Meu   modelo '),'Meu modelo');
  assert.throws(()=>cleanModelName(''),SheetModelError);assert.throws(()=>cleanModelName('x'.repeat(81)),SheetModelError);
});

test('models belong to the account: list, create, rename, delete, limits, privacy, backup and restore',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-models-')),dbPath=join(directory,'models.sqlite'),cookies={};let app,base;
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{
    await start();for(const username of ['ana','beto'])await call(username,'/auth/register','POST',{username,password:'local-models-review'});
    // sem sessão, nada
    assert.equal((await call('ninguem','/sheet-models')).status,401);
    assert.deepEqual((await call('ana','/sheet-models')).body,[]);

    const made=await call('ana','/sheet-models','POST',{name:'Meu D&D da casa',fields:fields(),source:'file'});
    assert.equal(made.status,201);assert.equal(made.body.name,'Meu D&D da casa');assert.equal(made.body.source,'file');assert.equal(made.body.fields.length,4);assert.ok(made.body.id);
    assert.equal(made.body.fields[2].formula,'piso((Força-10)/2)');
    // nome repetido (sem diferenciar caixa) e pedidos malformados
    assert.equal((await call('ana','/sheet-models','POST',{name:'meu d&d da casa',fields:fields()})).status,409);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Sem campos',fields:[]})).status,400);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Origem ruim',fields:fields(),source:'nuvem'})).status,400);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Extra',fields:fields(),owner:'beto'})).status,400);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Código',fields:[{type:'formula',label:'F',formula:'x'.repeat(1001)}]})).status,400);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Duplicados',fields:[{type:'text',label:'A'},{type:'text',label:'A'}]})).status,400);

    // privacidade: o outro usuário não vê, não renomeia e não apaga
    assert.deepEqual((await call('beto','/sheet-models')).body,[]);
    assert.equal((await call('beto',`/sheet-models/${made.body.id}`,'PATCH',{name:'Roubado'})).status,404);
    assert.equal((await call('beto',`/sheet-models/${made.body.id}`,'DELETE')).status,404);
    assert.equal((await call('beto','/sheet-models','POST',{name:'Meu D&D da casa',fields:fields()})).status,201,'o mesmo nome é livre para outra conta');

    // renomear
    const renamed=await call('ana',`/sheet-models/${made.body.id}`,'PATCH',{name:'D&D da casa v2'});
    assert.equal(renamed.status,200);assert.equal(renamed.body.name,'D&D da casa v2');assert.equal(renamed.body.fields.length,4);
    assert.equal((await call('ana',`/sheet-models/${made.body.id}`,'PATCH',{name:'D&D da casa v2',fields:[]})).status,400);
    assert.equal((await call('ana','/sheet-models','GET')).body.length,1);

    // limite por conta
    for(let index=1;index<SHEET_MODEL_LIMITS.models;index++)assert.equal((await call('ana','/sheet-models','POST',{name:`Modelo ${index}`,fields:fields()})).status,201);
    const full=await call('ana','/sheet-models','POST',{name:'Um a mais',fields:fields()});assert.equal(full.status,400);assert.match(full.body.error||full.body.message||JSON.stringify(full.body),/30/);

    // backup e restauração levam os modelos junto
    await stop();
    const backup=join(directory,'backup.sqlite'),restored=join(directory,'restored.sqlite');
    await createBackup(dbPath,backup);
    const verified=await verifyBackup(backup);assert.equal(verified.database.userVersion,9);assert.equal(verified.database.counts.sheet_models,31);
    await restoreBackup(backup,restored);await start(restored);
    await call('ana','/auth/login','POST',{username:'ana',password:'local-models-review'});
    const listed=(await call('ana','/sheet-models')).body;assert.equal(listed.length,SHEET_MODEL_LIMITS.models);
    assert.equal(listed.find(model=>model.name==='D&D da casa v2').fields[2].label,'Mod. Força');
    // apagar libera espaço
    assert.equal((await call('ana',`/sheet-models/${listed[0].id}`,'DELETE')).status,200);
    assert.equal((await call('ana','/sheet-models','POST',{name:'Cabe de novo',fields:fields()})).status,201);
  }finally{if(app)await stop();}
});

test('a saved model that breaks the rules stops a restore instead of reaching the app',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-models-bad-')),dbPath=join(directory,'bad.sqlite');
  const {DatabaseSync}=await import('node:sqlite');
  const app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const register=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ana',password:'local-models-review'})});
  const cookie=register.headers.get('set-cookie').split(';')[0];
  const made=await fetch(base+'/sheet-models',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({name:'Bom',fields:fields()})});
  assert.equal(made.status,201);
  const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;
  const backup=join(directory,'bad-backup.sqlite');await createBackup(dbPath,backup);
  const raw=new DatabaseSync(backup);raw.exec(`UPDATE sheet_models SET fields='[{"type":"script","label":"X","tab":"Geral"}]'`);raw.close();
  await assert.rejects(()=>verifyBackup(backup),/inválid|incompat/i);
});
