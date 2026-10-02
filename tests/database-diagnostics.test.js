import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createApplication} from '../server/app.js';
import {inspectDatabaseUsage} from '../server/databaseDiagnostics.js';

const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const cli=(...args)=>spawnSync(process.execPath,['scripts/diagnoseDatabase.js',...args],{cwd:new URL('..',import.meta.url).pathname,encoding:'utf8'});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-db-diagnostic-')),path=join(directory,'test.sqlite');
  const app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const register=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'diagnostic-owner',password:'private-password'})});
  const owner=await register.json(),cookie=register.headers.get('set-cookie').split(';')[0];
  const create=await fetch(base+'/rooms',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Nome que não deve sair no diagnóstico'})});
  const room=await create.json();
  return {directory,path,app,owner,room,async close(){const stopped=new Promise(done=>app.server.once('close',done));app.close();await stopped;rmSync(directory,{recursive:true,force:true});}};
}

test('CLI íntegro mostra versão, contagens e ocupação estimada sem conteúdo privado',async()=>{
  const f=await fixture();
  try{
    const result=cli('--json','--full',f.path);
    assert.equal(result.status,0,result.stderr);
    const report=JSON.parse(result.stdout);
    assert.equal(report.ok,true);assert.equal(report.checks.quick.ok,true);assert.equal(report.checks.integrity.ok,true);
    assert.equal(report.checks.foreignKeyViolations,0);assert.equal(report.totals.roomCount,1);
    assert.equal(report.rooms[0].roomId,f.room.id);assert.ok(report.rooms[0].stateBytes>0);
    assert.equal(report.counts.rooms,1);assert.equal(report.counts.users,1);
    assert.ok(report.database.mainFileBytes>0);assert.ok(report.database.pageSize>0);
    assert.equal(result.stdout.includes('Nome que não deve sair'),false);
    assert.equal(result.stdout.includes('private-password'),false);
    const human=cli(f.path);assert.equal(human.status,0);assert.match(human.stdout,/Payload estimado/);
  }finally{await f.close();}
});

test('referência inválida e arquivo ilegível geram código de saída de falha e saída controlada',async()=>{
  const f=await fixture();
  try{
    f.app.db.exec('PRAGMA foreign_keys=OFF');
    f.app.db.prepare('INSERT INTO members VALUES(?,?,?)').run(f.room.id,'missing-user','player');
    const invalid=cli('--json',f.path);
    assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stdout).checks.foreignKeyViolations,1);
    const garbage=join(f.directory,'garbage.sqlite');writeFileSync(garbage,'private-garbage-content');
    const unreadable=cli('--json',garbage);assert.equal(unreadable.status,1);
    assert.deepEqual(JSON.parse(unreadable.stdout),{ok:false,error:'database_unreadable'});
    assert.equal(unreadable.stdout.includes('private-garbage-content'),false);
  }finally{await f.close();}
});

test('diagnóstico lê WAL ativo em snapshot sem alterar os arquivos originais',async()=>{
  const f=await fixture();
  try{
    assert.ok(existsSync(f.path+'-wal'));
    const before=[sha(f.path),sha(f.path+'-wal')];
    const report=inspectDatabaseUsage(f.path,{full:true});
    assert.equal(report.ok,true);assert.ok(report.database.walFileBytes>0);
    assert.equal(report.counts.rooms,1);
    assert.deepEqual([sha(f.path),sha(f.path+'-wal')],before);
  }finally{await f.close();}
});
