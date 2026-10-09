import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createReadStream,lstatSync,realpathSync,mkdirSync,mkdtempSync,copyFileSync,constants,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,chmodSync,linkSync,unlinkSync,rmdirSync,statSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {DATABASE_TABLES,DATABASE_V1_TABLES,DATABASE_V2_TABLES,DATABASE_V4_TABLES,DATABASE_V5_TABLES,DATABASE_V6_TABLES,DATABASE_V7_TABLES,DATABASE_V8_TABLES,LEGACY_DATABASE_TABLES,databaseSchemaIdentity} from '../server/databaseSchema.js';
import {assertSavedSceneMedia} from '../server/sceneMedia.js';
import {assertSavedTimeline} from '../server/campaignTimeline.js';
import {assertSavedSheetModels} from '../server/sheetModels.js';
import {assertMigrationLedger,assertRoomMigrationLedger} from '../server/databaseMigrations.js';
import {assertRoomState,assertRoomMembers,migrateRoomState,ROOM_STATE_VERSION} from '../server/roomState.js';
import {assertRoomAudit} from '../server/roomAudit.js';
import {assertSavedDiceHistory} from '../server/diceHistory.js';
import {assertCombatOperations} from '../server/combatOperations.js';

export const RECOVERY_FORMAT_VERSION = 1;
const applicationVersion = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = path => {try{lstatSync(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const companions = path => ['-wal','-shm','-journal'].map(suffix=>path+suffix);
function schemaRows(db){
  return db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name").all();
}
function checkIntegrity(db,full){
  const results = db.prepare(full?'PRAGMA integrity_check':'PRAGMA quick_check').all();
  if(results.length!==1||Object.values(results[0])[0]!=='ok')throw Error('O banco não passou na verificação de integridade SQLite.');
  if(db.prepare('PRAGMA foreign_key_check').get())throw Error('O banco contém referências inválidas entre registros.');
}
function parseJSON(value,check,label){
  let parsed;
  try{parsed=JSON.parse(value);}catch{throw Error(`JSON inválido em ${label}. Nenhum conteúdo foi publicado.`);}
  if(!check(parsed))throw Error(`Estrutura de dados inválida em ${label}.`);
  return parsed;
}
function checkSavedData(db,tables,userVersion){
  const roomStateVersions={};
  for(const row of db.prepare('SELECT id,state,revision FROM rooms').iterate()){
    const state=parseJSON(row.state,object,'estado de mesa');
    if(userVersion>0){const members=db.prepare('SELECT u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username').all(row.id),usernames=members.map(member=>member.username);migrateRoomState(state,{usernames,members});}
    const version=state.stateVersion??0;
    if(!Number.isInteger(version)||version<0||version>ROOM_STATE_VERSION)throw Error('Versão do estado de mesa não suportada por esta aplicação.');
    roomStateVersions[version]=(roomStateVersions[version]||0)+1;
    if(!Array.isArray(state.points)||!Array.isArray(state.sheetFields)||!object(state.playerSheets)||!object(state.statusBarsData)||!Number.isSafeInteger(row.revision)||row.revision<0)throw Error('Estado de mesa incompatível com a aplicação.');
    for(const sheet of Object.values(state.playerSheets))if(!object(sheet))throw Error('Ficha persistida inválida.');
    for(const key of ['masterNotebooks','mapStrokes','mapObjects','campaignScenes'])if(state[key]!==undefined&&!Array.isArray(state[key]))throw Error('Lista persistida da mesa inválida.');
  }
  for(const row of db.prepare('SELECT bundle FROM map_assets').iterate())parseJSON(row.bundle,value=>object(value)&&Array.isArray(value.files),'arquivos da mesa 3D');
  if(tables.has('map_imports'))for(const row of db.prepare('SELECT phase,result FROM map_imports').iterate()){
    parseJSON(row.result,value=>object(value)&&!['id','phase','createdAt','expiresAt'].some(key=>Object.hasOwn(value,key))&&
      (row.phase!=='confirmed'||typeof value.objectId==='string'&&Array.isArray(value.warnings)&&value.warnings.every(warning=>typeof warning==='string')),'confirmação de importação 3D');
  }
  for(const row of db.prepare('SELECT mesh FROM dice_structures').iterate())parseJSON(row.mesh,object,'estrutura de rolagem');
  if(tables.has('note_versions'))for(const row of db.prepare('SELECT content,shared_with,asset_ids,summary FROM note_versions').iterate()){
    parseJSON(row.content,object,'histórico de nota');
    parseJSON(row.shared_with,Array.isArray,'acesso do histórico');
    parseJSON(row.asset_ids,Array.isArray,'imagens do histórico');
    parseJSON(row.summary,object,'resumo do histórico');
  }
  if(tables.has('note_assets'))for(const row of db.prepare('SELECT hash,data,bytes FROM note_assets').iterate()){
    if(row.bytes!==row.data?.byteLength||createHash('sha256').update(row.data).digest('hex')!==row.hash)throw Error('Uma imagem de nota não corresponde ao tamanho ou checksum registrado.');
  }
  if(tables.has('room_audit'))assertRoomAudit(db);
  if(tables.has('dice_rolls'))assertSavedDiceHistory(db);
  if(tables.has('combat_operations'))assertCombatOperations(db);
  if(tables.has('scene_media'))assertSavedSceneMedia(db);
  if(tables.has('timeline_entries'))assertSavedTimeline(db);
  if(tables.has('sheet_models'))assertSavedSheetModels(db);
  return roomStateVersions;
}
function openReadOnly(path){
  const db = new DatabaseSync(path,{readOnly:true,timeout:5000});
  try{db.exec('PRAGMA trusted_schema=OFF;');return db;}catch(error){db.close();throw error;}
}
export function inspectDatabase(path){
  const db=openReadOnly(path);
  try{
    db.exec('BEGIN');
    const identity=databaseSchemaIdentity(db);
    checkIntegrity(db,true);
    const tables=new Set(schemaRows(db).map(row=>row.name));
    if(identity.userVersion>0){assertMigrationLedger(db,{throughVersion:identity.userVersion});assertRoomMigrationLedger(db);}
    const roomStateVersions=checkSavedData(db,tables,identity.userVersion);
    const definitions=identity.userVersion===0?LEGACY_DATABASE_TABLES:identity.userVersion===1?DATABASE_V1_TABLES:identity.userVersion<4?DATABASE_V2_TABLES:identity.userVersion===4?DATABASE_V4_TABLES:identity.userVersion===5?DATABASE_V5_TABLES:identity.userVersion===6?DATABASE_V6_TABLES:identity.userVersion===7?DATABASE_V7_TABLES:identity.userVersion===8?DATABASE_V8_TABLES:DATABASE_TABLES;
    const counts=Object.fromEntries(Object.keys(definitions).sort().map(name=>[name,tables.has(name)?db.prepare(`SELECT count(*) AS count FROM ${name}`).get().count:0]));
    const sqliteVersion=db.prepare('SELECT sqlite_version() AS version').get().version;
    return {...identity,counts,sqliteVersion,roomStateVersions};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}
async function fileIdentity(path){
  const hash=createHash('sha256');let bytes=0;
  for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}
  return {bytes,sha256:hash.digest('hex')};
}
function requireFile(path){if(!present(path)||!statSync(path).isFile())throw Error(`Arquivo SQLite não encontrado: ${path}`);}
function requireStandalone(path){
  requireFile(path);
  if(companions(path).some(present))throw Error('A origem tem arquivos WAL/SHM/journal. Restaure uma cópia produzida por npm run backup, não o banco em uso.');
}
function canonicalPath(path){
  let parent=resolve(path),tail=[];
  while(!present(parent)){tail.unshift(basename(parent));const next=dirname(parent);if(next===parent)break;parent=next;}
  const result=resolve(realpathSync(parent),...tail);
  return process.platform==='win32'?result.toLowerCase():result;
}
function requireNewDestination(source,destination,report){
  if(canonicalPath(source)===canonicalPath(destination))throw Error('O destino deve ser um banco novo, diferente da origem.');
  for(const path of [destination,report,destination+'.json',destination+'.restore.json',...companions(destination)])if(present(path))throw Error(`O destino ou um arquivo associado já existe: ${path}`);
}
function flushFile(path){const fd=openSync(path,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}}
function writePrivateJSON(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});flushFile(path);}
function stageFor(destination){
  mkdirSync(dirname(destination),{recursive:true,mode:0o700});
  const path=mkdtempSync(join(dirname(destination),'.grimorio-recovery-'));
  chmodSync(path,0o700);
  return path;
}
function removeStage(stage){
  // Only known files created in this unique directory are removed; no recursion.
  for(const name of ['database.sqlite','report.json']){const path=join(stage,name);if(present(path))unlinkSync(path);}
  rmdirSync(stage);
}
function publishPair(stage,destination,report,source){
  requireNewDestination(source,destination,report);
  const database=join(stage,'database.sqlite'),metadata=join(stage,'report.json');
  // Hard links publish complete files without overwriting an existing path.
  // Both files are on the destination filesystem. The database is published last.
  let publishedReport=false;
  try{linkSync(metadata,report);publishedReport=true;linkSync(database,destination);}
  catch(error){
    if(publishedReport){const current=lstatSync(report),own=statSync(metadata);if(current.ino===own.ino&&current.dev===own.dev)unlinkSync(report);}
    if(['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(error.code))throw Error('O destino precisa de um volume local que permita publicar arquivos por hard link. Escolha outro diretório.');
    throw error;
  }
}
function sameDatabaseMetadata(left,right){
  return ['userVersion','applicationId','schemaKind','schemaFingerprint','missingTables','counts',...(left?.roomStateVersions!==undefined||right.userVersion>0?['roomStateVersions']:[])].every(key=>isDeepStrictEqual(left?.[key],right[key]));
}
export async function verifyBackup(source,{allowLegacy=false}={}){
  source=resolve(source);requireStandalone(source);
  const database=inspectDatabase(source),file=await fileIdentity(source),manifestPath=source+'.json';
  let manifest=null;
  if(present(manifestPath)){
    if(statSync(manifestPath).size>65536)throw Error('Manifesto de backup muito grande.');
    manifest=parseJSON(readFileSync(manifestPath,'utf8'),object,'manifesto do backup');
    if(manifest.application!=='grimorio'||manifest.formatVersion!==RECOVERY_FORMAT_VERSION)throw Error('Versão do manifesto de backup não suportada.');
    if(manifest.file?.bytes!==file.bytes||manifest.file?.sha256!==file.sha256)throw Error('O checksum do backup não corresponde ao manifesto.');
    if(!sameDatabaseMetadata(manifest.database,database))throw Error('A versão, o esquema ou a contagem do banco não correspondem ao manifesto.');
  }else if(!allowLegacy)throw Error('Manifesto não encontrado. Para um backup antigo conhecido, use --allow-legacy após guardar uma cópia do arquivo.');
  requireStandalone(source);
  return {source,database,file,manifest,legacy:manifest===null};
}
export async function createBackup(source,destination,{automaticBackup}={}){
  if(automaticBackup!==undefined&&(!object(automaticBackup)||automaticBackup.formatVersion!==1||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(automaticBackup.directoryId||'')))throw Error('Identificador de backup automático inválido.');
  source=resolve(source);destination=resolve(destination);requireFile(source);
  const report=destination+'.json';requireNewDestination(source,destination,report);
  const stage=stageFor(destination),stagedDatabase=join(stage,'database.sqlite');
  try{
    const db=openReadOnly(source);
    try{databaseSchemaIdentity(db);checkIntegrity(db,false);db.exec('PRAGMA synchronous=FULL;');db.prepare('VACUUM INTO ?').run(stagedDatabase);}finally{db.close();}
    chmodSync(stagedDatabase,0o600);flushFile(stagedDatabase);
    const database=inspectDatabase(stagedDatabase),file=await fileIdentity(stagedDatabase);
    const manifest={application:'grimorio',formatVersion:RECOVERY_FORMAT_VERSION,createdAt:new Date().toISOString(),producerVersion:applicationVersion,nodeVersion:process.versions.node,database,file,...(automaticBackup?{automaticBackup}: {})};
    writePrivateJSON(join(stage,'report.json'),manifest);
    publishPair(stage,destination,report,source);
    return {destination,report,database,file};
  }finally{removeStage(stage);}
}
export async function restoreBackup(source,destination,{allowLegacy=false}={}){
  source=resolve(source);destination=resolve(destination);
  requireFile(source);
  const report=destination+'.restore.json';requireNewDestination(source,destination,report);
  const verified=await verifyBackup(source,{allowLegacy}),stage=stageFor(destination),stagedDatabase=join(stage,'database.sqlite');
  try{
    copyFileSync(source,stagedDatabase,constants.COPYFILE_EXCL);
    chmodSync(stagedDatabase,0o600);flushFile(stagedDatabase);
    const file=await fileIdentity(stagedDatabase),sourceAfterCopy=await fileIdentity(source);
    requireStandalone(source);
    if(file.sha256!==verified.file.sha256||sourceAfterCopy.sha256!==verified.file.sha256)throw Error('O backup mudou durante a restauração. Nenhum banco foi publicado.');
    const database=inspectDatabase(stagedDatabase);
    if(!sameDatabaseMetadata(verified.database,database))throw Error('A cópia restaurada não corresponde ao backup.');
    const restoration={application:'grimorio',formatVersion:RECOVERY_FORMAT_VERSION,restoredAt:new Date().toISOString(),producerVersion:applicationVersion,legacyWithoutManifest:verified.legacy,sourceSha256:verified.file.sha256,file,database};
    writePrivateJSON(join(stage,'report.json'),restoration);
    publishPair(stage,destination,report,source);
    return {destination,report,database,file,legacy:verified.legacy};
  }finally{removeStage(stage);}
}
