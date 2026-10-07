import {Worker} from 'node:worker_threads';

export function createModelValidator({timeoutMs=20000,maxWorkers=2}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||!Number.isInteger(maxWorkers)||maxWorkers<1||maxWorkers>2)throw Error('Configuração da validação de modelos inválida.');
  const jobs=new Set(),cache=new Map(),shared=new Map();let closed=false;
  const error=(status,message)=>Object.assign(Error(message),{status});
  function run(bundle,signal){
    if(closed)return Promise.reject(error(503,'A conferência de modelos está encerrando. Tente novamente.'));
    if(signal?.aborted)return Promise.reject(error(499,'Importação cancelada.'));
    if(jobs.size>=maxWorkers)return Promise.reject(error(503,'Há modelos sendo conferidos. Aguarde e tente novamente.'));
    return new Promise((resolve,reject)=>{
      let worker,timer,finished=false;
      const finish=(failure,result)=>{
        if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
        const release=()=>{jobs.delete(cancel);failure?reject(failure):resolve(result);};
        Promise.resolve(worker?.terminate()).then(release,release);
      };
      const abort=()=>finish(error(499,'Importação cancelada.'));
      const cancel=()=>finish(error(503,'A conferência de modelos foi interrompida. Tente novamente.'));
      jobs.add(cancel);signal?.addEventListener('abort',abort,{once:true});
      try{
        worker=new Worker(new URL('./modelValidationWorker.js',import.meta.url),{workerData:bundle,resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:8},stdout:true,stderr:true});
        worker.stdout.resume();worker.stderr.resume();
        worker.once('message',result=>result.ok?finish(null,result.summary):finish(error(result.status||400,result.message||'Modelo inválido.')));
        worker.once('error',failure=>finish(error(failure.code==='ERR_WORKER_OUT_OF_MEMORY'?413:400,'Não foi possível conferir o modelo dentro dos limites. Reduza ou exporte o arquivo novamente.')));
        worker.once('exit',()=>{if(!finished)finish(error(400,'Não foi possível concluir a conferência do modelo.'));});
        timer=setTimeout(()=>finish(error(503,'A conferência do modelo demorou demais. Reduza o arquivo e tente novamente.')),timeoutMs);
      }catch{finish(error(503,'A conferência de modelos está indisponível. Tente novamente.'));}
    });
  }
  function validateShared(factory,signal,key=Symbol()){
    if(closed)return Promise.reject(error(503,'A conferência de modelos está encerrando. Tente novamente.'));
    if(signal?.aborted)return Promise.reject(error(499,'Importação cancelada.'));
    if(cache.has(key)){const result=cache.get(key);cache.delete(key);cache.set(key,result);return Promise.resolve(result);}
    let entry=shared.get(key);
    if(entry?.controller.signal.aborted)entry=null;
    if(!entry){
      entry={controller:new AbortController(),clients:0,finished:false};shared.set(key,entry);
      let pending;try{pending=run(factory(),entry.controller.signal);}catch{pending=Promise.reject(error(400,'Pacote 3D inválido.'));}
      entry.promise=pending.then(result=>{if(closed)throw error(503,'A conferência foi interrompida.');cache.set(key,result);while(cache.size>64)cache.delete(cache.keys().next().value);return result;}).finally(()=>{entry.finished=true;if(shared.get(key)===entry)shared.delete(key);});
    }
    entry.clients++;
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(failure,result)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(--entry.clients===0&&!entry.finished)entry.controller.abort();failure?reject(failure):resolve(result);};
      const abort=()=>finish(error(499,'Importação cancelada.'));signal?.addEventListener('abort',abort,{once:true});
      entry.promise.then(result=>finish(null,result),failure=>finish(failure));
    });
  }
  return {validate:(bundle,signal,key)=>validateShared(()=>bundle,signal,key),validateSaved:(serialized,signal,key)=>validateShared(()=>JSON.parse(serialized),signal,key),close(){closed=true;cache.clear();for(const cancel of jobs)cancel();}};
}
