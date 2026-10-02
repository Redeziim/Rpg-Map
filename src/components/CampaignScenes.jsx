import {useEffect,useRef,useState} from 'react';
import {FileText,Plus,X} from 'lucide-react';
import {SCENE_FIELDS,sceneFields,sameSceneField,mergeSceneFields} from '../shared/campaignScenes.js';
import {draftTabId,loadDraftWindows,saveDraftWindows} from './noteDraftStore.js';
import {trapDialogFocus} from './trapDialogFocus.js';
import './CampaignScenes.css';

const LABELS={title:'Título',body:'Texto',pointIds:'Pontos vinculados',visibility:'Visibilidade'};
function validDraft(record){
  const validFields=value=>value&&typeof value.title==='string'&&value.title.length<=120&&typeof value.body==='string'&&value.body.length<=10000&&Array.isArray(value.pointIds)&&value.pointIds.length<=30&&value.pointIds.every(id=>typeof id==='string'&&id.length<=100)&&['master','table'].includes(value.visibility);
  return record&&typeof record.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(record.id)&&Number.isSafeInteger(record.base?.version)&&record.base.version>=0&&validFields(record.fields)&&validFields(record.base.fields)?record:null;
}
function makeDraft(scene,pointId){
  const fields=sceneFields(scene);if(pointId)fields.pointIds=[pointId];
  return {id:scene?.id||crypto.randomUUID(),base:{version:scene?.version||0,fields:sceneFields(scene)},fields};
}
function downloadDraft(record){
  const blob=new Blob([JSON.stringify({format:'grimorio-campaign-scene-draft',version:1,scene:record},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='rascunho-cena.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function SceneEditor({record,onChange,latest,points,editable,saving,error,storageProblem,onSave,onClose,onKeep}){
  const dialog=useRef(null),editorTitle=useRef(null),nameInput=useRef(null),reviewTitle=useRef(null),discardTitle=useRef(null),pending=useRef(false);
  const [review,setReview]=useState(null),[choices,setChoices]=useState({}),[discard,setDiscard]=useState(false),[failure,setFailure]=useState('');
  const {fields,base}=record,changed=!!latest&&latest.version!==base.version,missing=base.version>0&&!latest;
  const dirty=!base.version||SCENE_FIELDS.some(field=>!sameSceneField(field,base.fields[field],fields[field]));
  const reviewOutdated=review&&(!latest||review.version!==latest.version);
  const pointNames=new Map(points.map(point=>[point.id,point.name]));
  useEffect(()=>{const element=dialog.current,opener=document.activeElement;element.showModal();const initialFocus=window.matchMedia('(max-width:760px)').matches?editorTitle:nameInput;initialFocus.current?.focus({preventScroll:true});return()=>{if(element.open)element.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};},[]);
  useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const edit=(field,value)=>{onChange({...record,fields:{...fields,[field]:value}});setFailure('');};
  const close=()=>{if(saving||pending.current)return;if(dirty){setDiscard(true);requestAnimationFrame(()=>discardTitle.current?.focus());}else onClose();};
  async function save(event){
    event.preventDefault();if(!editable||saving||pending.current||changed||missing||review)return;
    if(fields.pointIds.some(id=>!pointNames.has(id))){setFailure('Remova os vínculos com pontos indisponíveis antes de salvar.');return;}
    pending.current=true;setFailure('');
    try{if(!await onSave(record.id,{...fields,title:fields.title.trim()},base.version))setFailure('Não foi possível salvar. Seu rascunho continua aqui; confira a conexão e a versão da mesa.');}finally{pending.current=false;}
  }
  const preview=(field,value)=>field==='pointIds'?value.map(id=>pointNames.get(id)||'Ponto indisponível').join(', ')||'Sem pontos':field==='visibility'?value==='table'?'Compartilhada com a mesa':'Só mestres':value||'Sem texto';
  return <dialog ref={dialog} className="scene-editor-dialog" aria-labelledby="scene-editor-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();close();}}><form className="scene-editor-sheet" onSubmit={save}>
    <header><span className="campaign-kicker">Rascunho de campanha</span><h2 ref={editorTitle} tabIndex={-1} id="scene-editor-title">{base.version?'Editar cena':'Nova cena'}</h2><button type="button" aria-label="Fechar editor da cena" disabled={saving} onClick={close}><X size={20} aria-hidden="true"/></button></header>
    <div className="scene-editor-content">
      {!editable&&<p className="scene-warning" role="alert">Você não pode salvar cenas nesta visão. Seu rascunho foi preservado e pode ser copiado ou baixado.</p>}
      {missing&&<p className="scene-warning" role="alert">A cena não está mais disponível. Seu rascunho continua aqui, mas não pode recriá-la ao salvar.</p>}
      {latest?.archived&&<p className="scene-warning">Esta cena está arquivada. Salvar altera o texto sem restaurá-la.</p>}
      {changed&&!review&&<div className="scene-warning"><p role="status">A cena mudou em outra tela. Seu rascunho foi mantido.</p><button type="button" disabled={saving} onClick={()=>{setReview({version:latest.version,fields:sceneFields(latest)});setChoices({});requestAnimationFrame(()=>reviewTitle.current?.focus());}}>Revisar cena</button></div>}
      {review?<section aria-label="Revisão da cena" className="scene-review"><h3 ref={reviewTitle} tabIndex={-1}>Escolha o que manter</h3><p>Aplicar as escolhas muda somente o rascunho. Depois, salve a cena.</p>
        {reviewOutdated&&<p className="scene-warning" role="alert">A cena mudou novamente. Volte ao rascunho e atualize a revisão.</p>}
        {SCENE_FIELDS.filter(field=>!sameSceneField(field,fields[field],review.fields[field])).map(field=><fieldset key={field}><legend>{LABELS[field]}</legend>{!sameSceneField(field,base.fields[field],fields[field])?<><dl><dt>Meu rascunho</dt><dd>{preview(field,fields[field])}</dd><dt>Na mesa</dt><dd>{preview(field,review.fields[field])}</dd></dl><label><input type="radio" name={`scene-review-${field}`} checked={(choices[field]||'mine')==='mine'} onChange={()=>setChoices(current=>({...current,[field]:'mine'}))}/>Manter meu rascunho</label><label><input type="radio" name={`scene-review-${field}`} checked={choices[field]==='latest'} onChange={()=>setChoices(current=>({...current,[field]:'latest'}))}/>Usar versão da mesa</label></>:<p>Você não editou este campo; será usada a versão da mesa: {preview(field,review.fields[field])}</p>}</fieldset>)}
        <div className="scene-actions"><button type="button" onClick={()=>{setReview(null);requestAnimationFrame(()=>nameInput.current?.focus());}}>Voltar ao rascunho</button><button type="button" disabled={!!reviewOutdated} onClick={()=>{onChange({...record,base:review,fields:mergeSceneFields(base.fields,fields,review.fields,choices)});setReview(null);requestAnimationFrame(()=>nameInput.current?.focus());}}>Aplicar escolhas</button></div>
      </section>:<>
        <label>Título<input ref={nameInput} name="scene-title" autoComplete="off" required maxLength={120} value={fields.title} readOnly={!editable} disabled={saving} onChange={event=>edit('title',event.target.value)} placeholder="Ex.: Chegada ao porto…"/></label>
        <label>Texto da cena<textarea name="scene-body" autoComplete="off" maxLength={10000} rows={8} value={fields.body} readOnly={!editable} disabled={saving} onChange={event=>edit('body',event.target.value)} placeholder="Prepare o encontro, os detalhes e as pistas…"/></label>
        <label>Visibilidade<select name="scene-visibility" autoComplete="off" value={fields.visibility} disabled={saving||!editable} onChange={event=>edit('visibility',event.target.value)}><option value="master">Só mestres</option><option value="table">Compartilhada com a mesa</option></select></label>
        <p>Cenas compartilhadas com pontos aparecem para jogadores quando pelo menos um desses pontos está revelado. Sem pontos, ficam disponíveis para toda a mesa.</p>
        <fieldset className="scene-point-choice"><legend>Pontos vinculados · até 30</legend><div>{points.map(point=><label key={point.id}><input type="checkbox" name={`scene-point-${point.id}`} checked={fields.pointIds.includes(point.id)} disabled={saving||!editable||fields.pointIds.length>=30&&!fields.pointIds.includes(point.id)} onChange={event=>edit('pointIds',event.target.checked?[...fields.pointIds,point.id]:fields.pointIds.filter(id=>id!==point.id))}/>{point.name}</label>)}{fields.pointIds.filter(id=>!pointNames.has(id)).map(id=><label key={id}><input type="checkbox" name={`scene-point-${id}`} checked disabled={saving||!editable} onChange={()=>edit('pointIds',fields.pointIds.filter(item=>item!==id))}/>Ponto indisponível · remova este vínculo</label>)}{!points.length&&!fields.pointIds.length&&<p>Não há pontos disponíveis neste mapa.</p>}</div></fieldset>
      </>}
      {storageProblem&&<p className="scene-warning" role="alert">O navegador não conseguiu guardar o rascunho. Baixe uma cópia antes de fechar a página.</p>}
      {failure&&<p className="scene-warning" role="alert">{error||failure}</p>}
      {discard&&<section className="scene-warning" aria-label="Confirmar fechamento"><h3 ref={discardTitle} tabIndex={-1}>Fechar sem publicar?</h3><p>Você pode manter o rascunho neste navegador para continuar depois, ou descartá-lo.</p><div className="scene-actions"><button type="button" disabled={storageProblem} onClick={onKeep}>Fechar e manter rascunho</button><button type="button" onClick={onClose}>Descartar rascunho e fechar</button><button type="button" onClick={()=>{setDiscard(false);nameInput.current?.focus();}}>Continuar editando</button></div></section>}
    </div>
    <footer><span>{saving?'Salvando…':dirty?'Rascunho · ainda não publicado':'Sem alterações'}</span><button type="button" onClick={()=>downloadDraft(record)}>Baixar cópia</button><button type="button" disabled={saving} onClick={close}>Cancelar</button><button type="submit" disabled={saving||!editable||missing||changed||!!review||!dirty}>{saving?'Salvando…':'Salvar cena'}</button></footer>
  </form></dialog>;
}

export default function CampaignScenes({roomId,userId,scenes,points,editable,request,onRequestHandled,onOpenPoint,saving,error,onSave,onArchive}){
  const [tabId]=useState(draftTabId),key=`grimorio-scenes-draft-v1:${roomId}:${userId}`,localKey=`${key}:${tabId}`;
  const [local]=useState(()=>{try{return JSON.parse(localStorage.getItem(localKey))||{};}catch{return {};}});
  const [editor,setEditor]=useState(()=>validDraft(local.windows?.[0])),[ready,setReady]=useState(false),[storageProblem,setStorageProblem]=useState(false);
  const [editorOpen,setEditorOpen]=useState(true);
  const [selectedId,setSelectedId]=useState(null),[archived,setArchived]=useState(false),[notice,setNotice]=useState(''),[undoId,setUndoId]=useState(null);
  const saveQueue=useRef(Promise.resolve()),requestSeen=useRef(null);
  useEffect(()=>{let active=true;loadDraftWindows(key,tabId).then(record=>{if(active&&record?.updatedAt>=Number(local.updatedAt||0))setEditor(validDraft(record.windows?.[0]));}).catch(()=>{}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[key,tabId]);
  useEffect(()=>{if(!ready)return;let active=true;const record={windows:editor?[editor]:[],updatedAt:Date.now()};let localSaved=false;try{localStorage.setItem(localKey,JSON.stringify(record));localSaved=true;}catch{}setStorageProblem(!localSaved);saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveDraftWindows(key,tabId,record.windows,record.updatedAt)).then(()=>{if(active)setStorageProblem(false);},()=>{if(active)setStorageProblem(!localSaved);});return()=>{active=false;};},[editor,ready,key,tabId,localKey]);
  useEffect(()=>{if(!editor||!storageProblem)return;const warn=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[editor,storageProblem]);
  useEffect(()=>{if(!ready||!request||requestSeen.current===request.token)return;requestSeen.current=request.token;if(request.create&&editable){if(editor)setNotice('Há um rascunho aberto. Salve ou feche antes de criar outra cena.');else setEditor(makeDraft(null,request.pointId));}else if(request.id){setSelectedId(request.id);setArchived(false);}onRequestHandled();},[ready,request?.token]);
  const matches=scenes.filter(scene=>!!scene.archived===archived),selected=matches.find(scene=>scene.id===selectedId)||(!selectedId?matches[0]:null);
  const latest=editor?scenes.find(scene=>scene.id===editor.id):null,undoScene=scenes.find(scene=>scene.id===undoId&&scene.archived),pointNames=new Map(points.map(point=>[point.id,point.name]));
  function openEditor(scene){if(!editor)setEditor(makeDraft(scene));else if(scene?.id!==editor.id)setNotice('Retome ou feche o rascunho existente antes de editar outra cena.');setEditorOpen(true);}
  async function save(id,fields,version){const result=await onSave(id,fields,version);if(result){setEditor(null);setSelectedId(id);setNotice('Cena salva na mesa.');}return result;}
  async function archive(scene,value){const result=await onArchive(scene,value);if(result){setNotice(value?'Cena arquivada. Ela não aparece mais nos pontos.':'Cena restaurada.');if(value)setUndoId(scene.id);else{setUndoId(null);setArchived(false);setSelectedId(scene.id);}}}
  return <main className="campaign-page scenes-page">
    <header className="campaign-page-heading"><span className="campaign-kicker">Arquivo da campanha</span><h2>Cenas</h2><p>{editable?'Prepare os encontros e ligue cada cena aos locais do mapa.':'Leia as cenas que o mestre compartilhou com a mesa.'}</p></header>
    {notice&&<p className="scene-notice" role="status">{notice}</p>}{undoScene&&editable&&<button type="button" className="scene-undo" disabled={saving} onClick={()=>archive(undoScene,false)}>Restaurar cena arquivada: {undoScene.title}</button>}
    {!ready&&<p role="status">Preparando rascunhos…</p>}
    {ready&&editor&&!editorOpen&&<section className="scene-warning" aria-label="Rascunho pendente"><p>Há um rascunho neste navegador que ainda não foi publicado.</p>{storageProblem&&<p role="alert">Não foi possível guardar a cópia local. Baixe uma cópia antes de sair.</p>}<div className="scene-actions"><button type="button" onClick={()=>setEditorOpen(true)}>Retomar rascunho</button><button type="button" onClick={()=>downloadDraft(editor)}>Baixar cópia do rascunho</button></div></section>}
    <div className="scene-archive-layout"><aside aria-label="Arquivo de cenas" className="scene-index">
      {editable&&<button type="button" disabled={!ready||saving} onClick={()=>openEditor()}><Plus size={16} aria-hidden="true"/>Nova cena</button>}
      {editable&&<div className="scene-actions" role="group" aria-label="Visualização do arquivo"><button type="button" aria-pressed={!archived} onClick={()=>{setArchived(false);setSelectedId(null);}}>Ativas</button><button type="button" aria-pressed={archived} onClick={()=>{setArchived(true);setSelectedId(null);}}>Arquivadas</button></div>}
      {matches.length?<ul>{matches.map(scene=><li key={scene.id}><button type="button" aria-current={selected?.id===scene.id?'true':undefined} onClick={()=>setSelectedId(scene.id)}><FileText size={17} aria-hidden="true"/><span>{scene.title}{editable&&<small>{scene.visibility==='master'?'Só mestres':'Compartilhada com a mesa'}</small>}</span></button></li>)}</ul>:<p>{editable?archived?'Nenhuma cena arquivada.':'Crie a primeira cena da campanha.':'Nenhuma cena disponível nesta visão.'}</p>}
    </aside>
    <section className="scene-reader" aria-label="Leitura da cena">{selected?<>
      <span className="campaign-kicker">{selected.archived?'Arquivada':selected.visibility==='master'?'Só mestres':'Compartilhada com a mesa'}</span><h3>{selected.title}</h3><p className="scene-body">{selected.body||'Esta cena ainda não tem texto.'}</p>
      {!!selected.pointIds.length&&<section className="scene-place-links" aria-label="Locais desta cena"><h4>Locais no mapa</h4>{selected.pointIds.map(id=>pointNames.has(id)?<button key={id} type="button" onClick={()=>onOpenPoint(id)}>Abrir ponto: {pointNames.get(id)}</button>:<p key={id}>Ponto indisponível. Edite a cena para retirar este vínculo.</p>)}</section>}
      {editable&&<div className="scene-actions"><button type="button" disabled={!ready||saving} onClick={()=>openEditor(selected)}>Editar cena</button><button type="button" disabled={saving} onClick={()=>archive(selected,!selected.archived)}>{selected.archived?'Restaurar cena':'Arquivar cena'}</button></div>}
    </>:<p>{selectedId?'Esta cena não está disponível nesta visão do arquivo.':'Selecione uma cena para ler.'}</p>}</section></div>
    {ready&&editor&&editorOpen&&<SceneEditor key={editor.id} record={editor} onChange={setEditor} latest={latest} points={points} editable={editable} saving={saving} error={error} storageProblem={storageProblem} onSave={save} onClose={()=>{setEditor(null);setEditorOpen(true);}} onKeep={()=>setEditorOpen(false)}/>}
  </main>;
}
