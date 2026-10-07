import {api} from '../api.js';
import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {DEFAULT_PHYSICS,PHYSICS_FIELDS,TRAY_SCALE,TRAY_FLOOR} from '../shared/trayConfig.js';
import {Hand} from 'lucide-react';
import {buildDie} from './Dice3D.jsx';
import './DiceTray.css';

let modelPromise;
function loadTrayModel(){
  if(!modelPromise)modelPromise=new Promise((resolve,reject)=>{
    const manager=new THREE.LoadingManager();let model;
    manager.onLoad=()=>{if(model)resolve(model);};manager.onError=()=>reject(Error('Não foi possível carregar a base 3D.'));
    new MTLLoader(manager).setPath('/assets/tray/').load('base.mtl',creator=>{
      creator.preload();new OBJLoader(manager).setMaterials(creator).setPath('/assets/tray/').load('base.obj',value=>{model=value;},undefined,reject);
    },undefined,reject);
  }).catch(e=>{modelPromise=null;throw e;});
  return modelPromise;
}

function TrayScene({roll,offset,held,hold,mapPoint,onLoadError,navigate,cameraActions}){
  const host=useRef(null),controlsRef=useRef(null),cameraState=useRef(null);
  useEffect(()=>{if(controlsRef.current){controlsRef.current.enableRotate=navigate;controlsRef.current.enablePan=navigate;controlsRef.current.enableZoom=navigate;}},[navigate]);
  useEffect(()=>{
    const element=host.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:devicePixelRatio<=1.5,alpha:true});}catch{return;}
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));element.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);
    camera.position.fromArray(cameraState.current?.position||([0,16,12]));
    const controls=new OrbitControls(camera,renderer.domElement);controlsRef.current=controls;
    controls.target.fromArray(cameraState.current?.target||([0,0,0]));controls.minDistance=8;controls.maxDistance=60;controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI*.46;
    controls.enableRotate=navigate;controls.enablePan=navigate;controls.enableZoom=navigate;controls.zoomSpeed=.7;controls.update();
    const remember=()=>{cameraState.current={position:camera.position.toArray(),target:controls.target.toArray()};renderer.render(scene,camera);};
    controls.addEventListener('change',remember);
    cameraActions.current=action=>{
      if(action==='reset'){camera.position.fromArray([0,16,12]);controls.target.fromArray([0,0,0]);}
      else{const relative=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(relative);
        if(action==='in')spherical.radius=Math.max(8,spherical.radius*.85);
        if(action==='out')spherical.radius=Math.min(34,spherical.radius/ .85);
        if(action==='left')spherical.theta-=.2;if(action==='right')spherical.theta+=.2;
        if(action==='up')spherical.phi=Math.max(.15,spherical.phi-.12);if(action==='down')spherical.phi=Math.min(Math.PI*.46,spherical.phi+.12);
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      }controls.update();remember();
    };
    scene.add(new THREE.HemisphereLight(0xffedce,0x21151a,2.5));
    const light=new THREE.DirectionalLight(0xffdfab,3);light.position.set(2,8,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-9,right:9,top:9,bottom:-9});light.shadow.bias=-.001;scene.add(light);
    let disposed=false;
    // Keep a simple floor visible while the supplied model loads.
    const loadingFloor=new THREE.Mesh(new THREE.CylinderGeometry(6,6,.15,6),new THREE.MeshStandardMaterial({color:0x202025,roughness:1}));scene.add(loadingFloor);
    loadTrayModel().then(source=>{
      if(disposed)return;
      const model=source.clone(true);
      model.scale.setScalar(TRAY_SCALE);model.position.y=-TRAY_FLOOR*TRAY_SCALE;
      model.traverse(o=>{if(o.isMesh){
        o.geometry=o.geometry.clone();const geometry=o.geometry,position=geometry.attributes.position,indices=geometry.index;
        const floor=[],walls=[];
        for(let i=0;i<(indices?indices.count:position.count);i+=3){const triangle=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);const target=triangle.some(v=>position.getY(v)>TRAY_FLOOR+.025)?walls:floor;target.push(...triangle);}
        geometry.setIndex([...floor,...walls]);geometry.clearGroups();geometry.addGroup(0,floor.length,0);geometry.addGroup(floor.length,walls.length,1);
        const base=o.material.clone();if(base.map)base.map=base.map.clone();base.side=THREE.DoubleSide;base.shininess=25;
        const wall=base.clone();wall.transparent=true;wall.opacity=.18;wall.depthWrite=false;
        o.material=[base,wall];o.receiveShadow=true;
      }});
      scene.add(model);scene.remove(loadingFloor);renderer.render(scene,camera);
    }).catch(()=>{if(!disposed)onLoadError('Não foi possível carregar sua base 3D. Recarregue a página.');});
    const data=held?[]:roll?.dice||[];
    const meshes=data.map(d=>{const mesh=buildDie(d.sides,held?.skinId||roll.skinId,d.notation);mesh.scale.setScalar(roll?.dieScale||.55);mesh.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(mesh);return mesh;});
    const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.3);
    mapPoint.current=(clientX,clientY)=>{const rect=element.getBoundingClientRect();plane.constant=-(hold.current.height||1.3);ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);const point=new THREE.Vector3();ray.ray.intersectPlane(plane,point);return {x:Math.max(-2.5,Math.min(2.5,point.x)),z:Math.max(-2,Math.min(2,point.z))};};
    const resize=()=>{renderer.setSize(element.clientWidth,element.clientHeight);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(element);resize();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let frame;
    function draw(){
      const elapsed=roll?Math.max(0,Date.now()+offset-roll.startedAt):0;
      meshes.forEach((mesh,i)=>{
        mesh.visible=!roll.releaseMs||elapsed>=roll.releaseMs[i];
        if(!roll.frames)return;
        const f=reduced?roll.frames.length-1:Math.min(roll.frames.length-1,elapsed/roll.frameMs),a=Math.floor(f),b=Math.min(a+1,roll.frames.length-1),u=f-a;
        const p=roll.frames[a][i],q=roll.frames[b][i];
        mesh.position.set(p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u,p[2]+(q[2]-p[2])*u);
        mesh.quaternion.slerpQuaternions(new THREE.Quaternion(...p.slice(3)),new THREE.Quaternion(...q.slice(3)),u);
      });
      renderer.render(scene,camera);
      if(roll&&!held&&elapsed<roll.duration)frame=requestAnimationFrame(draw);
    }
    draw();return()=>{disposed=true;controls.dispose();controlsRef.current=null;cameraActions.current=null;loadingFloor.geometry.dispose();loadingFloor.material.dispose();cancelAnimationFrame(frame);observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material]){material.map?.dispose();material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[roll?.id,offset,held]);
  return <div className="tray-scene" ref={host} role="img" aria-label="Bandeja 3D para rolagem com câmera ajustável"/>;
}
export default function DiceTray({roll,serverTime,compact=false,held,onThrow,onCancel}){
  const [navigate,setNavigate]=useState(false),[collapsed,setCollapsed]=useState(false),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[physics,setPhysics]=useState({...DEFAULT_PHYSICS}),[hand,setHand]=useState(null);
  const [previewVisible,setPreviewVisible]=useState(false);
  const cameraActions=useRef(null);
  const hold=useRef({x:0,z:1}),mapPoint=useRef(()=>({x:0,z:1})),drag=useRef(null),timing=useRef({id:null,offset:0});
  if(timing.current.id!==roll?.id)timing.current={id:roll?.id,offset:(serverTime||Date.now())-Date.now()};
  const offset=timing.current.offset;
  useEffect(()=>{const remaining=roll?roll.startedAt+roll.duration-Date.now()-offset:0;setDone(remaining<=0);const timer=setTimeout(()=>setDone(true),Math.max(0,remaining));return()=>clearTimeout(timer);},[roll?.id,offset]);
  useEffect(()=>{if(held){setNavigate(false);setCollapsed(false);setError('');hold.current={x:0,z:1};}},[held]);
  useEffect(()=>{
    if(!compact||held){setPreviewVisible(false);return;}
    const remaining=roll?roll.startedAt+roll.duration+3000-Date.now()-offset:0;
    if(remaining<=0){setPreviewVisible(false);return;}
    setPreviewVisible(true);setCollapsed(false);
    const timer=setTimeout(()=>setPreviewVisible(false),remaining);
    return()=>clearTimeout(timer);
  },[compact,roll?.id,offset,held]);
  hold.current.height=physics.startingHeight;
  if(compact&&!held&&!previewVisible)return null;
  const cancelDrag=()=>{drag.current=null;setHand(null);};
  function point(e){return mapPoint.current(e.clientX,e.clientY);}
  function down(e){if(!e.isPrimary||!held||navigate||busy||!done&&roll)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);hold.current={...p,height:physics.startingHeight};drag.current={id:e.pointerId,samples:[{...p,time:performance.now()}]};setHand({x:e.nativeEvent.offsetX,y:e.nativeEvent.offsetY});}
  function move(e){if(!drag.current||drag.current.id!==e.pointerId)return;const p=point(e),now=performance.now();hold.current={...p,height:physics.startingHeight};drag.current.samples.push({...p,time:now});drag.current.samples=drag.current.samples.filter(s=>now-s.time<150);const rect=e.currentTarget.getBoundingClientRect();setHand({x:e.clientX-rect.left,y:e.clientY-rect.top});}
  async function up(e){if(!drag.current||drag.current.id!==e.pointerId)return;const p=point(e),now=performance.now(),first=drag.current.samples[0];const dt=Math.max(.03,(now-first.time)/1000);let vx=(p.x-first.x)/dt,vz=(p.z-first.z)/dt;const speed=Math.hypot(vx,vz);cancelDrag();if(speed<.5){setError('Arraste e solte em movimento para lançar os dados.');return;}if(speed>12){vx*=11.99/speed;vz*=11.99/speed;}setBusy(true);setError('');try{const result=await onThrow({x:p.x,z:p.z,vx,vz},physics);if(!result)setError('O lançamento não foi confirmado. Tente novamente para conferir a mesma jogada.');}catch{setError('O lançamento não foi confirmado. Tente novamente para conferir a mesma jogada.');}finally{setBusy(false);}}
  return <section className={`dice-tray ${compact?'tray-floating':''} ${compact&&previewVisible&&!held?'tray-preview':''}`} aria-label="Bandeja compartilhada">
    <header><div><strong>Bandeja da mesa</strong><small>{held?'Dados na mão · arraste e solte':roll?`@${roll.username} · ${done?'rolou':'jogando dados…'}`:'Escolha os dados para começar.'}</small></div><button type="button" onClick={()=>setCollapsed(v=>!v)} aria-expanded={!collapsed}>{collapsed?'Expandir':'Recolher'}</button></header>
    {!collapsed&&<><div className="tray-camera-controls" role="group" aria-label="Câmera da bandeja">
      {[["in","Aproximar","+"],["out","Afastar","−"],["left","Girar para a esquerda","←"],["right","Girar para a direita","→"],["up","Ver mais de cima","↑"],["down","Ver mais de lado","↓"],["reset","Restaurar câmera","Centralizar"]].map(([action,label,text])=><button key={action} type="button" aria-label={label} title={label} disabled={!!hand||busy} onClick={()=>cameraActions.current?.(action)}>{text}</button>)}
      {held&&<button type="button" aria-pressed={navigate} disabled={!!hand||busy} onClick={()=>setNavigate(v=>!v)}>{navigate?'Voltar à mão':'Mover câmera'}</button>}
    </div><p className="tray-camera-hint">{held&&!navigate?'Arraste para lançar · use os botões para ajustar a visão.':'Arraste para girar · botão direito para deslocar · roda ou pinça para zoom.'}</p>
    <div className={`tray-gesture ${held&&!navigate?'has-hand':''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
      <TrayScene roll={roll} offset={offset} held={held} hold={hold} mapPoint={mapPoint} onLoadError={setError} navigate={!held||navigate} cameraActions={cameraActions}/>
      {held&&!navigate&&<div className="tray-hand" style={hand?{left:hand.x,top:hand.y}:undefined}><Hand size={32}/><span>{busy?'Lançando…':hand?'Solte para jogar':'Arraste para jogar'}</span></div>}
    </div>
    <div className="tray-result" aria-live="polite">{held?<span>{busy?'Preparando a jogada…':!done&&roll?'Aguarde a jogada atual terminar.':'Arraste os dados e solte em movimento. Quanto mais rápido, mais forte.'}</span>:roll?(done?roll.cocked?<strong>Dado preso, inclinado ou fora da área. Tente novamente.</strong>:<><span>{roll.parts.map(p=>`${p.sign<0?'−':''}${p.qty}d${p.sides}: [${p.rolls.join(', ')}]`).join(' · ')}</span><strong>Total {roll.total}</strong></>:<span>Os dados estão rolando…</span>):<span>Escolha os dados e use “Pegar dados na mão”.</span>}</div>
    {held&&<details className="tray-settings"><summary>Ajustar física do lançamento</summary><div>{PHYSICS_FIELDS.map(f=><label key={f.key}>{f.label}<output>{physics[f.key]}</output><input type="range" aria-label={f.label} min={f.min} max={f.max} step={f.step} value={physics[f.key]} disabled={busy} onChange={e=>setPhysics(p=>({...p,[f.key]:Number(e.target.value)}))}/></label>)}</div><button disabled={busy} onClick={()=>setPhysics({...DEFAULT_PHYSICS})}>Restaurar ajustes</button></details>}
    {error&&<p className="tray-send-error" role="alert">{error}</p>}{held&&<button className="tray-cancel" disabled={busy} onClick={onCancel}>Guardar dados</button>}</>}
  </section>;
}
