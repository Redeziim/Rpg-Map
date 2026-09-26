import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export function useRoom(initialRoom,onRevoked){
  const [room,setRoom]=useState(initialRoom),[error,setError]=useState(''),[connection,setConnection]=useState('connecting'),[saving,setSaving]=useState(false);
  const current=useRef(initialRoom),serverMapImage=useRef(initialRoom.state.mapImage),queue=useRef(Promise.resolve()),pending=useRef(0),alive=useRef(true),deferredRoom=useRef(null);
  const apply=next=>{if(!alive.current)return;current.current=next;setRoom(next);};
  const flushDeferred=()=>{
    const next=deferredRoom.current;deferredRoom.current=null;
    if(!next||!alive.current)return;
    if(next.revision>current.current.revision||(next.revision===current.current.revision&&next.serverTime>=current.current.serverTime)||next.role!==current.current.role)apply(next);
    else if(next.trayRoll?.id!==current.current.trayRoll?.id)apply({...current.current,trayRoll:next.trayRoll,serverTime:next.serverTime});
  };
  useEffect(()=>{
    alive.current=true;
    const events=new EventSource(`/api/rooms/${initialRoom.id}/events`);
    events.addEventListener('room',e=>{
      const next=JSON.parse(e.data);setConnection('online');
      if(next.mapImageUnchanged){next.state.mapImage=serverMapImage.current;delete next.mapImageUnchanged;}
      else serverMapImage.current=next.state.mapImage;
      if(!pending.current||next.role!==current.current.role){if(next.role!==current.current.role)deferredRoom.current=null;apply(next);}
      else {
        if(!deferredRoom.current||next.revision>=deferredRoom.current.revision)deferredRoom.current=next;
        if(next.trayRoll?.id!==current.current.trayRoll?.id)apply({...current.current,trayRoll:next.trayRoll,serverTime:next.serverTime});
      }
    });
    events.addEventListener('revoked',()=>{events.close();onRevoked('Seu acesso à mesa mudou ou a sessão expirou.');});
    events.onerror=()=>setConnection('reconnecting');
    return()=>{alive.current=false;events.close();};
  },[initialRoom.id]);
  const mutate=(path,data,method='PATCH',optimistic)=>{
    pending.current++;setSaving(true);setError('');
    if(optimistic)apply(optimistic(current.current));
    const request=queue.current.then(async()=>{
      if(!alive.current)return false;
      try{
        const requestData=path==='/state'&&data&&Object.hasOwn(data,'points')
          ?{...data,pointsVersion:current.current.pointsVersion}:data;
        const result=await api(`/rooms/${initialRoom.id}${path}`,{method,data:requestData});
        if(result.state)serverMapImage.current=result.state.mapImage;
        if(result.state)current.current=result;
        if(pending.current===1 && result.state)apply(result);
        return result;
      }catch(e){
        if(alive.current)setError(e.message);
        try{const fresh=await api(`/rooms/${initialRoom.id}`);serverMapImage.current=fresh.state.mapImage;current.current=fresh;if(pending.current===1)apply(fresh);}catch{}
        return false;
      }finally{pending.current--;if(!pending.current)flushDeferred();if(alive.current)setSaving(pending.current>0);}
    });
    queue.current=request.catch(()=>{});return request;
  };
  useEffect(()=>{const warn=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  return {room,error,setError,connection,saving,mutate};
}
