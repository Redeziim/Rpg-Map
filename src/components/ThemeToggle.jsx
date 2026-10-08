import React,{useEffect,useState} from 'react';
import {Sun} from 'lucide-react';
import {STORAGE_KEY,applyTheme,nextTheme,readTheme,saveTheme} from '../themePreference.js';
import './ThemeToggle.css';

const store=()=>{try{return window.localStorage;}catch{return null;}};

// Alterna entre o tema sombrio (padrão) e o claro. A escolha vale para este navegador e acompanha as outras abas abertas.
export default function ThemeToggle({className=''}){
  const [theme,setTheme]=useState(()=>readTheme(store()));
  useEffect(()=>{applyTheme(document,theme);},[theme]);
  useEffect(()=>{
    const sync=event=>{if(event.key===STORAGE_KEY||event.key===null)setTheme(readTheme(store()));};
    window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[]);
  const light=theme==='claro';
  return <button type="button" className={`theme-toggle ${className}`.trim()} aria-pressed={light} onClick={()=>{const next=nextTheme(theme);saveTheme(store(),next);setTheme(next);}}><Sun size={18} aria-hidden="true"/>Tema claro</button>;
}
