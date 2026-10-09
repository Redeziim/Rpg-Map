import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {FileUp,Save,Trash2} from 'lucide-react';
import {api} from '../api.js';
import {SHEET_SYSTEMS} from '../shared/sheetTemplates.js';
import {SHEET_FIELD_TYPES,SHEET_MODEL_LIMITS,SheetModelError,cleanModelName,cleanSheetFields} from '../shared/sheetModels.js';
import {inferSheetModel} from '../shared/sheetModelFromText.js';
import './SheetModels.css';

const TYPE_LABELS={text:'Texto',number:'Número',textarea:'Texto longo',image:'Imagem',list:'Lista',checklist:'Lista de marcas',formula:'Fórmula',attack:'Ataque',status:'Barra de recurso'};
const SOURCE_LABELS={file:'de um arquivo',room:'de uma mesa',manual:'montado à mão'};
const plural=(count,one,many)=>`${count} ${count===1?one:many}`;
const systemItems=SHEET_SYSTEMS.map(system=>({key:system.id,name:system.name,summary:system.summary,fields:system.fields().map(({type,label,tab,formula})=>({type,label,tab,...(formula?{formula}:{})}))}));

// Biblioteca de modelos da ficha: sistemas famosos já prontos, os modelos guardados na sua conta e a criação de um modelo novo a partir de
// um PDF, uma imagem ou um TXT. Um modelo é só uma lista de campos; ele nunca fica fixo na mesa (ADR 037).
export default function SheetModels({sheetFields,onFieldsChange,makeId}){
  const [mine,setMine]=useState(null),[loadError,setLoadError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pending,setPending]=useState(null),[systemError,setSystemError]=useState(''),[deleting,setDeleting]=useState(null),[busy,setBusy]=useState(false);
  const [phase,setPhase]=useState('idle'),[message,setMessage]=useState(''),[draft,setDraft]=useState(null),[saveOwn,setSaveOwn]=useState(null);
  const abort=useRef(null),heading=useRef(null);
  const load=useCallback(async()=>{
    try{setMine(await api('/sheet-models'));setLoadError('');}
    catch(cause){setLoadError(cause.message||'Não foi possível abrir seus modelos.');}
  },[]);
  useEffect(()=>{void load();return()=>abort.current?.abort();},[load]);
  useEffect(()=>{if(phase==='review')heading.current?.focus();},[phase]);

  // Somar mantém o que já existe e só traz os campos de nome novo; substituir troca o modelo inteiro.
  const plan=pending&&(()=>{
    const created=pending.fields.map(field=>({id:makeId(),...field}));
    if(pending.mode==='replace')return {fields:created,added:created.length};
    const have=new Set(sheetFields.map(field=>field.label.trim().toLowerCase()));
    const extra=created.filter(field=>!have.has(field.label.trim().toLowerCase()));
    return {fields:[...sheetFields,...extra],added:extra.length};
  })();
  function apply(){
    if(!plan)return;
    if(plan.fields.length>SHEET_MODEL_LIMITS.fields){setSystemError(`O modelo ficaria com mais de ${SHEET_MODEL_LIMITS.fields} campos. Remova campos antes de somar este modelo.`);return;}
    onFieldsChange(plan.fields);
    setNotice(`${pending.mode==='replace'?'Modelo trocado por':'Campos somados de'} “${pending.name}”.`);setPending(null);setSystemError('');
  }
  const choose=(item,mode)=>{setPending({name:item.name,fields:item.fields,mode});setSystemError('');setNotice('');};

  async function save(name,fields,source){
    setBusy(true);setError('');
    try{
      const model=await api('/sheet-models',{method:'POST',data:{name,fields,source}});
      setMine(previous=>[model,...(previous||[])]);setNotice(`Modelo “${model.name}” guardado nos seus modelos. Só você o vê.`);
      return model;
    }catch(cause){setError(cause.message||'Não foi possível guardar o modelo.');return null;}
    finally{setBusy(false);}
  }
  async function remove(model){
    setBusy(true);setError('');
    try{await api(`/sheet-models/${model.id}`,{method:'DELETE'});setMine(previous=>(previous||[]).filter(item=>item.id!==model.id));setNotice(`Modelo “${model.name}” apagado.`);}
    catch(cause){setError(cause.message||'Não foi possível apagar o modelo.');}
    finally{setBusy(false);setDeleting(null);}
  }
  async function saveRoomModel(event){
    event.preventDefault();
    let name,fields;
    try{name=cleanModelName(saveOwn.name);fields=cleanSheetFields(sheetFields);}
    catch(cause){setError(cause instanceof SheetModelError?cause.message:'Não foi possível montar o modelo.');return;}
    if(await save(name,fields,'room'))setSaveOwn(null);
  }

  async function readFile(event){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    const controller=new AbortController();abort.current=controller;
    setPhase('reading');setError('');setNotice('');setMessage('Abrindo o arquivo…');
    try{
      // O leitor (PDF.js e OCR) é grande; só carrega quando alguém manda um arquivo.
      const {readSheetFile}=await import('./sheetReader.js');
      const read=await readSheetFile(file,{onProgress:setMessage,signal:controller.signal});
      const inferred=inferSheetModel({text:read.text,wordSets:read.wordSets,formFieldNames:read.formFieldNames,fileName:file.name});
      setDraft({name:inferred.title||'Modelo novo',notes:inferred.notes,readings:inferred.readings,fileName:file.name,method:read.method,truncated:read.truncated,
        rows:inferred.fields.map((field,index)=>({key:index,use:true,type:field.type,label:field.label,tab:field.tab,formula:field.formula||'',evidence:field.evidence}))});
      setPhase('review');
    }catch(cause){
      if(cause?.name==='AbortError'){setPhase('idle');return;}
      setError(cause.message||'Não consegui ler o arquivo.');setPhase('idle');
    }finally{if(abort.current===controller)abort.current=null;}
  }
  const editRow=(key,patch)=>setDraft(previous=>({...previous,rows:previous.rows.map(row=>row.key===key?{...row,...patch}:row)}));
  const chosen=useMemo(()=>draft?draft.rows.filter(row=>row.use):[],[draft]);
  // O que vai ser guardado passa pelas mesmas regras do servidor; o motivo da recusa aparece antes de clicar.
  const checked=useMemo(()=>{
    if(!draft)return {fields:null,problem:''};
    try{cleanModelName(draft.name);return {fields:cleanSheetFields(chosen.map(({type,label,tab,formula})=>({type,label,tab,...(type==='formula'?{formula}:{})}))),problem:''};}
    catch(cause){return {fields:null,problem:cause instanceof SheetModelError?cause.message:'Revise os campos.'};}
  },[draft,chosen]);
  async function finish(alsoUse){
    if(!checked.fields)return;
    const model=await save(cleanModelName(draft.name),checked.fields,'file');
    if(!model)return;
    setDraft(null);setPhase('idle');
    if(alsoUse)choose({name:model.name,fields:model.fields},'add');
  }
  function closeReview(){setDraft(null);setPhase('idle');setError('');}

  const list=(items,{own=false}={})=>items.map(item=><li key={item.key||item.id}>
    <div><strong>{item.name}</strong><span>{own?`${plural(item.fields.length,'campo','campos')} · ${SOURCE_LABELS[item.source]||''}`:item.summary}</span></div>
    <div className="system-template-actions">
      <button type="button" className="sheet-tool-btn" onClick={()=>choose(item,'add')}>Somar campos</button>
      {sheetFields.length>0&&<button type="button" className="sheet-tool-btn" onClick={()=>choose(item,'replace')}>Substituir o modelo</button>}
      {own&&(deleting===item.id
        ?<><button type="button" className="sheet-tool-btn is-danger" disabled={busy} onClick={()=>remove(item)}>Apagar mesmo</button><button type="button" className="sheet-tool-btn" onClick={()=>setDeleting(null)}>Manter</button></>
        :<button type="button" className="sheet-tool-btn" aria-label={`Apagar o modelo ${item.name}`} onClick={()=>setDeleting(item.id)}><Trash2 size={15} aria-hidden="true"/></button>)}
    </div>
  </li>);

  return <section className="system-templates sheet-models" aria-label="Modelos de sistema">
    <div className="sheet-models-head">
      <h4>Modelos de sistema</h4>
      {phase==='idle'&&<div className="sheet-models-tools">
        <label className="sheet-tool-btn sheet-models-file" title="PDF, imagem (print) ou TXT. A leitura acontece neste navegador."><FileUp size={16} aria-hidden="true"/>Criar de um arquivo<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,.pdf,.txt,.md" onChange={readFile}/></label>
        {sheetFields.length>0&&!saveOwn&&<button type="button" className="sheet-tool-btn" onClick={()=>{setSaveOwn({name:''});setError('');}}><Save size={16} aria-hidden="true"/>Guardar esta mesa</button>}
      </div>}
    </div>
    <p className="sheet-models-hint">PDF, imagem ou TXT viram um modelo para revisar. Os seus modelos ficam só na sua conta.</p>
    {phase==='reading'&&<div className="sheet-models-progress" role="status"><p>{message}</p><button type="button" className="sheet-tool-btn" onClick={()=>abort.current?.abort()}>Cancelar leitura</button></div>}

    <h5>Meus modelos{mine?` (${mine.length})`:''}</h5>
    {mine===null&&!loadError&&<p role="status" className="sheet-models-empty">Carregando…</p>}
    {loadError&&<p role="alert" className="sheet-models-error">{loadError} <button type="button" className="sheet-tool-btn" onClick={load}>Tentar de novo</button></p>}
    {mine&&!mine.length&&<p className="sheet-models-empty">Nenhum modelo guardado ainda.</p>}
    {mine&&mine.length>0&&<ul className="sheet-models-list">{list(mine,{own:true})}</ul>}

    {saveOwn&&<form className="sheet-models-save" onSubmit={saveRoomModel}>
      <label>Nome do modelo<input name="sheet-model-name" autoComplete="off" value={saveOwn.name} maxLength={SHEET_MODEL_LIMITS.name} required placeholder="Ex.: Minha campanha de Cthulhu…" onChange={event=>setSaveOwn({name:event.target.value})}/></label>
      <button type="submit" className="sheet-tool-btn" disabled={busy}>Guardar nos meus modelos</button>
      <button type="button" className="sheet-tool-btn" onClick={()=>setSaveOwn(null)}>Cancelar</button>
    </form>}

    {phase==='review'&&draft&&<div className="sheet-models-review" role="group" aria-label="Revisar o modelo lido">
      <h5 ref={heading} tabIndex={-1}>Revise o modelo lido</h5>
      <p>De <strong>{draft.fileName}</strong> ({draft.method}) saíram {plural(draft.rows.length,'campo','campos')}. Marque os que quer, corrija nomes, tipos e categorias, e dê um nome ao modelo.{draft.truncated?' Só o começo do arquivo foi lido.':''}</p>
      {draft.notes.map(note=><p key={note} className="sheet-models-note" role="status">{note}</p>)}
      {draft.readings?.length>0&&<details className="sheet-models-raw"><summary>Texto lido do arquivo</summary>{draft.readings.map((reading,index)=><pre key={index} aria-label={`Leitura ${index+1}`}>{reading}</pre>)}</details>}
      <label className="sheet-models-name">Nome do modelo<input name="sheet-model-title" autoComplete="off" value={draft.name} maxLength={SHEET_MODEL_LIMITS.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
      {draft.rows.length>0&&<>
        <div className="sheet-models-bulk" role="group" aria-label="Seleção"><button type="button" className="sheet-tool-btn" onClick={()=>setDraft({...draft,rows:draft.rows.map(row=>({...row,use:true}))})}>Marcar todos</button><button type="button" className="sheet-tool-btn" onClick={()=>setDraft({...draft,rows:draft.rows.map(row=>({...row,use:false}))})}>Desmarcar todos</button><span>{chosen.length} de {draft.rows.length} marcados</span></div>
        <div className="sheet-models-table"><table>
          <caption className="visually-hidden">Campos encontrados no arquivo</caption>
          <thead><tr><th scope="col">Usar</th><th scope="col">Nome do campo</th><th scope="col">Tipo</th><th scope="col">Categoria</th></tr></thead>
          <tbody>{draft.rows.map(row=><tr key={row.key} className={row.use?'':'is-off'}>
            <td><input type="checkbox" checked={row.use} aria-label={`Usar ${row.label}`} onChange={event=>editRow(row.key,{use:event.target.checked})}/></td>
            <td><input aria-label={`Nome do campo ${row.label}`} value={row.label} maxLength={SHEET_MODEL_LIMITS.label} onChange={event=>editRow(row.key,{label:event.target.value})}/>{row.type==='formula'&&<input aria-label={`Fórmula de ${row.label}`} value={row.formula} maxLength={SHEET_MODEL_LIMITS.formula} onChange={event=>editRow(row.key,{formula:event.target.value})}/>}<small>{row.evidence}</small></td>
            <td><select aria-label={`Tipo de ${row.label}`} value={row.type} onChange={event=>editRow(row.key,{type:event.target.value})}>{SHEET_FIELD_TYPES.map(type=><option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></td>
            <td><input aria-label={`Categoria de ${row.label}`} value={row.tab} maxLength={SHEET_MODEL_LIMITS.tab} onChange={event=>editRow(row.key,{tab:event.target.value})}/></td>
          </tr>)}</tbody>
        </table></div>
      </>}
      {checked.problem&&<p role="alert" className="sheet-models-error">{checked.problem}</p>}
      <div className="sheet-models-actions">
        <button type="button" className="sheet-tool-btn" disabled={busy} onClick={closeReview}>Cancelar</button>
        <button type="button" className="sheet-tool-btn" disabled={busy||!checked.fields} onClick={()=>finish(false)}>Guardar nos meus modelos</button>
        <button type="button" className="sheet-tool-btn is-primary" disabled={busy||!checked.fields} onClick={()=>finish(true)}>Guardar e somar à mesa</button>
      </div>
    </div>}

    {error&&<p role="alert" className="sheet-models-error">{error}</p>}
    {notice&&<p role="status" className="sheet-models-notice">{notice}</p>}

    <details className="sheet-models-systems"><summary>Sistemas de RPG ({systemItems.length})</summary>
      <ul className="sheet-models-list">{list(systemItems)}</ul>
    </details>

    {pending&&plan&&<div className="system-confirm" role="group" aria-label={`Confirmar ${pending.name}`}>
      <p role="alert">{pending.mode==='replace'
        ?`Substituir os ${sheetFields.length} campos atuais pelos ${plan.added} de ${pending.name}? O que os jogadores já preencheram não some do servidor, mas deixa de aparecer nas fichas, porque o modelo novo tem campos diferentes. Se quiser manter os valores, escolha Somar campos em vez de Substituir.`
        :plan.added?`Somar ${plural(plan.added,'campo','campos')} de ${pending.name} ao modelo? Campos com o mesmo nome dos que já existem não são repetidos.`:`Todos os campos de ${pending.name} já existem neste modelo.`}</p>
      {systemError&&<p role="alert">{systemError}</p>}
      <button type="button" className="sheet-tool-btn" disabled={!plan.added} onClick={apply}>{pending.mode==='replace'?'Substituir modelo':'Somar campos'}</button>
      <button type="button" className="sheet-tool-btn" onClick={()=>{setPending(null);setSystemError('');}}>Cancelar</button>
    </div>}
  </section>;
}
