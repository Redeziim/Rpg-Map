import React,{useEffect,useState} from 'react';
import {api,ROLE_LABELS} from '../api.js';

const initial=name=>String(name||'?').trim().charAt(0).toLocaleUpperCase('pt-BR')||'?';

// As outras mesas da conta, na barra lateral: um quadrado com a inicial (fechada) e o nome com o papel (aberta). Um clique troca de mesa.
export default function RailTables({currentId,onOpen,limit=3}){
  const [rooms,setRooms]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
  useEffect(()=>{
    let alive=true;
    api('/rooms').then(list=>{if(alive&&Array.isArray(list))setRooms(list);}).catch(()=>{});
    return()=>{alive=false;};
  },[]);
  const others=rooms.filter(room=>room.id!==currentId).slice(0,limit);
  if(!others.length)return null;
  async function open(id){
    setBusy(id);setError('');
    try{await onOpen(id);}
    catch(cause){setError(cause?.message||'Não foi possível abrir a mesa.');setBusy('');}
  }
  return <nav className="rail-tables" aria-label="Outras mesas">
    <ul>{others.map(room=><li key={room.id}><button type="button" className="rail-table" title={`${room.name} · ${ROLE_LABELS[room.role]||room.role}`} disabled={Boolean(busy)} aria-busy={busy===room.id} onClick={()=>open(room.id)}>
      <span className="rail-avatar is-small" aria-hidden="true">{initial(room.name)}</span>
      <span className="rail-text"><strong>{room.name}</strong><small>{ROLE_LABELS[room.role]||room.role}</small></span>
    </button></li>)}</ul>
    {error&&<p className="rail-error" role="alert">{error}</p>}
  </nav>;
}
