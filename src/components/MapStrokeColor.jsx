import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {isMapStrokeColor} from '../shared/mapStrokeColor.js';
import './MapStrokeColor.css';

const QUICK_COLORS=[['#d9b777','Dourado'],['#b86f61','Vermelho'],['#78a7a1','Azul'],['#ffffff','Branco'],['#000000','Preto']];
const clamp=value=>Math.max(0,Math.min(1,value));

function toHsv(hex){
  const [r,g,b]=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const hue=!delta?0:max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
  return {h:(hue*60+360)%360,s:max?delta/max:0,v:max};
}

function toHex({h,s,v}){
  const channel=n=>{
    const k=(n+h/60)%6;
    return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');
  };
  return '#'+channel(5)+channel(3)+channel(1);
}

export default function MapStrokeColor({color,onChange}){
  const id=useId(),rootRef=useRef(null),triggerRef=useRef(null),dragRef=useRef(null);
  const [open,setOpen]=useState(false),[hsv,setHsv]=useState(()=>toHsv(color)),[hex,setHex]=useState(color),[invalid,setInvalid]=useState(false);
  useEffect(()=>{
    setHex(color);setInvalid(false);
    // Preserve the wheel position when brightness reaches black or saturation reaches white.
    setHsv(current=>toHex(current)===color.toLowerCase()?current:toHsv(color));
  },[color]);
  useEffect(()=>{
    if(!open)return;
    const closeOutside=event=>{if(!rootRef.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('focusin',closeOutside);
    return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('focusin',closeOutside);};
  },[open]);
  function select(next){setHsv(next);const value=toHex(next);setHex(value);setInvalid(false);onChange(value);}
  function close(){setOpen(false);triggerRef.current?.focus();}
  function pick(event){
    const rect=event.currentTarget.getBoundingClientRect(),radius=rect.width/2;
    const x=event.clientX-rect.left-radius,y=event.clientY-rect.top-radius;
    select({...hsv,h:(Math.atan2(y,x)*180/Math.PI+450)%360,s:clamp(Math.hypot(x,y)/radius)});
  }
  function wheelKey(event){
    const step=event.shiftKey?10:1;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();select({...hsv,h:(hsv.h+(event.key==='ArrowLeft'?-step:step)+360)%360});
    }else if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();select({...hsv,s:clamp(hsv.s+(event.key==='ArrowUp'?step:-step)/100)});
    }
  }
  const angle=(hsv.h-90)*Math.PI/180;
  return <div ref={rootRef} className="map-color-picker" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}}>
    <button ref={triggerRef} type="button" className="map-color-trigger" aria-label="Escolher cor do traço" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
      <span className="map-color-seal" aria-hidden="true" style={{'--chosen-color':color}}/><span>Cor</span>
    </button>
    {open&&<section id={id} className="map-color-panel" aria-label="Cores do traço">
      <header><h3>Cor do traço</h3><button type="button" aria-label="Fechar cores" onClick={close}><X size={18} aria-hidden="true"/></button></header>
      <p id={`${id}-help`}>Escolha no círculo e ajuste o tom.</p>
      <button type="button" className="map-color-wheel" aria-label="Círculo de cores" aria-describedby={`${id}-keyboard`} onKeyDown={wheelKey}
        onPointerDown={event=>{if(event.button!==0||!event.isPrimary)return;event.currentTarget.focus();dragRef.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);pick(event);}}
        onPointerMove={event=>{if(dragRef.current===event.pointerId)pick(event);}}
        onPointerUp={()=>{dragRef.current=null;}} onPointerCancel={()=>{dragRef.current=null;}}
        style={{'--wheel-shade':1-hsv.v}}>
        <span className="map-color-position" aria-hidden="true" style={{left:`${50+Math.cos(angle)*hsv.s*50}%`,top:`${50+Math.sin(angle)*hsv.s*50}%`,background:color}}/>
      </button>
      <span id={`${id}-keyboard`} className="sr-only">Setas esquerda e direita escolhem a cor; para cima e para baixo ajustam a intensidade. Shift faz ajustes maiores. Você também pode digitar o código da cor.</span>
      <span className="sr-only" role="status">Cor selecionada: {color}.</span>
      <label className="map-color-tone" htmlFor={`${id}-tone`}><span>Escuro</span><span>Claro</span></label>
      <input id={`${id}-tone`} name="strokeBrightness" type="range" min="0" max="100" value={Math.round(hsv.v*100)} aria-label="Claridade da cor" onChange={event=>select({...hsv,v:Number(event.target.value)/100})}/>
      <div className="map-color-presets" role="group" aria-label="Cores rápidas">{QUICK_COLORS.map(([value,label])=><button key={value} type="button" aria-label={label} aria-pressed={color.toLowerCase()===value} style={{'--swatch-color':value}} onClick={()=>select(toHsv(value))}/>)}</div>
      <label htmlFor={`${id}-hex`}>Código da cor</label>
      <div className="map-color-code"><span aria-hidden="true" style={{background:color}}/><input id={`${id}-hex`} name="strokeColor" value={hex} maxLength={7} autoComplete="off" spellCheck={false} placeholder="#1A7BD1…" aria-invalid={invalid} aria-describedby={invalid?`${id}-error`:undefined}
        onChange={event=>{const value=event.target.value;setHex(value);setInvalid(false);if(isMapStrokeColor(value)){setHsv(toHsv(value));onChange(value.toLowerCase());}}}
        onBlur={()=>setInvalid(!isMapStrokeColor(hex))}/></div>
      {invalid&&<p id={`${id}-error`} role="alert">Use # e seis caracteres de 0 a 9 ou A a F.</p>}
      <button type="button" className="map-color-done" onClick={close}>Pronto</button>
    </section>}
  </div>;
}
