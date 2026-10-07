import React,{useEffect,useState} from 'react';

// Lembra o estado aberto/fechado entre aberturas do painel, só nesta sessão do navegador.
const memory=new Map();

export default function ToolSection({id,title,icon,defaultOpen=false,forceOpen=false,children}){
  const [open,setOpen]=useState(()=>forceOpen||(memory.has(id)?memory.get(id):defaultOpen));
  useEffect(()=>{if(forceOpen){memory.set(id,true);setOpen(true);}},[forceOpen,id]);
  return <details className="tool-section" open={open} onToggle={event=>{const next=event.currentTarget.open;memory.set(id,next);setOpen(next);}}>
    <summary>{icon}<span>{title}</span></summary>
    <div className="tool-section-body">{children}</div>
  </details>;
}
