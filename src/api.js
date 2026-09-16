export async function api(path, {method='GET', data, signal}={}) {
  let response;
  try { response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,signal:signal||AbortSignal.timeout(20000)}); }
  catch(e){if(e.name==='AbortError')throw e;throw new Error('Servidor indisponível. Verifique sua conexão e tente novamente.');}
  const result=await response.json().catch(()=>({error:'O servidor não respondeu corretamente.'}));
  if(!response.ok)throw Object.assign(new Error(result.error||'Não foi possível concluir.'),{status:response.status});
  return result;
}
export const ROLE_LABELS={admin:'ADM',master:'Mestre',player:'Jogador'};
