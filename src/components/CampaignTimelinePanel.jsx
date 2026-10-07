import {useCallback,useEffect,useRef,useState} from 'react';
import {Plus,X} from 'lucide-react';
import {api} from '../api.js';
import {TIMELINE_KINDS,formatTimelineDate,isTimelineDate} from '../shared/campaignTimeline.js';
import {TIMELINE_FIELDS,TIMELINE_FIELD_LABELS,makeTimelineDraft,mergeTimelineFields,sameTimelineField,timelineFields,validTimelineDraft} from '../shared/timelineDraft.js';
import {trapDialogFocus} from './trapDialogFocus.js';
import CampaignTimeline from './CampaignTimeline.jsx';
import './CampaignPages.css';
import './CampaignScenes.css';
import './CampaignTimelinePanel.css';

const draftKey=(roomId,userId)=>`grimorio-timeline-draft-v1:${roomId}:${userId}`;
function readDraft(key){try{return validTimelineDraft(JSON.parse(localStorage.getItem(key)));}catch{return null;}}
function writeDraft(key,record){try{if(record)localStorage.setItem(key,JSON.stringify(record));else localStorage.removeItem(key);return true;}catch{return false;}}
const cursorOf=next=>next?`${next.date},${next.createdAt},${next.id}`:null;
const dateTime=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

function preview(field,value,{pointNames,sceneNames}){
  if(field==='date')return formatTimelineDate(value);
  if(field==='kind')return TIMELINE_KINDS[value]||value;
  if(field==='visibility')return value==='table'?'Jogadores podem ler':'Só mestres';
  if(field==='pointIds')return value.map(id=>pointNames.get(id)||'Ponto indisponível').join(', ')||'Nenhum ponto';
  if(field==='sceneIds')return value.map(id=>sceneNames.get(id)||'Cena indisponível').join(', ')||'Nenhuma cena';
  return value||'Sem texto';
}

