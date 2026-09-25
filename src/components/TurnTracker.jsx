import React,{useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Skull,Users,X} from 'lucide-react';
import './TurnTracker.css';

export default function TurnTracker({room,username,editable,saving,mutate}){
  const [npcName,setNpcName]=useState(''),[npcKind,setNpcKind]=useState('enemy');
  const editorSummaryRef=useRef(null);
  const order=room.state.turnOrder||[],npcs=room.state.turnNpcs||[],excluded=room.state.turnExcluded||[];
  const actors=order.map(id=>{
    const npc=npcs.find(entry=>entry.id===id);
    return {id,name:npc?.name||id,kind:npc?.kind||'player',avatar:npc?null:room.groupBars?.[id]?.avatar};
  });
  const active=room.state.activePlayer,activeActor=actors.find(actor=>actor.id===active);
  const nextId=order.length?order[(Math.max(-1,order.indexOf(active))+1)%order.length]:null;
  const excludedPlayers=room.members.filter(member=>member.role!=='master'&&excluded.includes(member.username));
  const kindLabel=kind=>kind==='enemy'?'Inimigo':kind==='npc'?'NPC':'Jogador';
  const act=async(action,player,extra={})=>{
    const result=await mutate('/turns',{action,player,...extra},'POST');
    if(result&&action==='add')setNpcName('');
    if(result&&action==='remove')editorSummaryRef.current?.focus();
  };
  return <section className="turn-tracker" aria-label="Turnos da mesa">
    <div className="turn-heading">
      <div className="turn-heading-copy"><span className="eyebrow">Ordem de jogo</span><p role="status">{activeActor?<><strong>{active===username?'Seu turno':`Turno de ${activeActor.name}`}</strong><span>{activeActor.kind!=='player'?` · ${kindLabel(activeActor.kind)}`:''}</span></>:'Turnos ainda não iniciados'}</p></div>
      {editable&&<div className="turn-actions"><button type="button" disabled={saving||!order.length} onClick={()=>act('next')}>{active?'Próximo turno':'Iniciar turnos'}</button><button type="button" disabled={saving||!active} onClick={()=>act('end')}>Encerrar</button><details className="turn-editor"><summary ref={editorSummaryRef}>Gerenciar turnos</summary><div className="turn-editor-panel">
        <h3>Participantes do combate</h3>
        <p>Jogadores entram automaticamente. Tire alguém desta ordem sem remover sua conta da mesa.</p>
        <form className="turn-add-form" onSubmit={event=>{event.preventDefault();act('add',undefined,{name:npcName,kind:npcKind});}}>
          <label>Nome do personagem<input name="combat-character" autoComplete="off" value={npcName} onChange={event=>setNpcName(event.target.value)} minLength={2} maxLength={50} required placeholder="Ex.: Guarda da ponte…"/></label>
          <label>Tipo<select name="combat-kind" value={npcKind} onChange={event=>setNpcKind(event.target.value)}><option value="enemy">Inimigo</option><option value="npc">NPC</option></select></label>
          <button type="submit" disabled={saving}>Adicionar à ordem</button>
        </form>
        <ol className="turn-edit-list">{actors.map((actor,index)=><li key={actor.id}>
          <span className="turn-edit-name"><b>{index+1}</b><span>{actor.name}<small>{kindLabel(actor.kind)}</small></span></span>
          <span className="turn-edit-actions"><button type="button" disabled={saving||active===actor.id} onClick={()=>act('select',actor.id)} aria-label={`Dar turno a ${actor.name}`}>Dar turno</button><button type="button" disabled={saving||index===0} onClick={()=>act('up',actor.id)} aria-label={`Antecipar turno de ${actor.name}`}><ArrowUp aria-hidden="true" size={16}/></button><button type="button" disabled={saving||index===actors.length-1} onClick={()=>act('down',actor.id)} aria-label={`Adiar turno de ${actor.name}`}><ArrowDown aria-hidden="true" size={16}/></button><button type="button" disabled={saving} onClick={()=>act('remove',actor.id)} aria-label={actor.kind==='player'?`Tirar ${actor.name} do combate`:`Remover ${actor.name} do combate`}><X aria-hidden="true" size={16}/></button></span>
        </li>)}</ol>
        {excludedPlayers.length>0&&<div className="turn-excluded"><h4>Fora do combate</h4>{excludedPlayers.map(member=><div key={member.id}><span>{member.username}</span><button type="button" disabled={saving} onClick={()=>act('include',member.username)}>Recolocar na ordem</button></div>)}</div>}
      </div></details></div>}
    </div>
    {actors.length?<ol className="turn-roster" aria-label="Sequência dos turnos" tabIndex={0}>{actors.map((actor,index)=><li key={actor.id} title={actor.name} className={`turn-portrait turn-${actor.kind} ${active===actor.id?'is-current-turn':''} ${nextId===actor.id&&active!==actor.id?'is-next-turn':''}`} aria-current={active===actor.id?'step':undefined} aria-label={`${index+1}º: ${actor.name}, ${kindLabel(actor.kind)}${active===actor.id?', em turno':''}`}>
      <span className="turn-portrait-image" aria-hidden="true">{actor.avatar?<img src={actor.avatar} width="34" height="34" alt=""/>:actor.kind==='enemy'?<Skull size={21}/>:actor.kind==='npc'?<Users size={21}/>:actor.name.slice(0,1).toUpperCase()}</span>
      <span className="turn-portrait-name">{actor.name}</span><span className="turn-portrait-rank">{index+1}</span>
    </li>)}</ol>:<p className="turn-empty">Adicione jogadores à mesa ou personagens ao combate.</p>}
  </section>;
}
