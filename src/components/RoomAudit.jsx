import React,{useEffect,useRef,useState} from 'react';
import {BookOpen,RefreshCw} from 'lucide-react';
import {api,ROLE_LABELS} from '../api.js';
import {AUDIT_ACTIONS,AUDIT_CATEGORIES,AUDIT_RETENTION} from '../shared/roomAudit.js';
import './RoomAudit.css';

const dateFormat=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
function detailText(details){
  const parts=[];
  if(details.target)parts.push('@'+details.target);
  if(details.fromRole&&details.role)parts.push(`de ${ROLE_LABELS[details.fromRole]} para ${ROLE_LABELS[details.role]}`);
  else if(details.role)parts.push(ROLE_LABELS[details.role]);
  return parts.join(' · ');
}
function AuditEntries({roomId,revision,refreshKey}){
  const [category,setCategory]=useState(''),[page,setPage]=useState({entries:[],nextBefore:null}),[busy,setBusy]=useState('first'),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[loadedRevision,setLoadedRevision]=useState(null);
  const request=useRef(null),refreshButton=useRef(null);
  async function load(before){
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(before?'more':'first');setError('');
    const query=new URLSearchParams({mapViewMode:'master',limit:'25',...(category?{category}:{}),...(before?{before:String(before)}:{})});
    try{
      const result=await api(`/rooms/${roomId}/audit?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
      if(controller.signal.aborted)return;
      setPage(previous=>({...result,entries:before?[...previous.entries,...result.entries]:result.entries}));
      if(!before)setLoadedRevision(revision);
    }catch(cause){if(!controller.signal.aborted)setError(cause.message);}
    finally{if(!controller.signal.aborted)setBusy('');}
  }
  useEffect(()=>{setPage({entries:[],nextBefore:null});setLoadedRevision(null);void load();return()=>request.current?.abort();},[roomId,category,refresh,refreshKey]);
  return <div className="room-audit-content">
    <p className="room-audit-hint">Quem fez a alteração e quando. Textos de notas e imagens não aparecem aqui.</p>
    <div className="room-audit-tools">
      <label>Tipo de alteração<select name="auditCategory" autoComplete="off" value={category} onChange={event=>setCategory(event.target.value)}><option value="">Todos os tipos</option>{Object.entries(AUDIT_CATEGORIES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <button ref={refreshButton} type="button" aria-disabled={!!busy} onClick={()=>{if(!busy)setRefresh(value=>value+1);}}><RefreshCw size={16} aria-hidden="true"/>Atualizar registros</button>
    </div>
    {loadedRevision!==null&&loadedRevision!==revision&&!busy&&<p className="room-audit-notice" role="status">A mesa recebeu alterações. Atualize para consultar os novos registros.</p>}
    {error&&<p className="room-audit-error" role="alert">{error} <button type="button" disabled={!!busy} onClick={()=>{refreshButton.current?.focus();setRefresh(value=>value+1);}}>Tentar novamente</button></p>}
    <p className="room-audit-status" role="status">{busy?'Carregando registros…':page.entries.length===1?'1 registro exibido':`${page.entries.length.toLocaleString('pt-BR')} registros exibidos`}</p>
    {!busy&&page.entries.length===0&&!error&&<p className="room-audit-empty">{category?'Nenhuma alteração desse tipo registrada.':'Nenhuma alteração registrada desde que esta função foi ativada.'}</p>}
    <ol className="room-audit-list" aria-label="Alterações registradas" aria-busy={!!busy}>
      {page.entries.map(entry=>{const [type,label]=AUDIT_ACTIONS[entry.action]||['','Alteração da mesa'];return <li key={entry.sequence}>
        <time dateTime={new Date(entry.createdAt).toISOString()}>{dateFormat.format(entry.createdAt)}</time>
        <div className="room-audit-action"><span className="room-audit-category">{AUDIT_CATEGORIES[type]}</span><strong>{label}</strong>{detailText(entry.details)&&<span>{detailText(entry.details)}</span>}</div>
        <span className="room-audit-author">Por <strong>@{entry.actor.username}</strong></span>
      </li>;})}
    </ol>
    {page.entries.length>0&&<button className="room-audit-more" type="button" aria-disabled={!!busy||!page.nextBefore} onClick={()=>{if(!busy&&page.nextBefore)void load(page.nextBefore);}}>{busy==='more'?'Carregando…':page.nextBefore?'Ver registros anteriores':'Todos os registros exibidos'}</button>}
    <p className="room-audit-footnote">Até {AUDIT_RETENTION.toLocaleString('pt-BR')} registros recentes por mesa. Alterações anteriores à ativação não são recuperadas.</p>
  </div>;
}
export default function RoomAudit({roomId,revision,refreshKey}){
  const [open,setOpen]=useState(false);
  return <details className="room-audit" onToggle={event=>setOpen(event.currentTarget.open)}><summary><BookOpen size={20} aria-hidden="true"/><span>Registro da mesa</span></summary>{open&&<AuditEntries roomId={roomId} revision={revision} refreshKey={refreshKey}/>}</details>;
}
