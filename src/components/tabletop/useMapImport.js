import {useEffect,useRef,useState} from 'react';
import {api} from '../../api.js';
import {nativeMapAsset,createMapAssetBlob} from './mapAssetTransfer.js';
import {uploadMapAsset} from './uploadMapAsset.js';

const activePhases=new Set(['preparing','uploading','checking','cancelling','reconciling']);
export function useMapImport({roomId,userId,viewMode,editable,onConfirmed,refresh}){
  const [job,setJob]=useState(null),operation=useRef(null),alive=useRef(false),latest=useRef({});
  latest.current={editable,onConfirmed,refresh};
  const base=`/rooms/${roomId}/map-imports`,storageKey=`grimorio:model-import:v1:${userId}:${roomId}`;
  const update=(run,state)=>{if(alive.current&&operation.current===run)setJob(state);};
  function remember(id){try{if(id)localStorage.setItem(storageKey,JSON.stringify({version:1,id}));else localStorage.removeItem(storageKey);return true;}catch{return false;}}
  function settle(run,result){
    if(!alive.current||operation.current!==run)return;
    if(!['confirmed','cancelled','failed'].includes(result.phase))throw Error('O resultado ainda não foi confirmado.');
    remember(null);operation.current=null;
    const message=result.phase==='confirmed'?(run.cancelled?'O modelo já havia sido adicionado antes do cancelamento.':run.restored?'Importação anterior conferida: o modelo foi adicionado.':'Modelo adicionado à mesa.'):
      result.phase==='cancelled'?'Importação cancelada. Os arquivos não foram adicionados.':result.message||'Não foi possível concluir a importação.';
    setJob({...result,message});
    if(result.phase==='confirmed'){latest.current.onConfirmed(result);void latest.current.refresh();}
  }
  async function reconcile(run){
    run.reconciliation=new AbortController();update(run,{phase:run.cancelled?'cancelling':'reconciling',message:run.cancelled?'Cancelando e conferindo o resultado…':'Conferindo o resultado da importação…'});
    try{settle(run,await api(`${base}/${run.id}`,{method:'DELETE',signal:AbortSignal.any([run.reconciliation.signal,AbortSignal.timeout(20000)])}));}
    catch(error){if(alive.current&&operation.current===run){setJob({phase:'uncertain',message:'Não foi possível conferir o resultado. Verifique antes de adicionar novamente.',detail:error.message,canDismiss:error.status===404});}}
    finally{run.reconciliation=null;}
  }
  useEffect(()=>{
    alive.current=true;
    let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
    if(saved?.version===1&&/^[a-f0-9-]{36}$/.test(saved.id)){
      const run={id:saved.id,restored:true,controller:new AbortController()};operation.current=run;void reconcile(run);
    }
    return()=>{
      alive.current=false;const run=operation.current;operation.current=null;run?.controller.abort();run?.reconciliation?.abort();
      if(run?.id)void api(`${base}/${run.id}`,{method:'DELETE'}).catch(()=>{});
    };
  },[roomId,userId]);
  useEffect(()=>{if(!editable&&operation.current&&!operation.current.reconciliation){operation.current.cancelled=true;operation.current.controller.abort();}},[editable]);
  async function start(files,main,kind,placement){
    if(operation.current||!latest.current.editable)return;
    const run={controller:new AbortController(),cancelled:false};operation.current=run;update(run,{phase:'preparing',message:'Preparando o pacote…'});
    try{
      const body=createMapAssetBlob({...nativeMapAsset(files,main,kind),...(placement?{placement}:{})});
      const signal=AbortSignal.any([run.controller.signal,AbortSignal.timeout(120000)]);
      const prepared=await api(`${base}?mapViewMode=${viewMode}`,{method:'POST',data:{},signal});run.id=prepared.id;run.remembered=remember(run.id);
      signal.throwIfAborted();if(!alive.current||!latest.current.editable)throw new DOMException('Importação cancelada.','AbortError');
      update(run,{phase:'uploading',message:'Enviando arquivos…',remembered:run.remembered});
      const result=await uploadMapAsset(`/rooms/${roomId}/map-assets?mapViewMode=${viewMode}&importId=${run.id}`,{body,signal,
        onProgress:progress=>update(run,{phase:'uploading',message:'Enviando arquivos…',progress,remembered:run.remembered}),
        onUploaded:()=>update(run,{phase:'checking',message:'Conferindo e salvando o modelo…',remembered:run.remembered})});
      settle(run,result.import);
    }catch(error){
      if(!alive.current||operation.current!==run)return;
      if(run.id)await reconcile(run);
      else{operation.current=null;setJob({phase:run.cancelled?'cancelled':'failed',message:run.cancelled?'Importação cancelada. Os arquivos não foram adicionados.':error.message});}
    }
  }
  return {job,busy:activePhases.has(job?.phase),blocked:activePhases.has(job?.phase)||job?.phase==='uncertain',start,
    cancel(){const run=operation.current;if(!run||run.reconciliation)return;run.cancelled=true;update(run,{phase:'cancelling',message:'Cancelando e conferindo o resultado…'});run.controller.abort();},
    check(){const run=operation.current;if(run?.id&&!run.reconciliation)void reconcile(run);},
    dismiss(){if(job?.canDismiss){remember(null);operation.current=null;setJob(null);}},
    clear(){if(!operation.current)setJob(null);}};
}
