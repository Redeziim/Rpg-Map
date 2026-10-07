import {loadMapAsset,disposeModel} from './loadMapAsset.js';
import {Frustum,Matrix4,Sphere,Vector3} from 'three';
import {createModelLOD,updateModelLOD} from './modelLOD.js';

// The scene renderer consumes this public model stream; HTTP is supplied at the
// environment boundary so the same loader can run with real packets in tests.
export function createSceneStream({fetchBundle,onModel=()=>{},onRemove=()=>{},onError=()=>{},onProgress=()=>{}}){
  const models=new Map(),active=new Map(),failed=new Map();let state={objects:[],selected:[]},disposed=false,scheduled=false;
  const frustum=new Frustum(),matrix=new Matrix4(),sphere=new Sphere(),point=new Vector3();
  function candidates(){
    if(!state.camera||state.paused)return [];
    state.camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(state.camera.projectionMatrix,state.camera.matrixWorldInverse));
    const selected=new Set(state.selected),ranked=[];
    for(const item of state.objects){
      point.fromArray(item.position);const distance=point.distanceTo(state.camera.position),radius=30*Math.max(...item.scale);
      sphere.center.copy(point);sphere.radius=radius;
      const visible=frustum.intersectsSphere(sphere),chosen=selected.has(item.id);
      if(chosen||visible||distance<radius*4)ranked.push({item,priority:chosen?0:visible?1:2,distance});
    }
    return ranked.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
  }
  const getSnapshot=()=>{const wanted=candidates(),ids=new Set(wanted.map(({item})=>item.id));return {active:active.size,pending:wanted.filter(({item})=>!models.has(item.id)&&!failed.has(item.id)).length,deferred:state.objects.filter(item=>!ids.has(item.id)&&!models.has(item.id)).length,loaded:models.size,failed:failed.size};};
  function schedule(){if(disposed||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;pump();});}
  function remove(id,model){models.delete(id);onRemove(id,model);disposeModel(model);}
  function pump(){
    if(disposed)return;
    for(const {item} of candidates()){
      if(active.size>=2-(state.reserve||0))break;if(models.has(item.id)||active.has(item.id)||failed.has(item.id))continue;
      const controller=new AbortController(),quality=state.quality,signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]),token={controller,item};active.set(item.id,token);
      fetchBundle(item,signal).then(async bundle=>{
        // Yield between downloads and parsing so input/camera events get a turn.
        await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();
        const model=await loadMapAsset(bundle,{quality,signal});
        return createModelLOD(model,{signal});
      }).then(model=>{
        const current=state.objects.find(object=>object.id===item.id);
        if(disposed||signal.aborted||!current||current.assetId!==item.assetId){disposeModel(model);return;}
        model.userData.mapId=item.id;model.userData.streamingAssetId=item.assetId;
        model.position.fromArray(current.position);model.rotation.fromArray([...current.rotation,'XYZ']);model.scale.fromArray(current.scale);
        updateModelLOD(model,state.camera,{selected:state.selected.includes(item.id),qualityMode:state.qualityMode});
        models.set(item.id,model);onModel(item.id,model);
      }).catch(error=>{if(!disposed&&!controller.signal.aborted){failed.set(item.id,item.assetId);onError(item,error);}}).finally(()=>{if(active.get(item.id)===token)active.delete(item.id);if(!disposed){schedule();onProgress(getSnapshot());}});
    }
    onProgress(getSnapshot());
  }
  function refreshLevels(camera=state.camera,selected=state.selected,qualityMode=state.qualityMode){
    if(disposed||!camera)return false;let changed=false;
    for(const [id,model]of models)changed=updateModelLOD(model,camera,{selected:selected.includes(id),qualityMode})||changed;
    return changed;
  }
  return {models,getSnapshot,refreshLevels,update(next){
    if(disposed)return;const qualityChanged=state.quality!==next.quality;state=next;
    const objects=new Map(state.objects.map(item=>[item.id,item])),wanted=candidates(),wantedIds=new Set(wanted.map(({item})=>item.id));
    for(const [id,model]of models){const item=objects.get(id),distance=item?point.fromArray(item.position).distanceTo(state.camera.position):Infinity,radius=item?30*Math.max(...item.scale):0;
      if(qualityChanged||!item||item.assetId!==model.userData.streamingAssetId||!state.paused&&!wantedIds.has(id)&&distance>radius*8)remove(id,model);
    }
    for(const [id,token]of active)if(qualityChanged||!wantedIds.has(id)||objects.get(id)?.assetId!==token.item.assetId)token.controller.abort();
    for(const [id,assetId]of failed)if(qualityChanged||objects.get(id)?.assetId!==assetId)failed.delete(id);
    // Reserve a slot for the private preview. Stronger selection priorities can
    // also replace a lower-priority request; aborted parsers still occupy slots
    // until their promises settle, keeping physical concurrency bounded.
    const capacity=2-(state.reserve||0),rank=new Map(wanted.map((entry,index)=>[entry.item.id,index]));
    const running=[...active.values()].filter(token=>!token.controller.signal.aborted).sort((a,b)=>(rank.get(a.item.id)??Infinity)-(rank.get(b.item.id)??Infinity));
    for(const token of running.slice(capacity))token.controller.abort();
    const nextSelected=wanted.find(entry=>entry.priority===0&&!models.has(entry.item.id)&&!active.has(entry.item.id)&&!failed.has(entry.item.id));
    if(nextSelected&&running.length>=capacity&&capacity>0){const worst=running.at(-1);if(!state.selected.includes(worst.item.id))worst.controller.abort();}
    refreshLevels();schedule();onProgress(getSnapshot());
  },retry(){failed.clear();schedule();},dispose(){
    if(disposed)return;disposed=true;for(const token of active.values())token.controller.abort();for(const [id,model]of models)remove(id,model);failed.clear();
  }};
}
