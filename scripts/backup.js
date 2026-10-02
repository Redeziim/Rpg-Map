import {createBackup} from './databaseRecovery.js';

const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--help'){
  console.log('Uso: npm run backup -- [destino-novo.sqlite]\nOrigem: DB_PATH ou data/grimorio.sqlite. Gera SQLite e manifesto .json, sem sobrescrever arquivos.');
}else{
  try{
    if(args.length>1||args.some(value=>value.startsWith('--')))throw Error('Uso: npm run backup -- [destino-novo.sqlite]');
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const result=await createBackup(process.env.DB_PATH||'data/grimorio.sqlite',args[0]||`data/backups/grimorio-${stamp}.sqlite`);
    console.log(`Backup SQLite verificado: ${result.destination}\nManifesto: ${result.report}\nEsquema: ${result.database.schemaKind}; versão SQLite da aplicação: ${result.database.userVersion}\nMesas: ${result.database.counts.rooms}; contas: ${result.database.counts.users}; checksum SHA-256: ${result.file.sha256}`);
  }catch(error){console.error(`Backup não criado: ${error.message}`);process.exitCode=1;}
}
