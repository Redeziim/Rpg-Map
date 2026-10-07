import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync,renameSync,unlinkSync,mkdirSync,symlinkSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/app.js';
import {createRoomState,newPlayerSheet,newStatusProfile} from '../server/roomState.js';
import {createBackup,verifyBackup,restoreBackup} from '../scripts/databaseRecovery.js';
import {automaticBackupConfig,runAutomaticBackup,readAutomaticBackupStatus} from '../scripts/automaticBackup.js';

const CONTROL='.grimorio-automatic.sqlite';
const ownedFiles=directory=>readdirSync(directory).filter(name=>name.startsWith('auto-grimorio-')&&name.endsWith('.sqlite'));
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-auto-backup-'));
  const source=join(directory,'source.sqlite'),backups=join(directory,'backups');
  const app=createApplication({dbPath:source});
  app.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('owner','owner','hash','salt');
  const state={...createRoomState(),masterNotes:'Texto reservado: não pode aparecer nos logs',playerSheets:{owner:newPlayerSheet()},statusBarsData:{owner:newStatusProfile()}};
  state.combat.order=['owner'];
  app.db.prepare('INSERT INTO rooms VALUES(?,?,?,?,?)').run('room','Mesa privada','owner',JSON.stringify(state),2);
  app.db.prepare('INSERT INTO members VALUES(?,?,?)').run('room','owner','admin');
  const env={...process.env,DB_PATH:source,BACKUP_DIR:backups,BACKUP_INTERVAL_MINUTES:'2',BACKUP_KEEP:'2',BACKUP_RETRY_MINUTES:'1'};
  return {directory,source,backups,app,env,config:automaticBackupConfig(env)};
}
function clean(directory){assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
async function childResult(args,env){
  const child=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  const [code,signal]=await once(child,'close');return {code,signal,stdout,stderr};
}
async function until(check,timeout=10000){
  const start=Date.now();while(Date.now()-start<timeout){const result=await check();if(result)return result;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('A operação local não terminou no prazo do teste.');
}

test('backup automático copia WAL, respeita intervalo e retenção, conserva cópias manuais e repete só a manutenção após falha',async()=>{
  const f=fixture();let restored;
  try{
    const at=Date.now();
    const initial=await runAutomaticBackup(f.config,{now:at});assert.equal(initial.outcome,'success');assert.equal(initial.status.healthy,true);
    assert.equal((await runAutomaticBackup(f.config,{now:at+1})).outcome,'not-due');
    const first=ownedFiles(f.backups)[0];
    const verified=await verifyBackup(join(f.backups,first));assert.equal(verified.database.counts.rooms,1);assert.equal(verified.manifest.automaticBackup.formatVersion,1);
    const control=new DatabaseSync(join(f.backups,CONTROL));const directoryId=control.prepare('SELECT directory_id FROM automatic_backup').get().directory_id;control.close();
    await createBackup(f.source,join(f.backups,'manual.sqlite'));
    const automaticLooking='auto-grimorio-2000-01-01T00-00-00-000Z-00000000-0000-0000-0000-000000000000.sqlite';
    await createBackup(f.source,join(f.backups,automaticLooking));
    const manualBytes=readFileSync(join(f.backups,'manual.sqlite')),unknownBytes=readFileSync(join(f.backups,automaticLooking));
    f.app.db.prepare('UPDATE rooms SET revision=3 WHERE id=?').run('room');
    assert.equal((await runAutomaticBackup(f.config,{now:at+120000})).outcome,'success');
    f.app.db.prepare('UPDATE rooms SET revision=4 WHERE id=?').run('room');
    const third=await runAutomaticBackup(f.config,{now:at+240000});assert.equal(third.status.removed,1);
    assert.equal(lstatSync(join(f.backups,'manual.sqlite')).isFile(),true);assert.deepEqual(readFileSync(join(f.backups,'manual.sqlite')),manualBytes);
    assert.deepEqual(readFileSync(join(f.backups,automaticLooking)),unknownBytes);assert.equal(ownedFiles(f.backups).length,3);assert.equal(readdirSync(f.backups).includes(first),false);
    const latest=join(f.backups,third.status.lastFile);await restoreBackup(latest,join(f.directory,'restored.sqlite'));
    restored=new DatabaseSync(join(f.directory,'restored.sqlite'),{readOnly:true});assert.equal(restored.prepare('SELECT revision FROM rooms').get().revision,4);restored.close();restored=null;
    const older=ownedFiles(f.backups).find(name=>name!==third.status.lastFile&&name!==automaticLooking),report=join(f.backups,older+'.json'),oldManifest=readFileSync(report);
    const wrong=JSON.parse(oldManifest);wrong.file.sha256='0'.repeat(64);writeFileSync(report,JSON.stringify(wrong));
    const priorFiles=ownedFiles(f.backups);
    const failed=await runAutomaticBackup(f.config,{now:at+360000});assert.equal(failed.outcome,'failure');assert.equal(failed.status.healthy,false);assert.match(failed.status.lastError,/checksum/);
    assert.equal(ownedFiles(f.backups).length,priorFiles.length+1);for(const name of priorFiles)assert.ok(ownedFiles(f.backups).includes(name));
    assert.equal((await runAutomaticBackup(f.config,{now:at+360001})).outcome,'not-due');
    writeFileSync(report,oldManifest);
    // Recover an owned manifest left by a crash; never remove unknown SQLite files.
    const orphan='auto-grimorio-1999-01-01T00-00-00-000Z-00000000-0000-0000-0000-000000000001.sqlite.json';
    writeFileSync(join(f.backups,orphan),JSON.stringify({...JSON.parse(oldManifest),automaticBackup:{formatVersion:1,directoryId}}));
    const retried=await runAutomaticBackup(f.config,{now:at+420000});assert.equal(retried.outcome,'success');assert.equal(retried.status.lastFile,failed.status.lastFile);assert.equal(retried.status.lastBackupAt,at+360000);
    assert.equal(ownedFiles(f.backups).length,3);assert.equal(readdirSync(f.backups).includes(orphan),false);
    assert.equal(readAutomaticBackupStatus(f.config,{now:at+420000}).healthy,true);assert.equal(readAutomaticBackupStatus(f.config,{now:at+600001}).healthy,false);
    // Invalid JSON cannot quietly escape retention just because its ownership marker cannot be parsed.
    const malformed=join(f.backups,retried.status.lastFile+'.json'),savedManifest=readFileSync(malformed);writeFileSync(malformed,'{');
    const malformedResult=await runAutomaticBackup(f.config,{now:at+420001,force:true});assert.equal(malformedResult.outcome,'failure');assert.match(malformedResult.status.lastError,/registrada/);
    writeFileSync(malformed,savedManifest);
    assert.equal((await runAutomaticBackup(f.config,{now:at+480001})).outcome,'success');
    assert.equal(f.app.db.prepare('SELECT revision FROM rooms').get().revision,4);
    assert.equal(readFileSync(join(f.backups,CONTROL)).includes(Buffer.from('Texto reservado')),false);
    // Missing source: previous copies and their bytes are retained, then the scheduled retry recovers.
    f.app.close();f.app=null;renameSync(f.source,f.source+'.held');
    const oldCopies=new Map(ownedFiles(f.backups).map(name=>[name,readFileSync(join(f.backups,name))]));
    const missing=await runAutomaticBackup(f.config,{now:at+600000});assert.equal(missing.outcome,'failure');assert.equal(missing.status.lastBackupAt,at+420001);
    for(const [name,bytes] of oldCopies)assert.deepEqual(readFileSync(join(f.backups,name)),bytes);
    renameSync(f.source+'.held',f.source);assert.equal((await runAutomaticBackup(f.config,{now:at+660000})).outcome,'success');
    const clockBack=await runAutomaticBackup(f.config,{now:at-600000});assert.equal(clockBack.outcome,'success');assert.ok(ownedFiles(f.backups).includes(clockBack.status.lastFile));assert.equal(clockBack.status.registeredCount,2);
  }finally{restored?.close();f.app?.close();clean(f.directory);}
});

test('workers concorrentes compartilham lock recuperável, não repetem no reinício e recusam diretório, controle, origem e configuração inválidos',async()=>{
  const f=fixture();let control,lockingChild;
  try{
    const runs=await Promise.all(Array.from({length:3},()=>childResult(['scripts/automaticBackup.js'],f.env)));
    for(const result of runs)assert.equal(result.code,0,result.stderr);
    assert.equal(runs.filter(result=>JSON.parse(result.stdout).outcome==='success').length,1);assert.equal(ownedFiles(f.backups).length,1);
    assert.equal(JSON.parse((await childResult(['scripts/automaticBackup.js'],f.env)).stdout).outcome,'not-due');
    // A real killed process releases the OS-backed SQLite lock, with no stale lock-file deletion.
    lockingChild=spawn(process.execPath,['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN IMMEDIATE');console.log('locked');setInterval(()=>{},1000);",join(f.backups,CONTROL)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    await once(lockingChild.stdout,'data');
    const busy=await childResult(['scripts/automaticBackup.js','--once'],f.env);assert.equal(busy.code,0,busy.stderr);assert.equal(JSON.parse(busy.stdout).outcome,'busy');
    const killed=once(lockingChild,'close');lockingChild.kill('SIGKILL');await killed;lockingChild=null;
    assert.equal((await childResult(['scripts/automaticBackup.js','--once'],f.env)).code,0);assert.equal(ownedFiles(f.backups).length,2);
    await createBackup(f.source,join(f.directory,'other.sqlite'));
    const before=readFileSync(join(f.backups,CONTROL));
    await assert.rejects(runAutomaticBackup({...f.config,source:join(f.directory,'other.sqlite')},{force:true}),/outro DB_PATH/);
    assert.deepEqual(readFileSync(join(f.backups,CONTROL)),before);
    control=new DatabaseSync(join(f.backups,CONTROL));control.exec('PRAGMA user_version=2');control.close();control=null;
    const futureBytes=readFileSync(join(f.backups,CONTROL));await assert.rejects(runAutomaticBackup(f.config,{force:true}),/desconhecido/);assert.deepEqual(readFileSync(join(f.backups,CONTROL)),futureBytes);
    control=new DatabaseSync(join(f.backups,CONTROL));control.exec('PRAGMA user_version=1');control.close();control=null;
    await assert.rejects(runAutomaticBackup({...f.config,directory:f.directory},{force:true}),/fora do diretório/);
    const foreign=join(f.directory,'foreign');mkdirSync(foreign);writeFileSync(join(foreign,CONTROL),'Não alterar este arquivo');
    await assert.rejects(runAutomaticBackup({...f.config,directory:foreign},{force:true}));assert.equal(readFileSync(join(foreign,CONTROL),'utf8'),'Não alterar este arquivo');
    const linked=join(f.directory,'linked');symlinkSync(f.backups,linked,process.platform==='win32'?'junction':'dir');
    await assert.rejects(runAutomaticBackup({...f.config,directory:linked},{force:true}),/link simbólico/);
    for(const patch of [{BACKUP_DIR:''},{BACKUP_DIR:'relative'},{BACKUP_KEEP:'1'},{BACKUP_KEEP:'366'},{BACKUP_KEEP:'2.5'},{BACKUP_INTERVAL_MINUTES:'0'},{BACKUP_INTERVAL_MINUTES:'NaN'},{BACKUP_RETRY_MINUTES:'3'},{BACKUP_TIMEOUT_MINUTES:'0'}])assert.throws(()=>automaticBackupConfig({...f.env,...patch}));
    assert.equal(automaticBackupConfig({}),null);assert.equal(readAutomaticBackupStatus(null).healthy,false);
    const defaults=automaticBackupConfig({BACKUP_DIR:f.backups});assert.equal(defaults.intervalMinutes,1440);assert.equal(defaults.keep,14);
    const unknown=await childResult(['scripts/automaticBackup.js','--bad'],f.env);assert.equal(unknown.code,1);assert.equal(ownedFiles(f.backups).length,2);
    // A symlink with an owned manifest must block retention without deleting its target.
    const target=join(f.directory,'precious.sqlite');writeFileSync(target,'conteúdo preservado');
    const linkName='auto-grimorio-2001-01-01T00-00-00-000Z-00000000-0000-0000-0000-000000000003.sqlite';
    try{
      symlinkSync(target,join(f.backups,linkName));
      const manifest=JSON.parse(readFileSync(join(f.backups,ownedFiles(f.backups).find(name=>name!==linkName)+'.json'),'utf8'));
      writeFileSync(join(f.backups,linkName+'.json'),JSON.stringify(manifest));
      const result=await runAutomaticBackup(f.config,{force:true});assert.equal(result.outcome,'failure');assert.match(result.status.lastError,/irregular/);assert.equal(readFileSync(target,'utf8'),'conteúdo preservado');
    }catch(error){if(error.code!=='EPERM')throw error;}
  }finally{control?.close();if(lockingChild){const stopped=once(lockingChild,'close');lockingChild.kill('SIGKILL');await stopped;}f.app?.close();clean(f.directory);}
});

test('servidor agenda worker isolado, continua respondendo, mantém estado após reinício e emite alerta e código de saúde em falhas',async()=>{
  const f=fixture();let server;const active=[];
  async function start(env){
    const child=spawn(process.execPath,['server/index.js'],{env:{...env,PORT:'0',HOST:'127.0.0.1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='',errors='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);active.push(child);
    // With port zero, query the bound port from the actual listener via server startup output.
    await until(()=>output.includes('Grimório: servidor em'));
    const base=output.match(/Grimório: servidor em (http:\/\/[^\s]+)/)[1];
    assert.deepEqual(await (await fetch(base+'/api/health')).json(),{ok:true});
    return {child,base,output:()=>output,errors:()=>errors};
  }
  async function stop(handle){const closed=once(handle.child,'close');handle.child.kill('SIGTERM');await closed;active.splice(active.indexOf(handle.child),1);}
  try{
    f.app.close();f.app=null;
    server=await start(f.env);await until(()=>server.output().includes('Backup automático verificado'));
    const status=await childResult(['scripts/automaticBackup.js','--status'],f.env);assert.equal(status.code,0,status.stderr);const saved=JSON.parse(status.stdout);assert.equal(saved.healthy,true);assert.equal(ownedFiles(f.backups).length,1);
    await stop(server);server=await start(f.env);await new Promise(resolve=>setTimeout(resolve,200));assert.equal(ownedFiles(f.backups).length,1);await stop(server);server=null;
    // A bad operational-control file must alert without preventing the API from serving.
    const controlPath=join(f.backups,CONTROL);renameSync(controlPath,controlPath+'.held');writeFileSync(controlPath,'controle danificado');
    server=await start(f.env);await until(()=>server.errors().includes('ALERTA:'));assert.equal(server.errors().includes('Texto reservado'),false);assert.equal(server.child.exitCode,null);
    assert.deepEqual(await (await fetch(server.base+'/api/health')).json(),{ok:true});
    const unhealthy=await childResult(['scripts/automaticBackup.js','--status'],f.env);assert.equal(unhealthy.code,1);assert.match(unhealthy.stderr,/ALERTA/);assert.equal(ownedFiles(f.backups).length,1);
    await stop(server);server=null;unlinkSync(controlPath);renameSync(controlPath+'.held',controlPath);
    // A saved failure is queryable after restarting the CLI, without content from notes.
    renameSync(f.source,f.source+'.held');const failed=await childResult(['scripts/automaticBackup.js','--once'],f.env);assert.equal(failed.code,1);assert.match(failed.stderr,/ALERTA/);
    const failedStatus=await childResult(['scripts/automaticBackup.js','--status'],f.env);assert.equal(failedStatus.code,1);assert.equal(JSON.parse(failedStatus.stdout).healthy,false);assert.equal(failedStatus.stdout.includes('Texto reservado'),false);
    renameSync(f.source+'.held',f.source);assert.equal((await childResult(['scripts/automaticBackup.js','--once'],f.env)).code,0);
    assert.equal((await childResult(['scripts/automaticBackup.js','--status'],f.env)).code,0);
  }finally{for(const child of active){const closed=once(child,'close');child.kill('SIGTERM');await closed;}f.app?.close();clean(f.directory);}
});
