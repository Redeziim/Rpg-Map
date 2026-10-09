import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,List} from 'lucide-react';
import {clampStart,pagesInView,paginate,viewLabel,viewStart} from '../shared/bookPages.js';
import './SheetBook.css';

// Duração da virada; o mesmo valor está em --turn-ms no CSS. A folga cobre o fim da animação em máquinas lentas.
const TURN_MS=640;
const WIDE=760;
// Altura útil de uma página em px: o livro menos cabeçalho, número da página e margens do corpo (medido com o livro a 568 px: 410).
const PAGE_CHROME_PX=158;
export const pageCapacity=height=>Math.max(260,height-PAGE_CHROME_PX);
const reduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const typing=target=>target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));

function Page({page,number,side,ghost=false}){
  if(!page)return <div className={`book-page book-page-${side} book-page-blank`} aria-hidden="true"/>;
  return <section className={`book-page book-page-${side}`} aria-label={`Página ${number}: ${page.title}`} inert={ghost?'':undefined} aria-hidden={ghost?'true':undefined}>
    <header className="book-page-head">{page.title}</header>
    <div className="book-page-body" tabIndex={ghost?undefined:0} role="region" aria-label={`Conteúdo da página ${number}`}>{page.node}</div>
    <footer className="book-page-number">{number}</footer>
  </section>;
}

// Ficha como livro: capa com o perfil, uma página por grupo de categorias e, no fim, as ferramentas.
// Só as páginas à vista ficam montadas. Durante a virada, as faces do papel em movimento são cópias sem foco (inert).
export default function SheetBook({cover,items,tools,onShowList,label='Ficha do personagem'}){
  const hostRef=useRef(null),spreadRef=useRef(null),touch=useRef(null);
  const [perView,setPerView]=useState(2),[capacity,setCapacity]=useState(410),[start,setStart]=useState(0),[turn,setTurn]=useState(null);

  useLayoutEffect(()=>{
    const host=hostRef.current;
    if(!host||typeof ResizeObserver==='undefined')return;
    const spread=spreadRef.current;
    const measure=()=>{setPerView(host.clientWidth>=WIDE?2:1);if(spread)setCapacity(pageCapacity(spread.clientHeight));};
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(host);
    if(spread)observer.observe(spread);
    return ()=>observer.disconnect();
  },[]);

  const pages=useMemo(()=>{
    const list=[{key:'capa',title:'Capa',tab:'Capa',node:cover}];
    for(const [index,group] of paginate(items.map(item=>({category:item.category,weight:item.weight})),capacity).entries()){
      const nodes=group.categories.map(category=>items.find(item=>item.category===category));
      const title=group.categories.join(' · ');
      list.push({key:`grupo-${index}`,title,tab:group.categories.length>1?`${group.categories[0]} +${group.categories.length-1}`:group.categories[0],node:<div className="category-layout">{nodes.map(item=><React.Fragment key={item.category}>{item.node}</React.Fragment>)}</div>});
    }
    if(tools)list.push({key:'ferramentas',title:'Ferramentas',tab:'Importar ficha',node:tools});
    return list;
  },[cover,items,tools,capacity]);

  const total=pages.length,current=clampStart(start,total,perView);
  useEffect(()=>{if(current!==start)setStart(current);},[current,start]);
  useEffect(()=>{if(!turn)return;const timer=setTimeout(()=>{setStart(turn.to);setTurn(null);},TURN_MS+80);return ()=>clearTimeout(timer);},[turn]);

  const go=useCallback(target=>{
    const to=clampStart(target,total,perView);
    if(turn||to===current)return;
    if(reduced())setStart(to);else setTurn({from:current,to,dir:to>current?'forward':'back'});
  },[turn,total,perView,current]);

  const settled=turn?turn.to:current,visible=pagesInView(settled,total,perView);
  const onKeyDown=event=>{
    if(typing(event.target)||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='ArrowRight'){event.preventDefault();go(current+perView);}
    if(event.key==='ArrowLeft'){event.preventDefault();go(current-perView);}
  };
  const onPointerDown=event=>{if(event.pointerType==='touch')touch.current={x:event.clientX,y:event.clientY};};
  const onPointerUp=event=>{
    const origin=touch.current;touch.current=null;
    if(!origin||event.pointerType!=='touch')return;
    const dx=event.clientX-origin.x,dy=Math.abs(event.clientY-origin.y);
    if(Math.abs(dx)>70&&dy<50)go(dx<0?current+perView:current-perView);
  };

  const ghost=(index,side)=><Page page={pages[index]} number={index+1} side={side} ghost/>;
  const solid=(index,side)=><Page page={pages[index]} number={index+1} side={side}/>;
  let spread;
  if(!turn){
    spread=perView===2?<>{solid(current,'left')}{solid(current+1,'right')}</>:solid(current,'single');
  }else if(perView===2){
    const {from,to,dir}=turn;
    spread=dir==='forward'
      ?<>{solid(from,'left')}{ghost(to+1,'right')}<div className="book-leaf"><div className="book-face">{ghost(from+1,'right')}</div><div className="book-face book-face-back">{ghost(to,'left')}</div></div></>
      :<>{ghost(to,'left')}{solid(from+1,'right')}<div className="book-leaf"><div className="book-face">{ghost(from,'left')}</div><div className="book-face book-face-back">{ghost(to+1,'right')}</div></div></>;
  }else{
    const {from,to,dir}=turn;
    spread=dir==='forward'
      ?<>{ghost(to,'single')}<div className="book-leaf"><div className="book-face">{ghost(from,'single')}</div></div></>
      :<>{ghost(from,'single')}<div className="book-leaf"><div className="book-face">{ghost(to,'single')}</div></div></>;
  }

  const first=settled<=0,last=settled+perView>=total;
  return <div ref={hostRef} className="sheet-book" role="group" aria-roledescription="livro" aria-label={label} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
    <div className="book-tabs" role="tablist" aria-label="Seções da ficha">
      {pages.map((page,index)=><button key={page.key} type="button" role="tab" className="book-tab" aria-selected={visible.includes(index)} onClick={()=>go(viewStart(index,perView))}>{page.tab}</button>)}
    </div>
    <div className={`book-stage ${perView===1?'is-single':'is-double'} ${turn?`is-turning dir-${turn.dir}`:''}`} style={{'--turn-ms':`${TURN_MS}ms`}}>
      <div className="book-spread" ref={spreadRef}>{spread}</div>
    </div>
    <div className="book-controls">
      <button type="button" className="sheet-tool-btn book-turn" onClick={()=>go(settled-perView)} disabled={first||!!turn} aria-label="Página anterior"><ChevronLeft size={18} aria-hidden="true"/></button>
      <span className="book-counter" role="status" aria-live="polite">{viewLabel(settled,total,perView)}</span>
      <button type="button" className="sheet-tool-btn book-turn" onClick={()=>go(settled+perView)} disabled={last||!!turn} aria-label="Próxima página"><ChevronRight size={18} aria-hidden="true"/></button>
      <button type="button" className="sheet-tool-btn book-list" onClick={onShowList}><List size={16} aria-hidden="true"/>Ver como lista</button>
    </div>
  </div>;
}
