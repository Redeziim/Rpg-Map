import {countLegacyExportDirectories,createExportRecovery,defaultExportRoot,exportRootPath} from './exportWorkspace.js';

export function createMaintenance({db,exportRoot=defaultExportRoot(),intervalMs=30000,batchSize=100,maxExportDirs=16,onIssue=()=>{}}){
  if(!Number.isSafeInteger(intervalMs)||intervalMs<1000||!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>1000||!Number.isSafeInteger(maxExportDirs)||maxExportDirs<1||maxExportDirs>100)throw Error('Configuração de manutenção inválida.');
  exportRoot=exportRootPath(exportRoot,{create:true});
  const sessions=db.prepare('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires<=? ORDER BY expires LIMIT ?)');
  const invites=db.prepare('DELETE FROM invites WHERE id IN (SELECT id FROM invites WHERE expires<=? ORDER BY expires LIMIT ?)');
  const imports=db.prepare('DELETE FROM map_imports WHERE id IN (SELECT id FROM map_imports WHERE expires<=? ORDER BY expires LIMIT ?)');
  const diceReceipts=db.prepare('DELETE FROM dice_receipts WHERE rowid IN (SELECT rowid FROM dice_receipts WHERE expires<=? ORDER BY expires LIMIT ?)');
  const combatOperations=db.prepare('DELETE FROM combat_operations WHERE rowid IN (SELECT rowid FROM combat_operations WHERE expires<=? ORDER BY expires LIMIT ?)');
  let timer;const reported=new Set();
  const report=(code,error)=>{const key=`${code}:${error}`;if(reported.has(key))return;reported.add(key);try{onIssue(code,error);}catch{}};
  const exportsRecovery=createExportRecovery(exportRoot,{onIssue:report});
  function runOnce(){
    const database={sessions:0,invites:0,imports:0,diceReceipts:0,combatOperations:0},exports={removed:0,pending:0,examined:0};
    const now=Date.now();
    for(const [table,statement] of [['sessions',sessions],['invites',invites],['imports',imports],['diceReceipts',diceReceipts],['combatOperations',combatOperations]]){
      try{database[table]=Number(statement.run(now,batchSize).changes);}catch(error){report(`database-${table}`,error.code||'failed');}
    }
    try{Object.assign(exports,exportsRecovery.runOnce(maxExportDirs));}
    catch(error){report('export-scan',error.code||'failed');}
    return {database,exports};
  }
  return {runOnce,start(){if(timer)return;try{const count=countLegacyExportDirectories();if(count)report('export-legacy-unowned',String(count));}catch(error){report('export-legacy-scan',error.code||'failed');}runOnce();timer=setInterval(runOnce,intervalMs);timer.unref();},stop(){if(timer)clearInterval(timer);timer=null;exportsRecovery.close();}};
}
