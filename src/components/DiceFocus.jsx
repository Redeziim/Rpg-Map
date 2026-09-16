import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Dice3D from './Dice3D.jsx';
import './DiceFocus.css';

function ResultDialog({roll,onClose}){
  const dialog=useRef(null);
  useEffect(()=>{const previous=document.activeElement;dialog.current.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
  let physicalIndex=0;
  return createPortal(<dialog ref={dialog} className="dice-focus" aria-labelledby="dice-focus-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="dice-focus-content">
      <header><div><p>@{roll.username} lançou</p><h2 id="dice-focus-title">Resultado da jogada</h2></div><button autoFocus type="button" onClick={onClose} aria-label="Fechar destaque dos dados">Fechar ×</button></header>
      <div className="dice-focus-grid">{roll.parts.flatMap((part,partIndex)=>part.rolls.map((value,index)=>{
        const dice=roll.dice.slice(physicalIndex,physicalIndex+(part.sides===100?2:1));physicalIndex+=dice.length;
        return <article key={`${partIndex}-${index}`} className="dice-focus-item"><span>{part.sign<0?'− ':''}d{part.sides}{part.sides===100?' · dezenas e unidades':''}</span><div className={`dice-focus-model ${dice.length===2?'dice-focus-pair':''}`}>{dice.map((die,i)=><Dice3D key={i} diceType={die.sides} skinId={roll.skinId} notation={die.notation} fixedValue={die.value}/>)}</div><strong aria-label={`Resultado ${value}`}>{value}</strong></article>;
      }))}</div>
      <footer><span>{roll.parts.map((p,i)=>`${i?(p.sign<0?' − ':' + '):p.sign<0?'− ':''}${p.qty}d${p.sides}`).join('')}</span><span>Total <strong>{roll.total}</strong></span></footer>
    </div>
  </dialog>,document.body);
}
export default function DiceFocus({roll,serverTime,enabled=true}){
  const [focused,setFocused]=useState(null),initialOld=useRef(roll&&roll.startedAt+roll.duration<=(serverTime||Date.now())?roll.id:null);
  const enabledRef=useRef(enabled);
  enabledRef.current=enabled;
  useEffect(()=>{if(!enabled)setFocused(null);},[enabled]);
  useEffect(()=>{
    setFocused(null);
    if(!roll||roll.id===initialOld.current)return;
    const remaining=roll.startedAt+roll.duration-(serverTime||Date.now());
    if(roll.cocked)return;
    const timer=setTimeout(()=>{if(enabledRef.current)setFocused(roll);},Math.max(0,remaining)+150);
    return()=>clearTimeout(timer);
  },[roll?.id]);
  return enabled&&focused?<ResultDialog roll={focused} onClose={()=>setFocused(null)}/>:null;
}
