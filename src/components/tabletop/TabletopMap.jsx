import React,{useEffect,useRef,useState} from 'react';
import {Maximize2,SlidersHorizontal,ZoomIn,ZoomOut} from 'lucide-react';
import TabletopScene from './TabletopScene.jsx';
import {api} from '../../api.js';
import {useMapImport} from './useMapImport.js';
import ModelPreviewPanel from './ModelPreviewPanel.jsx';
import ObjectSelectionPanel from './ObjectSelectionPanel.jsx';
import ObjectReferencePanel from './ObjectReferencePanel.jsx';
import {expandSelection} from '../../shared/tabletopSelection.js';
import {nativeMapAsset,createMapAssetBlob} from './mapAssetTransfer.js';
import {mapAssetPlacement} from '../../shared/mapAssetTransfer.js';
import {readQualityPreference,writeQualityPreference} from './qualityPolicy.js';
import {readCameraPreference,writeCameraPreference} from './cameraPreferences.js';
import {LIGHTING_PRESETS} from '../../shared/tabletopLighting.js';
import './TabletopMap.css';
const supported=/\.(glb|gltf|obj|fbx|png|jpe?g|webp)$/i;
const model=/\.(glb|gltf|obj|fbx)$/i;
const formatSize=bytes=>bytes<1048576?`${(bytes/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})} KB`:`${(bytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;

export default function TabletopMap({room,userId,mutate,editable,viewMode,selected,setSelected,destinations,onOpenReference}){
  const objects=room.state.mapObjects||[],[mode,setMode]=useState('translate'),[files,setFiles]=useState([]),[main,setMain]=useState(''),[kind,setKind]=useState('terrain'),[status,setStatus]=useState(''),[error,setError]=useState(''),[toolsOpen,setToolsOpen]=useState(false),[linkBusy,setLinkBusy]=useState(false);
  const actions=useRef(null),pending=useRef(null),timer=useRef(null),alive=useRef(true),inflight=useRef(false),permission=useRef(editable),currentRoom=useRef(room);
  const [saving,setSaving]=useState(false),[conflict,setConflict]=useState(null);
  const selectionFeedback=useRef(null),errorFeedback=useRef(null),conflictFeedback=useRef(null),focusAfterAction=useRef(false),focusedProblem=useRef(null);
  if(room.revision>=currentRoom.current.revision)currentRoom.current=room;
  const importFeedback=useRef(null),importFiles=useRef(null),importButton=useRef(null),previewOpenButton=useRef(null),previewPose=useRef(null),previewCurrent=useRef(null),selectionBeforePreview=useRef(null),previewFeedback=useRef(null),previewFocused=useRef(null),returnPreviewFocus=useRef(false),toolsToggle=useRef(null);
  const [preview,setPreview]=useState(null),[previewInfo,setPreviewInfo]=useState(null),[previewMode,setPreviewMode]=useState('translate'),[previewError,setPreviewError]=useState(''),[previewCommitted,setPreviewCommitted]=useState(false);
  const activePreview=preview?.roomId===room.id?preview:null;previewCurrent.current=activePreview;
  const imports=useMapImport({roomId:room.id,userId,viewMode,editable,onConfirmed:receipt=>{setPreviewCommitted(true);setPreview(null);previewPose.current=null;setPreviewInfo(null);setSelected([receipt.objectId]);setFiles([]);setMain('');},refresh:()=>mutate('',undefined,'GET')});
  const {job,busy,blocked}=imports;
  const [qualityMode,setQualityMode]=useState(()=>readQualityPreference(userId,room.id)),[qualityInfo,setQualityInfo]=useState(null),[qualitySaved,setQualitySaved]=useState(true);
  const [motionMode,setMotionMode]=useState('system'),[systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [sceneReady,setSceneReady]=useState(false);
  const cameraPose=useRef(undefined),[cameraSaved,setCameraSaved]=useState(true),[lightingBusy,setLightingBusy]=useState(false),[lightingError,setLightingError]=useState('');
  if(cameraPose.current===undefined)cameraPose.current=readCameraPreference(userId,room.id);
  const rememberCamera=pose=>{cameraPose.current=pose;const stored=writeCameraPreference(userId,room.id,pose);if(alive.current&&!stored)setCameraSaved(false);};
  async function changeLighting(preset){
    if(!editable||lightingBusy||saving||linkBusy||conflict||activePreview||!sceneReady||preset===room.state.tabletopLighting)return;
    setLightingBusy(true);setLightingError('');const result=await mutate('/tabletop-lighting',{preset,version:currentRoom.current.tabletopLightingVersion});
    if(alive.current){setLightingBusy(false);if(result)setStatus('Iluminação atualizada para todos.');else setLightingError('Não foi possível atualizar a luz. Confira a iluminação atual e tente novamente.');}
  }
  const sceneAvailability=ready=>{setSceneReady(ready);if(!ready)setToolsOpen(false);};
  permission.current=editable;
  const requestPath=path=>`${path}?mapViewMode=${viewMode}`;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);pending.current=null;};},[]);
  useEffect(()=>{if(!editable){pending.current=null;clearTimeout(timer.current);setSaving(false);}},[editable]);
  useEffect(()=>{setSelected(previous=>{const next=expandSelection(objects,previous.filter(id=>objects.some(item=>item.id===id)));return next.length===previous.length&&next.every((id,i)=>id===previous[i])?previous:next;});},[objects]);
  useEffect(()=>{if(!saving&&!conflict)return;const protect=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[saving,conflict]);
  useEffect(()=>{setPreview(null);setPreviewInfo(null);previewPose.current=null;setPreviewCommitted(false);},[room.id]);
  useEffect(()=>{
    if(saving)return;const problem=conflict||error;
    if(problem&&focusedProblem.current!==problem){if(!toolsOpen){setToolsOpen(true);return;}(conflict?conflictFeedback:errorFeedback).current?.focus();focusedProblem.current=problem;}
    else if(focusAfterAction.current){focusAfterAction.current=false;selectionFeedback.current?.focus();}
    if(!problem)focusedProblem.current=null;
  },[saving,conflict,error,selected,toolsOpen]);
  useEffect(()=>{
    if(!toolsOpen)return;
    if(activePreview&&previewInfo?.id===activePreview.id&&['ready','failed'].includes(previewInfo.phase)&&(previewFocused.current!==activePreview.id||previewInfo.phase==='failed')){previewFeedback.current?.focus();previewFocused.current=activePreview.id;}
    if(!activePreview&&returnPreviewFocus.current){returnPreviewFocus.current=false;(previewOpenButton.current||importFiles.current||toolsToggle.current)?.focus();}
  },[activePreview?.id,previewInfo?.phase,toolsOpen]);
  useEffect(()=>{if(sceneReady&&['failed','uncertain'].includes(job?.phase))setToolsOpen(true);},[job?.phase,sceneReady]);
  useEffect(()=>{
    if(!toolsOpen)return;
    if(['failed','uncertain'].includes(job?.phase))importFeedback.current?.focus();
    else if(job?.phase==='cancelled') (importButton.current||importFiles.current)?.focus();
    else if(job?.phase==='confirmed')importFiles.current?.focus();
  },[job?.phase,toolsOpen]);
  const flush=async()=>{
    timer.current=null;
    if(inflight.current||!alive.current||!permission.current)return;
    const next=pending.current;if(!next)return;pending.current=null;inflight.current=true;
    try{const confirmed=await api(requestPath(`/rooms/${room.id}/map-object-actions`),{method:'POST',data:{action:'transform',ids:next.patches.map(item=>item.id),version:next.version,patches:next.patches}});if(alive.current){
      if(confirmed.revision>=currentRoom.current.revision)currentRoom.current=confirmed;
      if(pending.current?.version===next.version)pending.current.version=confirmed.mapObjectsVersion;
      for(const {id,...patch} of next.patches)actions.current?.({type:'confirm-transform',id,patch,revision:confirmed.revision});setError('');
    }}catch(e){if(alive.current){
      const draft=pending.current?.patches||next.patches;pending.current=null;setConflict({patches:draft,message:e.message});setError('');
      for(const {id,...patch} of draft)actions.current?.({type:'failed-transform',id,patch});await mutate('',undefined,'GET');
    }}finally{inflight.current=false;if(alive.current){if(pending.current)timer.current=setTimeout(flush,150);else setSaving(false);}}
  };
  const stream=(patches,expectedVersion)=>{
    if(!sceneReady||!editable||conflict)return;
    const version=expectedVersion||pending.current?.version||currentRoom.current.mapObjectsVersion;pending.current={version,patches};setSaving(true);
    if(!timer.current&&!inflight.current)timer.current=setTimeout(flush,180);
  };
  const transform=(id,patch,expectedVersion)=>{
    if(!sceneReady||!editable||conflict)return;const item=currentRoom.current.state.mapObjects.find(item=>item.id===id);if(!item||item.locked)return;
    const pose={position:item.position,rotation:item.rotation,scale:item.scale,...patch};actions.current?.({type:'local-transform',id,patch:pose});stream([{id,...pose}],expectedVersion);
  };
  function select(id,multiple=false){
    if(activePreview||saving||linkBusy||conflict)return;
    setSelected(previous=>{if(!id)return multiple?previous:[];const ids=expandSelection(objects,[id]);return multiple?ids.every(id=>previous.includes(id))?previous.filter(id=>!ids.includes(id)):[...new Set([...previous,...ids])]:ids;});
  }
  async function objectAction(action,extra={},ids=selected){
    if(!editable||!sceneReady||saving||linkBusy||activePreview)return false;setSaving(true);setError('');
    try{const confirmed=await api(requestPath(`/rooms/${room.id}/map-object-actions`),{method:'POST',data:{version:currentRoom.current.mapObjectsVersion,action,ids,...extra}});if(alive.current){if(confirmed.revision>=currentRoom.current.revision)currentRoom.current=confirmed;setSelected(confirmed.mapAction.selectionIds);setConflict(null);focusAfterAction.current=true;await mutate('',undefined,'GET');}return true;
    }catch(error){if(alive.current){setError(error.status?error.message:`${error.message} Confira a lista antes de repetir a ação.`);await mutate('',undefined,'GET');}return false;}finally{if(alive.current)setSaving(false);}
  }
  const applyDelta=delta=>objectAction('transform',{delta:{position:(delta.position||[0,0,0]).map(Number),rotation:(delta.rotation||[0,0,0]).map(value=>Number(value)*Math.PI/180),scale:Number(delta.scale??1)}});
  async function referenceAction(action,extra,version,objectId){
    if(!editable||saving||linkBusy||conflict||activePreview||!sceneReady)return false;
    setLinkBusy(true);setError('');
    try{
      const confirmed=await api(requestPath(`/rooms/${room.id}/map-object-actions`),{method:'POST',data:{action,ids:[objectId],version,...extra}});
      if(!alive.current)return false;if(confirmed.revision>=currentRoom.current.revision)currentRoom.current=confirmed;
      await mutate('',undefined,'GET');if(!alive.current)return false;setStatus(action==='link'?'Vínculo adicionado.':'Vínculo retirado.');return true;
    }catch(error){if(alive.current){setError(error.message);await mutate('',undefined,'GET');}return false;}finally{if(alive.current)setLinkBusy(false);}
  }
  async function openReference(objectId,referenceId){
    if(saving||linkBusy||conflict||activePreview||!sceneReady)return;setLinkBusy(true);setError('');
    const result=await mutate(requestPath(`/map-objects/${objectId}/references/${referenceId}`),undefined,'GET');
    if(!alive.current)return;setLinkBusy(false);if(result?.referenceTarget)onOpenReference(result);else setError('O destino não está mais disponível nesta visão.');
  }
  function choose(event){
    const list=Array.from(event.target.files||[]);setFiles(list);setError('');setPreviewError('');imports.clear();
    const first=list.find(f=>model.test(f.name))||list.find(f=>supported.test(f.name));setMain(first?(first.webkitRelativePath||first.name):'');
    event.target.value='';
  }
  function openPreview(){
    if(!files.length||!main||!sceneReady||blocked||!editable)return;
    try{
      const bundle=nativeMapAsset(files,main,kind);createMapAssetBlob(bundle);
      const pose=mapAssetPlacement();previewPose.current=pose;selectionBeforePreview.current=selected;
      setSelected([]);setPreviewError('');imports.clear();setPreviewCommitted(false);setPreviewMode('translate');
      const draft={id:crypto.randomUUID(),roomId:room.id,bundle,...pose};setPreviewInfo({id:draft.id,phase:'loading'});setPreview(draft);
    }catch(error){setPreviewError(error.message);}
  }
  function changePreview(id,pose,final=true){
    if(previewCurrent.current?.id!==id)return;previewPose.current=mapAssetPlacement(pose);
    if(final)setPreview(current=>current?.id===id?{...current,...previewPose.current}:current);
  }
  function reportPreview(info){
    if(previewCurrent.current?.id!==info.id)return;
    setPreviewInfo(current=>current?.id===info.id&&current.phase===info.phase&&current.message===info.message&&current.dimensions?.join(',')===info.dimensions?.join(',')?current:info);
  }
  function cancelPreview(){
    if(blocked)return;returnPreviewFocus.current=true;setPreviewCommitted(false);setPreview(null);setPreviewInfo(null);previewPose.current=null;setSelected(selectionBeforePreview.current);
  }
  function upload(){if(activePreview&&previewInfo?.phase==='ready'&&files.length&&main&&sceneReady&&!blocked&&editable){setError('');void imports.start(files,main,kind,mapAssetPlacement(previewPose.current));}}
  return <section className="tabletop-map" aria-label="Mapa tridimensional">
    <aside id="tabletop-tools-panel" className="tabletop-tools" aria-label="Ferramentas do mapa" hidden={!toolsOpen}>
      <h2>Mesa 3D</h2>{!editable&&<p>Explore a cena. Mestre e ADM cuidam dos objetos.</p>}
      <div className="tabletop-quality">
        <label htmlFor="tabletop-quality">Qualidade</label>
        <select id="tabletop-quality" name="tabletopQuality" autoComplete="off" value={qualityMode} onChange={event=>{const next=event.target.value;setQualityMode(next);setQualitySaved(writeQualityPreference(userId,room.id,next));}}><option value="auto">Automática</option><option value="original">Original</option><option value="light">Leve</option></select>
        <p role="status">{!sceneReady?'Qualidade aplicada ao reabrir o 3D.':qualityInfo?`${qualityMode==='auto'?'Automática · ':''}${qualityInfo.quality==='light'?'Leve':'Original'}${qualityInfo.pending?' · carregando…':''}`:'Preparando qualidade…'}</p>
        {sceneReady&&qualityInfo?.loading&&<p aria-live="polite" aria-atomic="true">{qualityInfo.loading.loaded} de {objects.length} objetos carregados.{qualityInfo.loading.pending>0?` Carregando ${qualityInfo.loading.pending}…`:''}{qualityInfo.loading.deferred>0?` ${qualityInfo.loading.deferred} aguardam aproximação ou seleção.`:''}</p>}
        {sceneReady&&qualityInfo?.loading?.failed>0&&<div><p role="alert">{qualityInfo.loading.failed===1?'1 objeto não pôde carregar.':`${qualityInfo.loading.failed} objetos não puderam carregar.`} A mesa continua salva.</p><button type="button" onClick={()=>actions.current?.('retry-loads')}>Tentar carregar novamente</button></div>}
        {!qualitySaved&&<small role="status">A escolha vale nesta sessão; o navegador não permitiu salvá-la.</small>}
        <label className="tabletop-motion"><input type="checkbox" name="tabletopMotion" checked={motionMode==='smooth'||motionMode==='system'&&!systemReduced} onChange={event=>setMotionMode(event.target.checked?'smooth':'instant')}/>Movimento suave</label>
        {systemReduced&&motionMode==='system'&&<small>Seu aparelho prefere movimento reduzido. Você pode ativar a suavização nesta sessão.</small>}
      </div>
      {editable&&<div className="tabletop-import">
        <label>Importar como<select name="modelKind" autoComplete="off" value={kind} disabled={blocked||!sceneReady||!!activePreview} onChange={e=>setKind(e.target.value)}><option value="terrain">Mapa / terreno</option><option value="structure">Estrutura / objeto</option></select></label>
        <label className="tabletop-file">{files.length?`${files.length} arquivo${files.length>1?'s':''} selecionado${files.length>1?'s':''} · trocar`:'Selecionar arquivos'}<input ref={importFiles} name="modelFiles" type="file" multiple disabled={blocked||!sceneReady||!!activePreview} accept=".glb,.gltf,.obj,.mtl,.fbx,.bin,.png,.jpg,.jpeg,.webp" onChange={choose}/></label>
        <small>GLB, GLTF, OBJ ou FBX, com os arquivos de apoio. Até 50 MB.</small>
        {!!files.length&&<><label>Arquivo principal<select name="modelMainFile" autoComplete="off" value={main} disabled={blocked||!sceneReady||!!activePreview} onChange={e=>setMain(e.target.value)}>{files.filter(f=>supported.test(f.name)).map(f=><option key={f.name} value={f.webkitRelativePath||f.name}>{f.name}</option>)}</select></label><button ref={previewOpenButton} onClick={openPreview} disabled={blocked||!main||!sceneReady||!!activePreview||saving||!!conflict}>Ver prévia</button></>}
        {previewError&&<p className="tabletop-import-error" role="alert">{previewError}</p>}
      </div>}
      {activePreview&&<ModelPreviewPanel key={activePreview.id} preview={activePreview} info={previewInfo} mode={previewMode} onMode={setPreviewMode} onChange={changePreview} onCancel={cancelPreview} onReset={()=>changePreview(activePreview.id,mapAssetPlacement())} onRetry={()=>{const draft={...activePreview,id:crypto.randomUUID()};setPreviewInfo({id:draft.id,phase:'loading'});setPreview(draft);}} onConfirm={upload} confirmRef={importButton} feedbackRef={previewFeedback} disabled={blocked||!sceneReady} blocked={blocked} editable={editable}/>}
      {job&&<section className={`tabletop-import-progress ${['failed','uncertain'].includes(job.phase)?'has-error':''}`} aria-label="Andamento da importação" tabIndex={-1} ref={importFeedback}>
        <h3>Importação</h3><p role={['failed','uncertain'].includes(job.phase)?'alert':'status'}>{job.message}</p>
        {busy&&<div className="tabletop-import-meter" role="progressbar" aria-label={job.message} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress?Math.floor(100*job.progress.loaded/job.progress.total):undefined} aria-valuetext={job.progress?`${Math.floor(100*job.progress.loaded/job.progress.total)}% enviados`:undefined}><span style={job.progress?{width:`${Math.min(100,100*job.progress.loaded/job.progress.total)}%`}:undefined}/></div>}
        {job.progress&&<small>{Math.floor(100*job.progress.loaded/job.progress.total)}% · {formatSize(job.progress.loaded)} de {formatSize(job.progress.total)} enviados</small>}
        {job.remembered===false&&<small>A confirmação pendente vale só nesta janela; o navegador não permitiu guardá-la.</small>}
        {!!job.warnings?.length&&<small>{job.warnings.join(' ')}</small>}
        {busy&&<button type="button" disabled={['cancelling','reconciling'].includes(job.phase)} onClick={imports.cancel}>Cancelar importação</button>}
        {job.phase==='uncertain'&&<><small>{job.detail}</small><button type="button" onClick={imports.check}>Verificar resultado</button>{job.canDismiss&&<><small>A confirmação antiga não está mais disponível. Confira na lista se o modelo foi adicionado.</small><button type="button" onClick={imports.dismiss}>Já conferi a lista</button></>}</>}
      </section>}
      {conflict&&<section ref={conflictFeedback} tabIndex={-1} className="tabletop-conflict" aria-label="Ajuste não confirmado"><h3>Ajuste não confirmado</h3><p role="alert">{conflict.message}</p><p>Seu ajuste foi guardado nesta janela. Confira as posições atuais antes de aplicar.</p><details><summary>Ver meu ajuste</summary>{conflict.patches.map(patch=><p key={patch.id}>{objects.find(item=>item.id===patch.id)?.name||'Objeto removido'} · posição {patch.position.map(value=>value.toFixed(2)).join(', ')} · rotação {patch.rotation.map(value=>(value*180/Math.PI).toFixed(1)).join(', ')}° · tamanho {patch.scale.map(value=>value.toFixed(2)).join(', ')}</p>)}</details><button type="button" disabled={saving} onClick={()=>setConflict(null)}>Usar posições da mesa</button><button type="button" disabled={saving||!editable||!sceneReady||conflict.patches.some(patch=>!objects.some(item=>item.id===patch.id&&!item.locked))} onClick={()=>objectAction('transform',{patches:conflict.patches},conflict.patches.map(patch=>patch.id))}>Aplicar meu ajuste</button></section>}
      {saving&&<p role="status">Salvando objetos…</p>}
      <section className="tabletop-view-settings" aria-label="Iluminação e câmera">
        <h3>Iluminação da mesa</h3>
        {editable?<label>Luz para todos<select name="tabletopLighting" autoComplete="off" value={room.state.tabletopLighting||'default'} disabled={lightingBusy||saving||linkBusy||!!conflict||!!activePreview||!sceneReady} onChange={event=>changeLighting(event.target.value)}>{Object.entries(LIGHTING_PRESETS).map(([key,preset])=><option key={key} value={key}>{preset.label}</option>)}</select></label>:<p>{LIGHTING_PRESETS[room.state.tabletopLighting||'default']?.label} · definida pelo mestre</p>}
        {lightingBusy&&<p role="status">Salvando iluminação…</p>}
        {lightingError&&<p className="tabletop-lighting-error" role="alert">{lightingError}</p>}
        <h3>Sua câmera</h3>
        <div className="tabletop-view-presets" role="group" aria-label="Vistas da câmera">{[['top','Vista superior'],['diagonal','Vista diagonal'],['front','Vista frontal'],['reset-camera','Restaurar câmera']].map(([action,label])=><button type="button" key={action} disabled={!sceneReady||!!activePreview} onClick={()=>actions.current?.(action)}>{label}</button>)}</div>
        {!cameraSaved&&<p role="status">Sua câmera fica guardada só nesta visita. O navegador não conseguiu salvar essa preferência.</p>}
      </section>
      <ObjectSelectionPanel feedbackRef={selectionFeedback} version={room.mapObjectsVersion} objects={objects} groups={room.state.mapGroups||[]} selected={selected} onSelect={select} onClear={()=>setSelected([])} onAll={()=>setSelected(objects.map(item=>item.id))} editable={editable} disabled={!!activePreview||saving||linkBusy||!!conflict||!sceneReady} mode={mode} onMode={setMode} onFocus={()=>actions.current?.('fit')} onTransform={transform} onDelta={applyDelta} onAction={objectAction}/>
      <ObjectReferencePanel objects={objects} selected={selected} destinations={destinations} editable={editable} disabled={!!activePreview||saving||linkBusy||!!conflict||!sceneReady} version={room.mapObjectsVersion} onAction={referenceAction} onOpen={openReference}/>
    </aside>
    <div className="tabletop-stage">
      <div className="tabletop-camera" role="group" aria-label="Câmera do mapa"><button ref={toolsToggle} type="button" className="tabletop-tools-toggle" aria-expanded={toolsOpen} aria-controls="tabletop-tools-panel" onClick={()=>setToolsOpen(open=>!open)}><SlidersHorizontal size={16} aria-hidden="true"/><span>{toolsOpen?'Fechar ferramentas':busy?'Ferramentas · importando':job?.phase==='uncertain'?'Ferramentas · verificar importação':'Ferramentas'}</span></button><span className="tabletop-camera-sep" aria-hidden="true"/>{[['fit','Enquadrar',Maximize2],['in','Aproximar',ZoomIn],['out','Afastar',ZoomOut]].map(([action,label,Icon])=><button key={action} disabled={!sceneReady} aria-label={label} title={label} onClick={()=>actions.current?.(action)}><Icon size={16} aria-hidden="true"/><span className="tabletop-camera-label">{label}</span></button>)}</div>
      <TabletopScene roomId={room.id} revision={room.revision} objects={objects} selected={selected} editable={editable&&!conflict&&!linkBusy} mode={activePreview?previewMode:mode} onSelect={select} onTransform={stream} onStatus={setStatus} actions={actions} qualityMode={qualityMode} onQuality={setQualityInfo} motionMode={motionMode} onMotionPreference={setSystemReduced} onAvailability={sceneAvailability} preview={activePreview} previewBlocked={blocked} previewCommitted={previewCommitted} onPreviewState={reportPreview} onPreviewTransform={changePreview} lighting={room.state.tabletopLighting||'default'} initialCameraPose={cameraPose.current} onCameraPose={rememberCamera}/>
      {!objects.length&&!activePreview&&sceneReady&&<div className="tabletop-empty" role="note"><h3>A mesa está vazia</h3><p>{editable?'Importe modelos 3D e mapas em Ferramentas para montar a cena. Os jogadores veem o que você colocar aqui.':'O mestre ainda não colocou objetos na mesa.'}</p>{editable&&!toolsOpen&&<button type="button" onClick={()=>setToolsOpen(true)}>Abrir ferramentas</button>}</div>}
      {activePreview&&<p className="tabletop-preview-badge">Prévia — só você · {activePreview.bundle.main.split('/').pop()}</p>}
      <p id="tabletop-keyboard-help" className="tabletop-help">Arraste para girar · botão direito para deslocar · roda ou pinça para zoom.<span className="sr-only"> Clique para selecionar; Shift + clique adiciona à seleção. Com foco no mapa: setas giram, Shift + setas deslocam, +/− ajustam zoom e Home enquadra. Marque vários objetos em Ferramentas.</span></p>
      {(status||error)&&<div ref={errorFeedback} tabIndex={-1} className={`tabletop-notice ${error?'has-error':''}`} role={error?'alert':'status'}>{error||status}</div>}
    </div>
  </section>;
}
