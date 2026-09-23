import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {NotebookPen, Plus, X, GripHorizontal, Save, LocateFixed} from 'lucide-react';
import './Notebook.css';

const clampPosition=(x,y)=>({x:Math.max(8,Math.min(x,innerWidth-Math.min(360,innerWidth-16)-8)),y:Math.max(8,Math.min(y,innerHeight-Math.min(480,innerHeight-16)-8))});
function NoteWindow({note,position,readOnly,onSave,onClose,onPosition,onFocus,zIndex,onDraft}) {
  const [title,setTitle]=useState(note.title),[body,setBody]=useState(note.body);
  const [saved,setSaved]=useState({title:note.savedTitle??note.title,body:note.savedBody??note.body});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const panel=useRef(null),drag=useRef(null),persisted=useRef(!note.isNew);
  const unsaved=title!==saved.title||body!==saved.body||!persisted.current;
  useEffect(()=>{onDraft({title,body,savedTitle:saved.title,savedBody:saved.body,isNew:!persisted.current});},[title,body,saved]);
  useEffect(()=>{
    if(!unsaved)return;
    const warn=e=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[unsaved]);
  useEffect(()=>{
    const resize=()=>onPosition(clampPosition(position.x,position.y));
    resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
  },[position.x,position.y]);
  async function save(){
    if(!title.trim()){setError('Dê um nome à nota antes de salvar.');return;}
    setBusy(true);setError('');const next={title:title.trim(),body};
    try{
      if(!await onSave(note.id,next))throw Error('Não foi possível salvar. Seu rascunho foi mantido; tente novamente.');
      persisted.current=true;setTitle(next.title);setSaved(next);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function start(e){if(e.button!==0)return;onFocus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,origin:position};}
  function move(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;const p=clampPosition(d.origin.x+e.clientX-d.x,d.origin.y+e.clientY-d.y);panel.current.style.left=p.x+'px';panel.current.style.top=p.y+'px';panel.current.style.maxHeight=`calc(100dvh - ${p.y+8}px)`;d.last=p;}
  function finish(){const d=drag.current;if(!d)return;drag.current=null;onPosition(d.last||d.origin);}
  function keyboard(e){const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!delta)return;e.preventDefault();onPosition(clampPosition(position.x+delta[0],position.y+delta[1]));}
  function close(){if(busy)return;if(unsaved&&(body||title!=='Nova nota')&&!confirm('Fechar sem salvar esta nota? As alterações desta janela serão descartadas.'))return;onClose();}
  return <section ref={panel} className="note-window" role="dialog" aria-modal="false" aria-label={title||'Nova nota'} style={{left:position.x,top:position.y,maxHeight:`calc(100dvh - ${position.y+8}px)`,zIndex}} onPointerDownCapture={onFocus} onFocusCapture={onFocus}>
    <header className="note-window-header"><button className="note-drag" aria-label={`Mover ${title||'nota'}: arraste ou use as setas`} title="Arraste para mover · setas do teclado para ajustar" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={keyboard}><GripHorizontal size={18} aria-hidden="true"/><span>{title||'Nova nota'}</span></button><button aria-label={`Fechar ${title||'nota'}`} disabled={busy} onClick={close}><X size={18} aria-hidden="true"/></button></header>
    <div className="note-window-content"><label>Nome da nota<input name="note-title" autoComplete="off" value={title} maxLength={100} readOnly={readOnly} disabled={busy} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Encontro na taverna…"/></label><label className="note-body-label">Anotações<textarea name="note-body" value={body} maxLength={50000} readOnly={readOnly} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Escreva suas anotações…"/></label>{error&&<p role="alert" className="note-error">{error}</p>}</div>
    <footer><span role="status">{readOnly?'Somente leitura':busy?'Salvando…':unsaved?'Rascunho · não salvo':'Salvo na mesa'}</span>{!readOnly&&<button className="note-save" disabled={busy||!unsaved} onClick={save}><Save size={15} aria-hidden="true"/>{busy?'Salvando…':'Salvar'}</button>}</footer>
  </section>;
}
export default function Notebook({title,hint,notes=[],onSave,readOnly=false,className='',storageKey}) {
  const key='grimorio-notes-v1:'+storageKey;
  const library=useRef(null);
  const positions=useRef(null);
  if(positions.current===null){try{positions.current=JSON.parse(localStorage.getItem(key+':positions'))||{};}catch{positions.current={};}}
  function place(id,position){positions.current[id]=position;try{localStorage.setItem(key+':positions',JSON.stringify(positions.current));}catch{}update(id,{position});}
  const [windows,setWindows]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(key));return Array.isArray(saved)?saved.filter(w=>w&&typeof w.id==='string'&&typeof w.title==='string'&&typeof w.body==='string'&&Number.isFinite(w.position?.x)&&Number.isFinite(w.position?.y)).slice(0,10):[];}catch{return [];}});
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(windows));}catch{}},[key,windows]);
  function open(note){setWindows(previous=>previous.some(w=>w.id===note.id)?[...previous.filter(w=>w.id!==note.id),previous.find(w=>w.id===note.id)]:previous.length>=10?previous:[...previous,{...note,position:positions.current[note.id]||clampPosition(220+previous.length*28,100+previous.length*28)}]);}
  function update(id,patch){setWindows(previous=>previous.map(w=>w.id===id?{...w,...patch}:w));}
  function focus(id){setWindows(previous=>previous.at(-1)?.id===id?previous:[...previous.filter(w=>w.id!==id),previous.find(w=>w.id===id)]);}
  return <><details ref={library} className={`notebook notebook-library ${className}`}><summary><NotebookPen size={18} aria-hidden="true"/><span>{title}<small>{hint} · {notes.length} {notes.length===1?'salva':'salvas'}</small></span></summary><div className="notebook-library-list">
    {!readOnly&&<button className="note-new" disabled={windows.length>=10} onClick={()=>open({id:crypto.randomUUID(),title:'Nova nota',body:'',isNew:true})}><Plus size={16} aria-hidden="true"/>Nova nota</button>}
    {!notes.length&&<p>Nenhuma nota salva ainda.</p>}
    {notes.map(note=><button key={note.id} onClick={()=>open(note)}><NotebookPen size={15} aria-hidden="true"/><span>{note.title}</span><small>{windows.some(w=>w.id===note.id)?'Aberta':'Abrir'}</small></button>)}
    {!!windows.length&&<button onClick={()=>setWindows(previous=>previous.map((w,i)=>({...w,position:clampPosition(24+i*24,80+i*24)})))}><LocateFixed size={16} aria-hidden="true"/>Reunir janelas ({windows.length})</button>}
    {windows.length>=10&&<p>Feche uma janela para abrir outra nota.</p>}
  </div></details>{createPortal(windows.map((note,index)=><NoteWindow key={note.id} note={note} position={note.position} readOnly={readOnly} onSave={onSave} onClose={()=>{setWindows(previous=>previous.filter(w=>w.id!==note.id));library.current?.querySelector('summary')?.focus();}} onPosition={position=>place(note.id,position)} onDraft={draft=>update(note.id,draft)} onFocus={()=>focus(note.id)} zIndex={70+index}/>),document.body)}</>;
}
