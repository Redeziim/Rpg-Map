import React,{useMemo,useRef,useState} from 'react';
import {REFERENCE_LABELS,referenceKey,referenceTargets} from '../../shared/tabletopReferences.js';

function ReferenceEditor({item,targets,editable,disabled,version,onAction,onOpen}){
  const [draft,setDraft]=useState({kind:'point',key:'',version:null}),targetInput=useRef(null),referenceList=useRef(null);
  const references=item.references||[],eligible=[...targets.entries()].filter(([,target])=>target.kind===draft.kind),options=eligible.filter(([,target])=>!references.some(ref=>!ref.unavailable&&referenceKey(ref)===referenceKey(target)));
  const target=targets.get(draft.key);
  const focusTargets=()=>requestAnimationFrame(()=>{const input=targetInput.current;(input&&!input.disabled?input:referenceList.current)?.focus();});
  async function remove(ref){if(await onAction('unlink',{referenceId:ref.id},version,item.id))focusTargets();}
  async function add(event){
    event.preventDefault();if(!target||disabled)return;
    const reference={kind:target.kind,targetId:target.targetId,...(target.kind==='note'?{scope:target.scope}:{})};
    if(await onAction('link',{reference},draft.version??version,item.id)){setDraft(current=>({...current,key:'',version:null}));focusTargets();}
  }
  return <>
    <p>Os vínculos abrem o conteúdo atual. Vincular uma nota não muda quem pode acessá-la.</p>
    <ul ref={referenceList} tabIndex={-1} aria-label="Vínculos atuais" className="tabletop-reference-list">{references.map(ref=>{
      const target=!ref.unavailable&&targets.get(referenceKey(ref));
      if(!target&&!editable)return null;
      return <li key={ref.id}><div><small>{REFERENCE_LABELS[ref.kind]}</small>{target?<button type="button" className="tabletop-reference-open" disabled={disabled} aria-label={`Abrir ${REFERENCE_LABELS[ref.kind].toLowerCase()}: ${target.title}`} onClick={()=>onOpen(item.id,ref.id)}>{target.title}</button>:<span>Destino indisponível</span>}</div>{editable&&<button type="button" disabled={disabled} aria-label={`Retirar vínculo ${REFERENCE_LABELS[ref.kind].toLowerCase()}: ${target?.title||'destino indisponível'}`} onClick={()=>remove(ref)}>Retirar</button>}</li>;
    })}</ul>
    {!references.some(ref=>!ref.unavailable&&targets.has(referenceKey(ref)))&&<p>{editable&&references.length?'Um destino foi removido ou seu acesso mudou. Você pode retirar o vínculo.':'Este objeto ainda não tem vínculos disponíveis.'}</p>}
    {editable&&<form className="tabletop-reference-form" onSubmit={add}>
      <label>Tipo de vínculo<select name="referenceKind" autoComplete="off" value={draft.kind} disabled={disabled} onChange={event=>setDraft({kind:event.target.value,key:'',version:null})}>{Object.entries(REFERENCE_LABELS).map(([kind,label])=><option value={kind} key={kind}>{label}</option>)}</select></label>
      <label>Vincular a<select ref={targetInput} name="referenceTarget" autoComplete="off" value={draft.key} disabled={disabled||!options.length} onChange={event=>setDraft(current=>({...current,key:event.target.value,version:current.version??version}))} required><option value="">Escolha {draft.kind==='point'?'um ponto':draft.kind==='scene'?'uma cena':'uma nota'}…</option>{draft.key&&!options.some(([key])=>key===draft.key)&&<option value={draft.key}>Destino indisponível · escolha outro</option>}{options.map(([key,target])=><option key={key} value={key}>{target.title}{target.kind==='note'?` · ${target.scope==='@master'?'Mestre':target.scope}`:''}</option>)}</select></label>
      {!options.length&&<small>{eligible.length?'Todos os destinos disponíveis deste tipo já estão vinculados.':'Nenhum destino disponível deste tipo. Crie ou compartilhe o conteúdo primeiro.'}</small>}
      {references.length>=90&&<small>Este objeto atingiu o limite de 90 vínculos. Retire um vínculo para adicionar outro.</small>}
      <button type="submit" disabled={disabled||!target||!options.some(([key])=>key===draft.key)||references.length>=90}>Vincular</button>
    </form>}
  </>;
}

export default function ObjectReferencePanel({objects,selected,destinations,editable,disabled,version,onAction,onOpen}){
  const [preferred,setPreferred]=useState(''),items=objects.filter(item=>selected.includes(item.id));
  const item=items.find(item=>item.id===preferred)||items[0],targets=useMemo(()=>referenceTargets(destinations),[destinations.points,destinations.scenes,destinations.notes]);
  if(!item)return null;
  return <section className="tabletop-references" aria-label="Vínculos do objeto">
    <h3>Vínculos</h3>
    {items.length>1?<label>Ver vínculos de<select name="referenceObject" autoComplete="off" value={item.id} disabled={disabled} onChange={event=>setPreferred(event.target.value)}>{items.map((entry,index)=><option key={entry.id} value={entry.id}>{entry.name} · objeto {index+1}</option>)}</select></label>:<strong>{item.name}</strong>}
    <ReferenceEditor key={item.id} item={item} targets={targets} editable={editable} disabled={disabled} version={version} onAction={onAction} onOpen={onOpen}/>
  </section>;
}
