import React,{useEffect,useRef,useState} from 'react';
import {ImagePlus,Link2,Pencil,Plus,Trash2,Undo2} from 'lucide-react';
import './NoteBoard.css';

export const emptyNoteBoard=()=>({nodes:[],edges:[],strokes:[]});
const BOARD_WIDTH=960,BOARD_HEIGHT=620;
const bounded=(value,max)=>Math.max(0,Math.min(max,value));
const isTextTarget=target=>Boolean(target?.closest?.('textarea,input,[contenteditable="true"]'));
function segment(from,to){
  const ax=from.x+95,ay=from.y+54,bx=to.x+95,by=to.y+54,dx=bx-ax,dy=by-ay;
  if(Math.abs(dx)+Math.abs(dy)<2)return {x1:ax,y1:ay,x2:bx+1,y2:by+1};
  const edge=Math.min(Math.abs(dx)<1?Infinity:96/Math.abs(dx),Math.abs(dy)<1?Infinity:56/Math.abs(dy));
  return {x1:ax+dx*edge,y1:ay+dy*edge,x2:bx-dx*edge,y2:by-dy*edge};
}

export default function NoteBoard({value,onChange,readOnly=false}){
  const board=value||emptyNoteBoard();
  const [drawing,setDrawing]=useState(false),[selected,setSelected]=useState(null),[editingId,setEditingId]=useState(null);
  const [linkFrom,setLinkFrom]=useState(null),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('');
  const [pen,setPen]=useState({x:480,y:310,path:''});
  const boardRef=useRef(null),scrollRef=useRef(null),fileRef=useRef(null),strokePreview=useRef(null),linkPreview=useRef(null);
  const stroke=useRef(null),drag=useRef(null),pan=useRef(null),linking=useRef(null),readOnlyRef=useRef(readOnly),aliveRef=useRef(true);
  const boardValue=useRef(board),history=useRef({past:[],future:[]}),nodeHistory=useRef(new Map());
  boardValue.current=board;readOnlyRef.current=readOnly;
  useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;};},[]);
  useEffect(()=>{if(selected&&!board.nodes.some(node=>node.id===selected))setSelected(null);},[board.nodes,selected]);
  const markerId=useRef(`note-arrow-${crypto.randomUUID()}`).current;
  const nodesById=new Map(board.nodes.map(node=>[node.id,node]));
  function apply(update,undoable=false){
    const previous=boardValue.current,next=typeof update==='function'?update(previous):update;
    if(next===previous)return;
    if(undoable){history.current.past.push(previous);if(history.current.past.length>50)history.current.past.shift();history.current.future=[];}
    boardValue.current=next;onChange(next);
  }
  function undo(){
    if(readOnlyRef.current)return;
    const previous=history.current.past.pop();if(!previous)return;
    history.current.future.push(boardValue.current);boardValue.current=previous;onChange(previous);
    setEditingId(null);setLinkFrom(null);setAnnouncement('Última ação desfeita.');
    boardRef.current?.focus();
  }
  function redo(){
    if(readOnlyRef.current)return;
    const next=history.current.future.pop();if(!next)return;
    history.current.past.push(boardValue.current);boardValue.current=next;onChange(next);
    setEditingId(null);setLinkFrom(null);setAnnouncement('Ação refeita.');
    boardRef.current?.focus();
  }
  function point(event){const rect=boardRef.current.getBoundingClientRect();return {x:bounded(Math.round(event.clientX-rect.left),BOARD_WIDTH),y:bounded(Math.round(event.clientY-rect.top),BOARD_HEIGHT)};}
  function startPan(event){
    if(event.target!==event.currentTarget)return;
    setSelected(null);setLinkFrom(null);setEditingId(null);
    if(drawing||event.pointerType!=='mouse'||event.button!==0&&event.button!==1)return;
    const viewport=scrollRef.current;
    pan.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event){const current=pan.current;if(!current||current.pointerId!==event.pointerId)return;const viewport=scrollRef.current;viewport.scrollLeft=current.left+current.x-event.clientX;viewport.scrollTop=current.top+current.y-event.clientY;}
  function endPan(event){if(pan.current?.pointerId===event.pointerId)pan.current=null;}
  function center(){const viewport=scrollRef.current;return {x:bounded(Math.round((viewport.scrollLeft+viewport.clientWidth/2)-95),BOARD_WIDTH-220),y:bounded(Math.round((viewport.scrollTop+viewport.clientHeight/2)-50),BOARD_HEIGHT-150)};}
  function focusEditor(id){requestAnimationFrame(()=>{const field=boardRef.current?.querySelector(`[data-node-id="${id}"] textarea, [data-node-id="${id}"] input`);field?.focus();field?.select();});}
  function startEditing(id){if(readOnly)return;setSelected(id);setEditingId(id);focusEditor(id);}
  function addIdeaAt(x,y,{text='Nova ideia',from=null,edit=true}={}){
    if(readOnly||boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    if(from&&boardValue.current.edges.length>=120){setError('O mapa mental chegou ao limite de 120 conexões.');return;}
    const id=crypto.randomUUID(),node={id,kind:'text',x:bounded(Math.round(x),BOARD_WIDTH-220),y:bounded(Math.round(y),BOARD_HEIGHT-150),text};
    apply(previous=>({...previous,nodes:[...previous.nodes,node],edges:from?[...previous.edges,{id:crypto.randomUUID(),from,to:id}]:previous.edges}),true);
    setSelected(id);setLinkFrom(null);setError('');
    if(edit)startEditing(id);else requestAnimationFrame(()=>boardRef.current?.querySelector(`[data-node-id="${id}"] .note-board-node-grip`)?.focus());
  }
  function createImage(file,x,y){
    if(!file)return;
    if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Use PNG, JPEG ou WebP de até 2 MB.');return;}
    setError('');const reader=new FileReader();
    reader.onload=()=>{
      if(!aliveRef.current)return;
      if(readOnlyRef.current){setError('O salvamento começou antes de anexar a imagem. Tente novamente.');return;}
      const id=crypto.randomUUID(),node={id,kind:'image',x:bounded(x,BOARD_WIDTH-220),y:bounded(y,BOARD_HEIGHT-150),text:file.name.slice(0,100),src:reader.result};
      apply(previous=>({...previous,nodes:[...previous.nodes,node]}),true);setSelected(id);setAnnouncement('Imagem adicionada ao quadro.');
    };
    reader.onerror=()=>setError('Não foi possível ler a imagem.');reader.readAsDataURL(file);
  }
  function attachImage(event){const file=event.target.files?.[0];event.target.value='';const p=center();createImage(file,p.x,p.y);}
  function connectNodes(from,to){
    const current=boardValue.current;
    if(from===to||!current.nodes.some(node=>node.id===from)||!current.nodes.some(node=>node.id===to))return;
    if(current.edges.some(edge=>edge.from===from&&edge.to===to)){setLinkFrom(null);return;}
    if(current.edges.length>=120){setError('O mapa mental chegou ao limite de 120 conexões.');return;}
    apply(previous=>({...previous,edges:[...previous.edges,{id:crypto.randomUUID(),from,to}]}),true);
    setLinkFrom(null);setSelected(to);setAnnouncement('Ideias conectadas.');
  }
  function chooseConnector(id){
    if(readOnly)return;
    if(linkFrom&&linkFrom!==id)connectNodes(linkFrom,id);
    else{setLinkFrom(id);setSelected(id);setAnnouncement('Escolha o ponto de outra ideia para conectar.');}
  }
  function startLink(event,id){
    if(readOnly||drawing||event.button!==0)return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    linking.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false};
    const node=nodesById.get(id),line=linkPreview.current;
    line.setAttribute('x1',node.x+190);line.setAttribute('y1',node.y+54);
    line.setAttribute('x2',node.x+190);line.setAttribute('y2',node.y+54);line.style.visibility='visible';
    setSelected(id);
  }
  function moveLink(event){
    const current=linking.current;if(!current||current.pointerId!==event.pointerId)return;
    if(Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>8)current.moved=true;
    const p=point(event);linkPreview.current?.setAttribute('x2',p.x);linkPreview.current?.setAttribute('y2',p.y);
  }
  function finishLink(event){
    const current=linking.current;if(!current||current.pointerId!==event.pointerId)return;
    linking.current=null;if(linkPreview.current)linkPreview.current.style.visibility='hidden';
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-node-id]')?.dataset.nodeId;
    if(target&&target!==current.id){connectNodes(current.id,target);return;}
    const rect=boardRef.current.getBoundingClientRect();
    if(current.moved&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom){
      const p=point(event);addIdeaAt(p.x-95,p.y-50,{from:current.id});return;
    }
    if(!current.moved)chooseConnector(current.id);
  }
  function cancelLink(){linking.current=null;if(linkPreview.current)linkPreview.current.style.visibility='hidden';}
  function moveNode(event,id){
    if(readOnly||drawing||event.button!==0)return;
    event.stopPropagation();
    const node=nodesById.get(id);if(!node)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:node.x,y:node.y,element:event.currentTarget.closest('.note-board-node')};
    setSelected(id);setLinkFrom(null);
  }
  function dragging(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    current.nextX=bounded(Math.round(current.x+event.clientX-current.startX),BOARD_WIDTH-220);
    current.nextY=bounded(Math.round(current.y+event.clientY-current.startY),BOARD_HEIGHT-150);
    current.element.style.transform=`translate(${current.nextX-current.x}px,${current.nextY-current.y}px)`;
  }
  function finishDrag(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    drag.current=null;current.element.style.transform='';
    if(current.nextX===undefined||readOnlyRef.current||current.nextX===current.x&&current.nextY===current.y)return;
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===current.id?{...node,x:current.nextX,y:current.nextY}:node)}),true);
  }
  function startStroke(event){
    if(readOnly||!drawing||event.button!==0)return;
    if(boardValue.current.strokes.length>=150){setError('O mapa mental chegou ao limite de 150 traços.');return;}
    const p=point(event);event.currentTarget.setPointerCapture(event.pointerId);
    stroke.current={pointerId:event.pointerId,path:`M ${p.x} ${p.y}`};strokePreview.current?.setAttribute('d',stroke.current.path);
  }
  function draw(event){const current=stroke.current;if(!current||current.pointerId!==event.pointerId)return;const p=point(event);if(current.path.length>14000)return;current.path+=` L ${p.x} ${p.y}`;strokePreview.current?.setAttribute('d',current.path);}
  function finishStroke(event){
    const current=stroke.current;if(!current||current.pointerId!==event.pointerId)return;
    stroke.current=null;strokePreview.current?.setAttribute('d','');
    if(current.path.includes(' L ')&&!readOnlyRef.current)apply(previous=>({...previous,strokes:[...previous.strokes,{id:crypto.randomUUID(),path:current.path}]}),true);
  }
  function removeSelected(){
    if(!selected||readOnly)return;
    apply(previous=>({...previous,nodes:previous.nodes.filter(node=>node.id!==selected),edges:previous.edges.filter(edge=>edge.from!==selected&&edge.to!==selected)}),true);
    setSelected(null);setEditingId(null);setLinkFrom(null);setAnnouncement('Ideia removida. Ctrl+Z desfaz.');
    boardRef.current?.focus();
  }
  function editNodeText(id,event){
    const current=boardValue.current.nodes.find(node=>node.id===id)?.text,value=event.target.value;
    if(current===undefined||value===current)return;
    const entry=nodeHistory.current.get(id)||{past:[],future:[]};entry.past.push(current);
    if(entry.past.length>100)entry.past.shift();entry.future=[];nodeHistory.current.set(id,entry);
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===id?{...node,text:value}:node)}));
  }
  function nodeTextShortcut(id,event){
    if(event.key==='Escape'){event.preventDefault();setEditingId(null);boardRef.current?.querySelector(`[data-node-id="${id}"] .note-board-node-grip`)?.focus();return;}
    if(!(event.ctrlKey||event.metaKey)||event.altKey||readOnly)return;
    const key=event.key.toLowerCase(),redo=key==='y'||key==='z'&&event.shiftKey;
    if(key!=='z'&&!redo)return;
    event.preventDefault();event.stopPropagation();
    const entry=nodeHistory.current.get(id),source=redo?entry?.future:entry?.past,destination=redo?entry?.past:entry?.future;
    if(!source?.length){if(!redo)undo();return;}
    const previous=source.pop();destination.push(boardValue.current.nodes.find(node=>node.id===id)?.text||'');
    apply(current=>({...current,nodes:current.nodes.map(node=>node.id===id?{...node,text:previous}:node)}));
    const input=event.currentTarget;requestAnimationFrame(()=>{if(input.isConnected&&document.activeElement===input)input.setSelectionRange(previous.length,previous.length);});
  }
  function nudge(event,id){
    const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];
    if(!delta||readOnly||drawing||event.ctrlKey||event.metaKey)return;
    event.preventDefault();const node=nodesById.get(id);
    apply(previous=>({...previous,nodes:previous.nodes.map(item=>item.id===id?{...item,x:bounded(node.x+delta[0],BOARD_WIDTH-220),y:bounded(node.y+delta[1],BOARD_HEIGHT-150)}:item)}),true);
  }
  function keyboardStroke(event){
    if(readOnly||!drawing||event.target!==event.currentTarget)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(delta){event.preventDefault();const step=event.shiftKey?25:10;setPen(previous=>{const x=bounded(previous.x+delta[0]*step,BOARD_WIDTH),y=bounded(previous.y+delta[1]*step,BOARD_HEIGHT);return {x,y,path:previous.path?`${previous.path} L ${x} ${y}`:''};});return;}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!pen.path){if(boardValue.current.strokes.length>=150){setError('O mapa mental chegou ao limite de 150 traços.');return;}setPen(previous=>({...previous,path:`M ${previous.x} ${previous.y}`}));}
      else{if(pen.path.includes(' L '))apply(previous=>({...previous,strokes:[...previous.strokes,{id:crypto.randomUUID(),path:pen.path}]}),true);setPen(previous=>({...previous,path:''}));}}
  }
  function boardKeyDown(event){
    if(isTextTarget(event.target))return;
    const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
    if(!readOnly&&modifier&&!event.altKey&&(key==='z'||key==='y')){event.preventDefault();if(key==='y'||event.shiftKey)redo();else undo();return;}
    if(!readOnly&&(event.key==='Delete'||event.key==='Backspace')&&selected){event.preventDefault();removeSelected();return;}
    if(event.key==='Escape'){setSelected(null);setEditingId(null);setLinkFrom(null);setPen(previous=>({...previous,path:''}));return;}
    if(!readOnly&&!modifier&&!event.altKey&&key==='n'){event.preventDefault();const p=center();addIdeaAt(p.x,p.y);return;}
    keyboardStroke(event);
  }
  function copyNode(event){
    if(isTextTarget(event.target)||!selected)return;
    const node=boardValue.current.nodes.find(item=>item.id===selected);if(!node)return;
    event.preventDefault();const payload={kind:node.kind,text:node.text,src:node.src};
    event.clipboardData.setData('text/plain',node.text||'Ideia');
    try{event.clipboardData.setData('application/x-grimorio-idea',JSON.stringify(payload));}catch{}
    setAnnouncement('Ideia copiada. Ctrl+V cria uma cópia.');
  }
  function pasteNode(event){
    if(readOnly||isTextTarget(event.target))return;
    const image=[...event.clipboardData.files].find(file=>['image/png','image/jpeg','image/webp'].includes(file.type));
    if(image){event.preventDefault();const p=center();createImage(image,p.x,p.y);return;}
    let payload=null;try{payload=JSON.parse(event.clipboardData.getData('application/x-grimorio-idea'));}catch{}
    const plain=event.clipboardData.getData('text/plain');
    const source=boardValue.current.nodes.find(node=>node.id===selected),location=source?{x:source.x+36,y:source.y+36}:center();
    if(payload?.kind==='image'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.src||'')&&payload.src.length<=3*1024*1024){
      event.preventDefault();if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
      const id=crypto.randomUUID(),node={id,kind:'image',x:bounded(location.x,BOARD_WIDTH-220),y:bounded(location.y,BOARD_HEIGHT-150),text:String(payload.text||'Imagem').slice(0,100),src:payload.src};
      apply(previous=>({...previous,nodes:[...previous.nodes,node]}),true);setSelected(id);setAnnouncement('Imagem duplicada.');return;
    }
    const text=payload?.kind==='text'?String(payload.text||'Nova ideia'):plain;
    if(!text)return;
    event.preventDefault();if(text.length>500){setError('Cole até 500 caracteres em uma ideia.');return;}
    addIdeaAt(location.x,location.y,{text,edit:false});setAnnouncement('Ideia colada. Ctrl+Z desfaz.');
  }
  return <section className="note-board" aria-label="Mapa mental da nota">
    <div className="note-board-tools" role="toolbar" aria-label="Ferramentas do mapa mental">
      {!readOnly&&<>
        <button type="button" className="note-board-new" onClick={()=>{const p=center();addIdeaAt(p.x,p.y);}}><Plus size={16} aria-hidden="true"/>Nova ideia</button>
        <button type="button" onClick={()=>fileRef.current?.click()}><ImagePlus size={16} aria-hidden="true"/>Imagem</button>
        <button type="button" aria-pressed={drawing} onClick={()=>{setDrawing(previous=>!previous);setSelected(null);setLinkFrom(null);}}><Pencil size={16} aria-hidden="true"/>{drawing?'Terminar desenho':'Caneta'}</button>
        {drawing&&board.strokes.length>0&&<button type="button" onClick={()=>apply(previous=>({...previous,strokes:previous.strokes.slice(0,-1)}),true)}><Undo2 size={16} aria-hidden="true"/>Desfazer traço</button>}
        <input ref={fileRef} className="note-board-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Anexar imagem ao mapa mental" tabIndex={-1} onChange={attachImage}/>
      </>}
    </div>
    <p className="note-board-help">{drawing?'Desenhe com mouse, toque ou caneta. Pelo teclado, foque o quadro, use Enter e as setas.':readOnly?'Explore as ideias e suas conexões.':'Duplo clique cria · arraste o fundo para percorrer · arraste cartões para mover · puxe o ponto lateral para ligar · Ctrl+C/V duplica a ideia selecionada.'}</p>
    {error&&<p className="note-board-error" role="alert">{error}</p>}
    <span className="note-board-announcement" role="status">{announcement}</span>
    <div ref={scrollRef} className="note-board-scroll"><div ref={boardRef} className={`note-board-canvas ${drawing?'is-drawing':''}`} style={{width:BOARD_WIDTH,height:BOARD_HEIGHT}} tabIndex={0} role="group" aria-label={drawing?'Quadro de desenho; Enter inicia ou termina, setas traçam, Escape cancela':'Quadro de ideias; duplo clique cria, N cria pelo teclado, Ctrl+C/V copia e cola a ideia selecionada'} onKeyDown={boardKeyDown} onCopy={copyNode} onCut={event=>{if(selected&&!isTextTarget(event.target)){copyNode(event);removeSelected();}}} onPaste={pasteNode} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onDoubleClick={event=>{if(readOnly||drawing||event.target!==event.currentTarget)return;const p=point(event);addIdeaAt(p.x-95,p.y-50);}}>
      <svg className={`note-board-lines ${drawing?'is-drawing':''}`} width={BOARD_WIDTH} height={BOARD_HEIGHT} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} aria-hidden="true" onPointerDown={startStroke} onPointerMove={draw} onPointerUp={finishStroke} onPointerCancel={finishStroke}>
        <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 1 L 7 4 L 0 7" fill="none" stroke="#d9b777" strokeWidth="1.5"/></marker></defs>
        {board.edges.map(edge=>{const from=nodesById.get(edge.from),to=nodesById.get(edge.to);return from&&to?<line key={edge.id} {...segment(from,to)} markerEnd={`url(#${markerId})`} stroke="#d9b777" strokeWidth="2"/>:null;})}
        {board.strokes.map(item=><path key={item.id} d={item.path} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}
        <line ref={linkPreview} className="note-board-link-preview" x1="0" y1="0" x2="0" y2="0"/>
        <path ref={strokePreview} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {drawing&&<><path d={pen.path} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle className="note-board-pen" cx={pen.x} cy={pen.y} r="6"/></>}
      </svg>
      {!board.nodes.length&&!board.strokes.length&&<div className="note-board-empty" aria-hidden="true"><strong>Comece uma ideia</strong>Duplo clique no quadro ou use “Nova ideia”. Depois, arraste o ponto lateral para ligar outra.</div>}
      {board.nodes.map(node=><article key={node.id} data-node-id={node.id} className={`note-board-node ${selected===node.id?'is-selected':''} ${linkFrom===node.id?'is-link-source':''}`} style={{left:node.x,top:node.y}} onClick={event=>{if(event.target.tagName==='IMG')setSelected(node.id);}}>
        <button type="button" className={`note-board-node-grip ${readOnly?'is-readonly':''}`} aria-label={`Selecionar ${node.text||'ideia'}${readOnly?'':'; Enter edita e setas movem'}`} aria-pressed={selected===node.id} onClick={event=>{event.stopPropagation();setSelected(node.id);setLinkFrom(null);}} onDoubleClick={()=>startEditing(node.id)} onPointerDown={event=>moveNode(event,node.id)} onPointerMove={dragging} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={event=>{if(event.key==='Enter'&&!readOnly){event.preventDefault();startEditing(node.id);}else nudge(event,node.id);}}>{node.kind==='image'?'Imagem':'Ideia'}<span aria-hidden="true">⋮⋮</span></button>
        {node.kind==='image'&&<img src={node.src} alt={node.text||'Imagem anexada'} width="170" height="106" loading="lazy" draggable="false"/>}
        {editingId===node.id&&!readOnly?(node.kind==='image'?<input aria-label="Legenda da imagem" value={node.text} maxLength={100} autoComplete="off" onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>:<textarea aria-label="Texto da ideia" value={node.text} maxLength={500} autoComplete="off" onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>):<button type="button" className="note-board-preview" onClick={()=>{if(!readOnly&&selected===node.id)startEditing(node.id);else setSelected(node.id);}} onDoubleClick={()=>startEditing(node.id)} onKeyDown={event=>nudge(event,node.id)} aria-label={`${node.kind==='image'?'Legenda':'Texto'}: ${node.text||'sem texto'}.${readOnly?'':' Ative novamente para editar'}`}>{node.text||'Sem texto'}</button>}
        {!readOnly&&!drawing&&<button type="button" className="note-board-connector" aria-label={`Ligar ${node.text||'ideia'} a outra ideia`} aria-pressed={linkFrom===node.id} onPointerDown={event=>startLink(event,node.id)} onPointerMove={moveLink} onPointerUp={finishLink} onPointerCancel={cancelLink} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();chooseConnector(node.id);}}}><Link2 size={17} aria-hidden="true"/></button>}
        {!readOnly&&selected===node.id&&!drawing&&<button type="button" className="note-board-node-delete" aria-label={`Excluir ${node.text||'ideia'}`} onClick={removeSelected}><Trash2 size={15} aria-hidden="true"/></button>}
      </article>)}
    </div></div>
    {!!board.edges.length&&<details className="note-board-links"><summary>Conexões ({board.edges.length})</summary><div>{board.edges.map(edge=><div key={edge.id}><span>{nodesById.get(edge.from)?.text||'Ideia'} → {nodesById.get(edge.to)?.text||'Ideia'}</span>{!readOnly&&<button type="button" aria-label={`Remover conexão de ${nodesById.get(edge.from)?.text||'ideia'} para ${nodesById.get(edge.to)?.text||'ideia'}`} onClick={()=>apply(previous=>({...previous,edges:previous.edges.filter(item=>item.id!==edge.id)}),true)}><Trash2 size={14} aria-hidden="true"/></button>}</div>)}</div></details>}
  </section>;
}
