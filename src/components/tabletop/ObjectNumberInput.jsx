import React,{useEffect,useRef} from 'react';

const shown=(value,field)=>+(value*(field==='rotation'?180/Math.PI:1)).toFixed(3);
export default function ObjectNumberInput({item,field,axis,version,onTransform}){
  const input=useRef(null),editing=useRef(null),labels={position:'Posição',rotation:'Rotação',scale:'Escala'};
  useEffect(()=>{
    if(editing.current?.dirty)return;
    if(input.current)input.current.value=shown(item[field][axis],field);
    if(editing.current)editing.current={version,vector:[...item[field]],dirty:false};
  },[item,field,axis,version]);
  return <input ref={input} name={`${field}${'XYZ'[axis]}`} autoComplete="off" aria-label={`${labels[field]} ${'XYZ'[axis]}`} type="number" step={field==='rotation'?5:field==='scale'?'any':.1} min={field==='scale'?.001:undefined} defaultValue={shown(item[field][axis],field)}
    onFocus={()=>{editing.current={version,vector:[...item[field]],dirty:false};}}
    onChange={()=>{if(editing.current)editing.current.dirty=true;}}
    onBlur={event=>{
      const draft=editing.current;editing.current=null;if(!draft?.dirty)return;
      const value=Number(event.target.value);if(!Number.isFinite(value)||event.target.value===''){event.target.value=shown(item[field][axis],field);return;}
      const vector=[...draft.vector];vector[axis]=field==='rotation'?value*Math.PI/180:field==='scale'?Math.max(.001,value):value;onTransform(item.id,{[field]:vector},draft.version);
    }} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/>;
}
