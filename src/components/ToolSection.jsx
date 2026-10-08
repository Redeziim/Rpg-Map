import React,{useEffect,useState} from 'react';

// Lembra o estado aberto/fechado entre aberturas do painel, só nesta sessão do navegador.
const memory=new Map();

// `status` é o que está ligado ou quanto há ("Desligada", "12"); `active` marca o instrumento em uso agora.
// Em uso aparece escrito e na régua lateral, para não depender só de cor.
export default function ToolSection({id,title,icon,defaultOpen=false,forceOpen=false,status='',active=false,children}){
  const [open,setOpen]=useState(()=>forceOpen||(memory.has(id)?memory.get(id):defaultOpen));
  useEffect(()=>{if(forceOpen){memory.set(id,true);setOpen(true);}},[forceOpen,id]);
  return <details className={`tool-section${active?' is-active':''}`} open={open} data-tool={id} onToggle={event=>{const next=event.currentTarget.open;memory.set(id,next);setOpen(next);}}>
    <summary>{icon}<span className="tool-title">{title}</span>{(active||status)&&<span className="tool-status">{active?'Em uso':status}</span>}</summary>
    <div className="tool-section-body">{children}</div>
  </details>;
}