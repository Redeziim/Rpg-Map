import {useEffect,useRef,useState} from 'react';
import {api} from '../api.js';
import './DiceHistory.css';

const dateFormatter=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const ORIGINS={tray:'Bandeja',sheet:'Ficha',group:'Grupo'};

export default function DiceHistory({room,viewMode}){
  const [older,setOlder]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(null);
  const request=useRef(null),revision=useRef(room.revision);revision.current=room.revision;
  useEffect(()=>()=>request.current?.abort(),[]);
  const extra=older?.revision===room.revision?older:null;
  const entries=[...(room.diceHistory||[]),...(extra?.entries||[])];
  const hasMore=extra?extra.hasMore:room.diceHistoryHasMore;
  async function loadMore(){
    if(loading||!entries.length)return;
    const controller=new AbortController();request.current=controller;
    const requestedRevision=room.revision;
    setLoading(true);setError(null);
    try{
      const page=await api(`/rooms/${room.id}/dice-history?mapViewMode=${viewMode}&before=${encodeURIComponent(entries.at(-1).id)}`,{signal:controller.signal});
      if(revision.current!==requestedRevision||page.revision!==requestedRevision)return;
      setOlder({revision:requestedRevision,entries:[...(extra?.entries||[]),...page.entries],hasMore:page.hasMore});
    }catch(cause){if(!controller.signal.aborted)setError({revision:requestedRevision,message:cause.message});}
    finally{if(!controller.signal.aborted)setLoading(false);}
  }
  return <details className="roll-ledger">
    <summary>Histórico da bandeja</summary>
    <p className="roll-ledger-hint">Rolagens salvas · as privadas só aparecem para quem rolou e para o ADM · até 500 registros.</p>
    {entries.length?<ol aria-label="Rolagens salvas">{entries.map(entry=><li key={entry.id}>
      <div className="roll-ledger-meta"><span>@{entry.author}{entry.visibility==='private'&&<em className="roll-private-tag">Privada</em>}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{dateFormatter.format(entry.createdAt)}</time></div>
      <div className="roll-ledger-result"><span>{entry.expression}</span><strong aria-label={entry.cocked?'Sem resultado válido':`Total ${entry.total}`}>{entry.cocked?'Sem resultado':entry.total}</strong></div>
      <details className="roll-ledger-entry"><summary>Ver dados e contexto</summary><p>{entry.parts.map(part=>`${part.sign<0?'− ':''}${part.qty}d${part.sides}: [${part.rolls.join(', ')}]`).join(' · ')}</p><p>{ORIGINS[entry.origin]} · {entry.context.roomName}{entry.context.combat.round>0?` · Rodada ${entry.context.combat.round}`:' · Fora de combate'}{entry.context.scene?` · Cena: ${entry.context.scene.title}`:''}</p>{entry.cocked&&<p>Dado preso, inclinado ou fora da área. Esta jogada não tem total válido.</p>}</details>
    </li>)}</ol>:<p className="roll-ledger-empty">As próximas rolagens da bandeja ficam guardadas aqui.</p>}
    {error?.revision===room.revision&&<p role="alert">{error.message}</p>}
    {loading&&<p role="status">Carregando rolagens anteriores…</p>}
    {hasMore&&<button type="button" disabled={loading} onClick={loadMore}>{loading?'Carregando…':'Ver rolagens anteriores'}</button>}
  </details>;
}
