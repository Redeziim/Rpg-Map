import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {NotebookPen,Plus,X,GripHorizontal,Save,LocateFixed,Share2,Map as MapIcon,FileText,RefreshCw} from 'lucide-react';
import NoteBoard,{emptyNoteBoard} from './NoteBoard.jsx';
import './Notebook.css';

const noteKey=note=>`${note.scope||''}:${note.id}`;
const clampPosition=(x,y,wide=false)=>({x:Math.max(8,Math.min(x,innerWidth-Math.min(wide?860:500,innerWidth-16)-8)),y:Math.max(8,Math.min(y,innerHeight-180))});
const normalized=note=>({title:note.title||'',body:note.body||'',board:note.board||emptyNoteBoard(),version:note.version||0,sharedWith:note.sharedWith||[]});
function savedFromRoom(room,scope,id){
  if(!room?.state)return null;
  const list=scope==='@master'?room.state.masterNotebooks:room.state.playerSheets?.[scope]?.notebooks;
  return list?.find(note=>note.id===id)||room.state.sharedNotebooks?.find(note=>note.id===id&&note.scope===scope)||null;
}
function NoteWindow({note,latest,position,readOnly,onSave,onShare,onClose,onPosition,onFocus,zIndex,onDraft,members,username,canShare,draftStorageError}){
  const [draft,setDraft]=useState(()=>normalized(note));
  const [saved,setSaved]=useState(()=>({...normalized(latest||note),version:Math.min(note.version||0,latest?.version||note.version||0)}));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[shareOpen,setShareOpen]=useState(false),[boardOpen,setBoardOpen]=useState(false);
  const [recipients,setRecipients]=useState(()=>latest?.sharedWith||note.sharedWith||[]);
  const panel=useRef(null),drag=useRef(null),persisted=useRef(!note.isNew);
  const textHistory=useRef({title:{past:[],future:[]},body:{past:[],future:[]}});
  useEffect(()=>{panel.current?.querySelector('.note-drag')?.focus();},[]);
  const scope=note.scope;
  const boardDirty=useMemo(()=>JSON.stringify(draft.board)!==JSON.stringify(saved.board),[draft.board,saved.board]);
  const dirty=!persisted.current||draft.title!==saved.title||draft.body!==saved.body||boardDirty;
  const incomingVersion=latest?.version||0,stale=incomingVersion>saved.version;
  useEffect(()=>{
    if(!latest||incomingVersion<=saved.version)return;
    const next=normalized(latest);
    if(!dirty){textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};setDraft(next);setSaved(next);setRecipients(next.sharedWith);}
  },[latest,incomingVersion,saved.version,dirty]);
  useEffect(()=>{onDraft({title:draft.title,body:draft.body,board:draft.board,version:saved.version,isNew:!persisted.current});},[draft,saved.version]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  useEffect(()=>{const resize=()=>{const next=clampPosition(position.x,position.y,boardOpen);if(next.x!==position.x||next.y!==position.y)onPosition(next);};resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[position.x,position.y,boardOpen]);
  function loadLatest(){if(!latest)return;const next=normalized(latest);persisted.current=true;textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};setDraft(next);setSaved(next);setRecipients(next.sharedWith);setError('');}
  function editText(field,event){
    const value=event.target.value,current=draft[field];
    if(value===current)return;
    const history=textHistory.current[field];
    history.past.push(current);if(history.past.length>100)history.past.shift();history.future=[];
    setDraft(previous=>({...previous,[field]:value}));
  }
  function textShortcut(field,event){
    if(!(event.ctrlKey||event.metaKey)||event.altKey||readOnly||busy)return;
    const key=event.key.toLowerCase(),redo=key==='y'||key==='z'&&event.shiftKey;
    if(key!=='z'&&!redo)return;
    event.preventDefault();
    const history=textHistory.current[field],source=redo?history.future:history.past,destination=redo?history.past:history.future;
    if(!source.length)return;
    const value=source.pop();destination.push(draft[field]);
    setDraft(previous=>({...previous,[field]:value}));
    const input=event.currentTarget;
    requestAnimationFrame(()=>{if(input.isConnected&&document.activeElement===input)input.setSelectionRange(value.length,value.length);});
  }
  async function save(){
    if(!draft.title.trim()){setError('Dê um nome à nota antes de salvar.');return;}
    if(stale){setError('Outra pessoa salvou uma versão mais recente. Carregue a versão atual antes de editar.');return;}
    setBusy(true);setError('');
    const payload={title:draft.title.trim(),body:draft.body,board:draft.board,...(persisted.current?{version:saved.version}:{})};
    try{
      const room=await onSave(scope,note.id,payload);
      if(!room)throw Error('Não foi possível salvar. Confira a conexão ou carregue a versão atual.');
      persisted.current=true;
      const next=normalized(savedFromRoom(room,scope,note.id)||{...payload,version:saved.version+1,sharedWith:saved.sharedWith});
      textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};
      setDraft(next);setSaved(next);setRecipients(next.sharedWith);
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  async function share(){
    setBusy(true);setError('');
    try{
      const room=await onShare(scope,note.id,{version:saved.version,sharedWith:recipients});
      if(!room)throw Error('Não foi possível atualizar o compartilhamento. Confira a versão da nota.');
      const next=normalized(savedFromRoom(room,scope,note.id)||{...saved,sharedWith:recipients,version:saved.version+1});
      setSaved(next);setDraft(previous=>dirty?{...previous,version:next.version,sharedWith:next.sharedWith}:next);setShareOpen(false);
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  function start(event){if(event.button!==0)return;onFocus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,origin:position};}
  function move(event){const current=drag.current;if(!current||current.id!==event.pointerId)return;const next=clampPosition(current.origin.x+event.clientX-current.x,current.origin.y+event.clientY-current.y,boardOpen);panel.current.style.left=next.x+'px';panel.current.style.top=next.y+'px';panel.current.style.maxHeight=`calc(100dvh - ${next.y+8}px)`;current.last=next;}
  function finish(){const current=drag.current;if(!current)return;drag.current=null;onPosition(current.last||current.origin);}
  function keyboard(event){const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!delta)return;event.preventDefault();onPosition(clampPosition(position.x+delta[0],position.y+delta[1],boardOpen));}
  function close(){if(busy)return;if(dirty&&!confirm('Fechar sem salvar esta nota? As alterações desta janela serão descartadas.'))return;onClose();}
  const candidates=members.filter(member=>member.username!==username&&member.username!==note.owner);
  return <section id={`note-window-${note.scope}-${note.id}`} ref={panel} className={`note-window ${boardOpen?'is-wide':''}`} role="dialog" aria-modal="false" aria-label={draft.title||'Nova nota'} style={{left:position.x,top:position.y,maxHeight:`calc(100dvh - ${position.y+8}px)`,zIndex}} onPointerDownCapture={onFocus} onFocusCapture={onFocus}>
    <header className="note-window-header"><button className="note-drag" aria-label={`Mover ${draft.title||'nota'}: arraste ou use as setas`} title="Arraste para mover · setas do teclado para ajustar" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={keyboard}><GripHorizontal size={18} aria-hidden="true"/><span>{draft.title||'Nova nota'}</span></button><button aria-label={`Fechar ${draft.title||'nota'}`} disabled={busy} onClick={close}><X size={18} aria-hidden="true"/></button></header>
    <div className="note-window-content">
      {note.owner&&<p className="note-owner">Compartilhada por {note.owner==='@master'?'Mestre':note.owner}</p>}
      {stale&&<div className="note-stale" role="status"><span>Esta nota mudou em outra janela ou por outro participante.</span><button type="button" onClick={()=>{if(!dirty||confirm('Substituir seu rascunho pela versão atual?'))loadLatest();}}><RefreshCw size={15} aria-hidden="true"/>Carregar versão atual</button></div>}
      {draftStorageError&&<p className="note-error" role="alert">{draftStorageError}</p>}
      <label className="note-title-label">Nome da nota<input name="note-title" autoComplete="off" value={draft.title} maxLength={100} readOnly={readOnly} disabled={busy} onChange={event=>editText('title',event)} onKeyDown={event=>textShortcut('title',event)} placeholder="Ex.: Encontro na taverna…"/></label>
      <div className="note-view-switch" role="group" aria-label="Visualização da nota"><button type="button" aria-pressed={!boardOpen} onClick={()=>setBoardOpen(false)}><FileText size={16} aria-hidden="true"/>Texto</button><button type="button" aria-pressed={boardOpen} onClick={()=>setBoardOpen(true)}><MapIcon size={16} aria-hidden="true"/>Mapa mental</button></div>
      {boardOpen?<NoteBoard key={`${scope}:${note.id}:${saved.version}`} value={draft.board} onChange={update=>setDraft(previous=>({...previous,board:typeof update==='function'?update(previous.board):update}))} readOnly={readOnly||busy}/>:<label className="note-body-label">Anotações<textarea name="note-body" value={draft.body} maxLength={50000} readOnly={readOnly} disabled={busy} onChange={event=>editText('body',event)} onKeyDown={event=>textShortcut('body',event)} placeholder="Escreva suas anotações…" wrap="soft"/></label>}
      {canShare&&!readOnly&&<div className="note-share"><button type="button" className="note-share-toggle" disabled={!persisted.current||busy} onClick={()=>{setShareOpen(previous=>!previous);setRecipients(saved.sharedWith);}} aria-expanded={shareOpen}><Share2 size={16} aria-hidden="true"/>Compartilhar {saved.sharedWith.length?`(${saved.sharedWith.length})`:''}</button>{!persisted.current&&<small>Salve a nota antes de compartilhar.</small>}
      {shareOpen&&<div className="note-share-panel"><p>Escolha quem pode abrir e editar esta nota.</p>{candidates.length?candidates.map(member=><label key={member.username}><input type="checkbox" checked={recipients.includes(member.username)} onChange={event=>setRecipients(previous=>event.target.checked?[...previous,member.username]:previous.filter(name=>name!==member.username))}/>{member.username}</label>):<p>Não há outros participantes nesta mesa.</p>}<button type="button" disabled={busy||stale} onClick={share}>Salvar acesso</button></div>}</div>}
      {error&&<p role="alert" className="note-error">{error}</p>}
    </div>
    <footer><span role="status">{readOnly?'Somente leitura':busy?'Salvando…':stale?'Versão mais recente disponível':dirty?'Rascunho · não salvo':'Salvo na mesa'}</span>{!readOnly&&<button className="note-save" disabled={busy||!dirty||stale} onClick={save}><Save size={15} aria-hidden="true"/>{busy?'Salvando…':'Salvar'}</button>}</footer>
  </section>;
}
export default function Notebook({title,hint,notes=[],onSave,onShare,readOnly=false,className='',storageKey,scope,members=[],username='',canShare=false}){
  const key='grimorio-notes-v2:'+storageKey;
  const library=useRef(null),positions=useRef(null),openers=useRef(new Map());
  if(positions.current===null){try{positions.current=JSON.parse(localStorage.getItem(key+':positions'))||{};}catch{positions.current={};}}
  const [windows,setWindows]=useState(()=>{try{const stored=JSON.parse(localStorage.getItem(key));return Array.isArray(stored)?stored.filter(windowNote=>windowNote&&typeof windowNote.id==='string'&&typeof windowNote.title==='string'&&Number.isFinite(windowNote.position?.x)&&Number.isFinite(windowNote.position?.y)&&(scope!=='shared'||notes.some(item=>noteKey(item)===noteKey(windowNote)))).slice(0,10):[];}catch{return [];}})
  const visibleWindows=useMemo(()=>scope==='shared'?windows.filter(windowNote=>notes.some(item=>noteKey(item)===noteKey(windowNote))):windows,[scope,windows,notes]);
  const [draftStorageError,setDraftStorageError]=useState('');
  const latestWindows=useRef(visibleWindows);latestWindows.current=visibleWindows;
  const persist=useCallback(items=>{try{localStorage.setItem(key,JSON.stringify(items));setDraftStorageError('');}catch{setDraftStorageError('Este rascunho não cabe no armazenamento local. Salve a nota na mesa antes de sair.');}},[key]);
  useEffect(()=>{const timer=setTimeout(()=>persist(visibleWindows),400);return()=>clearTimeout(timer);},[visibleWindows,persist]);
  useEffect(()=>{const flush=()=>{try{localStorage.setItem(key,JSON.stringify(latestWindows.current));}catch{}};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[key]);
  useEffect(()=>{if(scope==='shared'&&visibleWindows.length<windows.length)persist(visibleWindows);},[scope,visibleWindows,windows,persist]);
  useEffect(()=>{if(scope==='shared')setWindows(previous=>previous.filter(windowNote=>notes.some(item=>noteKey(item)===noteKey(windowNote))));},[scope,notes]);
  function update(id,patch){setWindows(previous=>previous.map(windowNote=>noteKey(windowNote)===id?{...windowNote,...patch}:windowNote));}
  function place(id,position){positions.current[id]=position;try{localStorage.setItem(key+':positions',JSON.stringify(positions.current));}catch{}update(id,{position});}
  function open(raw,opener){const note={...raw,scope:raw.scope||scope};const id=noteKey(note);if(opener)openers.current.set(id,opener);setWindows(previous=>previous.some(windowNote=>noteKey(windowNote)===id)?[...previous.filter(windowNote=>noteKey(windowNote)!==id),previous.find(windowNote=>noteKey(windowNote)===id)]:previous.length>=10?previous:[...previous,{...note,position:positions.current[id]||clampPosition(110+previous.length*28,80+previous.length*28)}]);requestAnimationFrame(()=>document.getElementById(`note-window-${note.scope}-${note.id}`)?.querySelector('.note-drag')?.focus());}
  function focus(id){setWindows(previous=>{const found=previous.find(windowNote=>noteKey(windowNote)===id);return !found||previous.at(-1)===found?previous:[...previous.filter(windowNote=>noteKey(windowNote)!==id),found];});}
  return <><details ref={library} className={`notebook notebook-library ${className}`}><summary><NotebookPen size={18} aria-hidden="true"/><span>{title}<small>{hint} · {notes.length} {notes.length===1?'nota':'notas'}</small></span></summary><div className="notebook-library-list">
    {!readOnly&&scope!=='shared'&&<button className="note-new" disabled={windows.length>=10} onClick={event=>open({id:crypto.randomUUID(),title:'Nova nota',body:'',board:emptyNoteBoard(),isNew:true},event.currentTarget)}><Plus size={16} aria-hidden="true"/>Nova nota</button>}
    {!notes.length&&<p>Nenhuma nota disponível.</p>}
    {notes.map(note=><button key={noteKey({...note,scope:note.scope||scope})} onClick={event=>open(note,event.currentTarget)}><NotebookPen size={15} aria-hidden="true"/><span>{note.title}<small>{note.owner?` · ${note.owner==='@master'?'Mestre':note.owner}`:''}</small></span><small>{windows.some(windowNote=>noteKey(windowNote)===noteKey({...note,scope:note.scope||scope}))?'Aberta':'Abrir'}</small></button>)}
    {!!windows.length&&<button onClick={()=>setWindows(previous=>previous.map((windowNote,index)=>({...windowNote,position:clampPosition(24+index*24,80+index*24)})))}><LocateFixed size={16} aria-hidden="true"/>Reunir janelas ({windows.length})</button>}
    {windows.length>=10&&<p>Feche uma janela para abrir outra nota.</p>}
    {draftStorageError&&<p role="alert">{draftStorageError}</p>}
  </div></details>{createPortal(visibleWindows.map((note,index)=>{const id=noteKey(note),latest=notes.find(item=>noteKey({...item,scope:item.scope||scope})===id);return <NoteWindow key={id} note={note} latest={latest} position={note.position} readOnly={readOnly} onSave={onSave} onShare={onShare} members={members} username={username} canShare={canShare} draftStorageError={draftStorageError} onClose={()=>{setWindows(previous=>previous.filter(windowNote=>noteKey(windowNote)!==id));const opener=openers.current.get(id);if(opener?.isConnected)opener.focus();else library.current?.querySelector('summary')?.focus();openers.current.delete(id);}} onPosition={position=>place(id,position)} onDraft={draft=>update(id,draft)} onFocus={()=>focus(id)} zIndex={70+index}/>;}),document.body)}</>;
}
