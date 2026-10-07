export async function api(path, {method='GET', data, signal,mediaCache,body:payload,headers={},responseType='json'}={}) {
  let response;
  try { response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{...(data?{'Content-Type':'application/json'}:{}),...mediaCache?.headers(),...headers},body:payload??(data?JSON.stringify(mediaCache?mediaCache.encode(data):data):undefined),signal:signal||AbortSignal.timeout(20000)}); }
  catch(e){if(e.name==='AbortError')throw e;throw new Error('Servidor indisponível. Verifique sua conexão e tente novamente.');}
  if(response.ok&&responseType==='blob')return response.blob();
  const result=await response.json().catch(()=>({error:'O servidor não respondeu corretamente.'}));
  if(!response.ok)throw Object.assign(new Error(result.error||'Não foi possível concluir.'),{status:response.status,...(result.details?{details:result.details}:{})});
  return mediaCache?mediaCache.decode(result):result;
}
export const ROLE_LABELS={admin:'ADM',master:'Mestre',player:'Jogador'};
