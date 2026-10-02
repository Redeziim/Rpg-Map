import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {lstatSync,realpathSync,mkdirSync,chmodSync,readdirSync,readFileSync,unlinkSync} from 'node:fs';
import {resolve,join,relative,dirname,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBackup,verifyBackup} from './databaseRecovery.js';

const CONTROL_NAME='.grimorio-automatic.sqlite';
const CONTROL_ID=0x4742414b;
const CONTROL_SQL='CREATE TABLE automatic_backup (id INTEGER PRIMARY KEY CHECK(id=1), source TEXT NOT NULL, directory_id TEXT NOT NULL, status TEXT NOT NULL)';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AUTO_NAME=/^auto-grimorio-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.sqlite$/;
const present=path=>{try{return lstatSync(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const failureMessage=error=>String(error.message||error).replace(/[\r\n\t]/g,' ').slice(0,600);
function integer(value,fallback,min,max,name){
  if(value===undefined)return fallback;
  if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(`${name} precisa ser um inteiro entre ${min} e ${max}.`);
  return Number(value);
}
export function automaticBackupConfig(env=process.env){
  if(env.BACKUP_DIR===undefined)return null;
  if(!env.BACKUP_DIR.trim()||!isAbsolute(env.BACKUP_DIR))throw Error('BACKUP_DIR precisa ser um diretório absoluto dedicado às cópias automáticas.');
  const intervalMinutes=integer(env.BACKUP_INTERVAL_MINUTES,1440,1,525600,'BACKUP_INTERVAL_MINUTES');
  return {
    source:resolve(env.DB_PATH||'data/grimorio.sqlite'),directory:resolve(env.BACKUP_DIR),intervalMinutes,
    keep:integer(env.BACKUP_KEEP,14,2,365,'BACKUP_KEEP'),
    retryMinutes:integer(env.BACKUP_RETRY_MINUTES,Math.min(15,intervalMinutes),1,intervalMinutes,'BACKUP_RETRY_MINUTES'),
    timeoutMinutes:integer(env.BACKUP_TIMEOUT_MINUTES,30,1,1440,'BACKUP_TIMEOUT_MINUTES'),
  };
}
function canonical(path){
  let current=resolve(path);const tail=[];
  while(!present(current)){tail.unshift(basename(current));const parent=dirname(current);if(parent===current)break;current=parent;}
  const result=resolve(realpathSync(current),...tail);
  return process.platform==='win32'?result.toLowerCase():result;
}
function paths(config,{create=false}={}){
  if(create)mkdirSync(config.directory,{recursive:true,mode:0o700});
  const info=present(config.directory);
  if(!info||!info.isDirectory()||info.isSymbolicLink())throw Error('O diretório de backup não existe, não é uma pasta ou é um link simbólico.');
  const directory=realpathSync(config.directory),source=canonical(config.source),inside=relative(canonical(directory),source);
  if(!inside||(!inside.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&inside!=='..'&&!isAbsolute(inside)))throw Error('O banco de origem deve ficar fora do diretório dedicado aos backups automáticos.');
  const control=join(directory,CONTROL_NAME);
  for(const path of [control,control+'-journal',control+'-wal',control+'-shm']){
    const entry=present(path);
    if(entry&&(!entry.isFile()||entry.isSymbolicLink()))throw Error('O controle de backups contém um arquivo irregular ou link simbólico.');
  }
  return {directory,source,control};
}
function readControl(db,source,{initialize=false}={}){
  const version=db.prepare('PRAGMA user_version').get().user_version;
  const applicationId=db.prepare('PRAGMA application_id').get().application_id;
  const schema=db.prepare("SELECT name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY name").all();
  if(initialize&&version===0&&applicationId===0&&schema.length===0){
    db.exec(`${CONTROL_SQL}; PRAGMA user_version=1; PRAGMA application_id=${CONTROL_ID};`);
    db.prepare('INSERT INTO automatic_backup VALUES(1,?,?,?)').run(source,randomUUID(),JSON.stringify({lastRunAt:null,lastBackupAt:null,lastSuccessAt:null,lastError:null,lastFile:null,files:[],removed:0}));
  }else if(version!==1||applicationId!==CONTROL_ID||schema.length!==1||schema[0].name!=='automatic_backup'||schema[0].sql!==CONTROL_SQL)throw Error('Formato do controle de backups desconhecido. Use outra pasta dedicada; o arquivo existente foi preservado.');
  const rows=db.prepare('SELECT * FROM automatic_backup').all(),row=rows[0];
  if(rows.length!==1||row.id!==1||row.source!==source||!UUID.test(row.directory_id))throw Error('Esta pasta está vinculada a outro DB_PATH ou tem controle inválido. Use uma pasta diferente para o novo banco.');
  let status;try{status=JSON.parse(row.status);}catch{throw Error('Estado do controle de backups inválido.');}
  if(!status||typeof status!=='object'||['lastRunAt','lastBackupAt','lastSuccessAt'].some(key=>status[key]!==null&&(!Number.isSafeInteger(status[key])||status[key]<0))||!(status.lastError===null||typeof status.lastError==='string')||!(status.lastFile===null||AUTO_NAME.test(status.lastFile))||!Array.isArray(status.files)||status.files.some(name=>!AUTO_NAME.test(name))||new Set(status.files).size!==status.files.length||!Number.isSafeInteger(status.removed)||status.removed<0)throw Error('Estado do controle de backups inválido.');
  return {directoryId:row.directory_id,status};
}
function reportStatus(config,status,now){
  const retry=status.lastError!==null;
  const nextRunAt=status.lastRunAt===null?now:retry?status.lastRunAt+config.retryMinutes*60000:(status.lastBackupAt??0)+config.intervalMinutes*60000;
  const stale=status.lastBackupAt===null||now>status.lastBackupAt+(config.intervalMinutes+config.retryMinutes)*60000||now<status.lastRunAt;
  const {files,...publicStatus}=status;
  return {enabled:true,healthy:!retry&&!stale,...publicStatus,registeredCount:files.length,nextRunAt,intervalMinutes:config.intervalMinutes,keep:config.keep};
}
export function readAutomaticBackupStatus(config,{now=Date.now()}={}){
  if(!config)return {enabled:false,healthy:false,reason:'Backup automático desativado: BACKUP_DIR não foi definido.'};
  const location=paths(config),db=new DatabaseSync(location.control,{readOnly:true,timeout:5000});
  try{
    db.exec('PRAGMA trusted_schema=OFF; BEGIN;');
    const control=readControl(db,location.source),result=reportStatus(config,control.status,now);
    if(result.lastFile){
      const path=join(location.directory,result.lastFile),file=present(path),manifest=manifestAt(path+'.json');
      if(!file?.isFile()||file.isSymbolicLink()||manifest?.automaticBackup?.directoryId!==control.directoryId||manifest.file?.bytes!==file.size)return {...result,healthy:false,reason:'A última cópia ou seu manifesto está ausente ou divergente. Confira com npm run restore -- --verify.'};
    }
    return result;
  }
  finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}
function manifestAt(path){
  const info=present(path);
  if(!info||!info.isFile()||info.isSymbolicLink()||info.size>65536)return null;
  try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}
}
function unchanged(path,info){const current=present(path);return current&&current.isFile()&&!current.isSymbolicLink()&&current.ino===info.ino&&current.dev===info.dev&&current.size===info.size&&current.mtimeMs===info.mtimeMs;}
async function retainCopies(location,directoryId,keep,registeredFiles,lastFile){
  const candidates=[],orphans=[];
  const registered=new Set(registeredFiles);
  for(const name of new Set([...readdirSync(location.directory),...registered])){
    const databaseName=name.endsWith('.sqlite.json')?name.slice(0,-5):name;
    if(!AUTO_NAME.test(databaseName))continue;
    const path=join(location.directory,databaseName),report=path+'.json',manifest=manifestAt(report);
    const info=present(path);
    if(!info&&!present(report))continue; // Fully deleted pairs after a crash need no cleanup.
    if(manifest?.application!=='grimorio'||manifest?.automaticBackup?.formatVersion!==1||manifest?.automaticBackup?.directoryId!==directoryId){
      if(registered.has(databaseName))throw Error('Manifesto de uma cópia automática registrada ausente ou inválido. Nenhuma retenção foi aplicada.');
      continue;
    }
    const reportInfo=lstatSync(report);
    if(!info){if(name.endsWith('.json'))orphans.push({report,info:reportInfo});continue;}
    if(name.endsWith('.json'))continue;
    if(!info.isFile()||info.isSymbolicLink())throw Error('Uma cópia automática é um arquivo irregular. Nenhuma retenção foi aplicada.');
    const sourceInfo=present(location.source);
    if(canonical(path)===location.source||(sourceInfo&&sourceInfo.ino===info.ino&&sourceInfo.dev===info.dev))throw Error('Uma cópia automática aponta para a origem. Nenhuma retenção foi aplicada.');
    const verified=await verifyBackup(path);
    if(!verified.manifest||!Number.isFinite(Date.parse(verified.manifest.createdAt)))throw Error('Data de uma cópia automática inválida. Nenhuma retenção foi aplicada.');
    candidates.push({path,report,info,reportInfo,createdAt:Date.parse(verified.manifest.createdAt)});
  }
  // Keep the newest successfully produced copy even if the system clock moved backwards.
  candidates.sort((a,b)=>Number(basename(b.path)===lastFile)-Number(basename(a.path)===lastFile)||b.createdAt-a.createdAt||b.path.localeCompare(a.path));
  const expired=candidates.slice(keep);
  // Verify every owned pair before deleting any. Exact files only; no recursive cleanup.
  for(const item of expired)if(!unchanged(item.path,item.info)||!unchanged(item.report,item.reportInfo))throw Error('Uma cópia mudou durante a retenção. Nenhum arquivo alterado será removido.');
  for(const item of expired){
    if(!unchanged(item.path,item.info)||!unchanged(item.report,item.reportInfo))throw Error('Uma cópia mudou antes da remoção.');
    unlinkSync(item.path);unlinkSync(item.report);
  }
  // A crash between publishing/deleting the two files may leave an owned manifest alone.
  for(const item of orphans)if(unchanged(item.report,item.info))unlinkSync(item.report);
  return {removed:expired.length,files:candidates.slice(0,keep).map(item=>basename(item.path))};
}
export async function runAutomaticBackup(config,{now=Date.now(),force=false}={}){
  if(!config)return {outcome:'disabled'};
  const location=paths(config,{create:true});
  const db=new DatabaseSync(location.control,{timeout:0});let locked=false;
  try{
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA synchronous=FULL;');
    try{db.exec('BEGIN IMMEDIATE');locked=true;}catch(error){if(error.errcode===5)return {outcome:'busy'};throw error;}
    const control=readControl(db,location.source,{initialize:true}),status={...control.status,files:[...control.status.files]};
    chmodSync(location.control,0o600);
    const due=reportStatus(config,status,now).nextRunAt;
    if(!force&&now>=status.lastRunAt&&now<due){db.exec('ROLLBACK');locked=false;return {outcome:'not-due',status:reportStatus(config,status,now)};}
    let outcome='success';status.lastRunAt=now;status.removed=0;
    try{
      // Retry failed retention without generating another copy before the regular interval.
      if(force||status.lastBackupAt===null||now<status.lastBackupAt||now>=status.lastBackupAt+config.intervalMinutes*60000){
        const name=`auto-grimorio-${new Date(now).toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.sqlite`;
        await createBackup(location.source,join(location.directory,name),{automaticBackup:{formatVersion:1,directoryId:control.directoryId}});
        status.lastBackupAt=now;status.lastFile=name;
        status.files.push(name);
      }
      const retained=await retainCopies(location,control.directoryId,config.keep,status.files,status.lastFile);
      status.removed=retained.removed;status.files=retained.files;
      status.lastSuccessAt=now;status.lastError=null;
    }catch(error){status.lastError=failureMessage(error);outcome='failure';}
    db.prepare('UPDATE automatic_backup SET status=? WHERE id=1').run(JSON.stringify(status));
    db.exec('COMMIT');locked=false;
    return {outcome,status:reportStatus(config,status,now)};
  }finally{if(locked&&db.isTransaction)db.exec('ROLLBACK');db.close();}
}
export async function automaticBackupCLI(args,env=process.env){
  try{
    if(args.length===1&&args[0]==='--help'){
      console.log('Uso: npm run backup:auto -- [--once | --status]\nBACKUP_DIR absoluto ativa o agendamento no servidor. --once força uma cópia; sem opção respeita o intervalo; --status retorna 1 se desativado, com falha ou atrasado.');return 0;
    }
    if(args.length>1||(args.length===1&&!['--once','--status'].includes(args[0])))throw Error('Uso: npm run backup:auto -- [--once | --status]');
    const config=automaticBackupConfig(env);
    const result=args[0]==='--status'?readAutomaticBackupStatus(config):await runAutomaticBackup(config,{force:args[0]==='--once'});
    console.log(JSON.stringify(result));
    if(result.outcome==='failure')console.error(`ALERTA: backup automático falhou. ${result.status.lastError}`);
    return args[0]==='--status'?(result.healthy?0:1):['failure','disabled'].includes(result.outcome)?1:0;
  }catch(error){console.error(`ALERTA: backup automático não pôde ser executado. ${failureMessage(error)}`);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await automaticBackupCLI(process.argv.slice(2));
