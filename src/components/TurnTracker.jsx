import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronDown,ChevronUp,Skull,Users,X} from 'lucide-react';
import './TurnTracker.css';
import useCombatRecovery from './useCombatRecovery.js';
import CombatEffects,{emptyEffectDraft,matchesEffectDraft} from './CombatEffects.jsx';

function InitiativeField({actor,value,version,saving,act}){
  const [draft,setDraft]=useState(null),[review,setReview]=useState(false);
  return <form className="turn-initiative" onSubmit={async event=>{
    event.preventDefault();if(!draft)return;
    const result=await act('initiative',actor.id,{value:draft.text===''?null:Number(draft.text),version:review?version:draft.version});
    if(result){setDraft(null);setReview(false);}else setReview(true);
  }}>
    <label>Iniciativa<input type="number" name={`initiative-${actor.id}`} autoComplete="off" aria-label={`Iniciativa de ${actor.name}`} min="-999" max="999" step="1" value={draft?.text??value??''} disabled={saving} placeholder="—" onChange={event=>setDraft(previous=>({text:event.target.value,version:previous?.version??version}))}/></label>
    {draft&&<><span className="turn-initiative-current">Atual: {value??'sem valor'}</span><button type="submit" disabled={saving}>{review?'Aplicar à ordem atual':'Salvar'}</button><button type="button" disabled={saving} onClick={()=>{setDraft(null);setReview(false);}}>Cancelar</button></>}
  </form>;
}

