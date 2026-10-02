import {randomUUID} from 'node:crypto';
import {chmodSync,existsSync,lstatSync,mkdirSync,mkdtempSync,opendirSync,readFileSync,readdirSync,readlinkSync,realpathSync,rmdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir,hostname} from 'node:os';
import {isAbsolute,join,resolve} from 'node:path';

export const EXPORT_OWNER_FILE='owner.json';
export const defaultExportRoot=()=>join(tmpdir(),`grimorio-export-files-v1-${process.getuid?.()??'user'}`);
const runName=/^run-[A-Za-z0-9]{6}$/;
const legacyName=/^grimorio-export-files-[A-Za-z0-9]{6}$/;
const jobName=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
const safeReasons=new Set(['owner-file','owner-size','owner-unknown','owner-unverifiable','unexpected-entry']);
function pidNamespace(){if(process.platform!=='linux')return null;try{return readlinkSync('/proc/self/ns/pid');}catch{return null;}}

function verifiedDirectory(path){
  const absolute=resolve(path),info=lstatSync(absolute);
  const real=realpathSync(absolute),samePath=process.platform==='win32'?real.toLowerCase()===absolute.toLowerCase():real===absolute;
  if(!isAbsolute(path)||!info.isDirectory()||info.isSymbolicLink()||!samePath)throw Error('Diretório de exportação não é seguro.');
  if(process.getuid&&((info.uid!==process.getuid())||(info.mode&0o077)!==0))throw Error('Diretório de exportação não é privado.');
  return absolute;
}
export function exportRootPath(root=defaultExportRoot(),{create=false}={}){
  if(!isAbsolute(root))throw Error('Use um caminho absoluto para os temporários de exportação.');
  if(create)mkdirSync(root,{recursive:true,mode:0o700});
  return verifiedDirectory(root);
}
export function countLegacyExportDirectories(){return readdirSync(tmpdir()).filter(name=>legacyName.test(name)).length;}
export function createExportWorkspace(root=defaultExportRoot()){
  const base=exportRootPath(root,{create:true}),directory=mkdtempSync(join(base,'run-'));
  try{
    chmodSync(directory,0o700);
    writeFileSync(join(directory,EXPORT_OWNER_FILE),JSON.stringify({format:'grimorio-export-run',version:1,pid:process.pid,host:hostname(),pidNamespace:pidNamespace(),nonce:randomUUID()}),{flag:'wx',mode:0o600});
    return {directory,close(){
      if(!existsSync(directory))return;
      verifiedDirectory(directory);
      const owner=join(directory,EXPORT_OWNER_FILE);
      if(existsSync(owner)&&lstatSync(owner).isFile())unlinkSync(owner);
      rmdirSync(directory);
    }};
  }catch(error){try{rmdirSync(directory);}catch{}throw error;}
}
function ownerInactive(pid){
  if(pid===process.pid)return false;
  try{process.kill(pid,0);return false;}
  catch(error){return error.code==='ESRCH';}
}
function safeFile(path){const info=lstatSync(path);return info.isFile()&&!info.isSymbolicLink()&&info.nlink===1;}

export function createExportRecovery(root,{onIssue=()=>{}}={}){
  let scanner=null;
  function close(){if(scanner){try{scanner.closeSync();}finally{scanner=null;}}}
  function runOnce(maxDirectories=16){
    if(!existsSync(root))return {removed:0,pending:0,examined:0};
    let base;
    try{base=exportRootPath(root);}catch(error){close();throw error;}
    scanner||=opendirSync(base);
    let removed=0,pending=0,examined=0;
    while(examined<maxDirectories){
      let entry;try{entry=scanner.readSync();}catch(error){close();throw error;}
      if(!entry){close();break;}
      examined++;
      if(!runName.test(entry.name)){pending++;try{onIssue('export-preserved','unexpected-root-entry');}catch{}continue;}
      const directory=join(base,entry.name);
      try{
        verifiedDirectory(directory);
        const ownerPath=join(directory,EXPORT_OWNER_FILE);
        if(!safeFile(ownerPath))throw Error('owner-file');
        const ownerInfo=lstatSync(ownerPath);
        if(ownerInfo.size>4096)throw Error('owner-size');
        const owner=JSON.parse(readFileSync(ownerPath,'utf8'));
        if(owner.format!=='grimorio-export-run'||owner.version!==1||!Number.isSafeInteger(owner.pid)||owner.pid<1||owner.host!==hostname()||typeof owner.nonce!=='string'||!/^[0-9a-f-]{36}$/.test(owner.nonce))throw Error('owner-unknown');
        if(process.platform==='linux'&&(!pidNamespace()||owner.pidNamespace!==pidNamespace()))throw Error('owner-unverifiable');
        if(!ownerInactive(owner.pid)){pending++;continue;}
        const files=readdirSync(directory);
        if(files.some(file=>file!==EXPORT_OWNER_FILE&&!jobName.test(file)||!safeFile(join(directory,file))))throw Error('unexpected-entry');
        if(!ownerInactive(owner.pid)){pending++;continue;}
        for(const file of files.filter(file=>file!==EXPORT_OWNER_FILE))unlinkSync(join(directory,file));
        unlinkSync(ownerPath);rmdirSync(directory);removed++;
      }catch(error){pending++;const reason=error.code||(safeReasons.has(error.message)?error.message:'invalid-entry');try{onIssue('export-preserved',reason);}catch{}}
    }
    return {removed,pending,examined};
  }
  return {runOnce,close};
}
