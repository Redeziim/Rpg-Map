import {restoreBackup,verifyBackup} from './databaseRecovery.js';

const usage='Uso: npm run restore -- origem.sqlite destino-novo.sqlite [--allow-legacy]\nVerificar sem restaurar: npm run restore -- --verify origem.sqlite [--allow-legacy]\nO comando não usa DB_PATH como destino e nunca substitui um banco existente.';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--help')console.log(usage);
else{
  try{
    const flags=args.filter(value=>value.startsWith('--')),paths=args.filter(value=>!value.startsWith('--'));
    if(flags.some(flag=>!['--verify','--allow-legacy'].includes(flag))||new Set(flags).size!==flags.length||paths.length!==(flags.includes('--verify')?1:2))throw Error(usage);
    const options={allowLegacy:flags.includes('--allow-legacy')};
    const result=flags.includes('--verify')?await verifyBackup(paths[0],options):await restoreBackup(paths[0],paths[1],options);
    console.log(`${flags.includes('--verify')?'Backup verificado':'Banco novo restaurado'}: ${result.destination||result.source}\nEsquema: ${result.database.schemaKind}; versão SQLite da aplicação: ${result.database.userVersion}\nMesas: ${result.database.counts.rooms}; contas: ${result.database.counts.users}; checksum SHA-256: ${result.file.sha256}`);
    if(result.report)console.log(`Relatório: ${result.report}`);
    if(result.legacy)console.log('Backup antigo sem manifesto: integridade e esquema conferidos; não há checksum anterior para comparar.');
    if(result.destination)console.log('Teste a cópia isoladamente. Para usá-la, pare o servidor e configure DB_PATH com o novo caminho.');
  }catch(error){console.error(`Restauração recusada: ${error.message}`);process.exitCode=1;}
}