function EntryEditor({record,onChange,latest,points,scenes,saving,failure,storageProblem,onSave,onClose,onKeep}){
  const dialog=useRef(null),titleInput=useRef(null),reviewTitle=useRef(null),discardTitle=useRef(null);
  const [review,setReview]=useState(null),[choices,setChoices]=useState({}),[discard,setDiscard]=useState(false);
  const {fields,base}=record,changed=!!latest&&latest.version!==base.version,isNew=base.version===0;
  const dirty=isNew||TIMELINE_FIELDS.some(field=>!sameTimelineField(field,base.fields[field],fields[field]));
  const names={pointNames:new Map(points.map(point=>[point.id,point.name])),sceneNames:new Map(scenes.map(scene=>[scene.id,scene.title]))};
  const reviewOutdated=review&&(!latest||review.version!==latest.version);
  useEffect(()=>{const element=dialog.current,opener=document.activeElement;element.showModal();titleInput.current?.focus({preventScroll:true});return()=>{if(element.open)element.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};},[]);
  useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const edit=(field,value)=>onChange({...record,fields:{...fields,[field]:value}});
  const toggle=(field,id,on)=>edit(field,on?[...fields[field],id]:fields[field].filter(item=>item!==id));
  const close=()=>{if(saving)return;if(dirty){setDiscard(true);requestAnimationFrame(()=>discardTitle.current?.focus());}else onClose();};
  const missingLinks=[...fields.pointIds.filter(id=>!names.pointNames.has(id)),...fields.sceneIds.filter(id=>!names.sceneNames.has(id))];
  const submit=event=>{event.preventDefault();if(saving||review||changed||!isTimelineDate(fields.date)||!fields.title.trim())return;onSave({...fields,title:fields.title.trim()});};
  return <dialog ref={dialog} className="scene-editor-dialog" aria-labelledby="timeline-editor-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();close();}}><form className="scene-editor-sheet" onSubmit={submit}>
    <header><span className="campaign-kicker">Rascunho do diário</span><h2 id="timeline-editor-title">{isNew?'Novo registro':'Editar registro'}</h2><button type="button" aria-label="Fechar editor do registro" disabled={saving} onClick={close}><X size={20} aria-hidden="true"/></button></header>
    <div className="scene-editor-content">
      {changed&&!review&&<div className="scene-warning"><p role="status">O registro mudou em outra janela. Seu rascunho foi mantido.</p><button type="button" disabled={saving} onClick={()=>{setReview({version:latest.version,fields:timelineFields(latest)});setChoices({});requestAnimationFrame(()=>reviewTitle.current?.focus());}}>Revisar registro</button></div>}
      {!isNew&&!latest&&<p className="scene-warning" role="alert">Este registro não está mais disponível nesta lista. Seu rascunho continua aqui; salvar pode falhar.</p>}
      {review?<section aria-label="Revisão do registro" className="scene-review"><h3 ref={reviewTitle} tabIndex={-1}>Escolha o que manter</h3><p>Aplicar as escolhas muda somente o rascunho. Depois, salve o registro.</p>
        {reviewOutdated&&<p className="scene-warning" role="alert">O registro mudou novamente. Volte ao rascunho e atualize a revisão.</p>}
        {TIMELINE_FIELDS.filter(field=>!sameTimelineField(field,fields[field],review.fields[field])).map(field=><fieldset key={field}><legend>{TIMELINE_FIELD_LABELS[field]}</legend>{!sameTimelineField(field,base.fields[field],fields[field])?<><dl><dt>Meu rascunho</dt><dd>{preview(field,fields[field],names)}</dd><dt>Na mesa</dt><dd>{preview(field,review.fields[field],names)}</dd></dl><label><input type="radio" name={`timeline-review-${field}`} checked={(choices[field]||'mine')==='mine'} onChange={()=>setChoices(current=>({...current,[field]:'mine'}))}/>Manter meu rascunho</label><label><input type="radio" name={`timeline-review-${field}`} checked={choices[field]==='latest'} onChange={()=>setChoices(current=>({...current,[field]:'latest'}))}/>Usar versão da mesa</label></>:<p>Você não editou este campo; será usada a versão da mesa: {preview(field,review.fields[field],names)}</p>}</fieldset>)}
        <div className="scene-actions"><button type="button" onClick={()=>{setReview(null);requestAnimationFrame(()=>titleInput.current?.focus());}}>Voltar ao rascunho</button><button type="button" disabled={!!reviewOutdated} onClick={()=>{onChange({...record,base:review,fields:mergeTimelineFields(base.fields,fields,review.fields,choices)});setReview(null);requestAnimationFrame(()=>titleInput.current?.focus());}}>Aplicar escolhas</button></div>
      </section>:<>
        <label>Título<input ref={titleInput} name="timeline-title" autoComplete="off" required maxLength={120} value={fields.title} disabled={saving} onChange={event=>edit('title',event.target.value)} placeholder="Ex.: A guilda fecha o porto"/></label>
        <div className="timeline-editor-row">
          <label>Data do acontecimento<input type="date" name="timeline-date" autoComplete="off" required value={fields.date} disabled={saving} onChange={event=>edit('date',event.target.value)}/></label>
          <label>Tipo<select name="timeline-kind" autoComplete="off" value={fields.kind} disabled={saving} onChange={event=>edit('kind',event.target.value)}>{Object.entries(TIMELINE_KINDS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>Texto<textarea name="timeline-body" autoComplete="off" maxLength={10000} rows={6} value={fields.body} disabled={saving} onChange={event=>edit('body',event.target.value)} placeholder="O que aconteceu, quem decidiu e o que muda daqui em diante…"/></label>
        <label>Quem pode ler<select name="timeline-visibility" autoComplete="off" value={fields.visibility} disabled={saving} onChange={event=>edit('visibility',event.target.value)}><option value="master">Só mestres</option><option value="table">Jogadores podem ler</option></select></label>
        <p>Registros novos começam reservados. Um vínculo nunca libera o ponto ou a cena para quem ainda não os vê.</p>
        <fieldset className="scene-point-choice"><legend>Pontos vinculados · até 20</legend><div>{points.map(point=><label key={point.id}><input type="checkbox" name={`timeline-point-${point.id}`} checked={fields.pointIds.includes(point.id)} disabled={saving||fields.pointIds.length>=20&&!fields.pointIds.includes(point.id)} onChange={event=>toggle('pointIds',point.id,event.target.checked)}/>{point.name}</label>)}{fields.pointIds.filter(id=>!names.pointNames.has(id)).map(id=><label key={id}><input type="checkbox" name={`timeline-point-${id}`} checked disabled={saving} onChange={()=>toggle('pointIds',id,false)}/>Ponto indisponível · remova este vínculo</label>)}{!points.length&&!fields.pointIds.length&&<p>Não há pontos neste mapa.</p>}</div></fieldset>
        <fieldset className="scene-point-choice"><legend>Cenas vinculadas · até 20</legend><div>{scenes.map(scene=><label key={scene.id}><input type="checkbox" name={`timeline-scene-${scene.id}`} checked={fields.sceneIds.includes(scene.id)} disabled={saving||fields.sceneIds.length>=20&&!fields.sceneIds.includes(scene.id)} onChange={event=>toggle('sceneIds',scene.id,event.target.checked)}/>{scene.title}</label>)}{fields.sceneIds.filter(id=>!names.sceneNames.has(id)).map(id=><label key={id}><input type="checkbox" name={`timeline-scene-${id}`} checked disabled={saving} onChange={()=>toggle('sceneIds',id,false)}/>Cena indisponível · remova este vínculo</label>)}{!scenes.length&&!fields.sceneIds.length&&<p>Não há cenas criadas.</p>}</div></fieldset>
        {missingLinks.length>0&&<p className="scene-warning" role="alert">Remova os vínculos indisponíveis antes de salvar.</p>}
      </>}
      {storageProblem&&<p className="scene-warning" role="alert">O navegador não conseguiu guardar o rascunho. Copie o texto antes de fechar a página.</p>}
      {failure&&<p className="scene-warning" role="alert">{failure}</p>}
      {discard&&<section className="scene-warning" aria-label="Confirmar fechamento"><h3 ref={discardTitle} tabIndex={-1}>Fechar sem publicar?</h3><p>Você pode manter o rascunho neste navegador para continuar depois, ou descartá-lo.</p><div className="scene-actions"><button type="button" disabled={storageProblem} onClick={onKeep}>Fechar e manter rascunho</button><button type="button" onClick={onClose}>Descartar rascunho e fechar</button><button type="button" onClick={()=>{setDiscard(false);titleInput.current?.focus();}}>Continuar editando</button></div></section>}
    </div>
    <footer><span>{saving?'Salvando…':dirty?'Rascunho · ainda não publicado':'Sem alterações'}</span><button type="button" disabled={saving} onClick={close}>Cancelar</button><button type="submit" disabled={saving||!!review||changed||!dirty||missingLinks.length>0||!fields.title.trim()||!isTimelineDate(fields.date)}>{saving?'Salvando…':'Salvar registro'}</button></footer>
  </form></dialog>;
}

function VersionHistory({versions,current,saving,failure,onRestore,onClose}){
  const dialog=useRef(null);
  useEffect(()=>{const element=dialog.current,opener=document.activeElement;element.showModal();return()=>{if(element.open)element.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};},[]);
  return <dialog ref={dialog} className="scene-editor-dialog" aria-labelledby="timeline-versions-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();onClose();}}><div className="scene-editor-sheet">
    <header><span className="campaign-kicker">Histórico do registro</span><h2 id="timeline-versions-title">{current.title}</h2><button type="button" aria-label="Fechar histórico" onClick={onClose}><X size={20} aria-hidden="true"/></button></header>
    <div className="scene-editor-content"><p>Restaurar cria uma nova versão com o conteúdo antigo. O histórico nunca é reescrito.</p>
      {failure&&<p className="scene-warning" role="alert">{failure}</p>}
      <ol className="timeline-versions" aria-label="Versões do registro">{versions.map(version=><li key={version.version}>
        <div><strong>Versão {version.version}{version.version===current.version?' · atual':''}</strong><span>{dateTime.format(version.createdAt)} · @{version.editor}</span></div>
        <p>{version.title} · {formatTimelineDate(version.date)} · {TIMELINE_KINDS[version.kind]} · {version.visibility==='table'?'Jogadores podem ler':'Só mestres'}{version.archived?' · Arquivado':''}</p>
        {version.body&&<p className="timeline-version-body">{version.body.length>240?version.body.slice(0,240)+'…':version.body}</p>}
        {version.version!==current.version&&<button type="button" disabled={saving} onClick={()=>onRestore(version.version)}>Restaurar a versão {version.version}</button>}
      </li>)}</ol>
    </div>
    <footer><button type="button" onClick={onClose}>Fechar</button></footer>
  </div></dialog>;
}

export default function CampaignTimelinePanel({roomId,userId,viewMode,editable,revision,points,scenes,connection,onOpenPoint,onOpenScene}){
  const [kind,setKind]=useState('all'),[archived,setArchived]=useState(false),[page,setPage]=useState(null),[firstPage,setFirstPage]=useState(true);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const key=draftKey(roomId,userId);
  const [editor,setEditor]=useState(()=>editable?readDraft(key):null),[editorOpen,setEditorOpen]=useState(true),[saving,setSaving]=useState(false),[failure,setFailure]=useState(''),[storageProblem,setStorageProblem]=useState(false);
  const [history,setHistory]=useState(null);
  const controller=useRef(null),pageRevision=useRef(null),firstRef=useRef(true);
  const sceneList=scenes.filter(scene=>!scene.archived);
  const path=useCallback((before,known)=>{
    const params=new URLSearchParams({mapViewMode:viewMode,kind});
    if(archived)params.set('archived','1');
    if(before){params.set('before',before);params.set('revision',known);}
    return `/rooms/${roomId}/timeline?${params}`;
  },[roomId,viewMode,kind,archived]);
  const load=useCallback(async({before=null,known=null}={})=>{
    controller.current?.abort();const request=new AbortController();controller.current=request;
    setLoading(true);setError('');
    try{
      const result=await api(path(before,known),{signal:request.signal});
      if(request.signal.aborted)return;
      pageRevision.current=result.revision;firstRef.current=!before;setFirstPage(!before);setPage(result);
    }catch(cause){
      if(request.signal.aborted)return;
      // A stale cursor means the list changed between pages; start again from the newest entries.
      if(cause.status===409&&before){setNotice('A linha do tempo mudou. Voltamos aos registros mais recentes.');load();return;}
      setError(cause.message);
    }finally{if(controller.current===request)setLoading(false);}
  },[path]);
  useEffect(()=>{load();return()=>controller.current?.abort();},[load]);
  // The room snapshot carries only a digest; any change in what this person can read triggers a reload.
  useEffect(()=>{if(pageRevision.current!==null&&revision&&revision!==pageRevision.current){if(!firstRef.current)setNotice('A linha do tempo mudou. Voltamos aos registros mais recentes.');load();}},[revision,load]);
  useEffect(()=>{if(!editable)return;setStorageProblem(!writeDraft(key,editor));},[editor,key,editable]);
  const retry=()=>load();
  const first=()=>{setNotice('');load();};
  const earlier=()=>{if(page?.next)load({before:cursorOf(page.next),known:page.revision});};
  const latest=editor?[...(page?.entries||[])].find(entry=>entry.id===editor.id)||null:null;
  const [knownEntry,setKnownEntry]=useState(null);
  const current=latest||(knownEntry?.id===editor?.id?knownEntry:null);

  async function save(fields){
    if(!editor||saving)return;
    setSaving(true);setFailure('');
    try{
      const isNew=editor.base.version===0;
      const result=await api(`/rooms/${roomId}/timeline${isNew?'':'/'+editor.id}?mapViewMode=${viewMode}`,{method:isNew?'POST':'PATCH',data:isNew?{id:editor.id,...fields}:{expectedVersion:editor.base.version,...fields}});
      setEditor(null);setNotice(isNew?'Registro criado. Ele fica reservado até você publicá-lo.':'Registro salvo.');setKnownEntry(null);await load();
      return result;
    }catch(cause){
      if(cause.status===409&&cause.details?.current){setKnownEntry(cause.details.current);setFailure('O registro mudou em outra janela. Revise o rascunho antes de salvar.');}
      else setFailure(cause.message);
    }finally{setSaving(false);}
  }
  async function archive(entry,value){
    setSaving(true);setNotice('');setError('');
    try{await api(`/rooms/${roomId}/timeline/${entry.id}?mapViewMode=${viewMode}`,{method:'PATCH',data:{expectedVersion:entry.version,archived:value}});setNotice(value?'Registro arquivado. Jogadores não o veem mais.':'Registro restaurado.');await load();}
    catch(cause){setError(cause.message);if(cause.status===409)load();}
    finally{setSaving(false);}
  }
  async function openHistory(entry){
    setFailure('');
    try{const result=await api(`/rooms/${roomId}/timeline/${entry.id}/versions?mapViewMode=${viewMode}`);setHistory({entry,versions:result.versions});}
    catch(cause){setError(cause.message);}
  }
  async function restore(version){
    setSaving(true);setFailure('');
    try{
      const result=await api(`/rooms/${roomId}/timeline/${history.entry.id}/restore?mapViewMode=${viewMode}`,{method:'POST',data:{version,expectedVersion:history.entry.version}});
      setHistory(null);setNotice(`Versão ${version} restaurada como a versão ${result.entry.version}.`);await load();
    }catch(cause){setFailure(cause.status===409?'O registro mudou enquanto o histórico estava aberto. Feche e abra de novo.':cause.message);}
    finally{setSaving(false);}
  }
  const actions=editable?entry=><>
    <button type="button" disabled={saving||!!editor} onClick={()=>{setEditor(makeTimelineDraft(entry));setEditorOpen(true);setFailure('');}}>Editar</button>
    <button type="button" disabled={saving} onClick={()=>openHistory(entry)}>Versões</button>
    <button type="button" disabled={saving||connection!=='online'} onClick={()=>archive(entry,!entry.archived)}>{entry.archived?'Restaurar':'Arquivar'}</button>
  </>:undefined;
  return <div className="timeline-panel">
    {editable&&<div className="timeline-toolbar">
      <button type="button" disabled={saving||!!editor||connection!=='online'} onClick={()=>{setEditor(makeTimelineDraft(null));setEditorOpen(true);setFailure('');}}><Plus size={16} aria-hidden="true"/>Novo registro</button>
      <div role="group" aria-label="Visualização dos registros"><button type="button" aria-pressed={!archived} onClick={()=>setArchived(false)}>Ativos</button><button type="button" aria-pressed={archived} onClick={()=>setArchived(true)}>Arquivados</button></div>
    </div>}
    {editor&&!editorOpen&&<section className="scene-warning" aria-label="Rascunho pendente"><p>Há um rascunho neste navegador que ainda não foi publicado.</p><div className="scene-actions"><button type="button" onClick={()=>setEditorOpen(true)}>Retomar rascunho</button></div></section>}
    {notice&&<p className="scene-notice" role="status">{notice}</p>}
    <CampaignTimeline entries={page?.entries||[]} points={points} scenes={scenes} kind={kind} onKindChange={value=>{setKind(value);setNotice('');}} pageKey={`${kind}:${archived}:${firstPage?'first':cursorOf(page?.entries?.[0]&&{date:page.entries[0].date,createdAt:page.entries[0].createdAt,id:page.entries[0].id})}`} hasMore={!!page?.hasMore} isFirstPage={firstPage} loading={loading} error={error} connection={connection} onRetry={retry} onEarlier={earlier} onFirst={first} onOpenPoint={onOpenPoint} onOpenScene={onOpenScene} renderActions={actions} emptyHint={editable?(archived?'Registros arquivados aparecem aqui e podem ser restaurados.':'Crie o primeiro registro para começar o diário da campanha.'):undefined}/>
    {editor&&editorOpen&&<EntryEditor key={editor.id} record={editor} onChange={setEditor} latest={current} points={points} scenes={sceneList} saving={saving} failure={failure} storageProblem={storageProblem} onSave={save} onClose={()=>{setEditor(null);setFailure('');setKnownEntry(null);}} onKeep={()=>setEditorOpen(false)}/>}
    {history&&<VersionHistory versions={history.versions} current={history.entry} saving={saving} failure={failure} onRestore={restore} onClose={()=>{setHistory(null);setFailure('');}}/>}
  </div>;
}
