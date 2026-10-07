import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {NotebookPen,Plus,X,GripHorizontal,Save,Download,LocateFixed,Share2,Map as MapIcon,FileText,History,Pin,PinOff,Maximize2,Minimize2,MoveDiagonal2,Search} from 'lucide-react';
import NoteBoard from './NoteBoard.jsx';
import {NoteFindBar,NoteTextEditor} from './NoteFind.jsx';
import {findNoteMatches} from './noteFind.js';
import {emptyNoteBoard} from './noteBoardDefaults.js';
import {noteWindowRect,resizeNoteWindow} from './noteWindowGeometry.js';
import NoteConflictReview from './NoteConflictReview.jsx';
import NoteVersionHistory from './NoteVersionHistory.jsx';
import {restoreNoteFields} from './noteHistory.js';
import {editedNoteFields,resolveNoteConflict,sameNoteField,sameRecipients} from './noteConflict.js';
import {draftTabId,loadDraftWindows,saveDraftWindows,readLocalDraftWindows,saveLocalDraftWindows,listDraftCopies} from './noteDraftStore.js';
import './Notebook.css';

const noteKey=note=>`${note.scope||''}:${note.id}`;
const searchable=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const clampPosition=(x,y,wide=false)=>({x:Math.max(8,Math.min(x,innerWidth-Math.min(wide?860:500,innerWidth-16)-8)),y:Math.max(8,Math.min(y,innerHeight-180))});
const normalized=note=>({title:note.title||'',body:note.body||'',board:note.board||emptyNoteBoard(),version:note.version||0,sharedWith:note.sharedWith||[]});
function savedFromRoom(room,scope,id){
  if(!room?.state)return null;
  const list=scope==='@master'?room.state.masterNotebooks:room.state.playerSheets?.[scope]?.notebooks;
  return list?.find(note=>note.id===id)||room.state.sharedNotebooks?.find(note=>note.id===id&&note.scope===scope)||null;
}
function validDraftWindows(items,scope,notes){
  return Array.isArray(items)?items.filter(windowNote=>windowNote&&typeof windowNote.id==='string'&&typeof windowNote.title==='string'&&Number.isFinite(windowNote.position?.x)&&Number.isFinite(windowNote.position?.y)&&(scope!=='shared'||notes.some(item=>noteKey(item)===noteKey(windowNote)))).slice(0,10):[];
}
function NoteWindow({note,latest,position,readOnly,onSave,onShare,onClose,onPosition,onFocus,zIndex,onDraft,members,username,canShare,draftStorageError,points,onOpenPoint,openRequest,roomId}){
  const [draft,setDraft]=useState(()=>normalized(note));
  const [saved,setSaved]=useState(()=>({...normalized(latest&&latest.version===note.version?latest:note),version:note.version||0}));
  const [editedFields,setEditedFields]=useState(()=>note.editedFields||editedNoteFields(note,latest||note));
  const [retainedDirty,setRetainedDirty]=useState(()=>Boolean(note.contentDirty??(note.dirty||latest&&latest.version>note.version&&Object.values(editedNoteFields(note,latest)).some(Boolean))));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[shareOpen,setShareOpen]=useState(false),[compareOpen,setCompareOpen]=useState(false),[boardOpen,setBoardOpen]=useState(Boolean(note.boardOpen||openRequest?.id===note.id&&openRequest?.scope===note.scope&&!openRequest.view));
  const [recipients,setRecipients]=useState(()=>note.pendingRecipients||latest?.sharedWith||note.sharedWith||[]);
  const [historyOpen,setHistoryOpen]=useState(false),[restorationUndo,setRestorationUndo]=useState(null),[boardEpoch,setBoardEpoch]=useState(0);
  const [findOpen,setFindOpen]=useState(false),[findQuery,setFindQuery]=useState(''),[findCursor,setFindCursor]=useState(0);
  const [findNavigation,setFindNavigation]=useState(0);
  const findResults=useMemo(()=>findOpen?findNoteMatches(draft,findQuery,boardOpen):[],[findOpen,findQuery,boardOpen,draft.body,draft.board]);
  const findIndex=findResults.length?findCursor%findResults.length:0,activeFind=findResults[findIndex];
  const wide=boardOpen||historyOpen;
  const [viewport,setViewport]=useState(()=>({width:innerWidth,height:innerHeight}));
  const docked=boardOpen&&position.docked!==false;
  const rect=noteWindowRect(position,viewport,{wide,docked});
  const panel=useRef(null),drag=useRef(null),resizing=useRef(null),persisted=useRef(!note.isNew);
  const findToggle=useRef(null);
  const textHistory=useRef({title:{past:[],future:[]},body:{past:[],future:[]}});
  useEffect(()=>{panel.current?.querySelector('.note-drag')?.focus();},[]);
  useEffect(()=>{if(openRequest?.id!==note.id||openRequest?.scope!==note.scope)return;if(!openRequest.view||openRequest.view==='board')setBoardOpen(true);else if(openRequest.view==='text')setBoardOpen(false);},[openRequest?.token]);
  const scope=note.scope;
  const boardDirty=useMemo(()=>JSON.stringify(draft.board)!==JSON.stringify(saved.board),[draft.board,saved.board]);
  const dirty=retainedDirty||!persisted.current||draft.title!==saved.title||draft.body!==saved.body||boardDirty;
  const accessDirty=!sameRecipients(recipients,saved.sharedWith),hasPending=dirty||accessDirty;
  const incomingVersion=latest?.version||0,stale=incomingVersion>saved.version;
  useEffect(()=>{
    if(!latest||incomingVersion<=saved.version)return;
    const next=normalized(latest);
    if(!hasPending){textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};setDraft(next);setSaved(next);setEditedFields({title:false,body:false,board:false});setRecipients(next.sharedWith);setRestorationUndo(null);}
  },[latest,incomingVersion,saved.version,hasPending]);
  useEffect(()=>{onDraft({title:draft.title,body:draft.body,board:draft.board,version:saved.version,isNew:!persisted.current,dirty:hasPending,contentDirty:dirty,pendingRecipients:recipients,editedFields,boardOpen});},[draft,saved.version,hasPending,dirty,recipients,editedFields,boardOpen]);
  useEffect(()=>{
    if(!hasPending)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[hasPending]);
  useEffect(()=>{const resize=()=>setViewport({width:innerWidth,height:innerHeight});window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  function applyHistoricalVersion(version,fields){
    const next=restoreNoteFields(draft,version,fields);
    textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};
    setRestorationUndo(draft);setDraft(next);setEditedFields(editedNoteFields(next,saved));setRetainedDirty(false);setHistoryOpen(false);setError('');
    if(fields.includes('board'))setBoardEpoch(value=>value+1);
    setNotice(`Campos da versão ${version.version} carregados no rascunho. Revise e salve para criar uma nova versão.`);
    requestAnimationFrame(()=>panel.current?.querySelector('.note-history-access button,.note-history-toggle')?.focus());
  }
  function undoRestoration(){
    if(!restorationUndo)return;
    textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};
    setDraft(restorationUndo);setEditedFields(editedNoteFields(restorationUndo,saved));setRestorationUndo(null);setBoardEpoch(value=>value+1);setNotice('Rascunho anterior à restauração recuperado.');
    requestAnimationFrame(()=>panel.current?.querySelector('.note-history-access button,.note-history-toggle')?.focus());
  }
  function closeHistory(){setHistoryOpen(false);requestAnimationFrame(()=>panel.current?.querySelector('.note-history-access button,.note-history-toggle')?.focus());}
  function openFind(){setFindOpen(true);setFindNavigation(value=>value+1);requestAnimationFrame(()=>{const input=panel.current?.querySelector('input[name="note-find"]');input?.focus();input?.select();});}
  function closeFind(){setFindOpen(false);setFindNavigation(value=>value+1);findToggle.current?.focus();}
  function findShortcut(event){if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();event.stopPropagation();openFind();}}
  function stepFind(delta){if(findResults.length){setFindCursor((findIndex+delta+findResults.length)%findResults.length);setFindNavigation(value=>value+1);}}
  function switchView(open){setBoardOpen(open);setFindCursor(0);setFindNavigation(value=>value+1);}
  function applyComparison(choices){
    if(!latest)return;
    const current=normalized(latest),merged=resolveNoteConflict(draft,current,editedFields,choices);
    const keepAccess=accessDirty&&choices.access!=='latest',nextRecipients=keepAccess?recipients:current.sharedWith;
    persisted.current=true;textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};
    const remaining=editedNoteFields(merged,current);
    setDraft(merged);setSaved(current);setEditedFields(remaining);setRetainedDirty(false);setRecipients(nextRecipients);setCompareOpen(false);setError('');setRestorationUndo(null);
    const contentPending=Object.values(remaining).some(Boolean),accessPending=!sameRecipients(nextRecipients,current.sharedWith);
    setNotice(contentPending&&accessPending?'Versões combinadas. Salve a nota e depois a seleção no painel Compartilhar.':accessPending?'Sua seleção de acesso foi mantida. Abra Compartilhar e salve o acesso.':contentPending?'Versões combinadas nesta janela. Revise o resultado e salve a nota.':'Versão da mesa carregada. Não há alterações pendentes.');
  }
  function editText(field,event){
    const value=event.target.value,current=draft[field];
    if(value===current)return;
    const history=textHistory.current[field];
    setRestorationUndo(null);
    history.past.push(current);if(history.past.length>100)history.past.shift();history.future=[];
    setDraft(previous=>({...previous,[field]:value}));
    setEditedFields(previous=>({...previous,[field]:!sameNoteField(field,value,saved[field])}));
  }
  function textShortcut(field,event){
    if(!(event.ctrlKey||event.metaKey)||event.altKey||readOnly||busy)return;
    const key=event.key.toLowerCase(),redo=key==='y'||key==='z'&&event.shiftKey;
    if(key!=='z'&&!redo)return;
    event.preventDefault();
    const history=textHistory.current[field],source=redo?history.future:history.past,destination=redo?history.past:history.future;
    if(!source.length)return;
    const value=source.pop();destination.push(draft[field]);
    setRestorationUndo(null);
    setDraft(previous=>({...previous,[field]:value}));
    setEditedFields(previous=>({...previous,[field]:!sameNoteField(field,value,saved[field])}));
    const input=event.currentTarget;
    requestAnimationFrame(()=>{if(input.isConnected&&document.activeElement===input)input.setSelectionRange(value.length,value.length);});
  }
  async function save(){
    if(!draft.title.trim()){setError('Dê um nome à nota antes de salvar.');return;}
    if(stale){setError('Há uma versão mais recente na mesa. Compare as versões antes de salvar.');return;}
    setBusy(true);setError('');setNotice('');
    const payload={title:draft.title.trim(),body:draft.body,...(!persisted.current||editedFields.board?{board:draft.board}:{}),...(persisted.current?{version:saved.version}:{})};
    try{
      const room=await onSave(scope,note.id,payload);
      if(!room)throw Error('Não foi possível confirmar o salvamento. Seu rascunho continua aqui; confira a conexão e a versão da mesa.');
      persisted.current=true;
      const next=normalized(savedFromRoom(room,scope,note.id)||{...payload,version:saved.version+1,sharedWith:saved.sharedWith});
      textHistory.current={title:{past:[],future:[]},body:{past:[],future:[]}};
      setDraft(next);setSaved(next);if(!accessDirty)setRecipients(next.sharedWith);setEditedFields({title:false,body:false,board:false});setRetainedDirty(false);setCompareOpen(false);setRestorationUndo(null);
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  async function share(){
    setBusy(true);setError('');
    try{
      const room=await onShare(scope,note.id,{version:saved.version,sharedWith:recipients});
      if(!room)throw Error('Não foi possível confirmar o compartilhamento. Confira a versão da nota.');
      const next=normalized(savedFromRoom(room,scope,note.id)||{...saved,sharedWith:recipients,version:saved.version+1});
      setSaved(next);setDraft(previous=>dirty?{...previous,version:next.version,sharedWith:next.sharedWith}:next);setRecipients(next.sharedWith);setShareOpen(false);setNotice('Acesso salvo na mesa.');
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  function toggleSharing(){setShareOpen(previous=>!previous);if(!accessDirty)setRecipients(saved.sharedWith);}
  function paintRect(next){const style=panel.current.style;style.left=next.x+'px';style.top=next.y+'px';style.width=next.width+'px';style.height=next.height+'px';}
  function commitRect(next,patch={}){onPosition({...position,...next,...patch});}
  function start(event){if(event.button!==0||docked||position.expanded)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,origin:rect};}
  function move(event){const current=drag.current;if(!current||current.id!==event.pointerId)return;current.last=noteWindowRect({...current.origin,x:current.origin.x+event.clientX-current.x,y:current.origin.y+event.clientY-current.y},viewport);paintRect(current.last);}
  function finish(event){const current=drag.current;if(!current)return;drag.current=null;const next=event.type==='pointercancel'?current.origin:current.last||current.origin;paintRect(next);if(event.type!=='pointercancel'&&current.last)onPosition({...position,x:next.x,y:next.y});}
  function keyboard(event){const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!delta||docked||position.expanded)return;event.preventDefault();const next=noteWindowRect({...rect,x:rect.x+delta[0],y:rect.y+delta[1]},viewport);onPosition({...position,x:next.x,y:next.y});}
  function startResize(event){if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);resizing.current={id:event.pointerId,x:event.clientX,y:event.clientY,origin:rect};}
  function moveResize(event){const current=resizing.current;if(!current||current.id!==event.pointerId)return;current.last=resizeNoteWindow(current.origin,event.clientX-current.x,(event.clientY-current.y)*(docked?-1:1),viewport,docked);paintRect(current.last);}
  function finishResize(event){const current=resizing.current;if(!current)return;resizing.current=null;const next=event.type==='pointercancel'?current.origin:current.last||current.origin;paintRect(next);if(event.type!=='pointercancel'&&current.last)commitRect(next,{expanded:false});}
  function resizeKeyboard(event){const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,20],ArrowDown:[0,-20]}[event.key];if(!delta)return;event.preventDefault();commitRect(resizeNoteWindow(rect,delta[0],delta[1],viewport,docked),{expanded:false});}
  function downloadDraft(){
    try{
      const contents=JSON.stringify({format:'grimorio-note-draft-v1',exportedAt:new Date().toISOString(),scope,id:note.id,version:saved.version,title:draft.title,body:draft.body,board:draft.board,pendingRecipients:recipients},null,2);
      const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`rascunho-nota-${note.id.slice(0,8)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch{setError('Não foi possível gerar a cópia. Copie o texto da nota antes de fechar.');}
  }
  function close(){if(busy)return;if(hasPending&&!confirm('Fechar sem salvar esta nota? As alterações desta janela serão descartadas.'))return;onClose();}
  const candidates=members.filter(member=>member.username!==username&&member.username!==note.owner);
  return <section id={`note-window-${note.scope}-${note.id}`} ref={panel} className={`note-window ${wide?'is-wide':''} ${boardOpen?'is-board':''} ${docked?'is-docked':''}`} role="dialog" aria-modal="false" aria-label={draft.title||'Nova nota'} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,zIndex}} onPointerDownCapture={onFocus} onFocusCapture={onFocus} onKeyDownCapture={findShortcut}>
    <header className="note-window-header"><button type="button" className="note-drag" aria-disabled={docked||Boolean(position.expanded)} aria-label={docked?`${draft.title||'Nota'} fixa no canto inferior esquerdo`:position.expanded?`${draft.title||'Nota'} ampliada`:`Mover ${draft.title||'nota'}: arraste ou use as setas`} title={docked?'Use Soltar para mover a janela':'Arraste para mover · setas do teclado para ajustar'} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={keyboard}>{docked?<Pin size={16} aria-hidden="true"/>:<GripHorizontal size={18} aria-hidden="true"/>}<span>{draft.title||'Nova nota'}</span></button>
      {boardOpen&&<button type="button" className="note-dock-toggle" aria-label={docked?'Soltar janela do canto inferior esquerdo':'Fixar janela no canto inferior esquerdo'} title={docked?'Soltar para mover livremente':'Fixar no canto inferior esquerdo'} onClick={()=>onPosition({...position,x:rect.x,y:rect.y,docked:!docked})}>{docked?<PinOff size={16} aria-hidden="true"/>:<Pin size={16} aria-hidden="true"/>}<span>{docked?'Soltar':'Fixar'}</span></button>}
      {boardOpen&&persisted.current&&!readOnly&&roomId&&<button type="button" className="note-history-toggle" aria-label="Histórico de versões" title="Histórico de versões" aria-expanded={historyOpen} disabled={busy} onClick={()=>setHistoryOpen(open=>!open)}><History size={17} aria-hidden="true"/></button>}
      <button type="button" aria-label={position.expanded?'Restaurar tamanho da janela':'Aumentar janela'} title={position.expanded?'Restaurar tamanho':'Aumentar janela'} onClick={()=>onPosition({...position,expanded:!position.expanded})}>{position.expanded?<Minimize2 size={17} aria-hidden="true"/>:<Maximize2 size={17} aria-hidden="true"/>}</button>
      <button type="button" aria-label={`Fechar ${draft.title||'nota'}`} disabled={busy} onClick={close}><X size={18} aria-hidden="true"/></button></header>
    <div className="note-window-content">
      {note.owner&&<p className="note-owner">Compartilhada por {note.owner==='@master'?'Mestre':note.owner}</p>}
      {stale&&<div className="note-stale" role="status"><span>Há uma versão mais recente na mesa. Seu rascunho foi mantido.</span><button type="button" onClick={()=>setCompareOpen(true)}>Comparar versões</button></div>}
      {compareOpen&&latest&&<NoteConflictReview draft={draft} latest={normalized(latest)} editedFields={editedFields} pendingRecipients={accessDirty?recipients:null} groupId={`${scope}-${note.id}`} onApply={applyComparison} onCancel={()=>setCompareOpen(false)}/>}
      {draftStorageError&&<p className="note-error" role="alert">{draftStorageError}</p>}
      {!boardOpen&&persisted.current&&!readOnly&&roomId&&<div className="note-history-access"><button type="button" aria-expanded={historyOpen} disabled={busy} onClick={()=>setHistoryOpen(open=>!open)}><History size={16} aria-hidden="true"/>Histórico de versões</button></div>}
      {historyOpen&&<NoteVersionHistory roomId={roomId} scope={scope} noteId={note.id} latestVersion={incomingVersion||saved.version} draft={draft} busy={busy} onRestore={applyHistoricalVersion} onClose={closeHistory}/>}
      {!boardOpen&&<label className="note-title-label">Nome da nota<input name="note-title" autoComplete="off" value={draft.title} maxLength={100} readOnly={readOnly} disabled={busy} onChange={event=>editText('title',event)} onKeyDown={event=>textShortcut('title',event)} placeholder="Ex.: Encontro na taverna…"/></label>}
      <div className="note-view-switch" role="group" aria-label="Visualização da nota"><button type="button" aria-pressed={!boardOpen} onClick={()=>switchView(false)}><FileText size={16} aria-hidden="true"/>Texto</button><button type="button" aria-pressed={boardOpen} onClick={()=>switchView(true)}><MapIcon size={16} aria-hidden="true"/>Mapa mental</button><button ref={findToggle} type="button" className="note-find-toggle" aria-expanded={findOpen} onClick={()=>findOpen?closeFind():openFind()} title="Buscar nesta nota · Ctrl+F"><Search size={16} aria-hidden="true"/>Buscar</button></div>
      {findOpen&&<NoteFindBar query={findQuery} onQuery={value=>{setFindQuery(value);setFindCursor(0);setFindNavigation(previous=>previous+1);}} count={findResults.length} index={findIndex} onStep={stepFind} onClose={closeFind} boardOpen={boardOpen}/>}
      {boardOpen?<NoteBoard key={`${scope}:${note.id}:${saved.version}:${boardEpoch}`} value={draft.board} onChange={update=>{const next=typeof update==='function'?update(draft.board):update;setRestorationUndo(null);setDraft(previous=>({...previous,board:next}));setEditedFields(previous=>({...previous,board:!sameNoteField('board',next,saved.board)}));}} readOnly={readOnly||busy} points={points} onOpenPoint={onOpenPoint} roomId={roomId} searchQuery={findOpen?findQuery:''} activeSearch={activeFind} searchNavigation={findNavigation}/>:<NoteTextEditor value={draft.body} readOnly={readOnly} disabled={busy} onChange={event=>editText('body',event)} onKeyDown={event=>textShortcut('body',event)} matches={findResults} active={activeFind} searchNavigation={findNavigation}/>}
      {canShare&&!readOnly&&(!boardOpen||shareOpen)&&<div className="note-share">{!boardOpen&&<><button type="button" className="note-share-toggle" disabled={!persisted.current||busy} onClick={toggleSharing} aria-expanded={shareOpen}><Share2 size={16} aria-hidden="true"/>Compartilhar {saved.sharedWith.length?`(${saved.sharedWith.length})`:''}</button>{!persisted.current&&<small>Salve a nota antes de compartilhar.</small>}</>}
      {shareOpen&&<div className="note-share-panel"><p>Escolha quem pode abrir e editar esta nota.</p>{candidates.length?candidates.map(member=><label key={member.username}><input type="checkbox" checked={recipients.includes(member.username)} onChange={event=>setRecipients(previous=>event.target.checked?[...previous,member.username]:previous.filter(name=>name!==member.username))}/>{member.username}</label>):<p>Não há outros participantes nesta mesa.</p>}<button type="button" disabled={busy||stale} onClick={share}>Salvar acesso</button></div>}</div>}
      {error&&<p role="alert" className="note-error">{error}</p>}
      {notice&&<p role="status" className="note-notice">{notice}</p>}
      {restorationUndo&&<button type="button" className="note-restoration-undo" disabled={busy} onClick={undoRestoration}>Desfazer restauração</button>}
    </div>
    <footer><span role="status">{readOnly?'Somente leitura':busy?'Salvando…':stale?'Versão mais recente disponível':dirty?'Rascunho · não salvo':accessDirty?'Acesso · não salvo':'Salvo na mesa'}</span>{draftStorageError&&hasPending&&<button type="button" className="note-download" onClick={downloadDraft}><Download size={15} aria-hidden="true"/>Baixar cópia</button>}{boardOpen&&canShare&&!readOnly&&<button type="button" aria-label="Compartilhar nota" title={persisted.current?'Compartilhar nota':'Salve a nota antes de compartilhar'} aria-expanded={shareOpen} disabled={!persisted.current||busy} onClick={toggleSharing}><Share2 size={16} aria-hidden="true"/></button>}{!readOnly&&<button className="note-save" disabled={busy||!dirty||stale} onClick={save}><Save size={15} aria-hidden="true"/>{busy?'Salvando…':'Salvar'}</button>}</footer>
    <button type="button" className="note-resize" aria-label="Redimensionar janela: arraste o canto ou use as setas; direita alarga, cima aumenta a altura" title="Arraste para redimensionar · setas do teclado ajustam o tamanho" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize} onKeyDown={resizeKeyboard}><MoveDiagonal2 size={18} aria-hidden="true"/></button>
  </section>;
}
export default function Notebook({title,hint,notes=[],onSave,onShare,readOnly=false,className='',storageKey,scope,members=[],username='',canShare=false,points=[],onOpenPoint,openRequest,roomId}){
  const key='grimorio-notes-v2:'+storageKey;
  const library=useRef(null),positions=useRef(null),openers=useRef(new Map()),tabId=useRef(null);
  useEffect(()=>{
    const close=event=>{const el=library.current;if(el?.open&&!el.contains(event.target))el.open=false;};
    const escape=event=>{const el=library.current;if(event.key==='Escape'&&el?.open){el.open=false;el.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[]);
  if(tabId.current===null)tabId.current=draftTabId();
  if(positions.current===null){try{positions.current=JSON.parse(localStorage.getItem(key+':positions'))||{};}catch{positions.current={};}}
  const [localSnapshot]=useState(()=>{const record=readLocalDraftWindows(key,tabId.current);return {...record,windows:validDraftWindows(record.windows,scope,notes)};});
  const [windows,setWindows]=useState(localSnapshot.windows),[ready,setReady]=useState(false);
  const [search,setSearch]=useState('');
  const visibleWindows=useMemo(()=>scope==='shared'?windows.filter(windowNote=>notes.some(item=>noteKey(item)===noteKey(windowNote))):windows,[scope,windows,notes]);
  const matches=useMemo(()=>{const query=searchable(search.trim());return query?notes.filter(note=>[note.title,note.body,...(note.board?.nodes||[]).map(node=>node.text)].some(value=>searchable(value).includes(query))):notes;},[notes,search]);
  const [draftStorageError,setDraftStorageError]=useState('');
  const [copies,setCopies]=useState(null),[copiesBusy,setCopiesBusy]=useState(false),[copyError,setCopyError]=useState(''),[recoveryEpoch,setRecoveryEpoch]=useState(0),[recoveryNotice,setRecoveryNotice]=useState('');
  const latestWindows=useRef(visibleWindows);latestWindows.current=visibleWindows;
  useEffect(()=>{
    let active=true;
    loadDraftWindows(key,tabId.current).then(record=>{
      if(active&&Array.isArray(record?.windows)&&record.updatedAt>=localSnapshot.updatedAt)setWindows(validDraftWindows(record.windows,scope,notes));
    }).catch(()=>{}).finally(()=>{if(active)setReady(true);});
    return()=>{active=false;};
  },[key]);
  const persist=useCallback(async items=>{
    const updatedAt=Date.now();let localSaved=false,idbSaved=false;
    try{saveLocalDraftWindows(key,tabId.current,items,updatedAt);localSaved=true;}catch{}
    try{await saveDraftWindows(key,tabId.current,items,updatedAt);idbSaved=true;}catch{}
    setDraftStorageError(localSaved||idbSaved?'':'O navegador não conseguiu guardar este rascunho. Baixe uma cópia antes de fechar a página.');
  },[key]);
  useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>{void persist(visibleWindows);},250);return()=>clearTimeout(timer);},[ready,visibleWindows,persist]);
  useEffect(()=>{if(!ready)return;const flush=()=>{const items=latestWindows.current,updatedAt=Date.now();try{saveLocalDraftWindows(key,tabId.current,items,updatedAt);}catch{}void saveDraftWindows(key,tabId.current,items,updatedAt).catch(()=>{});};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[key,ready]);
  useEffect(()=>{if(ready&&scope==='shared')setWindows(previous=>previous.filter(windowNote=>notes.some(item=>noteKey(item)===noteKey(windowNote))));},[ready,scope,notes]);
  function update(id,patch){setWindows(previous=>previous.map(windowNote=>noteKey(windowNote)===id?{...windowNote,...patch}:windowNote));}
  function place(id,position){positions.current[id]=position;try{localStorage.setItem(key+':positions',JSON.stringify(positions.current));}catch{}update(id,{position});}
  function open(raw,opener){const note={...raw,scope:raw.scope||scope};const id=noteKey(note);if(opener)openers.current.set(id,opener);setWindows(previous=>previous.some(windowNote=>noteKey(windowNote)===id)?[...previous.filter(windowNote=>noteKey(windowNote)!==id),previous.find(windowNote=>noteKey(windowNote)===id)]:previous.length>=10?previous:[...previous,{...note,position:positions.current[id]||clampPosition(110+previous.length*28,80+previous.length*28)}]);requestAnimationFrame(()=>document.getElementById(`note-window-${note.scope}-${note.id}`)?.querySelector('.note-drag')?.focus());}
  useEffect(()=>{if(!ready||!openRequest)return;const target=notes.find(note=>note.id===openRequest.id&&(note.scope||scope)===openRequest.scope);if(target)open(target);},[ready,openRequest?.token]);
  function focus(id){setWindows(previous=>{const found=previous.find(windowNote=>noteKey(windowNote)===id);return !found||previous.at(-1)===found?previous:[...previous.filter(windowNote=>noteKey(windowNote)!==id),found];});}
  async function showCopies(){
    setCopiesBusy(true);setCopyError('');
    try{const records=await listDraftCopies(key,tabId.current);setCopies(records.map(record=>({...record,windows:validDraftWindows(record.windows,scope,notes)})).filter(record=>record.windows.some(note=>note.dirty||note.isNew||note.contentDirty)));}
    catch{setCopyError('Não foi possível consultar as cópias. Tente novamente.');}
    finally{setCopiesBusy(false);}
  }
  async function recoverCopy(record){
    setCopiesBusy(true);setCopyError('');
    // Retain current text as a separate copy before replacing open windows.
    if(latestWindows.current.some(note=>note.dirty||note.isNew||note.contentDirty)){
      const backupId=crypto.randomUUID(),updatedAt=Date.now();let kept=false;
      try{saveLocalDraftWindows(key,backupId,latestWindows.current,updatedAt);kept=true;}catch{}
      try{await saveDraftWindows(key,backupId,latestWindows.current,updatedAt);kept=true;}catch{}
      if(!kept){setCopyError('Não foi possível guardar as janelas atuais. Baixe suas cópias antes de trocar o rascunho.');setCopiesBusy(false);return;}
    }
    setRecoveryEpoch(value=>value+1);setWindows(record.windows);setCopies(null);setCopiesBusy(false);setRecoveryNotice('Cópia recuperada. Revise as notas e salve quando quiser. Suas janelas anteriores também foram preservadas.');
  }
  return <><details ref={library} className={`notebook notebook-library ${className}`}><summary title={hint}><NotebookPen size={18} aria-hidden="true"/><span>{title}<small>{notes.length} {notes.length===1?'nota':'notas'}</small></span></summary><div className="notebook-library-list"><p className="notebook-hint">{hint}</p>
    {!ready&&<p role="status">Preparando rascunhos…</p>}
    {ready&&<button type="button" disabled={copiesBusy} onClick={showCopies}><History size={16} aria-hidden="true"/>{copiesBusy?'Consultando cópias…':'Recuperar rascunhos'}</button>}
    {copies&&<section className="note-recovery" aria-label="Cópias locais"><h3>Cópias neste navegador</h3><p>Escolha uma cópia desta mesa e deste caderno. Ela será aberta para revisão, sem salvar na mesa.</p>{!copies.length&&<p>Nenhum outro rascunho disponível.</p>}{copies.map(record=><button key={record.id} type="button" disabled={copiesBusy} onClick={()=>recoverCopy(record)}><span>{record.windows.map(note=>note.title||'Nova nota').join(', ')}<small>{new Date(record.updatedAt).toLocaleString('pt-BR')}</small><small>{record.windows.map(note=>note.body||'').join(' · ').slice(0,100)}</small></span><span>Abrir cópia</span></button>)}<button type="button" disabled={copiesBusy} onClick={()=>setCopies(null)}>Fechar lista de cópias</button></section>}
    {copyError&&<p role="alert">{copyError}</p>}{recoveryNotice&&<p role="status">{recoveryNotice}</p>}
    {!readOnly&&scope!=='shared'&&<button type="button" className="note-new" disabled={!ready||windows.length>=10} onClick={event=>open({id:crypto.randomUUID(),title:'Nova nota',body:'',board:emptyNoteBoard(),isNew:true},event.currentTarget)}><Plus size={16} aria-hidden="true"/>Nova nota</button>}
    {notes.length>0&&<label className="note-search">Buscar em {title.toLowerCase()}<input type="search" name={`note-search-${scope}`} autoComplete="off" value={search} onChange={event=>setSearch(event.target.value)} maxLength={100} placeholder="Título, texto ou ideia…"/></label>}
    {search.trim()&&<p role="status">{matches.length} {matches.length===1?'nota encontrada':'notas encontradas'}</p>}
    {!notes.length&&<p>Nenhuma nota disponível.</p>}
    {notes.length>0&&!matches.length&&<p>Nenhuma nota encontrada neste caderno.</p>}
    {matches.map(note=><button key={noteKey({...note,scope:note.scope||scope})} disabled={!ready} onClick={event=>open(note,event.currentTarget)}><NotebookPen size={15} aria-hidden="true"/><span>{note.title}<small>{note.owner?` · ${note.owner==='@master'?'Mestre':note.owner}`:''}</small></span><small>{windows.some(windowNote=>noteKey(windowNote)===noteKey({...note,scope:note.scope||scope}))?'Aberta':'Abrir'}</small></button>)}
    {!!windows.length&&<button onClick={()=>setWindows(previous=>previous.map((windowNote,index)=>({...windowNote,position:{...windowNote.position,...clampPosition(24+index*24,80+index*24),docked:false,expanded:false}})))}><LocateFixed size={16} aria-hidden="true"/>Reunir janelas ({windows.length})</button>}
    {windows.length>=10&&<p>Feche uma janela para abrir outra nota.</p>}
    {draftStorageError&&<p role="alert">{draftStorageError}</p>}
  </div></details>{createPortal(ready?visibleWindows.map((note,index)=>{const id=noteKey(note),latest=notes.find(item=>noteKey({...item,scope:item.scope||scope})===id);return <NoteWindow key={`${id}:${recoveryEpoch}`} note={note} latest={latest} position={note.position} readOnly={readOnly||copiesBusy} onSave={onSave} onShare={onShare} members={members} username={username} canShare={canShare} draftStorageError={draftStorageError} points={points} onOpenPoint={onOpenPoint} openRequest={openRequest} roomId={roomId} onClose={()=>{setWindows(previous=>previous.filter(windowNote=>noteKey(windowNote)!==id));const opener=openers.current.get(id);if(opener?.isConnected)opener.focus();else library.current?.querySelector('summary')?.focus();openers.current.delete(id);}} onPosition={position=>place(id,position)} onDraft={draft=>update(id,draft)} onFocus={()=>focus(id)} zIndex={70+index}/>;}):[],document.body)}</>;
}



