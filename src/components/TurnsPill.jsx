import React,{useEffect,useRef,useState} from 'react';
import {Swords} from 'lucide-react';
import TurnTracker from './TurnTracker.jsx';
import {opensTurnPanel,turnNeedsAttention} from '../shared/turnAttention.js';

// Botão minimizado "Turnos": mostra de quem é a vez e abre, num painel, a ordem de jogo com os controles do mestre.
// O bloco de turnos fica sempre montado (só escondido), para não perder o que estava sendo feito ao fechar o painel.
// Quando há um comando sem confirmação ou um aviso, o painel abre sozinho e o botão avisa, para nada ficar escondido.
const ATTENTION_LABEL={checking:'Conferindo comando…',pending:'Confirmar comando',notice:'Ver aviso'};
const QUIET={kind:'',key:''};

export default function TurnsPill({room,user,editable,saving,connection,mutate}){
  const [open,setOpen]=useState(false),[attention,setAttention]=useState(QUIET),[seenKey,setSeenKey]=useState('');
  const button=useRef(null),panel=useRef(null);
  const combat=room.state.combat,activeId=combat?.activeId,myTurn=!!activeId&&activeId===user.username;
  const turnLabel=activeId?(myTurn?'Seu turno':combat.npcs?.find(entry=>entry.id===activeId)?.name||activeId):'';
  const flagged=turnNeedsAttention(attention,seenKey),label=flagged?ATTENTION_LABEL[attention.kind]:turnLabel;
  // comando pendente ou aviso novo: abre o painel; um aviso já visto não volta a marcar o botão
  useEffect(()=>{if(opensTurnPanel(attention.kind))setOpen(true);},[attention.kind,attention.key]);
  useEffect(()=>{if(open&&attention.kind==='notice')setSeenKey(attention.key);},[open,attention.kind,attention.key]);
  useEffect(()=>{
    if(!open)return undefined;
    const outside=event=>{if(!event.target.closest?.('.turns-pill'))setOpen(false);};
    const escape=event=>{
      if(event.key!=='Escape')return;
      // se o foco estava dentro do painel, ele volta para o botão em vez de se perder
      if(panel.current?.contains(document.activeElement))button.current?.focus();
      setOpen(false);
    };
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className={`turns-pill${open?' is-open':''}${myTurn?' is-my-turn':''}${flagged?' needs-attention':''}`}>
    <button ref={button} type="button" className="turns-pill-button" aria-expanded={open} aria-controls="turns-popover" onClick={()=>setOpen(value=>!value)}>
      <Swords size={16} aria-hidden="true"/><span>Turnos{combat?.round?` · rodada ${combat.round}`:''}</span>{label&&<small aria-hidden="true">{label}</small>}
    </button>
    {/* anuncia a mudança de turno ou o aviso mesmo com o painel fechado */}
    <span className="sr-only" role="status">{label?`Turnos: ${label}`:''}</span>
    <div id="turns-popover" ref={panel} className="turns-popover" hidden={!open}>
      <TurnTracker alwaysExpanded room={room} username={user.username} userId={user.id} editable={editable} saving={saving} connection={connection} mutate={mutate} onAttention={setAttention}/>
    </div>
  </div>;
}
