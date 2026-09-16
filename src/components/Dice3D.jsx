import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getDieDefinition, readDieFace, sampleOrientation, settleOrientation, resultPresentationOrientation } from './diceGeometry.js';

const DICE_SKINS = [
  {id:'nebulosa',label:'Nebulosa',color:'#50636b'}, {id:'chamas',label:'Chamas',color:'#8e442c'},
  {id:'floresta',label:'Floresta',color:'#384e38'}, {id:'ametista',label:'Ametista',color:'#5b4565'},
  {id:'pedra',label:'Pedra',color:'#646452'}, {id:'carmesim',label:'Carmesim',color:'#682e32'},
  {id:'safira',label:'Safira',color:'#294954'},
];

const PALETTES = {
  nebulosa:[0x50636b,'#eeddb5'],
  chamas: [0x8e442c, '#ffe3ae'], floresta: [0x384e38, '#edddb3'], ametista: [0x5b4565, '#f4deb7'],
  pedra: [0x646452, '#fff2d2'], carmesim: [0x682e32, '#ffe0b4'], safira: [0x294954, '#e9d9ad'],
};

function numberTexture(label, color) {
  const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=256;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,256,256);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 154px Georgia';ctx.strokeStyle='#161415';ctx.lineWidth=9;ctx.lineJoin='round';ctx.strokeText(label,128,130);ctx.fillText(label,128,130);
  if (label==='6' || label==='9') {ctx.fillRect(98,204,60,6);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function buildDie(sides, skinId, notation) {
  const {geometry,faces}=getDieDefinition(sides);
  const group=new THREE.Group();
  const [color,ink]=PALETTES[skinId] || PALETTES.safira;
  group.add(new THREE.Mesh(geometry.clone(),new THREE.MeshStandardMaterial({color,metalness:.15,roughness:.55,flatShading:true})));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,20),new THREE.LineBasicMaterial({color:0xc0a478,transparent:true,opacity:.55})));
  faces.forEach(face => {
    const label = notation==='tens' ? String((face.value%10)*10).padStart(2,'0') : notation==='units' ? String(face.value%10) : String(face.value);
    const texture=numberTexture(label,'#fff8e8');
    if(sides===4){
      const vertex=faces.flatMap(f=>f.vertices).reduce((best,v)=>v.dot(face.normal)<best.dot(face.normal)?v:best);
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));
      sprite.position.copy(vertex).multiplyScalar(1.07);sprite.scale.set(.34,.34,.34);group.add(sprite);
    }else{
      const size=face.radius*(sides===10?.95:1.08);
      const number=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
      number.position.copy(face.center).addScaledVector(face.normal,.008);
      number.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),face.normal);
      group.add(number);
    }
  });
  return group;
}

// One WebGL context shared by every die; each visible canvas receives its rendered frame.
// Large dice pools must not exhaust the browser's WebGL context limit.
let sharedRenderer=null, rendererUsers=0;
function acquireRenderer(){
  if(!sharedRenderer) sharedRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  rendererUsers++;return sharedRenderer;
}
function releaseRenderer(){if(--rendererUsers===0){sharedRenderer.dispose();sharedRenderer=null;}}

const Dice3D = ({diceType,skinId,spinTrigger=0,onResult,notation,fixedValue}) => {
  const containerRef=useRef(null), stateRef=useRef(null), resultRef=useRef(onResult), orientationRef=useRef(null);
  resultRef.current=onResult;
  useEffect(()=>{
    const container=containerRef.current;if(!container)return;
    const sides=diceType===100?10:diceType;
    const renderer=acquireRenderer();
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');container.appendChild(canvas);
    let dirty=true;
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(36,1,.1,100);
    camera.position.set(0,4.5,4.7);if(fixedValue!==undefined)camera.position.multiplyScalar(.78);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight(0xffeed4,0x293828,2));
    const light=new THREE.DirectionalLight(0xffd3a1,3);light.position.set(3,6,4);scene.add(light);
    const die=buildDie(sides,skinId,notation);scene.add(die);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.25,40),new THREE.MeshBasicMaterial({color:0x080e09,transparent:true,opacity:.3}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.15;shadow.visible=fixedValue===undefined;scene.add(shadow);
    const state={die,sides,roll:null,lastTrigger:0};stateRef.current=state;
    die.quaternion.copy(fixedValue!==undefined?resultPresentationOrientation(sides,fixedValue,camera.position):orientationRef.current || settleOrientation(sides,sampleOrientation()));
    const resize=()=>{const w=container.clientWidth||150,h=container.clientHeight||150;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};
    resize();const observer=new ResizeObserver(resize);observer.observe(container);
    let frame;
    const animate=(now)=>{
      frame=requestAnimationFrame(animate);
      const roll=state.roll;
      if(roll){
        const t=Math.min(1,(now-roll.start)/roll.duration);
        if(t<.7){
          const u=t/.7;
          die.quaternion.copy(roll.initial).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(u*roll.turns.x,u*roll.turns.y,u*roll.turns.z)));
          die.position.y=Math.sin(u*Math.PI)*.55;die.position.x=Math.sin(u*Math.PI*2)*.22;
          roll.last.copy(die.quaternion);
        }else{
          const u=(t-.7)/.3,ease=1-Math.pow(1-u,3);
          die.quaternion.slerpQuaternions(roll.last,roll.target,ease);
          die.position.set(0,Math.sin(u*Math.PI)*.08*(1-u),0);
        }
        if(t===1){
          die.quaternion.copy(roll.target);orientationRef.current=roll.target.clone();die.position.set(0,0,0);state.roll=null;
          const value=readDieFace(sides,die.quaternion).value;
          container.dataset.face=String(value);
          container.setAttribute('aria-label',`d${sides}: ${notation==='tens' ? String(value%10*10).padStart(2,'0') : notation==='units' ? value%10 : value}`);
          resultRef.current?.(value,roll.trigger);
        }
      }
      if(roll || dirty){renderer.setSize(canvas.width,canvas.height,false);renderer.render(scene,camera);context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(renderer.domElement,0,0);dirty=false;}
    };
    frame=requestAnimationFrame(animate);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();stateRef.current=null;scene.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});releaseRenderer();canvas.remove();};
  },[diceType,skinId,notation,fixedValue]);
  useEffect(()=>{
    const state=stateRef.current;if(!state||!spinTrigger||state.lastTrigger===spinTrigger)return;
    state.lastTrigger=spinTrigger;
    const turns=new THREE.Vector3(8+Math.random()*10,8+Math.random()*10,5+Math.random()*6);
    const initial=sampleOrientation();
    const landing=initial.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(turns.x,turns.y,turns.z)));
    state.roll={start:performance.now(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1350,initial,last:landing.clone(),target:settleOrientation(state.sides,landing),turns,trigger:spinTrigger};
  },[spinTrigger]);
  return <div ref={containerRef} className="dice-3d-canvas" role="img" aria-label={fixedValue!==undefined?`d${diceType}: ${notation==='tens'?String(fixedValue%10*10).padStart(2,'0'):notation==='units'?fixedValue%10:fixedValue}`:`Dado de ${diceType} lados`} />;
};
export { DICE_SKINS };
export default Dice3D;
