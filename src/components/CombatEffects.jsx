import React,{useEffect,useId,useRef,useState} from 'react';

export const emptyEffectDraft=()=>({player:'',name:'',origin:'',visibility:'all',kind:'manual',rounds:'1',version:null});
export const matchesEffectDraft=(draft,command)=>draft.player===command.player&&draft.name.trim()===command.name&&draft.origin.trim()===command.origin&&draft.visibility===command.visibility&&draft.kind===command.duration?.kind&&(draft.kind!=='rounds'||Number(draft.rounds)===command.duration.remaining);
export function effectDuration(effect){
  const {kind,remaining}=effect.duration;
  return remaining===0?'Encerrado':kind==='manual'?'Até remover':kind==='next-turn'?'Até receber o próximo turno':`${remaining} ${remaining===1?'rodada restante':'rodadas restantes'}`;
}

export default function CombatEffects({combat,actors,editable,busy,act,draft,setDraft}){
  const [removing,setRemoving]=useState(null),summaryRef=useRef(null),cancelRef=useRef(null),confirmationId=useId();
  const effects=combat.effects,ended=effects.filter(effect=>effect.duration.remaining===0).length;
  const nameOf=id=>actors.find(actor=>actor.id===id)?.name||id;
  const review=draft.version!==null&&draft.version!==combat.version;
  const hasDraft=!!(draft.name.trim()||draft.origin.trim());
  useEffect(()=>{
    if(!editable||!hasDraft)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[editable,hasDraft]);
  useEffect(()=>{if(removing&&editable)cancelRef.current?.focus();},[removing?.effect.id,editable]);
  const change=(field,value)=>setDraft(previous=>({...previous,[field]:value,version:previous.version??combat.version}));
  const activeEffects=effects.filter(effect=>effect.actorId===combat.activeId&&effect.duration.remaining!==0);
  return <div className="turn-effects-area">
    {combat.activeId&&<p className="turn-effect-alert" role="status">{activeEffects.length?`Neste turno: ${activeEffects.map(effect=>`${effect.name} (${effectDuration(effect).toLowerCase()})`).join('; ')}.`:'Nenhum efeito em andamento para este turno.'}{effects.some(effect=>effect.actorId===combat.activeId&&effect.duration.remaining===0)&&` Encerrados: ${effects.filter(effect=>effect.actorId===combat.activeId&&effect.duration.remaining===0).map(effect=>effect.name).join(', ')}.`}</p>}
    <details className="turn-effects">
      <summary ref={summaryRef}>Condições e efeitos <span role="status">{effects.length-ended} em andamento{ended?` · ${ended} ${ended===1?'encerrado':'encerrados'}`:''}</span></summary>
      <div className="turn-effects-panel">
        {editable&&<details className="turn-effect-compose"><summary>Adicionar um efeito</summary><form className="turn-effect-form" onSubmit={event=>{
          event.preventDefault();if(busy||review)return;
          void act('effect-add',draft.player,{name:draft.name.trim(),origin:draft.origin.trim(),visibility:draft.visibility,duration:{kind:draft.kind,remaining:draft.kind==='manual'?null:draft.kind==='next-turn'?1:Number(draft.rounds)},version:draft.version??combat.version});
        }}>
          <label>Participante<select name="effect-participant" value={draft.player} onChange={event=>change('player',event.target.value)} required><option value="">Escolha um participante</option>{actors.map(actor=><option key={actor.id} value={actor.id}>{actor.name}{actor.excluded?' · fora do combate':''}</option>)}</select></label>
          <label>Nome do efeito<input name="effect-name" autoComplete="off" minLength={2} maxLength={60} placeholder="Ex.: Envenenado…" value={draft.name} onChange={event=>change('name',event.target.value)} required/></label>
          <label>Origem (opcional)<input name="effect-origin" autoComplete="off" maxLength={120} placeholder="Ex.: Poção de proteção…" value={draft.origin} onChange={event=>change('origin',event.target.value)}/></label>
          <label>Quem vê<select name="effect-visibility" value={draft.visibility} onChange={event=>change('visibility',event.target.value)}><option value="all">Todos na mesa</option><option value="master">Só mestres e ADM</option></select></label>
          <label>Duração<select name="effect-duration" value={draft.kind} onChange={event=>change('kind',event.target.value)}><option value="manual">Até remover manualmente</option><option value="rounds">Número de rodadas</option><option value="next-turn">Até receber o próximo turno</option></select></label>
          {draft.kind==='rounds'&&<label>Quantas rodadas<input type="number" name="effect-rounds" autoComplete="off" inputMode="numeric" min="1" max="99" step="1" value={draft.rounds} onChange={event=>change('rounds',event.target.value)} required/></label>}
          <p className="turn-effect-help">{draft.kind==='rounds'?'Diminui quando começa uma nova rodada. Não conta enquanto o participante estiver fora do combate.':draft.kind==='next-turn'?'Encerra quando este participante receber a vez novamente, inclusive pelo botão Dar turno.':'Permanece até o mestre remover. Encerrar o combate não apaga os efeitos.'}</p>
          {review&&<p className="turn-effect-review" role="status">O combate mudou desde que você começou. Seu texto está aqui; confira o participante e use a ordem atual.</p>}
          <div className="turn-effect-form-actions">{review&&<button type="button" disabled={busy} onClick={()=>setDraft(previous=>({...previous,version:combat.version}))}>Usar a ordem atual</button>}<button type="submit" disabled={busy||review||!actors.length}>Adicionar efeito</button><button type="button" disabled={busy} onClick={()=>setDraft(emptyEffectDraft())}>Limpar formulário</button></div>
        </form></details>}
        {effects.length?<ul className="turn-effect-list">{effects.map(effect=><li key={effect.id} className={effect.duration.remaining===0?'is-ended':''}>
          <div><strong>{effect.name}</strong><span>{nameOf(effect.actorId)} · {effectDuration(effect)}{effect.visibility==='master'?' · Só mestres e ADM':''}</span>{effect.origin&&<p>Origem: {effect.origin}</p>}</div>
          {editable&&<button type="button" disabled={busy} onClick={()=>setRemoving({effect,version:combat.version})} aria-label={`Remover efeito ${effect.name} de ${nameOf(effect.actorId)}`}>Remover</button>}
        </li>)}</ul>:<p className="turn-empty">Nenhum efeito registrado. {editable?'Adicione uma condição quando precisar.':'O mestre pode adicionar condições aos participantes.'}</p>}
        {removing&&editable&&<div className="turn-effect-confirm" role="alertdialog" aria-labelledby={confirmationId}>
          <p id={confirmationId}>{effects.some(effect=>effect.id===removing.effect.id)?`Remover “${removing.effect.name}” de ${nameOf(removing.effect.actorId)}?`:'Este efeito já saiu da lista.'}</p>
          <button type="button" ref={cancelRef} disabled={busy} onClick={()=>{setRemoving(null);summaryRef.current?.focus();}}>Cancelar</button>
          {effects.some(effect=>effect.id===removing.effect.id)&&<>{removing.version!==combat.version&&<><p role="status">O combate mudou. Confira o efeito antes de remover.</p><button type="button" disabled={busy} onClick={()=>setRemoving(previous=>previous?{...previous,version:combat.version}:previous)}>Conferi o efeito atual</button></>}<button type="button" disabled={busy||removing.version!==combat.version} onClick={async()=>{const result=await act('effect-remove',undefined,{effectId:removing.effect.id,version:removing.version});if(result){setRemoving(null);summaryRef.current?.focus();}}}>Confirmar remoção</button></>}
        </div>}
      </div>
    </details>
  </div>;
}
