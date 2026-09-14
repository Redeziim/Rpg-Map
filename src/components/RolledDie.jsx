import React, { useRef } from 'react';
import Dice3D from './Dice3D.jsx';
import { percentileValue } from './diceGeometry.js';

export default function RolledDie({sides,skinId,spinTrigger,onResult}) {
  const pending = useRef({trigger:0,values:{}});
  if(sides!==100) return <Dice3D diceType={sides} skinId={skinId} spinTrigger={spinTrigger} onResult={onResult} />;
  const receive=(part,value,trigger)=>{
    if(pending.current.trigger!==trigger)pending.current={trigger,values:{}};
    pending.current.values[part]=value;
    const {tens,units}=pending.current.values;
    if(tens!==undefined&&units!==undefined)onResult?.(percentileValue(tens,units),trigger);
  };
  return <div className="percentile-dice"><Dice3D diceType={10} notation="tens" skinId={skinId} spinTrigger={spinTrigger} onResult={(v,t)=>receive('tens',v,t)} /><Dice3D diceType={10} notation="units" skinId={skinId} spinTrigger={spinTrigger} onResult={(v,t)=>receive('units',v,t)} /></div>;
}
