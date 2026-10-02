import React,{useEffect,useRef,useState} from 'react';
import {Archive,Download,X} from 'lucide-react';
import {api} from '../api.js';
import './RoomExport.css';

const quantities=[['points','Pontos do mapa'],['notes','Notas'],['versions','Versões de notas'],['noteImages','Imagens da coleção'],['models','Modelos da mesa 3D'],['scenes','Cenas'],['participants','Participantes'],['audit','Registros de alterações']];
const sizeFormat=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const fileSize=bytes=>bytes<1024*1024?`${sizeFormat.format(bytes/1024)}\u00a0KB`:`${sizeFormat.format(bytes/1024/1024)}\u00a0MB`;

function ExportContents({roomId,revision,viewMode,master}){
  const [job,setJob]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const request=useRef(null),prepared=useRef(null),prepareButton=useRef(null),downloadButton=useRef(null);
  const base=`/rooms/${roomId}/exports`,stale=job&&job.revision!==revision;
  useEffect(()=>()=>{
    request.current?.abort();
    if(prepared.current)void api(`${base}/${prepared.current.id}`,{method:'DELETE'}).catch(()=>{});
  },[base]);
  useEffect(()=>{
    if(!job)return;
    const timer=setTimeout(()=>{
      setMessage('O arquivo expirou. Prepare uma nova cópia.');setJob(null);prepared.current=null;
      if(document.activeElement?.closest('.room-export'))prepareButton.current?.focus();
    },Math.max(0,job.expiresAt-Date.now()));
    return()=>clearTimeout(timer);
  },[job]);
  async function prepare(){
    if(busy)return;
    const controller=new AbortController();request.current=controller;
    setBusy('prepare');setError('');setMessage('');
    try{
      if(prepared.current)await api(`${base}/${prepared.current.id}`,{method:'DELETE',signal:controller.signal}).catch(cause=>{if(cause.status!==404&&cause.status!==410)throw cause;});
      prepared.current=null;setJob(null);
      const result=await api(base,{method:'POST',data:{viewMode},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});
      if(controller.signal.aborted){void api(`${base}/${result.id}`,{method:'DELETE'}).catch(()=>{});return;}
      prepared.current=result;setJob(result);setMessage('Arquivo pronto. Confira o conteúdo e baixe a cópia.');
      requestAnimationFrame(()=>downloadButton.current?.focus());
    }catch(cause){if(!controller.signal.aborted)setError(cause.message);}
    finally{if(request.current===controller){request.current=null;setBusy('');}}
  }
  async function download(){
    if(busy||stale||!job)return;
    const controller=new AbortController();request.current=controller;setBusy('download');setError('');
    try{
      await api(`${base}/${job.id}`,{signal:controller.signal});
      if(controller.signal.aborted)return;
      const anchor=document.createElement('a');anchor.href=job.downloadUrl;anchor.download=job.filename;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      prepared.current=null;setJob(null);setMessage('Download solicitado. Confira os downloads do navegador.');
      requestAnimationFrame(()=>prepareButton.current?.focus());
    }catch(cause){if(!controller.signal.aborted){setError(cause.message);if([404,409,410].includes(cause.status)){prepared.current=null;setJob(null);prepareButton.current?.focus();}}}
    finally{if(request.current===controller){request.current=null;setBusy('');}}
  }
  async function discard(){
    if(busy==='prepare'){request.current?.abort();setMessage('Preparo cancelado.');prepareButton.current?.focus();return;}
    if(busy||!job)return;
    const controller=new AbortController();request.current=controller;setBusy('discard');setError('');
    try{
      await api(`${base}/${job.id}`,{method:'DELETE',signal:controller.signal}).catch(cause=>{if(cause.status!==404&&cause.status!==410)throw cause;});
      prepared.current=null;setJob(null);setMessage('Arquivo temporário descartado.');prepareButton.current?.focus();
    }catch(cause){if(!controller.signal.aborted)setError(cause.message);}
    finally{if(request.current===controller){request.current=null;setBusy('');}}
  }
  return <div className="room-export-content">
    <p>Guarde uma cópia dos dados e arquivos desta mesa em um único arquivo JSON.</p>
    <ul className="room-export-included"><li>Mapa, pontos, exploração e fichas disponíveis.</li><li>Notas, quadros e versões que você pode consultar.</li><li>Imagens da coleção e modelos da mesa 3D.</li>{master&&<li>Caderno do mestre, cenas e registro de alterações.</li>}</ul>
    <p className="room-export-privacy">{master?'Notas individuais de outras pessoas entram apenas quando foram compartilhadas com você.':'Inclui suas notas e as compartilhadas com você. Áreas ocultas do mapa permanecem cobertas.'}</p>
    {stale&&<p className="room-export-notice" role="status">A mesa mudou. Prepare uma nova cópia antes de baixar.</p>}
    {job&&<div className="room-export-ready"><span className="room-export-stamp">Cópia preparada</span><dl>{quantities.filter(([key])=>job.counts[key]>0).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{job.counts[key].toLocaleString('pt-BR')}</dd></div>)}</dl><p>{fileSize(job.bytes)} · disponível por até 5 minutos.</p></div>}
    {error&&<p className="room-export-error" role="alert">{error}</p>}
    <div className="room-export-actions">
      {job&&!stale&&<button ref={downloadButton} type="button" aria-disabled={!!busy} onClick={()=>void download()}><Download size={17} aria-hidden="true"/>Baixar cópia da mesa</button>}
      <button ref={prepareButton} type="button" aria-disabled={!!busy} onClick={()=>void prepare()}><Archive size={17} aria-hidden="true"/>{busy==='prepare'?'Preparando arquivo…':job?'Preparar nova cópia':'Preparar cópia da mesa'}</button>
      {(busy==='prepare'||job)&&<button type="button" aria-disabled={!!busy&&busy!=='prepare'} onClick={()=>void discard()}><X size={17} aria-hidden="true"/>{busy==='prepare'?'Cancelar preparo':'Descartar arquivo'}</button>}
    </div>
    <p className="room-export-status" role="status">{message}</p>
    <p className="room-export-footnote">O arquivo ainda não pode ser importado pela interface. Rascunhos não salvos ficam neste navegador.</p>
  </div>;
}

export default function RoomExport({roomId,revision,role,viewMode}){
  const [open,setOpen]=useState(false),master=role!=='player'&&viewMode!=='player';
  return <details className="room-export" onToggle={event=>setOpen(event.currentTarget.open)}><summary><Archive size={20} aria-hidden="true"/>Salvar uma cópia da mesa</summary>{open&&<ExportContents key={`${roomId}:${role}:${viewMode}`} roomId={roomId} revision={revision} viewMode={master?'master':'player'} master={master}/>}</details>;
}
