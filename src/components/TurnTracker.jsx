import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import './TurnTracker.css';

export default function TurnTracker({room, username, editable, saving, mutate}) {
  const order=room.state.turnOrder||[];
  const active=room.state.activePlayer;
  const act=(action,player)=>mutate('/turns',{action,player},'POST');
  return <section className="turn-tracker" aria-label="Turnos da mesa">
    <div className="turn-heading">
      <div><span className="eyebrow">Ordem de jogo</span><p role="status">{active?<><strong>{active===username?'Seu turno':`Turno de ${active}`}</strong>{active===username&&<span> · {username}</span>}</>:'Turnos ainda não iniciados'}</p></div>
      {editable&&<div className="turn-actions"><button disabled={saving||!order.length} onClick={()=>act('next')}>{active?'Próximo turno':'Iniciar turnos'}</button><button disabled={saving||!active} onClick={()=>act('end')}>Encerrar</button></div>}
    </div>
    {order.length?<details><summary>{editable?'Definir ordem e jogador da vez':'Ver ordem dos jogadores'}</summary><ol className="turn-order">{order.map((name,index)=><li key={name} className={active===name?'is-current-turn':''} aria-current={active===name?'step':undefined}>
      <span className="turn-number">{index+1}.</span><span className="turn-name">{name}{active===name&&<span className="turn-badge">Em turno</span>}</span>
      {editable&&<div className="turn-actions"><button disabled={saving||active===name} onClick={()=>act('select',name)} aria-label={`Dar turno a ${name}`}>Dar turno</button><button disabled={saving||index===0} onClick={()=>act('up',name)} aria-label={`Antecipar turno de ${name}`}><ArrowUp aria-hidden="true" size={16}/></button><button disabled={saving||index===order.length-1} onClick={()=>act('down',name)} aria-label={`Adiar turno de ${name}`}><ArrowDown aria-hidden="true" size={16}/></button></div>}
    </li>)}</ol></details>:<p>Adicione jogadores à mesa para definir os turnos.</p>}
  </section>;
}
