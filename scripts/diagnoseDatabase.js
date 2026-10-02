import {resolve} from 'node:path';
import {inspectDatabaseUsage} from '../server/databaseDiagnostics.js';

const args=process.argv.slice(2),json=args.includes('--json'),full=args.includes('--full'),paths=args.filter(arg=>!arg.startsWith('--'));
if(paths.length>1||args.some(arg=>arg.startsWith('--')&&!['--json','--full'].includes(arg))){
  console.error('Uso: npm run db:diagnose -- [--json] [--full] [caminho-do-banco]');
  process.exitCode=2;
}else{
  try{
    const report=inspectDatabaseUsage(paths[0]||process.env.DB_PATH||resolve('data/grimorio.sqlite'),{full});
    if(json)console.log(JSON.stringify(report,null,2));
    else{
      console.log(`SQLite: ${report.ok?'íntegro':'verificação falhou'} | esquema ${report.database.userVersion} | ${report.totals.roomCount} mesa(s)`);
      console.log(`Verificações: rápida ${report.checks.quick.ok?'ok':'falha'}, completa ${report.checks.integrity===null?'não executada':report.checks.integrity.ok?'ok':'falha'}, referências inválidas ${report.checks.foreignKeyViolations}, esquema ${report.checks.schemaCompatible?'compatível':'incompatível'}`);
      console.log(`Arquivos: banco ${report.database.mainFileBytes} B, WAL ${report.database.walFileBytes} B, SHM ${report.database.shmFileBytes} B; páginas livres ${report.database.freePages}`);
      console.log(`Payload estimado das mesas: ${report.totals.estimatedPayloadBytes} B (não equivale ao tamanho físico dos arquivos)`);
      for(const room of report.rooms)console.log(`Mesa ${room.roomId}: estado ${room.stateBytes} B; modelos ${room.models.count}/${room.models.payloadBytes} B (arquivos de origem ${room.models.sourceBytes} B); imagens ${room.images.count}/${room.images.payloadBytes} B; histórico ${room.histories.count}/${room.histories.payloadBytes} B; registros ${room.records.count}/${room.records.payloadBytes} B; estruturas ${room.structures.count}/${room.structures.payloadBytes} B`);
    }
    if(!report.ok)process.exitCode=1;
  }catch{
    if(json)console.log(JSON.stringify({ok:false,error:'database_unreadable'}));
    else console.error('Não foi possível ler o banco SQLite. Confirme o caminho, as permissões e a integridade do arquivo.');
    process.exitCode=1;
  }
}
