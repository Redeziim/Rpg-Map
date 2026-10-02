import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// SQLite verification/VACUUM run in a child, never on the API's event loop.
export function startAutomaticBackups(config,{env=process.env,logger=console}={}){
  if(!config)return {stop:async()=>{}};
  let child=null,stopped=false,timeout=null,timer=null;
  const tick=()=>{
    if(stopped||child)return;
    let output='';
    const worker=spawn(process.execPath,[fileURLToPath(new URL('../scripts/automaticBackup.js',import.meta.url))],{
      env:{...env,DB_PATH:config.source,BACKUP_DIR:config.directory,BACKUP_INTERVAL_MINUTES:String(config.intervalMinutes),BACKUP_KEEP:String(config.keep),BACKUP_RETRY_MINUTES:String(config.retryMinutes),BACKUP_TIMEOUT_MINUTES:String(config.timeoutMinutes)},
      stdio:['ignore','pipe','pipe'],windowsHide:true,
    });
    child=worker;
    worker.stdout.on('data',data=>{output=(output+data.toString()).slice(-16384);});
    worker.stderr.on('data',data=>{for(const line of data.toString().split(/\r?\n/))if(line&&!line.includes('ExperimentalWarning')&&!line.includes('Use `node --trace-warnings'))logger.error(line);});
    timeout=setTimeout(()=>{logger.error('ALERTA: backup automático excedeu o tempo limite e foi interrompido. Confira a pasta e o estado pelo comando backup:auto -- --status.');worker.kill('SIGTERM');},config.timeoutMinutes*60000);
    timeout.unref();
    worker.on('error',error=>logger.error(`ALERTA: não foi possível iniciar o processo de backup automático (${error.code||'erro'}).`));
    worker.on('close',(code,signal)=>{
      clearTimeout(timeout);timeout=null;child=null;
      let nextRunAt=null;
      if(code===0){
        try{
          const result=JSON.parse(output.trim());
          if(!['success','not-due','busy'].includes(result.outcome))throw Error('Resultado desconhecido');
          nextRunAt=result.status?.nextRunAt;
          if(result.outcome==='success')logger.log(`Backup automático verificado; ${result.status.removed} cópias antigas removidas.`);
        }catch{logger.error('ALERTA: o processo de backup terminou sem um resultado reconhecido.');}
      }else logger.error(`ALERTA: processo de backup terminou com falha (${signal||code}). Consulte backup:auto -- --status e os logs do serviço.`);
      if(!stopped){
        const delay=Number.isSafeInteger(nextRunAt)?Math.max(1000,Math.min(60000,nextRunAt-Date.now())):60000;
        timer=setTimeout(tick,delay);timer.unref();
      }
    });
  };
  tick();
  logger.log(`Backup automático ativo: a cada ${config.intervalMinutes} minutos, mantendo ${config.keep} cópias verificadas.`);
  return {stop:async()=>{
    stopped=true;clearTimeout(timer);
    const running=child;if(!running)return;
    await new Promise(resolve=>{const grace=setTimeout(()=>running.kill('SIGTERM'),10000);running.once('close',()=>{clearTimeout(grace);resolve();});});
  }};
}
