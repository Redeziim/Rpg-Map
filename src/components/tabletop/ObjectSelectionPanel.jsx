import React,{useEffect,useState} from 'react';
import ObjectNumberInput from './ObjectNumberInput.jsx';

export default function ObjectSelectionPanel({objects,groups,selected,version,onSelect,onClear,onAll,editable,disabled,mode,onMode,onFocus,onTransform,onDelta,onAction,feedbackRef}){
  const items=objects.filter(item=>selected.includes(item.id)),item=items.length===1?items[0]:null,locked=items.some(item=>item.locked);
  const group=groups.find(group=>items.length&&items.every(item=>item.groupId===group.id));
  const [name,setName]=useState('Grupo'),[delta,setDelta]=useState({position:[0,0,0],rotation:[0,0,0],scale:1}),[sizeFactor,setSizeFactor]=useState('1'),[removing,setRemoving]=useState(false);
  const selectionKey=selected.join(':');useEffect(()=>{setDelta({position:[0,0,0],rotation:[0,0,0],scale:1});setSizeFactor('1');setRemoving(false);},[selectionKey]);
  return <section className="tabletop-selection" aria-label="Objetos e grupos">
    <h3 tabIndex={-1} ref={feedbackRef}>Objetos da mesa <span>{objects.length}</span></h3>
    {!!objects.length&&<><p className="tabletop-selection-help">{editable?'Marque objetos para editar juntos.':'Marque objetos para focar o conjunto.'} Um grupo é selecionado por inteiro.</p><div className="tabletop-selection-quick"><button type="button" disabled={disabled} onClick={onAll}>Selecionar todos</button><button type="button" disabled={disabled||!items.length} onClick={onClear}>Limpar seleção</button></div></>}
    <div className="tabletop-objects">{objects.map((object,index)=><label className="tabletop-object-row" key={object.id}>
      <input type="checkbox" name={`select-${object.id}`} aria-label={`Selecionar ${object.name}, objeto ${index+1}`} checked={selected.includes(object.id)} disabled={disabled} onChange={()=>onSelect(object.id,true)}/>
      <span><strong>{object.name}</strong><small>{groups.find(group=>group.id===object.groupId)?.name||'Objeto'}{object.locked?' · Bloqueado':''}</small></span>
    </label>)}{!objects.length&&<p>{editable?'Importe seu primeiro mapa para começar.':'Aguardando o mestre importar o mapa.'}</p>}</div>
    {!!items.length&&<div className="tabletop-inspector" key={selected.join(':')}>
      <h3>{group?group.name:item?item.name:`${items.length} objetos selecionados`}</h3>
      <button type="button" disabled={disabled} onClick={onFocus}>Focar seleção</button>
      {editable&&<><div className="tabletop-selection-actions">
        <button type="button" disabled={disabled} onClick={()=>onAction('duplicate')}>Duplicar{group?' grupo':items.length>1?' seleção':' objeto'}</button>
        <button type="button" disabled={disabled} onClick={()=>onAction('lock',{locked:!locked})}>{locked?'Desbloquear':'Bloquear'}</button>
        {items.some(item=>item.groupId)&&<button type="button" disabled={disabled} onClick={()=>onAction('ungroup')}>Desagrupar</button>}
        {items.length>1&&!group&&<form className="tabletop-group-form" onSubmit={event=>{event.preventDefault();if(name.trim())onAction('group',{name:name.trim()});}}><label>Nome do grupo<input name="tabletopGroupName" value={name} onChange={event=>setName(event.target.value)} maxLength={120} disabled={disabled} autoComplete="off" required/></label><button type="submit" disabled={disabled||!name.trim()}>Agrupar seleção</button></form>}
      </div>
      {locked?<p className="tabletop-lock-help" role="status">Bloqueado: desbloqueie para mover, girar ou mudar o tamanho.</p>:<>
        <div className="tabletop-modes" role="group" aria-label="Editar seleção">{[['translate','Mover'],['rotate','Girar'],['scale','Tamanho']].map(([value,label])=><button key={value} type="button" disabled={disabled} aria-pressed={mode===value} onClick={()=>onMode(value)}>{label}</button>)}</div>
        <p>Arraste os eixos para mover ou girar. Em Tamanho, o modelo inteiro cresce ou diminui mantendo as proporções.</p>
        <form className="tabletop-proportional-size" onSubmit={async event=>{event.preventDefault();if(await onDelta({scale:Number(sizeFactor)}))setSizeFactor('1');}}>
          <label>Multiplicar tamanho<input name="proportionalSize" type="number" inputMode="decimal" autoComplete="off" min={.001/Math.min(...items.flatMap(object=>object.scale))} max={10000/Math.max(...items.flatMap(object=>object.scale))} step="any" required value={sizeFactor} disabled={disabled} onChange={event=>setSizeFactor(event.target.value)}/></label>
          <small>2 dobra · 0,5 reduz à metade. Mantém a forma{items.length>1?' e a posição relativa do conjunto':''}.</small>
          <button type="submit" disabled={disabled}>Aplicar tamanho</button>
        </form>
        <details className="tabletop-preview-numbers"><summary>Ajustar por números</summary><div>
          {item?['position','rotation'].map((key,k)=><fieldset key={key} disabled={disabled}><legend>{['Posição','Rotação (graus)'][k]}</legend><div className="tabletop-vector">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<ObjectNumberInput item={item} field={key} axis={i} version={version} onTransform={onTransform}/></label>)}</div></fieldset>):<form onSubmit={async event=>{event.preventDefault();if(await onDelta(delta))setDelta({position:[0,0,0],rotation:[0,0,0],scale:1});}}>
            {['position','rotation'].map((key,k)=><fieldset key={key} disabled={disabled}><legend>{k?'Girar o conjunto (graus)':'Deslocar o conjunto'}</legend><div className="tabletop-vector">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input name={`${key}${axis}`} autoComplete="off" aria-label={`${k?'Girar conjunto':'Deslocar conjunto'} ${axis}`} type="number" step={k?5:.1} required value={delta[key][i]} onChange={event=>setDelta(current=>({...current,[key]:current[key].map((value,index)=>index===i?event.target.value:value)}))}/></label>)}</div></fieldset>)}
            <button type="submit" disabled={disabled}>Aplicar ao conjunto</button>
          </form>}
        </div></details>
      </>}
      {removing?<div className="tabletop-remove-confirm" role="group" aria-label="Confirmar remoção"><p>Remover {items.length} objeto{items.length>1?'s':''} da cena? O arquivo será apagado se esta for a última cópia.</p><button type="button" disabled={disabled} onClick={()=>onAction('remove')}>Confirmar remoção</button><button type="button" disabled={disabled} onClick={()=>setRemoving(false)}>Cancelar remoção</button></div>:<button type="button" disabled={disabled} className="tabletop-remove" onClick={()=>setRemoving(true)}>Remover {items.length>1?'seleção':'objeto'} da cena</button>}</>}
    </div>}
  </section>;
}
