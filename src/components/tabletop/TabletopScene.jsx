import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {fetchMapAsset} from './mapAssetTransfer.js';
import {disposeModel} from './loadMapAsset.js';
import {createSceneStream} from './sceneStreaming.js';
import {loadModelPreview} from './loadModelPreview.js';
import {mapAssetPlacement} from '../../shared/mapAssetTransfer.js';
import {createQualityController} from './qualityPolicy.js';
import {modelQualityStats} from './modelQuality.js';
import {createRemoteMotion} from './remoteMotion.js';
import {createWebGLRecovery} from './webglRecovery.js';
import {selectionCenter,transformSelection} from '../../shared/tabletopSelection.js';
import {LIGHTING_PRESETS} from '../../shared/tabletopLighting.js';

export default function TabletopScene({roomId,revision,objects,selected,editable,mode,onSelect,onTransform,onStatus,actions,qualityMode='auto',onQuality,motionMode='system',onMotionPreference,onAvailability,preview,onPreviewState,onPreviewTransform,previewBlocked=false,previewCommitted=false,lighting='default',initialCameraPose,onCameraPose}){
  const host=useRef(null),runtime=useRef(null),latest=useRef({}),recoveryController=useRef(null),cameraPose=useRef(null),returnFocus=useRef(false),cameraBeforePreview=useRef(null),previewFramed=useRef(null);
  const [attempt,setAttempt]=useState(0),[recovery,setRecovery]=useState({phase:'starting'});
  latest.current={revision,objects,selected,editable,mode,onSelect,onTransform,onStatus,onQuality,motionMode,onMotionPreference,onAvailability,preview,onPreviewState,onPreviewTransform,previewBlocked,previewCommitted,lighting,onCameraPose};
  useEffect(()=>{
    const controller=createWebGLRecovery({onChange:state=>{setRecovery(state);latest.current.onAvailability?.(state.phase==='ready');},onRebuild:()=>setAttempt(value=>value+1)});
    recoveryController.current=controller;
    return()=>{controller.dispose();recoveryController.current=null;};
  },[roomId]);
  useEffect(()=>{
    const el=host.current,controller=recoveryController.current,token=controller.begin();let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:devicePixelRatio<=1.5});}catch{controller.failed(token);return;}
    if(renderer.getContext().isContextLost()){renderer.dispose();controller.failed(token);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#151413');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.05,20000);
    const pose=cameraPose.current?.roomId===roomId?cameraPose.current:initialCameraPose;camera.position.fromArray(pose?.position||[26,24,30]);
    const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.fromArray(pose?.target||[0,0,0]);orbit.maxDistance=5000;orbit.minDistance=.15;orbit.update();
    const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());
    const ambient=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight();sun.position.set(12,25,8);scene.add(ambient,sun);
    const grid=new THREE.GridHelper(100,100,0x746142,0x292722);grid.position.y=-.03;scene.add(grid);
    let models=new Map(),stream=null,streamTimer=null,disposed=false,contextLost=false,dragging=false,dragScale=null,previewLoads=0,qualityReportKey='',reportScheduled=false,pendingFit=null;
    const selectionProxy=new THREE.Object3D(),selectionOutlines=new Map();scene.add(selectionProxy);let selectionBase=null;
    let previewSource=null,previewMesh=null,previewOutline=null,previewToken=null;
    const qualityController=createQualityController({mode:qualityMode,hardware:{memory:navigator.deviceMemory,cores:navigator.hardwareConcurrency,maxTextureSize:renderer.capabilities.maxTextureSize}});
    let quality=qualityController.quality,qualityScheduled=false;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),motion=createRemoteMotion({reducedMotion:motionMode==='instant'||motionMode==='system'&&reducedMotion.matches}),localChanges=new Map();let frame=null;
    const render=()=>{
      if(disposed||contextLost)return;
      if(stream?.refreshLevels(camera,latest.current.selected,qualityController.mode)&&!reportScheduled){reportScheduled=true;queueMicrotask(()=>{reportScheduled=false;if(!disposed)reportQuality();});}
      const started=performance.now();renderer.render(scene,camera);
      if(document.visibilityState==='visible'&&qualityController.observeRender(performance.now()-started)!==quality&&!qualityScheduled){qualityScheduled=true;queueMicrotask(()=>{qualityScheduled=false;if(!disposed)changeQuality(qualityController.quality);});}
    };
    const setLighting=()=>{const preset=LIGHTING_PRESETS[latest.current.lighting]||LIGHTING_PRESETS.default;ambient.color.setHex(preset.sky);ambient.groundColor.setHex(preset.ground);ambient.intensity=preset.ambient;sun.color.setHex(preset.sun);sun.intensity=preset.intensity;render();};
    const rememberCamera=()=>{if(!latest.current.preview)latest.current.onCameraPose?.({position:camera.position.toArray(),target:orbit.target.toArray()});};
    const animate=time=>{frame=null;if(disposed)return;motion.frame(time);for(const outline of selectionOutlines.values())outline.update();render();requestFrame();};
    const requestFrame=()=>{if(!disposed&&frame===null&&motion.active&&document.visibilityState==='visible')frame=requestAnimationFrame(animate);};
    const settleMotion=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;motion.finish();render();};
    const reduce=()=>{const preference=latest.current.motionMode,disabled=preference==='instant'||preference==='system'&&reducedMotion.matches;motion.setReducedMotion(disabled);if(disabled)settleMotion();latest.current.onMotionPreference?.(reducedMotion.matches);};
    const visibility=()=>{settleMotion();updateStream();};
    reducedMotion.addEventListener('change',reduce);document.addEventListener('visibilitychange',visibility);
    const reportQuality=()=>{
      const before={triangles:0,texturePixels:0},after={triangles:0,texturePixels:0};let skipped=0;
      for(const mesh of [...models.values(),...(previewMesh?[previewMesh]:[])]){const stats=mesh.userData.qualityReport||{before:modelQualityStats(mesh),after:modelQualityStats(mesh),skipped:0};for(const key of Object.keys(before)){before[key]+=stats.before[key];after[key]+=stats.after[key];}skipped+=stats.skipped;}
      const loading=stream?.getSnapshot()||{active:0,pending:0,deferred:0,loaded:0,failed:0};
      const report={quality,before,after,skipped,pending:loading.pending+(previewToken?1:0),loading};
      const key=JSON.stringify(report);if(key!==qualityReportKey){qualityReportKey=key;latest.current.onQuality?.(report);}
      const next=qualityController.observeComplexity(before);if(next!==quality&&!qualityScheduled){qualityScheduled=true;queueMicrotask(()=>{qualityScheduled=false;if(!disposed)changeQuality(next);});}
    };
    const apply=(mesh,item)=>{mesh.position.fromArray(item.position);mesh.rotation.fromArray([...item.rotation,'XYZ']);mesh.scale.fromArray(item.scale);};
    const updateSelection=()=>{
      const props=latest.current,ids=props.preview?[]:props.selected;
      for(const [id,outline]of selectionOutlines)if(!ids.includes(id)||!models.has(id)){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();selectionOutlines.delete(id);}
      for(const id of ids){const mesh=models.get(id);if(!mesh)continue;if(!selectionOutlines.has(id)){const outline=new THREE.BoxHelper(mesh,0xd4b879);outline.material.depthTest=false;outline.renderOrder=999;scene.add(outline);selectionOutlines.set(id,outline);}selectionOutlines.get(id).update();}
      const locked=props.objects.some(item=>ids.includes(item.id)&&item.locked),chosen=ids.map(id=>models.get(id)).filter(Boolean);
      if(!props.editable||locked){transform.detach();dragging=false;orbit.enabled=true;selectionBase=null;render();return;}
      let mesh=props.preview?(props.previewBlocked?null:previewMesh):chosen.length===1?chosen[0]:chosen.length>1?selectionProxy:null;
      if(!props.preview&&chosen.length!==ids.length)mesh=null;
      if(mesh===selectionProxy&&!dragging){
        const items=chosen.map(mesh=>({id:mesh.userData.mapId,position:mesh.position.toArray(),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],scale:mesh.scale.toArray()})),center=selectionCenter(items);
        selectionBase={items,center};selectionProxy.position.fromArray(center);selectionProxy.rotation.set(0,0,0);selectionProxy.scale.setScalar(1);
      }
      if(mesh){if(transform.object!==mesh)transform.attach(mesh);transform.setMode(props.mode);transform.setSpace(mesh===selectionProxy?'world':'local');}else transform.detach();render();
    };
    function clearPreview(){
      if(previewToken){previewToken.cancelled=true;previewToken.controller.abort();previewToken=null;}
      if(previewMesh){if(transform.object===previewMesh)transform.detach();scene.remove(previewMesh);disposeModel(previewMesh);previewMesh=null;}
      if(previewOutline){scene.remove(previewOutline);previewOutline.geometry.dispose();previewOutline.material.dispose();previewOutline=null;}
      previewSource=null;
    }
    function reportPreview(){
      if(!previewMesh||!previewSource)return;
      previewMesh.updateMatrixWorld(true);previewOutline?.update();
      const dimensions=new THREE.Box3().setFromObject(previewMesh).getSize(new THREE.Vector3()).toArray();
      latest.current.onPreviewState?.({id:previewSource.id,phase:'ready',dimensions});
    }
    function startPreviewLoad(token,source){
      token.started=true;previewLoads++;updateStream();
      const signal=AbortSignal.any([token.controller.signal,AbortSignal.timeout(120000)]);
      const placement={position:source.position,rotation:source.rotation,scale:source.scale};
      loadModelPreview(source.bundle,{placement,quality,signal}).then(mesh=>{
        if(disposed||token.cancelled||latest.current.preview?.id!==source.id||!latest.current.editable){disposeModel(mesh);return;}
        previewMesh=mesh;apply(mesh,latest.current.preview);scene.add(mesh);
        previewOutline=new THREE.BoxHelper(mesh,0xd4b879);previewOutline.material.depthTest=false;previewOutline.renderOrder=1000;scene.add(previewOutline);
        reportPreview();updateSelection();
        if(previewFramed.current!==source.id){
          if(!cameraBeforePreview.current||cameraBeforePreview.current.roomId!==roomId)cameraBeforePreview.current={roomId,position:camera.position.toArray(),target:orbit.target.toArray()};
          previewFramed.current=source.id;fit();
        }
        render();reportQuality();
      }).catch(error=>{if(!disposed&&!token.cancelled)latest.current.onPreviewState?.({id:source.id,phase:'failed',message:error.message});})
        .finally(()=>{if(previewToken===token)previewToken=null;previewLoads--;if(!disposed){updateStream();pumpPreview();reportQuality();}});
    }
    function syncPreview(){
      const source=latest.current.editable?latest.current.preview:null;
      if(!source){
        clearPreview();const saved=cameraBeforePreview.current;
        if(saved?.roomId===roomId&&!latest.current.previewCommitted){camera.position.fromArray(saved.position);orbit.target.fromArray(saved.target);orbit.update();}
        cameraBeforePreview.current=null;previewFramed.current=null;return;
      }
      if(previewSource?.id!==source.id){
        clearPreview();previewSource=source;previewToken={controller:new AbortController(),cancelled:false,started:false};
        latest.current.onPreviewState?.({id:source.id,phase:'loading'});
      }
      if(previewMesh&&!(dragging&&transform.object===previewMesh)){apply(previewMesh,source);reportPreview();}
    }
    function updateStream(){
      clearTimeout(streamTimer);streamTimer=null;if(disposed||!stream)return;
      const props=latest.current,reserve=Math.min(2,previewLoads+(previewToken&&!previewToken.started?1:0));
      stream.update({objects:props.objects,selected:props.selected,camera,quality,qualityMode:qualityController.mode,paused:document.visibilityState!=='visible',reserve});
      pumpPreview();
    }
    function pumpPreview(){if(!disposed&&previewToken&&!previewToken.started&&previewLoads+(stream?.getSnapshot().active||0)<2)startPreviewLoad(previewToken,previewSource);}
    function scheduleStream(){if(disposed||streamTimer!==null)return;streamTimer=setTimeout(updateStream,80);}
    stream=createSceneStream({fetchBundle:(item,signal)=>fetchMapAsset(roomId,item.assetId,signal),
      onModel:(id,mesh)=>{if(disposed)return;const current=latest.current.objects.find(object=>object.id===id),local=localChanges.get(id);
        motion.receive(mesh,local?{...current,...local.target}:current,performance.now(),{immediate:true,revision:latest.current.revision});scene.add(mesh);
        if(pendingFit&&pendingFit.length===latest.current.selected.length&&pendingFit.every(id=>latest.current.selected.includes(id)&&models.has(id))){pendingFit=null;fit();}
        updateSelection();render();reportQuality();},
      onRemove:(id,mesh)=>{if(transform.object===mesh)transform.detach();motion.cancel(mesh);scene.remove(mesh);if(!latest.current.objects.some(item=>item.id===id))localChanges.delete(id);if(!disposed)updateSelection();},
      onError:(item,error)=>{if(!disposed)latest.current.onStatus(`${item.name}: ${error.message}`);},
      onProgress:()=>{if(!disposed){pumpPreview();reportQuality();}}
    });models=stream.models;
    const sync=()=>{
      if(disposed||contextLost)return;
      const props=latest.current;
      if(!props.editable)localChanges.clear();
      for(const item of props.objects){
        const existing=models.get(item.id);
        if(existing){
          if(dragging&&props.editable&&!item.locked&&(transform.object===existing||transform.object===selectionProxy&&props.selected.includes(item.id)))continue;
          const local=localChanges.get(item.id);
          if(local){
            const matches=['position','rotation','scale'].every(key=>item[key].every((v,i)=>Math.abs(v-local.target[key][i])<1e-7));
            if(matches||Number.isFinite(local.revision)&&props.revision>=local.revision)localChanges.delete(item.id);else continue;
          }
          motion.receive(existing,item,performance.now(),{revision:props.revision,immediate:document.visibilityState!=='visible'});continue;
        }
      }
      syncPreview();updateStream();updateSelection();render();requestFrame();reportQuality();
    };
    const changeQuality=next=>{
      if(disposed||contextLost)return;
      if(next===quality)return;quality=next;renderer.setPixelRatio(next==='light'?1:Math.min(devicePixelRatio,1.5));
      transform.detach();clearPreview();sync();
    };
    const publish=()=>{
      const mesh=transform.object;if(!mesh||!latest.current.editable)return;
      const target={position:mesh.position.toArray(),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],scale:mesh.scale.toArray().map(v=>Math.max(.001,Math.abs(v)))};
      if(latest.current.mode==='scale'&&mesh!==selectionProxy&&dragScale){
        const ratios=mesh.scale.toArray().map((value,index)=>value/dragScale[index]);
        const requested=ratios.reduce((factor,next)=>Math.abs(next-1)>Math.abs(factor-1)?next:factor,1);
        const factor=Math.min(10000/Math.max(...dragScale),Math.max(.001/Math.min(...dragScale),Math.abs(requested)));
        target.scale=dragScale.map(value=>value*factor);mesh.scale.fromArray(target.scale);
      }
      if(mesh===previewMesh){
        if(latest.current.previewBlocked)return;
        try{mapAssetPlacement(target);}catch{apply(mesh,latest.current.preview);return;}
        mesh.scale.fromArray(target.scale);previewOutline?.update();latest.current.onPreviewTransform?.(previewSource.id,target,!dragging);if(!dragging)reportPreview();return;
      }
      if(latest.current.preview)return;
      const props=latest.current;if(props.objects.some(item=>props.selected.includes(item.id)&&item.locked))return;
      if(mesh===selectionProxy&&selectionBase){
        const scales=mesh.scale.toArray(),factor=scales.reduce((value,next)=>Math.abs(next-1)>Math.abs(value-1)?next:value,1);
        const patches=transformSelection(selectionBase.items,{position:mesh.position.toArray().map((value,i)=>value-selectionBase.center[i]),rotation:target.rotation,scale:Math.max(.001,Math.abs(factor))},selectionBase.center);
        try{for(const {id,...pose}of patches)mapAssetPlacement(pose);}catch{latest.current.onStatus('Esse ajuste ultrapassa o limite de posição ou tamanho.');return;}
        mesh.scale.setScalar(Math.max(.001,Math.abs(factor)));
        for(const {id,...pose}of patches){const model=models.get(id);if(model){motion.cancel(model);apply(model,pose);localChanges.set(id,{target:pose});selectionOutlines.get(id)?.update();}}
        latest.current.onTransform(patches);return;
      }
      try{mapAssetPlacement(target);}catch{const saved=props.objects.find(item=>item.id===mesh.userData.mapId);if(saved)apply(mesh,saved);return;}
      motion.cancel(mesh);localChanges.set(mesh.userData.mapId,{target});selectionOutlines.get(mesh.userData.mapId)?.update();latest.current.onTransform([{id:mesh.userData.mapId,...target}]);
    };
    const dragChanged=e=>{if(e.value)updateSelection();dragging=e.value;orbit.enabled=!e.value;if(e.value&&transform.object){dragScale=transform.object.scale.toArray();motion.cancel(transform.object);}if(!e.value){publish();updateSelection();dragScale=null;}};
    const objectChanged=()=>{publish();render();};
    transform.addEventListener('dragging-changed',dragChanged);
    const cameraChanged=()=>{render();scheduleStream();},cameraStarted=()=>{pendingFit=null;};
    transform.addEventListener('objectChange',objectChanged);transform.addEventListener('change',render);orbit.addEventListener('change',cameraChanged);
    orbit.addEventListener('start',cameraStarted);
    orbit.addEventListener('end',rememberCamera);
    const ray=new THREE.Raycaster();let start;
    const down=e=>{start={x:e.clientX,y:e.clientY,gizmo:!!transform.axis};};
    const up=e=>{if(latest.current.preview||!start||start.gizmo||Math.hypot(e.clientX-start.x,e.clientY-start.y)>4||e.button!==0)return;const rect=el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);const hit=ray.intersectObjects([...models.values()],true)[0];let node=hit?.object;while(node&&!node.userData.mapId)node=node.parent;latest.current.onSelect(node?.userData.mapId||null,e.shiftKey);};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    const fit=(all=false)=>{
      const props=latest.current,selection=all?[]:props.selected,chosen=previewMesh?[previewMesh]:selection.map(id=>models.get(id)).filter(Boolean),box=new THREE.Box3();for(const mesh of previewMesh||selection.length?chosen:models.values())box.expandByObject(mesh);
      pendingFit=!previewMesh&&selection.some(id=>!models.has(id))?[...selection]:null;
      // An unloaded selected object can still be focused. Conservative bounds
      // also let Enquadrar reveal objects whose downloads were deferred.
      if(!previewMesh)for(const item of props.objects)if(!selection.length||selection.includes(item.id)){
        if(models.has(item.id))continue;const center=new THREE.Vector3().fromArray(item.position),radius=30*Math.max(...item.scale);box.expandByPoint(center.clone().addScalar(radius));box.expandByPoint(center.clone().addScalar(-radius));
      }
      const center=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());const size=box.isEmpty()?30:box.getSize(new THREE.Vector3()).length();
      orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.9,1).normalize().multiplyScalar(Math.max(2,size)*1.4/Math.min(1,camera.aspect)));orbit.update();render();rememberCamera();
    };
    actions.current=action=>{
      if(disposed||contextLost)return;
      if(typeof action==='object'){
        const mesh=models.get(action.id),local=localChanges.get(action.id);
        if(action.type==='local-transform'&&mesh&&latest.current.editable){const item=latest.current.objects.find(o=>o.id===action.id),target={...item,...action.patch};motion.cancel(mesh);apply(mesh,target);localChanges.set(action.id,{target});render();}
        if(local&&['confirm-transform','failed-transform'].includes(action.type)&&Object.entries(action.patch).every(([key,vector])=>vector.every((v,i)=>Math.abs(v-local.target[key][i])<1e-7))){if(action.type==='confirm-transform')local.revision=action.revision;else localChanges.delete(action.id);sync();}
        return;
      }
      if(action==='fit'){fit();return;}
      if(action==='reset-camera'){fit(true);return;}
      if(action==='retry-loads'){latest.current.onStatus('');stream.retry();updateStream();return;}
      pendingFit=null;
      if(action==='top')camera.position.copy(orbit.target).add(new THREE.Vector3(0,Math.max(10,camera.position.distanceTo(orbit.target)),.001));
      if(action==='diagonal'||action==='front'){const distance=Math.max(.15,camera.position.distanceTo(orbit.target));camera.position.copy(orbit.target).add(new THREE.Vector3(...(action==='diagonal'?[1,.9,1]:[0,0,1])).normalize().multiplyScalar(distance));}
      if(action==='in'||action==='out')camera.position.sub(orbit.target).multiplyScalar(action==='in'?.8:1.25).add(orbit.target);
      if(action.startsWith('orbit-')){
        const offset=camera.position.clone().sub(orbit.target),spherical=new THREE.Spherical().setFromVector3(offset);
        if(action==='orbit-left')spherical.theta-=.16;
        if(action==='orbit-right')spherical.theta+=.16;
        if(action==='orbit-up')spherical.phi=Math.max(.05,spherical.phi-.16);
        if(action==='orbit-down')spherical.phi=Math.min(Math.PI-.05,spherical.phi+.16);
        camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));
      }
      if(action.startsWith('pan-')){
        const distance=camera.position.distanceTo(orbit.target)*.08;
        const right=new THREE.Vector3();camera.getWorldDirection(right);right.cross(new THREE.Vector3(0,1,0)).normalize();
        const movement=action==='pan-left'?right.multiplyScalar(-distance):action==='pan-right'?right.multiplyScalar(distance):new THREE.Vector3(0,action==='pan-up'?distance:-distance,0);
        camera.position.add(movement);orbit.target.add(movement);
      }
      orbit.update();render();rememberCamera();
    };
    const resize=()=>{if(!el.clientWidth||!el.clientHeight)return;renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();render();scheduleStream();};
    renderer.setPixelRatio(quality==='light'?1:Math.min(devicePixelRatio,1.5));
    const lost=event=>{event.preventDefault();if(disposed)return;contextLost=true;cleanup();latest.current.onStatus('');controller.lost(token);};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    const observer=new ResizeObserver(resize);observer.observe(el);resize();runtime.current={sync,setLighting,setMotionMode:reduce,setQualityMode:next=>{if(next!==qualityController.mode){const resolved=qualityController.setMode(next);if(resolved!==quality)changeQuality(resolved);else{updateStream();render();reportQuality();}}}};setLighting();reduce();sync();controller.ready(token);
    if(returnFocus.current){returnFocus.current=false;el.focus({preventScroll:true});}
    function cleanup(){
      if(disposed)return;
      cameraPose.current={roomId,position:camera.position.toArray(),target:orbit.target.toArray()};
      rememberCamera();
      disposed=true;runtime.current=null;actions.current=null;clearTimeout(streamTimer);stream.dispose();
      if(frame!==null)cancelAnimationFrame(frame);motion.dispose();localChanges.clear();
      reducedMotion.removeEventListener('change',reduce);document.removeEventListener('visibilitychange',visibility);observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      transform.removeEventListener('dragging-changed',dragChanged);transform.removeEventListener('objectChange',objectChanged);transform.removeEventListener('change',render);orbit.removeEventListener('change',cameraChanged);
      orbit.removeEventListener('start',cameraStarted);
      orbit.removeEventListener('end',rememberCamera);
      transform.detach();clearPreview();transform.dispose();orbit.dispose();
      for(const outline of selectionOutlines.values()){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();}selectionOutlines.clear();scene.remove(selectionProxy);
      grid.geometry.dispose();grid.material.dispose();scene.clear();renderer.dispose();
      if(!contextLost)renderer.forceContextLoss();renderer.domElement.remove();
    }
    return cleanup;
  },[roomId,attempt]);
  useEffect(()=>runtime.current?.sync(),[revision,objects,selected,editable,mode,preview,previewBlocked]);
  useEffect(()=>runtime.current?.setQualityMode(qualityMode),[qualityMode]);
  useEffect(()=>runtime.current?.setMotionMode(),[motionMode]);
  useEffect(()=>runtime.current?.setLighting(),[lighting]);
  const onKeyDown=event=>{
    if(recovery.phase!=='ready')return;
    const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    const action=directions[event.key]?(event.shiftKey?'pan-':'orbit-')+directions[event.key]
      :event.key==='+'||event.key==='='?'in':event.key==='-'?'out':event.key==='Home'?'fit':null;
    if(!action)return;
    event.preventDefault();actions.current?.(action);
  };
  return <div className="tabletop-surface">
    <div ref={host} className="tabletop-viewport" role="region" tabIndex={0} aria-label="Mesa 3D navegável por teclado" aria-describedby="tabletop-keyboard-help" aria-busy={recovery.phase==='starting'||recovery.phase==='recovering'} aria-disabled={recovery.phase!=='ready'} onKeyDown={onKeyDown}/>
    {recovery.phase!=='ready'&&<section className="tabletop-recovery" aria-label="Estado da Mesa 3D">
      <h2>{recovery.phase==='unavailable'?'O 3D está indisponível':recovery.phase==='recovering'?'Reabrindo o 3D…':'Preparando o 3D…'}</h2>
      <p role={recovery.phase==='unavailable'?'alert':'status'}>{recovery.phase==='unavailable'?'A mesa continua salva. Tente reabrir o 3D ou use o mapa 2D e as notas.':'Seus objetos e alterações confirmadas continuam na mesa.'}</p>
      {recovery.phase==='unavailable'&&<button type="button" onClick={()=>{returnFocus.current=true;recoveryController.current?.retry();}}>Reabrir 3D</button>}
    </section>}
  </div>;
}
