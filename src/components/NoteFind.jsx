import {useEffect,useId,useLayoutEffect,useMemo,useRef} from 'react';
import {ChevronDown,ChevronUp,X} from 'lucide-react';
import {findTextMatches} from './noteFind.js';
import './NoteFind.css';

export function NoteFindBar({query,onQuery,count,index,onStep,onClose,boardOpen}){
  const id=useId(),inputRef=useRef(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  return <div className="note-find-bar" role="search" aria-label={boardOpen?'Buscar no mapa mental aberto':'Buscar no texto aberto'} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
    if(event.key==='Enter'&&event.target===inputRef.current){event.preventDefault();onStep(event.shiftKey?-1:1);}
  }}>
    <label htmlFor={id}>{boardOpen?'Buscar no mapa mental':'Buscar no texto'}</label>
    <div className="note-find-controls"><input ref={inputRef} id={id} type="search" name="note-find" autoComplete="off" maxLength={100} value={query} onChange={event=>onQuery(event.target.value)} placeholder="Palavra ou trecho…"/>
      <button type="button" aria-label="Resultado anterior" disabled={!count} onClick={()=>onStep(-1)}><ChevronUp size={18} aria-hidden="true"/></button>
      <button type="button" aria-label="Próximo resultado" disabled={!count} onClick={()=>onStep(1)}><ChevronDown size={18} aria-hidden="true"/></button>
      <button type="button" aria-label="Fechar busca" onClick={onClose}><X size={18} aria-hidden="true"/></button>
    </div>
    <output aria-live="polite">{query.trim()?count?`${index+1} de ${count} resultados`:'Nenhum resultado':'Digite uma palavra para encontrar.'}</output>
  </div>;
}

export function NoteHighlight({text,query='',active,svg=false,ranges}){
  const parts=useMemo(()=>{
    const matches=ranges||findTextMatches(text,query),result=[];
    let cursor=0;
    for(const match of matches){
      if(cursor<match.start)result.push(text.slice(cursor,match.start));
      const current=active?.start===match.start&&active?.end===match.end;
      const Tag=svg?'tspan':'mark';
      result.push(<Tag key={match.start} className={current?'note-find-current':'note-find-match'}>{text.slice(match.start,match.end)}</Tag>);
      cursor=match.end;
    }
    if(cursor<text.length)result.push(text.slice(cursor));
    return result.length?result:text;
  },[text,query,active?.start,active?.end,svg,ranges]);
  return parts;
}

export function NoteTextEditor({value,onChange,onKeyDown,readOnly,disabled,matches,active,searchNavigation=0}){
  const id=useId(),fieldRef=useRef(null),mirrorRef=useRef(null),layerRef=useRef(null);
  const sync=field=>{if(mirrorRef.current){mirrorRef.current.style.width=`${field.clientWidth}px`;mirrorRef.current.style.transform=`translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;}};
  useEffect(()=>{
    const field=fieldRef.current,observer=new ResizeObserver(()=>sync(field));
    observer.observe(field);sync(field);return()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{if(fieldRef.current)sync(fieldRef.current);},[value]);
  useLayoutEffect(()=>{
    const field=fieldRef.current;sync(field);
    const mark=mirrorRef.current?.querySelector('.note-find-current');
    if(!mark)return;
    const target=mark.getBoundingClientRect(),viewport=layerRef.current.getBoundingClientRect();
    if(target.top<viewport.top||target.bottom>viewport.bottom)field.scrollTop+=target.top-viewport.top-field.clientHeight/2;
    if(target.left<viewport.left||target.right>viewport.right)field.scrollLeft+=target.left-viewport.left-field.clientWidth/2;
    sync(field);
    const content=field.closest('.note-window-content'),outer=content?.getBoundingClientRect(),visibleMark=mark.getBoundingClientRect();
    const findBar=content?.querySelector('.note-find-bar')?.getBoundingClientRect();
    if(outer&&visibleMark.bottom>outer.bottom)content.scrollTop+=visibleMark.bottom-outer.bottom+8;
    else if(outer&&visibleMark.top<Math.max(outer.top,findBar?.bottom||outer.top))content.scrollTop-=Math.max(outer.top,findBar?.bottom||outer.top)-visibleMark.top+8;
    // Finding navigates; ordinary typing and undo keep the editor's own scroll position.
  },[searchNavigation]);
  return <label className="note-body-label" htmlFor={id}>Anotações<div className="note-text-editor">
    <div ref={layerRef} className="note-find-mirror" aria-hidden="true"><div ref={mirrorRef} className="note-find-mirror-text"><NoteHighlight text={value} ranges={matches} active={active}/>{'\n'}</div></div>
    <textarea ref={fieldRef} id={id} name="note-body" value={value} maxLength={50000} readOnly={readOnly} disabled={disabled} onChange={onChange} onKeyDown={onKeyDown} onScroll={event=>sync(event.currentTarget)} placeholder="Escreva suas anotações…" wrap="soft"/>
  </div></label>;
}
