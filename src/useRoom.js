import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import {createRoomMediaCache} from './roomMediaCache.js';

export function useRoom(initialRoom,onRevoked){
  const [room,setRoom]=useState(initialRoom),[error,setError]=useState(''),[connection,setConnection]=useState('connecting'),[saving,setSaving]=useState(false);
  const current=useRef(initialRoom),latest=useRef(initialRoom),queue=useRef(Promise.resolve()),pending=useRef(0),alive=useRef(true),lifecycle=useRef(null);
  const media=useRef(null);if(!media.current)media.current=createRoomMediaCache();
  const revokedCallback=useRef(onRevoked),revokeAccess=useRef(null);revokedCallback.current=onRevoked;
  const apply=next=>{if(!alive.current)return;current.current=next;setRoom(next);};
  // HTTP responses can arrive after a newer event. Only server snapshots advance this reference.
  const receive=next=>{
    if(!alive.current||next.revision<latest.current.revision||next.revision===latest.current.revision&&next.serverTime<latest.current.serverTime)return;
    if(next.mapImageUnchanged){next.state.mapImage=latest.current.state.mapImage;delete next.mapImageUnchanged;}
    latest.current=next;
    if(!pending.current||next.role!==current.current.role)apply(next);
    else if(next.trayRoll?.id!==current.current.trayRoll?.id)apply({...current.current,trayRoll:next.trayRoll,serverTime:next.serverTime});
  };
  useEffect(()=>{
    alive.current=true;
    const controller=new AbortController();lifecycle.current=controller;
    let stream,timer,checking=false,revoked=false,online=false,retryMs=3000;
    const signal=()=>AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
    const revoke=status=>{
      if(controller.signal.aborted||revoked)return;
      revoked=true;alive.current=false;clearTimeout(timer);stream?.close();controller.abort();
      revokedCallback.current(status===401?'Sua sessão expirou ou foi encerrada. Entre novamente para retomar a mesa.':'Seu acesso à mesa foi removido.',status);
    };
    revokeAccess.current=revoke;
    const schedule=()=>{
      clearTimeout(timer);
      timer=setTimeout(check,retryMs);retryMs=Math.min(retryMs*2,30000);
    };
    const disconnected=()=>{
      if(controller.signal.aborted||revoked)return;
      online=false;stream?.close();setConnection('reconnecting');schedule();
    };
    function connect(){
      if(controller.signal.aborted||revoked)return;
      stream?.close();
      const events=new EventSource(`/api/rooms/${initialRoom.id}/events?media=1`);stream=events;
      events.addEventListener('room',event=>{
        if(stream!==events||controller.signal.aborted)return;
        try{receive(media.current.decode(JSON.parse(event.data)));}
        catch{disconnected();return;}
        online=true;retryMs=3000;clearTimeout(timer);setConnection('online');
      });
      events.addEventListener('revoked',event=>{
        if(stream!==events||controller.signal.aborted)return;
        let status;try{status=JSON.parse(event.data).status;}catch{}
        if(status===401||status===403)revoke(status);else disconnected();
      });
      events.onerror=()=>{if(stream===events)disconnected();};
    }
    async function check(){
      if(controller.signal.aborted||revoked||checking||online)return;
      clearTimeout(timer);checking=true;
      try{
        receive(await api(`/rooms/${initialRoom.id}`,{signal:signal(),mediaCache:media.current}));
        if(!controller.signal.aborted)connect();
      }catch(cause){
        if(controller.signal.aborted)return;
        if(cause.status===401||cause.status===403)revoke(cause.status);
        else schedule();
      }finally{checking=false;}
    }
    const visible=()=>{if(document.visibilityState==='visible')void check();};
    connect();window.addEventListener('online',check);document.addEventListener('visibilitychange',visible);
    return()=>{alive.current=false;controller.abort();clearTimeout(timer);stream?.close();window.removeEventListener('online',check);document.removeEventListener('visibilitychange',visible);};
  },[initialRoom.id]);
  const mutate=(path,data,method='PATCH',optimistic)=>{
    if(!alive.current)return Promise.resolve(false);
    pending.current++;setSaving(true);setError('');
    if(optimistic)apply(optimistic(current.current));
    const controller=lifecycle.current;
    const request=queue.current.then(async()=>{
      const signal=()=>AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
      try{
        if(!alive.current||controller.signal.aborted)return false;
        const result=await api(`/rooms/${initialRoom.id}${path}`,{method,data,signal:signal(),mediaCache:media.current});
        if(result.state)receive(result);
        return controller.signal.aborted?false:result;
      }catch(cause){
        if(controller.signal.aborted)return false;
        if(cause.status===401){revokeAccess.current(401);return false;}
        setError(cause.status?cause.message:'A conexão caiu durante o envio. Ele pode ter sido salvo. Confira a versão da mesa antes de tentar novamente.');
        // A failed response does not prove that the write failed. Refresh; never replay it automatically.
        try{receive(await api(`/rooms/${initialRoom.id}`,{signal:signal(),mediaCache:media.current}));}
        catch(freshError){if(!controller.signal.aborted&&(freshError.status===401||freshError.status===403))revokeAccess.current(freshError.status);}
        return false;
      }finally{
        pending.current--;
        if(alive.current){if(!pending.current)apply(latest.current);setSaving(pending.current>0);}
      }
    });
    queue.current=request.catch(()=>{});return request;
  };
  useEffect(()=>{const warn=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  return {room,error,setError,connection,saving,mutate};
}
