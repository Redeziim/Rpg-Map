// Only native upload events measure transferred bytes. Receiving 100% is not a commit.
export function uploadMapAsset(path,{body,signal,onProgress,onUploaded}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return;}
    const request=new XMLHttpRequest();let settled=false;
    const progress=event=>onProgress?.(event.lengthComputable&&event.total>0?{loaded:event.loaded,total:event.total}:null);
    const uploaded=()=>onUploaded?.();
    const aborted=()=>finish(signal?.reason||new DOMException('Envio interrompido.','AbortError'));
    const abort=()=>{request.abort();aborted();};
    const failed=()=>finish(Error('A conexão caiu durante o envio.'));
    const timedOut=()=>finish(Error('O envio demorou demais.'));
    const loaded=()=>{
      const result=request.response;
      if(request.status<200||request.status>=300){finish(Object.assign(Error(result?.error||'Não foi possível concluir a importação.'),{status:request.status}));return;}
      if(!result||typeof result!=='object'){finish(Error('O servidor não respondeu corretamente.'));return;}
      finish(null,result);
    };
    function finish(error,result){
      if(settled)return;settled=true;signal?.removeEventListener('abort',abort);
      request.upload.removeEventListener('progress',progress);request.upload.removeEventListener('load',uploaded);
      for(const [event,handler]of [['load',loaded],['abort',aborted],['error',failed],['timeout',timedOut]])request.removeEventListener(event,handler);
      error?reject(error):resolve(result);
    }
    request.upload.addEventListener('progress',progress);request.upload.addEventListener('load',uploaded);
    for(const [event,handler]of [['load',loaded],['abort',aborted],['error',failed],['timeout',timedOut]])request.addEventListener(event,handler);
    signal?.addEventListener('abort',abort,{once:true});
    try{request.open('POST',`/api${path}`);request.withCredentials=true;request.responseType='json';request.timeout=120000;request.setRequestHeader('Content-Type',body.type);request.send(body);}catch(error){finish(error);}
  });
}