export default function TurnTracker({room,username,userId,editable,saving,connection,mutate}){
  const [npcName,setNpcName]=useState(''),[npcKind,setNpcKind]=useState('enemy');
  const [error,setError]=useState('');
  const [effectDraft,setEffectDraft]=useState(emptyEffectDraft);
  const editorSummaryRef=useRef(null),inFlight=useRef(false);
  const recovery=useCombatRecovery({roomId:room.id,userId,connection,mutate,onConfirmed:command=>{
    if(command.action==='add')setNpcName(previous=>previous===command.name?'':previous);
    if(command.action==='effect-add')setEffectDraft(previous=>matchesEffectDraft(previous,command)?emptyEffectDraft():previous);
  }});
  const busy=saving||!!recovery.pending||connection!=='online';
  const combat=room.state.combat,order=combat.order,npcs=combat.npcs,excluded=combat.excluded;
  const actors=order.map(id=>{
    const npc=npcs.find(entry=>entry.id===id);
    return {id,name:npc?.name||id,kind:npc?.kind||'player',avatar:npc?null:room.groupBars?.[id]?.avatar};
  });
  const active=combat.activeId,activeActor=actors.find(actor=>actor.id===active);
  const [expanded,setExpanded]=useState(()=>!!combat.activeId);
  useEffect(()=>{if(active)setExpanded(true);},[active]);
  const nextId=order.length?order[(Math.max(-1,order.indexOf(active))+1)%order.length]:null;
  const excludedPlayers=room.members.filter(member=>member.role!=='master'&&excluded.includes(member.username));
  const kindLabel=kind=>kind==='enemy'?'Inimigo':kind==='npc'?'NPC':'Jogador';
  const act=async(action,player,extra={})=>{
    if(inFlight.current||busy)return false;
    inFlight.current=true;setError('');
    try{
      const result=await recovery.execute({action,player,version:combat.version,...extra});
      if(result&&action==='remove')editorSummaryRef.current?.focus();
      if(!result)setError('A alteração não foi confirmada. Os valores digitados foram mantidos.');
      return result;
    }finally{inFlight.current=false;}
  };
  return <section className="turn-tracker" aria-label="Turnos da mesa" aria-busy={saving}>
    <div className="turn-heading">
      <button type="button" className="turn-toggle" aria-expanded={expanded} aria-label={`${expanded?'Recolher':'Mostrar'} ordem de jogo e efeitos · ${actors.length}`} title={expanded?'Recolher':'Mostrar ordem de jogo'} onClick={()=>setExpanded(open=>!open)}>{expanded?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}<span className="turn-toggle-count">{actors.length}</span></button>
      <div className="turn-heading-copy"><span className="eyebrow">{combat.round?`Rodada ${combat.round}`:'Ordem de jogo'}</span><p role="status">{activeActor?<><strong>{active===username?'Seu turno':`Turno de ${activeActor.name}`}</strong><span>{activeActor.kind!=='player'?` · ${kindLabel(activeActor.kind)}`:''}</span></>:'Turnos ainda não iniciados'}</p></div>
      {editable&&<div className="turn-actions"><button type="button" disabled={busy||!order.length} onClick={()=>act(active?'skip':'next')}>{active?'Pular turno':'Iniciar turnos'}</button><button type="button" disabled={busy||!active} onClick={()=>act('end')}>Encerrar</button><details className="turn-editor"><summary ref={editorSummaryRef}>Gerenciar turnos</summary><div className="turn-editor-panel">
        <h3>Participantes do combate</h3>
        <p>Mude a ordem com as setas, dê o turno a alguém ou retire do combate. Se retirar quem está na vez, o turno passa ao próximo. A conta continua na mesa.</p>
        <form className="turn-add-form" onSubmit={event=>{event.preventDefault();act('add',undefined,{name:npcName,kind:npcKind});}}>
          <label>Nome do personagem<input name="combat-character" autoComplete="off" value={npcName} onChange={event=>setNpcName(event.target.value)} minLength={2} maxLength={50} required placeholder="Ex.: Guarda da ponte…"/></label>
          <label>Tipo<select name="combat-kind" value={npcKind} onChange={event=>setNpcKind(event.target.value)}><option value="enemy">Inimigo</option><option value="npc">NPC</option></select></label>
          <button type="submit" disabled={busy}>Adicionar à ordem</button>
        </form>
        <div className="turn-sort"><p>A iniciativa é opcional. Valores maiores vêm primeiro; empates mantêm a ordem.</p><button type="button" disabled={busy||order.length<2||!Object.keys(combat.initiative).length} onClick={()=>act('sort')}>Ordenar por iniciativa</button></div>
        <ol className="turn-edit-list">{actors.map((actor,index)=><li key={actor.id}>
          <span className="turn-edit-name"><b>{index+1}</b><span>{actor.name}<small>{kindLabel(actor.kind)}</small></span></span>
          <span className="turn-edit-actions"><button type="button" disabled={busy||active===actor.id} onClick={()=>act('select',actor.id)} aria-label={`Dar turno a ${actor.name}`}>Dar turno</button><button type="button" disabled={busy||index===0} onClick={()=>act('up',actor.id)} aria-label={`Antecipar turno de ${actor.name}`} title="Mover para cima"><ArrowUp aria-hidden="true" size={16}/></button><button type="button" disabled={busy||index===actors.length-1} onClick={()=>act('down',actor.id)} aria-label={`Adiar turno de ${actor.name}`} title="Mover para baixo"><ArrowDown aria-hidden="true" size={16}/></button><button type="button" disabled={busy} onClick={()=>act('remove',actor.id)} aria-label={actor.kind==='player'?`Tirar ${actor.name} do combate`:`Remover ${actor.name} do combate`} title="Tirar do combate"><X aria-hidden="true" size={16}/></button></span>
          <InitiativeField actor={actor} value={combat.initiative[actor.id]} version={combat.version} saving={busy} act={act}/>
        </li>)}</ol>
        {excludedPlayers.length>0&&<div className="turn-excluded"><h4>Fora do combate</h4>{excludedPlayers.map(member=><div key={member.id}><span>{member.username}</span><button type="button" disabled={busy} onClick={()=>act('include',member.username)}>Recolocar na ordem</button></div>)}</div>}
      </div></details></div>}
    </div>
    {recovery.pending&&<div className="turn-recovery" aria-label="Confirmação do comando">
      <p role="status"><strong>{['sending','checking'].includes(recovery.phase)?'Conferindo seu comando…':'Comando sem confirmação'}</strong><span>{recovery.notice||'Vamos conferir o resultado antes do próximo comando.'}</span></p>
      {!['sending','checking'].includes(recovery.phase)&&<div className="turn-recovery-actions">
        {!recovery.pending.corrupt&&<button type="button" disabled={saving||connection!=='online'} onClick={recovery.verify}>Verificar resultado</button>}
        {recovery.phase==='unconfirmed'&&editable&&<button type="button" disabled={saving||connection!=='online'} onClick={recovery.retry}>Reenviar a mesma ação</button>}
        {['expired','corrupt'].includes(recovery.phase)&&<button type="button" disabled={saving||connection!=='online'} onClick={recovery.acknowledge}>Conferi a ordem atual</button>}
      </div>}
    </div>}
    {!recovery.pending&&recovery.notice&&<p className="turn-recovery-notice" role="status">{recovery.notice}</p>}
    {!recovery.pending&&!recovery.notice&&error&&<p className="turn-error" role="alert">{error}</p>}
    {expanded&&(actors.length?<ol className="turn-roster" aria-label="Sequência dos turnos" tabIndex={0}>{actors.map((actor,index)=><li key={actor.id} title={actor.name} className={`turn-portrait turn-${actor.kind} ${active===actor.id?'is-current-turn':''} ${nextId===actor.id&&active!==actor.id?'is-next-turn':''}`} aria-current={active===actor.id?'step':undefined} aria-label={`${index+1}º: ${actor.name}, ${kindLabel(actor.kind)}${active===actor.id?', em turno':''}`}>
      <span className="turn-portrait-image" aria-hidden="true">{actor.avatar?<img src={actor.avatar} width="34" height="34" alt=""/>:actor.kind==='enemy'?<Skull size={21}/>:actor.kind==='npc'?<Users size={21}/>:actor.name.slice(0,1).toUpperCase()}</span>
      <span className="turn-portrait-name">{actor.name}</span><span className="turn-portrait-rank">{index+1}</span>{Object.hasOwn(combat.initiative,actor.id)&&<span className="turn-portrait-initiative">Ini. {combat.initiative[actor.id]}</span>}
    </li>)}</ol>:<p className="turn-empty">Adicione jogadores à mesa ou personagens ao combate.</p>)}
    {expanded&&<CombatEffects combat={combat} actors={[...actors,...excludedPlayers.map(member=>({id:member.username,name:member.username,excluded:true}))]} editable={editable} busy={busy} act={act} draft={effectDraft} setDraft={setEffectDraft}/>}
  </section>;
}
