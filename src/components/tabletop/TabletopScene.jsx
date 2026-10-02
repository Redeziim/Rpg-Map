import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {api} from '../../api.js';
import {loadMapAsset,disposeModel} from './loadMapAsset.js';

export default function TabletopScene({roomId,objects,selected,editable,mode,onSelect,onTransform,onStatus,actions}){
  const host=useRef(null),runtime=useRef(null),latest=useRef({});
  latest.current={objects,selected,editable,mode,onSelect,onTransform,onStatus};
  useEffect(()=>{
    const el=host.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:devicePixelRatio<=1.5});}catch{onStatus('Não foi possível iniciar o 3D neste navegador.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#151413');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.05,20000);
    camera.position.set(26,24,30);
    const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,0,0);orbit.maxDistance=5000;orbit.minDistance=.15;orbit.update();
    const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());
    scene.add(new THREE.HemisphereLight(0xfff5e3,0x484a53,2.4));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(12,25,8);scene.add(sun);
    const grid=new THREE.GridHelper(100,100,0x746142,0x292722);grid.position.y=-.03;scene.add(grid);
    const models=new Map(),loading=new Map(),queued=new Map(),failed=new Set();let disposed=false,dragging=false,activeLoads=0;
    const render=()=>renderer.render(scene,camera);
    const apply=(mesh,item)=>{mesh.position.fromArray(item.position);mesh.rotation.fromArray([...item.rotation,'XYZ']);mesh.scale.fromArray(item.scale);};
    const updateSelection=()=>{
      const props=latest.current,mesh=models.get(props.selected);
      if(mesh&&props.editable){if(transform.object!==mesh)transform.attach(mesh);transform.setMode(props.mode);}else transform.detach();render();
    };
    const pump=()=>{
      while(!disposed&&activeLoads<2&&queued.size){
        const [id,item]=queued.entries().next().value;queued.delete(id);
        if(!latest.current.objects.some(object=>object.id===id))continue;
        const token={cancelled:false};loading.set(id,token);activeLoads++;
        latest.current.onStatus(`Carregando ${item.name}…`);
        api(`/rooms/${roomId}/map-assets/${item.assetId}`,{signal:AbortSignal.timeout(120000)}).then(loadMapAsset).then(mesh=>{
          if(disposed||token.cancelled){disposeModel(mesh);return;}
          const current=latest.current.objects.find(object=>object.id===id);if(!current){disposeModel(mesh);return;}
          mesh.userData.mapId=id;apply(mesh,current);models.set(id,mesh);scene.add(mesh);latest.current.onStatus('');updateSelection();render();
        }).catch(error=>{if(!disposed&&!token.cancelled){failed.add(id);latest.current.onStatus(`${item.name}: ${error.message}`);}})
          .finally(()=>{if(loading.get(id)===token)loading.delete(id);activeLoads--;pump();});
      }
    };
    const sync=()=>{
      const props=latest.current,ids=new Set(props.objects.map(o=>o.id));
      for(const [id,mesh]of models)if(!ids.has(id)){if(transform.object===mesh)transform.detach();scene.remove(mesh);disposeModel(mesh);models.delete(id);}
      for(const [id,token]of loading)if(!ids.has(id)){token.cancelled=true;loading.delete(id);}
      for(const id of queued.keys())if(!ids.has(id))queued.delete(id);
      for(const id of failed)if(!ids.has(id))failed.delete(id);
      for(const item of props.objects){
        const existing=models.get(item.id);
        if(existing){if(!(dragging&&transform.object===existing))apply(existing,item);continue;}
        if(!loading.has(item.id)&&!queued.has(item.id)&&!failed.has(item.id))queued.set(item.id,item);
      }
      pump();updateSelection();render();
    };
    const publish=()=>{const mesh=transform.object;if(!mesh||!latest.current.editable)return;latest.current.onTransform(mesh.userData.mapId,{position:mesh.position.toArray(),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],scale:mesh.scale.toArray().map(v=>Math.max(.001,Math.abs(v)))});};
    transform.addEventListener('dragging-changed',e=>{dragging=e.value;orbit.enabled=!e.value;if(!e.value)publish();});
    transform.addEventListener('objectChange',()=>{publish();render();});transform.addEventListener('change',render);orbit.addEventListener('change',render);
    const ray=new THREE.Raycaster();let start;
    const down=e=>{start={x:e.clientX,y:e.clientY,gizmo:!!transform.axis};};
    const up=e=>{if(!start||start.gizmo||Math.hypot(e.clientX-start.x,e.clientY-start.y)>4||e.button!==0)return;const rect=el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);const hit=ray.intersectObjects([...models.values()],true)[0];let node=hit?.object;while(node&&!node.userData.mapId)node=node.parent;latest.current.onSelect(node?.userData.mapId||null);};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    const fit=()=>{
      const chosen=models.get(latest.current.selected),box=new THREE.Box3();for(const mesh of chosen?[chosen]:models.values())box.expandByObject(mesh);
      const center=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());const size=box.isEmpty()?30:box.getSize(new THREE.Vector3()).length();
      orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.9,1).normalize().multiplyScalar(Math.max(2,size)*1.4/Math.min(1,camera.aspect)));orbit.update();render();
    };
    actions.current=action=>{
      if(action==='fit'){fit();return;}
      if(action==='top')camera.position.copy(orbit.target).add(new THREE.Vector3(0,Math.max(10,camera.position.distanceTo(orbit.target)),.001));
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
      orbit.update();render();
    };
    const resize=()=>{if(!el.clientWidth||!el.clientHeight)return;renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();render();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();runtime.current={sync};sync();
    return()=>{disposed=true;runtime.current=null;actions.current=null;queued.clear();observer.disconnect();transform.detach();transform.dispose();orbit.dispose();models.forEach(disposeModel);grid.geometry.dispose();grid.material.dispose();renderer.dispose();renderer.domElement.remove();};
  },[roomId]);
  useEffect(()=>runtime.current?.sync(),[objects,selected,editable,mode]);
  const onKeyDown=event=>{
    const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    const action=directions[event.key]?(event.shiftKey?'pan-':'orbit-')+directions[event.key]
      :event.key==='+'||event.key==='='?'in':event.key==='-'?'out':event.key==='Home'?'fit':null;
    if(!action)return;
    event.preventDefault();actions.current?.(action);
  };
  return <div ref={host} className="tabletop-viewport" role="region" tabIndex={0} aria-label="Mesa 3D navegável por teclado" aria-describedby="tabletop-keyboard-help" onKeyDown={onKeyDown}/>;
}
