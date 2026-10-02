import {useEffect,useRef,useState} from 'react';
import {MapPin,X} from 'lucide-react';
import {trapDialogFocus} from './trapDialogFocus.js';
import {mergePointFields,POINT_FIELDS,pointFields} from './pointConflict.js';
import './PointDetails.css';

const FIELD_LABELS={name:'Nome',description:'Descrição',type:'Tipo'};

export default function PointDetails({point,initialPoint,initialVersion,latestVersion,types,editable,linkedNotes=[],linkedScenes=[],onOpenScene,onCreateScene,onOpenNote,onClose,onSave,saving,error}){
  const dialogRef=useRef(null),titleRef=useRef(null),reviewTitleRef=useRef(null),savePending=useRef(false);
  const [base,setBase]=useState(()=>({fields:pointFields(initialPoint),version:initialVersion}));
  const [draft,setDraft]=useState(base.fields);
  const [saveError,setSaveError]=useState(false);
  const [review,setReview]=useState(null),[choices,setChoices]=useState({});
  const missing=!point,changed=!missing&&latestVersion!==base.version;
  const reviewOutdated=review&&(missing||review.version!==latestVersion);
  const hasEdits=POINT_FIELDS.some(field=>draft[field]!==base.fields[field]);
  const displayPoint=point||initialPoint;
  const type=types.find(item=>item.value===displayPoint.type);
  useEffect(()=>{
    const dialog=dialogRef.current,opener=document.activeElement;
    dialog.showModal();titleRef.current?.focus();
    return()=>{if(dialog.open)dialog.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};
  },[]);
  async function save(){
    if(saving||savePending.current||changed||missing||!draft.name.trim())return;
    savePending.current=true;
    try{
      const result=await onSave(initialPoint.id,{...draft,name:draft.name.trim()},base.version);
      if(result){setSaveError(false);onClose();}else setSaveError(true);
    }finally{savePending.current=false;}
  }
  function canLeave(){return !editable||!hasEdits||window.confirm('Sair deste ponto sem salvar as alterações?');}
  function close(){if(!saving&&!savePending.current&&canLeave())onClose();}
  function startReview(){
    if(missing||saving)return;
    setReview({fields:pointFields(point),version:latestVersion});
    setChoices({});setSaveError(false);
    requestAnimationFrame(()=>reviewTitleRef.current?.focus());
  }
  function applyReview(){
    if(!review||reviewOutdated)return;
    setDraft(mergePointFields(base.fields,draft,review.fields,choices));
    setBase(review);setReview(null);setSaveError(false);
    requestAnimationFrame(()=>titleRef.current?.focus());
  }
  const preview=(field,value)=>field==='type'?types.find(item=>item.value===value)?.label||value:value||'Sem descrição';
  return <dialog ref={dialogRef} className="point-details-overlay" aria-labelledby="point-details-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();close();}}>
    <article className="point-details">
      <header className="point-details-header"><span className="point-details-kicker"><MapPin size={17} aria-hidden="true"/>Ponto de interesse</span><button type="button" onClick={close} disabled={saving} aria-label="Fechar ponto"><X size={20} aria-hidden="true"/></button></header>
      <div className="point-details-body">
        <span className="point-details-type" style={{'--point-color':type?.color||'#d9b777'}}>{type?.label||displayPoint.type}</span>
        {editable&&<h2 id="point-details-title" className="point-details-edit-title">{displayPoint.name}</h2>}
        {missing&&<p className="point-details-notice" role="alert">{editable?'Este ponto foi excluído da mesa. Seu rascunho continua aqui para você copiar; ele não pode ser salvo neste ponto.':'Este ponto não está mais disponível nesta visão. O mestre pode ter coberto a área ou removido o ponto.'}</p>}
        {editable&&changed&&!review&&<section className="point-details-notice" aria-label="Ponto atualizado">
          <p role="status">Este ponto mudou em outra tela. Seu rascunho foi mantido.</p>
          <button type="button" disabled={saving} onClick={startReview}>Revisar alterações</button>
        </section>}
        {editable&&review?<section className="point-details-review" aria-labelledby="point-review-title">
          <h3 id="point-review-title" ref={reviewTitleRef} tabIndex={-1}>Escolha o que manter</h3>
          <p>Revise nome, descrição e tipo. Aplicar as escolhas altera só seu rascunho; depois clique em Salvar alterações.</p>
          {reviewOutdated&&<div className="point-details-notice"><p role="alert">O ponto mudou novamente. Atualize a revisão antes de aplicar as escolhas.</p>{!missing&&<button type="button" onClick={startReview}>Atualizar revisão</button>}</div>}
          {POINT_FIELDS.filter(field=>draft[field]!==review.fields[field]).map(field=>{
            const edited=draft[field]!==base.fields[field];
            const choice=choices[field]||'mine';
            return <fieldset key={field} className="point-details-field-review">
              <legend>{FIELD_LABELS[field]}</legend>
              {edited?<><dl><dt>Meu rascunho</dt><dd>{preview(field,draft[field])}</dd><dt>Na mesa</dt><dd>{preview(field,review.fields[field])}</dd></dl><div className="point-details-choices">
                <label><input type="radio" name={`point-review-${field}`} checked={choice==='mine'} onChange={()=>setChoices(current=>({...current,[field]:'mine'}))}/>Manter meu rascunho</label>
                <label><input type="radio" name={`point-review-${field}`} checked={choice==='latest'} onChange={()=>setChoices(current=>({...current,[field]:'latest'}))}/>Usar versão da mesa</label>
              </div></>:<><p className="point-details-preview">{preview(field,review.fields[field])}</p><p className="point-details-automatic">Você não editou este campo; a versão da mesa será usada.</p></>}
            </fieldset>;
          })}
          {POINT_FIELDS.every(field=>draft[field]===review.fields[field])&&<p>O conteúdo é igual nas duas versões. A posição ou outros dados do ponto mudaram.</p>}
          <div className="point-details-review-actions"><button type="button" onClick={()=>{setReview(null);requestAnimationFrame(()=>titleRef.current?.focus());}}>Voltar ao rascunho</button><button type="button" disabled={!!reviewOutdated} onClick={applyReview}>Aplicar escolhas</button></div>
        </section>:editable?<>
          <label htmlFor="point-details-name">Nome</label><input ref={titleRef} id="point-details-name" name="pointName" autoComplete="off" value={draft.name} maxLength={120} disabled={saving} onChange={event=>{setDraft(value=>({...value,name:event.target.value}));setSaveError(false);}}/>
          <label htmlFor="point-details-description">Descrição</label><textarea id="point-details-description" name="pointDescription" autoComplete="off" value={draft.description} maxLength={4000} rows={7} disabled={saving} onChange={event=>{setDraft(value=>({...value,description:event.target.value}));setSaveError(false);}}/>
          <label htmlFor="point-details-type-select">Tipo</label><select id="point-details-type-select" name="pointType" value={draft.type} disabled={saving} onChange={event=>{setDraft(value=>({...value,type:event.target.value}));setSaveError(false);}}>{types.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </>:<><h2 id="point-details-title" ref={titleRef} tabIndex={-1}>{displayPoint.name}</h2><p className="point-details-description">{displayPoint.description||'Este local ainda não tem descrição.'}</p></>}
        {!!linkedNotes.length&&<section className="point-details-notes" aria-label="Notas vinculadas"><h3>Notas vinculadas</h3>{linkedNotes.map(note=><button key={`${note.scope}:${note.id}`} type="button" disabled={saving} aria-label={`Abrir nota ${note.title} de ${note.scope==='@master'?'mestre':note.scope}`} onClick={()=>{if(canLeave())onOpenNote(note);}}>{note.title}</button>)}</section>}
        {(!missing&&editable||!!linkedScenes.length)&&<section className="point-details-notes" aria-label="Cenas vinculadas"><h3>Cenas da campanha</h3>{linkedScenes.map(scene=><button key={scene.id} type="button" disabled={saving} onClick={()=>{if(canLeave())onOpenScene(scene);}}>Abrir cena: {scene.title}</button>)}{editable&&!missing&&<button type="button" disabled={saving} onClick={()=>{if(canLeave())onCreateScene();}}>Criar cena neste ponto</button>}</section>}
      </div>
      {editable&&<footer className="point-details-footer">{saveError&&<p role="alert">{error||'Não foi possível salvar o ponto. Seu rascunho foi mantido.'}</p>}<button type="button" onClick={close} disabled={saving}>Cancelar</button><button type="button" className="point-details-save" disabled={saving||missing||changed||!!review||!draft.name.trim()} onClick={save}>{saving?'Salvando…':'Salvar alterações'}</button></footer>}
    </article>
  </dialog>;
}
