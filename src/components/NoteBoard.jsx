import React,{useEffect,useId,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {ImagePlus,Link2,MapPin,MoreHorizontal,Pencil,Plus,Trash2,Undo2,X,ZoomIn,ZoomOut,Expand} from 'lucide-react';
import {imageSignatureMatches} from '../shared/imageSignature.js';
import {api} from '../api.js';
import {emptyNoteBoard} from './noteBoardDefaults.js';
import {NoteHighlight} from './NoteFind.jsx';
import './NoteBoard.css';
import './NoteBoardLayout.css';

const MIN_WIDTH=960,MIN_HEIGHT=620,MAX_WIDTH=3840,MAX_HEIGHT=2480,MIN_ZOOM=.05;
const CARD_TYPES={person:'Pessoa',place:'Local',scene:'Cena',clue:'Pista'};
const bounded=(value,max)=>Math.max(0,Math.min(max,value));
const isTextTarget=target=>Boolean(target?.closest?.('textarea,input,[contenteditable="true"]'));
const nodeTags=node=>Array.isArray(node?.tags)?node.tags.filter(tag=>typeof tag==='string'):[];
const validTags=tags=>Array.isArray(tags)&&tags.length<=8&&tags.every(tag=>typeof tag==='string'&&tag===tag.trim()&&tag.length>=1&&tag.length<=30)&&new Set(tags.map(tag=>tag.toLocaleLowerCase('pt-BR'))).size===tags.length;
const copiedMetadata=payload=>({...(CARD_TYPES[payload?.category]?{category:payload.category}:{}),...(validTags(payload?.tags)?{tags:payload.tags}:{})});
function segment(from,to){
  const ax=from.x+95,ay=from.y+54,bx=to.x+95,by=to.y+54,dx=bx-ax,dy=by-ay;
  if(Math.abs(dx)+Math.abs(dy)<2)return {x1:ax,y1:ay,x2:bx+1,y2:by+1};
  const edge=Math.min(Math.abs(dx)<1?Infinity:96/Math.abs(dx),Math.abs(dy)<1?Infinity:56/Math.abs(dy));
  return {x1:ax+dx*edge,y1:ay+dy*edge,x2:bx-dx*edge,y2:by-dy*edge};
}

const zoomMemory=key=>'grimorio-board-zoom-v1:'+key;
function readZoom(key){try{const saved=Number(localStorage.getItem(zoomMemory(key)));return saved>=MIN_ZOOM&&saved<=2?saved:1;}catch{return 1;}}
export const BOARD_SHORTCUTS=[['N','Novo cartão no centro da vista'],['Setas','Mover o cartão selecionado de 10 em 10 pixels'],['Enter ou Espaço','Selecionar o cartão em foco'],['Shift + clique','Selecionar vários cartões'],['Delete ou Backspace','Remover o cartão ou a conexão selecionada'],['Esc','Limpar a seleção ou cancelar o traço'],['Ctrl + Z','Desfazer'],['Ctrl + Y ou Ctrl + Shift + Z','Refazer'],['Ctrl + C e Ctrl + V','Copiar e colar um cartão; colar uma imagem cria um cartão de imagem'],['Ctrl + F','Buscar nesta nota'],['No modo desenho: setas','Mover a caneta (Shift = 25 pixels)'],['No modo desenho: Enter ou Espaço','Começar e terminar o traço']];
export default function NoteBoard({value,onChange,readOnly=false,points=[],onOpenPoint,roomId,searchQuery='',activeSearch,searchNavigation=0,zoomKey}){
  const board=value||emptyNoteBoard();
  const width=board.width||MIN_WIDTH,height=board.height||MIN_HEIGHT;
  const [zoom,setZoom]=useState(()=>zoomKey?readZoom(zoomKey):1);
  const [optionsOpen,setOptionsOpen]=useState(false),drawerId=useId(),moreButton=useRef(null),drawer=useRef(null);
  useEffect(()=>{
    if(!optionsOpen)return undefined;
    const escape=event=>{
      if(event.key!=='Escape')return;
      if(drawer.current?.contains(document.activeElement))moreButton.current?.focus();
      setOptionsOpen(false);
    };
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[optionsOpen]);
  const [drawing,setDrawing]=useState(false),[selected,setSelected]=useState(null),[selectedCards,setSelectedCards]=useState(new Set()),[editingId,setEditingId]=useState(null);
  const [linkFrom,setLinkFrom]=useState(null),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('');
  const [editingEdge,setEditingEdge]=useState(null),[edgeDraft,setEdgeDraft]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('all'),[tagFilter,setTagFilter]=useState('all');
  const [tagInput,setTagInput]=useState(''),[tagError,setTagError]=useState('');
  const [pen,setPen]=useState({x:480,y:310,path:''});
  const [libraryOpen,setLibraryOpen]=useState(false),[libraryLoading,setLibraryLoading]=useState(false),[librarySearch,setLibrarySearch]=useState(''),[assets,setAssets]=useState([]),[assetUploads,setAssetUploads]=useState(0);
  const boardRef=useRef(null),scrollRef=useRef(null),fileRef=useRef(null),strokePreview=useRef(null),linkPreview=useRef(null),edgeElements=useRef(new Map()),edgeLabelElements=useRef(new Map());
  const stroke=useRef(null),drag=useRef(null),pan=useRef(null),linking=useRef(null),readOnlyRef=useRef(readOnly),aliveRef=useRef(true);
  const boardValue=useRef(board),history=useRef({past:[],future:[]}),nodeHistory=useRef(new Map());
  boardValue.current=board;readOnlyRef.current=readOnly;
  useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;};},[]);
  useEffect(()=>{if(selected&&!board.nodes.some(node=>node.id===selected))setSelected(null);},[board.nodes,selected]);
  const nodesById=new Map(board.nodes.map(node=>[node.id,node]));
  const availableTags=[...new Map(board.nodes.flatMap(nodeTags).map(tag=>[tag.toLocaleLowerCase('pt-BR'),tag])).values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const visibleNodes=board.nodes.filter(node=>(categoryFilter==='all'||(categoryFilter==='none'?!node.category:node.category===categoryFilter))&&(tagFilter==='all'||(tagFilter==='none'?!nodeTags(node).length:nodeTags(node).some(tag=>tag.toLocaleLowerCase('pt-BR')===tagFilter.toLocaleLowerCase('pt-BR')))));
  const matchingAssets=assets.filter(asset=>asset.name.toLocaleLowerCase('pt-BR').includes(librarySearch.trim().toLocaleLowerCase('pt-BR')));
  const visibleIds=new Set(visibleNodes.map(node=>node.id));
  const visibleEdges=board.edges.filter(edge=>visibleIds.has(edge.from)&&visibleIds.has(edge.to));
  useEffect(()=>{if(selected&&!visibleIds.has(selected)){setSelected(null);setEditingId(null);}if(linkFrom&&!visibleIds.has(linkFrom))setLinkFrom(null);},[selected,linkFrom,categoryFilter,tagFilter,board.nodes]);
  useEffect(()=>{setSelectedCards(current=>{const remaining=[...current].filter(id=>visibleIds.has(id));return remaining.length===current.size?current:new Set(remaining);});},[categoryFilter,tagFilter,board.nodes]);
  useEffect(()=>{if(editingEdge&&!visibleEdges.some(edge=>edge.id===editingEdge))setEditingEdge(null);},[editingEdge,categoryFilter,tagFilter,board.edges,board.nodes]);
  useEffect(()=>{if(tagFilter!=='all'&&tagFilter!=='none'&&!availableTags.some(tag=>tag.toLocaleLowerCase('pt-BR')===tagFilter))setTagFilter('all');},[tagFilter,board.nodes]);
  useEffect(()=>{
    if(!activeSearch)return;
    setEditingId(null);
    if(categoryFilter!=='all'||tagFilter!=='all')setAnnouncement('Filtros removidos para mostrar o resultado da busca.');
    setCategoryFilter('all');setTagFilter('all');
    const frame=requestAnimationFrame(()=>{
      const viewport=scrollRef.current,target=boardRef.current?.querySelector('.note-find-current');
      if(!viewport||!target)return;
      const bounds=target.getBoundingClientRect(),area=viewport.getBoundingClientRect();
      viewport.scrollLeft+=(bounds.left+bounds.right-area.left-area.right)/2;
      viewport.scrollTop+=(bounds.top+bounds.bottom-area.top-area.bottom)/2;
      const content=viewport.closest('.note-window-content'),outer=content?.getBoundingClientRect();
      if(outer&&area.bottom>outer.bottom)content.scrollTop+=area.bottom-outer.bottom;
    });
    return()=>cancelAnimationFrame(frame);
    // Recenter only for a search action; editing a matching card must keep its editor open.
  },[searchNavigation]);
  function drawAttachedLines(current,position){
    for(const link of current.links){
      const coordinates=link.from?segment(position,link.other):segment(link.other,position);
      for(const [axis,value] of Object.entries(coordinates))link.element.setAttribute(axis,value);
      if(link.label){link.label.setAttribute('x',(coordinates.x1+coordinates.x2)/2);link.label.setAttribute('y',(coordinates.y1+coordinates.y2)/2-8);}
    }
  }
  const selectedNode=nodesById.get(selected),linkedPoint=points.find(item=>item.id===selectedNode?.pointId);
  const selectedTags=nodeTags(selectedNode).join(', ');
  useEffect(()=>{setTagInput(selectedTags);setTagError('');},[selected,selectedTags]);
  function selectOnly(id){setSelected(id);setSelectedCards(id?new Set([id]):new Set());setLinkFrom(null);}
  function selectCard(id,additive=false){
    if(linkFrom&&linkFrom!==id&&!additive){connectNodes(linkFrom,id);return;}
    if(!additive){selectOnly(id);return;}
    const next=new Set(selectedCards);
    if(next.has(id))next.delete(id);else next.add(id);
    setSelectedCards(next);setSelected(next.has(id)?id:[...next].at(-1)||null);setLinkFrom(null);
    setAnnouncement(`${next.size} cartões selecionados.`);
  }
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
  function point(event){const rect=boardRef.current.getBoundingClientRect();return {x:bounded(Math.round((event.clientX-rect.left)/zoom),width),y:bounded(Math.round((event.clientY-rect.top)/zoom),height)};}
  function startPan(event){
    if(event.target!==event.currentTarget)return;
    selectOnly(null);setEditingId(null);
    if(drawing||event.pointerType!=='mouse'||event.button!==0&&event.button!==1)return;
    const viewport=scrollRef.current;
    pan.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event){const current=pan.current;if(!current||current.pointerId!==event.pointerId)return;const viewport=scrollRef.current;viewport.scrollLeft=current.left+current.x-event.clientX;viewport.scrollTop=current.top+current.y-event.clientY;}
  function endPan(event){if(pan.current?.pointerId===event.pointerId)pan.current=null;}
  function freeSpot(){
    const viewport=scrollRef.current,nodes=boardValue.current.nodes;
    if(!viewport)return {x:24,y:24};
    const left=Math.round(viewport.scrollLeft/zoom)+24,top=Math.round(viewport.scrollTop/zoom)+24,columns=Math.max(1,Math.floor((viewport.clientWidth/zoom-24)/210));
    for(let slot=0;slot<80;slot++){
      const x=bounded(left+(slot%columns)*210,width-220),y=bounded(top+Math.floor(slot/columns)*130,height-150);
      if(!nodes.some(node=>Math.abs(node.x-x)<200&&Math.abs(node.y-y)<120))return {x,y};
    }
    return center();
  }
  function center(){const viewport=scrollRef.current;return {x:bounded(Math.round((viewport.scrollLeft+viewport.clientWidth/2)/zoom-95),width-220),y:bounded(Math.round((viewport.scrollTop+viewport.clientHeight/2)/zoom-50),height-150)};}
  function changeZoom(next){
    const viewport=scrollRef.current,level=Math.max(MIN_ZOOM,Math.min(2,Math.round(next*20)/20));
    if(!viewport||level===zoom)return;
    const x=(viewport.scrollLeft+viewport.clientWidth/2)/zoom,y=(viewport.scrollTop+viewport.clientHeight/2)/zoom;
    setZoom(level);
    // The zoom you chose is yours: it stays in this browser, per note.
    if(zoomKey){try{localStorage.setItem(zoomMemory(zoomKey),String(level));}catch{/* private mode: the zoom still works for this session */}}
    requestAnimationFrame(()=>{viewport.scrollLeft=x*level-viewport.clientWidth/2;viewport.scrollTop=y*level-viewport.clientHeight/2;});
  }
  function expand(){
    if(readOnly)return;
    const nextWidth=Math.min(MAX_WIDTH,width+480),nextHeight=Math.min(MAX_HEIGHT,height+310);
    if(nextWidth===width&&nextHeight===height){setError('O quadro chegou ao tamanho máximo.');return;}
    apply(previous=>({...previous,width:nextWidth,height:nextHeight}),true);
    setError('');setAnnouncement('Quadro ampliado. Ctrl+Z desfaz.');
  }
  function focusEditor(id){requestAnimationFrame(()=>{const field=boardRef.current?.querySelector(`[data-node-id="${id}"] textarea, [data-node-id="${id}"] input`);field?.focus();field?.select();});}
  function startEditing(id){if(readOnly)return;selectOnly(id);setEditingId(id);focusEditor(id);}
  function addIdeaAt(x,y,{text='Nova ideia',from=null,edit=true,metadata={}}={}){
    if(readOnly||boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    if(from&&boardValue.current.edges.length>=120){setError('O mapa mental chegou ao limite de 120 conexões.');return;}
    const id=crypto.randomUUID(),node={id,kind:'text',x:bounded(Math.round(x),width-220),y:bounded(Math.round(y),height-150),text,...metadata};
    apply(previous=>({...previous,nodes:[...previous.nodes,node],edges:from?[...previous.edges,{id:crypto.randomUUID(),from,to:id}]:previous.edges}),true);
    setCategoryFilter('all');setTagFilter('all');
    selectOnly(id);setError('');
    if(edit)startEditing(id);else requestAnimationFrame(()=>boardRef.current?.querySelector(`[data-node-id="${id}"] .note-board-node-grip`)?.focus());
  }
  const assetPath=id=>`/api/rooms/${encodeURIComponent(roomId)}/note-assets/${encodeURIComponent(id)}`;
  async function loadLibrary(){
    setLibraryOpen(true);setLibraryLoading(true);setError('');
    try{const items=await api(`/rooms/${encodeURIComponent(roomId)}/note-assets`);if(aliveRef.current)setAssets(items);}
    catch(cause){if(aliveRef.current)setError(`Não foi possível abrir a coleção: ${cause.message}`);}
    finally{if(aliveRef.current)setLibraryLoading(false);}
  }
  async function storeImage(nodeId,name,src){
    if(!roomId)return;
    setAssetUploads(count=>count+1);
    try{
      const asset=await api(`/rooms/${encodeURIComponent(roomId)}/note-assets`,{method:'POST',data:{name,src}});
      if(!aliveRef.current)return;
      setAssets(current=>current.some(item=>item.id===asset.id)?current:[asset,...current]);
      if(readOnlyRef.current)return;
      apply(previous=>{
        const original=previous.nodes.find(node=>node.id===nodeId);
        if(!original||original.src!==src)return previous;
        return {...previous,nodes:previous.nodes.map(node=>node.id===nodeId?{...node,src:undefined,assetId:asset.id}:node)};
      });
      setAnnouncement('Imagem guardada na coleção. Salve a nota para manter a referência.');
    }catch(cause){if(aliveRef.current)setError(`A imagem está no rascunho, mas não entrou na coleção: ${cause.message}`);}
    finally{if(aliveRef.current)setAssetUploads(count=>count-1);}
  }
  function insertAsset(asset){
    if(readOnly)return;
    if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    const p=center(),id=crypto.randomUUID();
    apply(previous=>({...previous,nodes:[...previous.nodes,{id,kind:'image',x:p.x,y:p.y,text:asset.name,assetId:asset.id}]}),true);
    setCategoryFilter('all');setTagFilter('all');selectOnly(id);setLibraryOpen(false);setError('');setAnnouncement('Referência adicionada. Salve a nota para compartilhar.');
  }
  async function createImage(file,x,y){
    if(!file)return;
    if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Use PNG, JPEG ou WebP de até 2 MB.');return;}
    try{if(!imageSignatureMatches(file.type,new Uint8Array(await file.slice(0,24).arrayBuffer()))){setError('O arquivo não contém uma imagem PNG, JPEG ou WebP válida.');return;}}
    catch{setError('Não foi possível verificar a imagem. Tente outro arquivo.');return;}
    setError('');const reader=new FileReader();
    reader.onload=()=>{
      if(!aliveRef.current||typeof reader.result!=='string')return;
      const preview=new Image();
      preview.onload=()=>{
        if(!aliveRef.current)return;
        if(readOnlyRef.current){setError('O salvamento começou antes de anexar a imagem. Tente novamente.');return;}
        if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
        const id=crypto.randomUUID(),node={id,kind:'image',x:bounded(x,width-220),y:bounded(y,height-150),text:file.name.slice(0,100),src:reader.result};
        apply(previous=>({...previous,nodes:[...previous.nodes,node]}),true);setCategoryFilter('all');setTagFilter('all');selectOnly(id);setAnnouncement('Imagem adicionada ao quadro.');
        void storeImage(id,node.text,node.src);
      };
      preview.onerror=()=>{if(aliveRef.current)setError('Não foi possível abrir esta imagem. Use outro arquivo.');};
      preview.src=reader.result;
    };
    reader.onerror=()=>setError('Não foi possível ler a imagem.');
    try{reader.readAsDataURL(file);}catch{setError('Não foi possível ler a imagem. Tente outro arquivo.');}
  }
  function attachImage(event){const file=event.target.files?.[0];event.target.value='';const p=center();createImage(file,p.x,p.y);}
  function connectNodes(from,to){
    const current=boardValue.current;
    if(from===to||!current.nodes.some(node=>node.id===from)||!current.nodes.some(node=>node.id===to))return;
    if(current.edges.some(edge=>edge.from===from&&edge.to===to)){setLinkFrom(null);return;}
    if(current.edges.length>=120){setError('O mapa mental chegou ao limite de 120 conexões.');return;}
    apply(previous=>({...previous,edges:[...previous.edges,{id:crypto.randomUUID(),from,to}]}),true);
    selectOnly(to);setAnnouncement('Ideias conectadas.');
  }
  function saveEdgeLabel(){
    if(!editingEdge||readOnly)return;
    const label=edgeDraft.trim();
    if(label.length>80){setError('O rótulo pode ter até 80 caracteres.');return;}
    apply(previous=>({...previous,edges:previous.edges.map(edge=>edge.id===editingEdge?{...edge,label:label||undefined}:edge)}),true);
    setEditingEdge(null);setEdgeDraft('');setError('');setAnnouncement(label?'Rótulo da conexão salvo.':'Rótulo da conexão removido.');
  }
  function focusEdgeEditor(){if(window.matchMedia('(min-width: 601px)').matches)requestAnimationFrame(()=>boardRef.current?.closest('.note-board')?.querySelector('.note-board-label-editor input')?.focus());}
  function chooseConnector(id){
    if(readOnly)return;
    if(linkFrom&&linkFrom!==id)connectNodes(linkFrom,id);
    else if(linkFrom===id){setLinkFrom(null);setAnnouncement('Conexão cancelada.');}
    else{selectOnly(id);setLinkFrom(id);setAnnouncement('Clique em outro cartão para conectar.');}
  }
  function startLink(event,id){
    if(readOnly||drawing||event.button!==0)return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    linking.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,rect:boardRef.current.getBoundingClientRect(),zoom};
    const node=nodesById.get(id),line=linkPreview.current;
    line.setAttribute('x1',node.x+190);line.setAttribute('y1',node.y+54);
    line.setAttribute('x2',node.x+190);line.setAttribute('y2',node.y+54);line.style.visibility='visible';
    setSelected(id);setSelectedCards(new Set([id]));
  }
  function moveLink(event){
    const current=linking.current;if(!current||current.pointerId!==event.pointerId)return;
    if(Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>8)current.moved=true;
    const p={x:bounded(Math.round((event.clientX-current.rect.left)/current.zoom),width),y:bounded(Math.round((event.clientY-current.rect.top)/current.zoom),height)};
    linkPreview.current?.setAttribute('x2',p.x);linkPreview.current?.setAttribute('y2',p.y);
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
    if(readOnly||drawing||event.button!==0||event.shiftKey||linkFrom)return;
    event.stopPropagation();
    const node=nodesById.get(id);if(!node)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const links=boardValue.current.edges.filter(edge=>edge.from===id||edge.to===id).map(edge=>({element:edgeElements.current.get(edge.id),label:edgeLabelElements.current.get(edge.id),from:edge.from===id,other:nodesById.get(edge.from===id?edge.to:edge.from)})).filter(link=>link.element&&link.other);
    drag.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:node.x,y:node.y,node,links,element:event.currentTarget.closest('.note-board-node')};
    selectOnly(id);
  }
  function dragging(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    current.nextX=bounded(Math.round(current.x+(event.clientX-current.startX)/zoom),width-220);
    current.nextY=bounded(Math.round(current.y+(event.clientY-current.startY)/zoom),height-150);
    current.element.style.transform=`translate(${current.nextX-current.x}px,${current.nextY-current.y}px)`;
    drawAttachedLines(current,{...current.node,x:current.nextX,y:current.nextY});
  }
  function finishDrag(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    drag.current=null;
    if(event.type==='pointercancel'||current.nextX===undefined||readOnlyRef.current||current.nextX===current.x&&current.nextY===current.y){
      drawAttachedLines(current,current.node);current.element.style.transform='';return;
    }
    flushSync(()=>apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===current.id?{...node,x:current.nextX,y:current.nextY}:node)}),true));
    current.element.style.transform='';
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
    selectOnly(null);setEditingId(null);setAnnouncement('Ideia removida. Ctrl+Z desfaz.');
    boardRef.current?.focus();
  }
  function associatePoint(pointId){
    if(!selectedNode||readOnly)return;
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===selected?{...node,...(pointId?{pointId}:{pointId:undefined})}:node)}),true);
    setAnnouncement(pointId?'Ponto associado à ideia.':'Vínculo com ponto removido.');
  }
  function changeCategory(category){
    if(!selectedNode||readOnly)return;
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===selected?{...node,category:category||undefined}:node)}),true);
    setAnnouncement(category?`Cartão definido como ${CARD_TYPES[category]}.`:'Tipo do cartão removido.');
  }
  function saveTags(){
    if(!selectedNode||readOnly)return;
    const tags=tagInput.split(',').map(tag=>tag.trim()).filter(Boolean);
    if(!validTags(tags)){
      setTagError('Use até 8 etiquetas diferentes, com até 30 caracteres cada.');
      return;
    }
    setTagError('');setTagInput(tags.join(', '));
    const previousTags=nodeTags(selectedNode);
    if(tags.length===previousTags.length&&tags.every((tag,index)=>tag===previousTags[index]))return;
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===selected?{...node,tags}:node)}),true);
    setAnnouncement('Etiquetas atualizadas.');
  }
  function arrangeCards(action){
    if(readOnly)return;
    const cards=boardValue.current.nodes.filter(node=>selectedCards.has(node.id)&&visibleIds.has(node.id));
    if(cards.length<(action.startsWith('distribute')?3:2))return;
    const axis=action.endsWith('x')?'x':'y',positions=new Map();
    if(action.startsWith('align')){
      const boundary=Math.min(...cards.map(node=>node[axis]));
      for(const node of cards)positions.set(node.id,boundary);
    }else{
      const sorted=[...cards].sort((a,b)=>a[axis]-b[axis]||a.id.localeCompare(b.id));
      const first=sorted[0][axis],last=sorted.at(-1)[axis],step=(last-first)/(sorted.length-1);
      sorted.forEach((node,index)=>positions.set(node.id,Math.round(first+step*index)));
    }
    apply(previous=>{
      const nodes=previous.nodes.map(node=>positions.has(node.id)?{...node,[axis]:positions.get(node.id)}:node);
      return nodes.every((node,index)=>node.x===previous.nodes[index].x&&node.y===previous.nodes[index].y)?previous:{...previous,nodes};
    },true);
    setAnnouncement(action.startsWith('align')?'Cartões alinhados. Ctrl+Z desfaz.':'Cartões distribuídos. Ctrl+Z desfaz.');
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
    apply(previous=>({...previous,nodes:previous.nodes.map(item=>item.id===id?{...item,x:bounded(node.x+delta[0],width-220),y:bounded(node.y+delta[1],height-150)}:item)}),true);
  }
  function keyboardStroke(event){
    if(readOnly||!drawing||event.target!==event.currentTarget)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(delta){event.preventDefault();const step=event.shiftKey?25:10;setPen(previous=>{const x=bounded(previous.x+delta[0]*step,width),y=bounded(previous.y+delta[1]*step,height);return {x,y,path:previous.path?`${previous.path} L ${x} ${y}`:''};});return;}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!pen.path){if(boardValue.current.strokes.length>=150){setError('O mapa mental chegou ao limite de 150 traços.');return;}setPen(previous=>({...previous,path:`M ${previous.x} ${previous.y}`}));}
      else{if(pen.path.includes(' L '))apply(previous=>({...previous,strokes:[...previous.strokes,{id:crypto.randomUUID(),path:pen.path}]}),true);setPen(previous=>({...previous,path:''}));}}
  }
  function boardKeyDown(event){
    if(isTextTarget(event.target))return;
    const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
    if(!readOnly&&modifier&&!event.altKey&&(key==='z'||key==='y')){event.preventDefault();if(key==='y'||event.shiftKey)redo();else undo();return;}
    if(!readOnly&&(event.key==='Delete'||event.key==='Backspace')&&selected){event.preventDefault();removeSelected();return;}
    if(event.key==='Escape'){selectOnly(null);setEditingId(null);setPen(previous=>({...previous,path:''}));return;}
    if(!readOnly&&!modifier&&!event.altKey&&key==='n'){event.preventDefault();const p=center();addIdeaAt(p.x,p.y);return;}
    keyboardStroke(event);
  }
  function copyNode(event){
    if(isTextTarget(event.target)||!selected)return;
    const node=boardValue.current.nodes.find(item=>item.id===selected);if(!node)return;
    event.preventDefault();const payload={kind:node.kind,text:node.text,src:node.src,assetId:node.assetId,roomId,pointId:node.pointId,category:node.category,tags:node.tags};
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
    if(payload?.kind==='image'&&((typeof payload.assetId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(payload.assetId)&&payload.roomId===roomId)||(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.src||'')&&payload.src.length<=3*1024*1024))){
      event.preventDefault();if(boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
      const id=crypto.randomUUID(),node={id,kind:'image',x:bounded(location.x,width-220),y:bounded(location.y,height-150),text:String(payload.text||'Imagem').slice(0,100),...(payload.assetId&&payload.roomId===roomId?{assetId:payload.assetId}:{src:payload.src}),...(points.some(item=>item.id===payload.pointId)?{pointId:payload.pointId}:{}),...copiedMetadata(payload)};
      apply(previous=>({...previous,nodes:[...previous.nodes,node]}),true);setCategoryFilter('all');setTagFilter('all');selectOnly(id);setAnnouncement('Imagem duplicada.');return;
    }
    const text=payload?.kind==='text'?String(payload.text||'Nova ideia'):plain;
    if(!text)return;
    event.preventDefault();if(text.length>500){setError('Cole até 500 caracteres em uma ideia.');return;}
    addIdeaAt(location.x,location.y,{text,edit:false,metadata:payload?.kind==='text'?copiedMetadata(payload):{}});setAnnouncement('Ideia colada. Ctrl+Z desfaz.');
  }
  return <section className="note-board" aria-label="Mapa mental da nota">
    <div className="note-board-tools" role="toolbar" aria-label="Ferramentas do mapa mental">
      {!readOnly&&<>
        <button type="button" className="note-board-new" onClick={()=>{const p=freeSpot();addIdeaAt(p.x,p.y);}}><Plus size={16} aria-hidden="true"/>Novo cartão</button>
        <button type="button" onClick={()=>fileRef.current?.click()}><ImagePlus size={16} aria-hidden="true"/>Imagem</button>
        <button type="button" aria-pressed={drawing} onClick={()=>{setDrawing(previous=>!previous);selectOnly(null);}}><Pencil size={16} aria-hidden="true"/>{drawing?'Terminar desenho':'Desenhar'}</button>
        <button type="button" onClick={undo} disabled={!history.current.past.length}><Undo2 size={16} aria-hidden="true"/>Desfazer</button>
        <input ref={fileRef} className="note-board-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Anexar imagem ao mapa mental" tabIndex={-1} onChange={attachImage}/>
      </>}
      <span className="note-board-count" role="status">{categoryFilter!=='all'||tagFilter!=='all'?`${visibleNodes.length} de ${board.nodes.length} cartões · filtro`:`${board.nodes.length} ${board.nodes.length===1?'cartão':'cartões'}`}</span>
      <button type="button" ref={moreButton} className="note-board-more" aria-expanded={optionsOpen} aria-controls={drawerId} onClick={()=>setOptionsOpen(open=>!open)}><MoreHorizontal size={16} aria-hidden="true"/>Mais</button>
      <div className="note-board-zoom" role="group" aria-label="Zoom do quadro"><button type="button" aria-label="Afastar quadro" disabled={zoom<=MIN_ZOOM} onClick={()=>changeZoom(zoom-(zoom<=.5?.05:.25))}><ZoomOut size={16} aria-hidden="true"/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button type="button" aria-label="Aproximar quadro" disabled={zoom>=2} onClick={()=>changeZoom(zoom+(zoom<.5?.05:.25))}><ZoomIn size={16} aria-hidden="true"/></button></div>
    </div>
    {assetUploads>0&&<p className="note-board-asset-status" role="status">Guardando {assetUploads} {assetUploads===1?'imagem':'imagens'} na coleção…</p>}
    <p className="sr-only">Duplo clique no fundo cria um cartão. Shift+clique seleciona vários. Ctrl+C/V copia e cola. Ctrl+Z desfaz. Use as setas para mover um cartão selecionado ou percorrer o quadro. Para desenhar pelo teclado, foque o quadro, use Enter e as setas.</p>
    <div id={drawerId} ref={drawer} className="note-board-drawer" role="region" aria-label="Mais opções do mapa mental" hidden={!optionsOpen}>
      <header><strong>Mais opções</strong><button type="button" className="note-board-drawer-close" aria-label="Fechar mais opções" onClick={()=>setOptionsOpen(false)}><X size={16} aria-hidden="true"/></button></header>
      <div className="note-board-drawer-body">
      {!readOnly&&<div className="note-board-extra-tools"><button type="button" aria-expanded={libraryOpen} onClick={()=>libraryOpen?setLibraryOpen(false):void loadLibrary()}>Coleção de imagens</button><button type="button" onClick={expand} disabled={width>=MAX_WIDTH&&height>=MAX_HEIGHT}><Expand size={16} aria-hidden="true"/>Aumentar área de desenho</button></div>}
    {libraryOpen&&<section className="note-board-library" aria-label="Coleção de imagens da mesa">
      <div className="note-board-library-heading"><strong>Referências da mesa</strong><button type="button" onClick={()=>setLibraryOpen(false)}>Fechar coleção</button></div>
      <label>Encontrar imagem<input type="search" name="board-library-search" autoComplete="off" value={librarySearch} onChange={event=>setLibrarySearch(event.target.value)} placeholder="Nome da imagem"/></label>
      {libraryLoading?<p role="status">Carregando imagens…</p>:assets.length?<ul>{matchingAssets.slice(0,40).map(asset=><li key={asset.id}><button type="button" disabled={readOnly} onClick={()=>insertAsset(asset)}><img src={assetPath(asset.id)} alt="" loading="lazy" width="58" height="46"/><span>{asset.name}<small>{Math.ceil(asset.bytes/1024)} KB · inserir no quadro</small></span></button></li>)}</ul>:<p role="status">Nenhuma imagem disponível. Use “Imagem” para enviar uma referência.</p>}
      {!libraryLoading&&assets.length>0&&matchingAssets.length===0&&<p role="status">Nenhuma imagem com este nome.</p>}
      {!libraryLoading&&matchingAssets.length>40&&<p role="status">Mostrando 40 de {matchingAssets.length} imagens. Busque pelo nome para encontrar as demais.</p>}
    </section>}
    <div className="note-board-index" role="group" aria-label="Filtrar cartões do mapa mental">
      <span className="note-board-index-title">Filtrar cartões</span>
      <label>Tipo<select name="board-category-filter" autoComplete="off" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">Todos</option><option value="none">Sem tipo</option>{Object.entries(CARD_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Etiqueta<select name="board-tag-filter" autoComplete="off" value={tagFilter} onChange={event=>setTagFilter(event.target.value)}><option value="all">Todas</option><option value="none">Sem etiqueta</option>{availableTags.map(tag=><option key={tag.toLocaleLowerCase('pt-BR')} value={tag.toLocaleLowerCase('pt-BR')}>{tag}</option>)}</select></label>
      <output className="note-board-index-count" aria-live="polite">{visibleNodes.length} de {board.nodes.length} cartões</output>
    </div>
    {!!visibleEdges.length&&<details className="note-board-links"><summary>Conexões visíveis ({visibleEdges.length})</summary><ul>{visibleEdges.map(edge=>{const from=nodesById.get(edge.from)?.text||'Ideia',to=nodesById.get(edge.to)?.text||'Ideia';return <li key={edge.id} role="listitem">
      <span className="note-board-relation">{from} — {to}{edge.label&&<em> · <NoteHighlight text={edge.label} query={searchQuery} active={activeSearch?.kind==='edge'&&activeSearch.id===edge.id?activeSearch:undefined}/></em>}</span>
      {!readOnly&&<div className="note-board-link-actions"><button type="button" aria-label={`Editar rótulo da conexão entre ${from} e ${to}`} onClick={()=>{setEditingEdge(edge.id);setEdgeDraft(edge.label||'');setError('');focusEdgeEditor();}}>Rótulo</button><button type="button" aria-label={`Remover conexão entre ${from} e ${to}`} onClick={()=>{apply(previous=>({...previous,edges:previous.edges.filter(item=>item.id!==edge.id)}),true);if(editingEdge===edge.id)setEditingEdge(null);setAnnouncement('Conexão removida. Ctrl+Z desfaz.');}}><Trash2 size={14} aria-hidden="true"/></button></div>}
      {editingEdge===edge.id&&!readOnly&&<div className="note-board-label-editor"><label>Rótulo da conexão<input name="board-edge-label" autoComplete="off" type="text" value={edgeDraft} maxLength={80} onChange={event=>setEdgeDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveEdgeLabel();}else if(event.key==='Escape'){setEditingEdge(null);setEdgeDraft('');}}}/></label><button type="button" onClick={saveEdgeLabel}>Salvar rótulo</button><button type="button" onClick={()=>{setEditingEdge(null);setEdgeDraft('');}}>Cancelar</button></div>}
    </li>;})}</ul></details>}
      <details className="note-board-shortcuts"><summary>Atalhos do teclado</summary><dl>{BOARD_SHORTCUTS.map(([keys,action])=><div key={keys}><dt>{keys}</dt><dd>{action}</dd></div>)}</dl><p>O zoom que você escolher fica guardado neste navegador, para cada nota.</p></details>
      </div>
    </div>
    <p className="note-board-help">{drawing?'Desenhe no quadro. Clique em “Terminar desenho” para voltar aos cartões.':linkFrom?'Clique em outro cartão para conectar. Escape cancela.':readOnly?'Arraste o fundo ou use as barras para explorar o quadro.':'Arraste cartões para organizar. Para conectar, puxe o círculo lateral até outro cartão.'}</p>
    {error&&<p className="note-board-error" role="alert">{error}</p>}
    <span className="note-board-announcement" role="status">{announcement}</span>
    <div className="note-board-stage"><div ref={scrollRef} className="note-board-scroll"><div className="note-board-extent" style={{width:width*zoom,height:height*zoom}}><div ref={boardRef} className={`note-board-canvas ${drawing?'is-drawing':''}`} style={{width,height,transform:`scale(${zoom})`}} tabIndex={0} role="group" aria-label={drawing?'Quadro de desenho; Enter inicia ou termina, setas traçam, Escape cancela':'Quadro de ideias; duplo clique cria, N cria pelo teclado, Ctrl+C/V copia e cola a ideia selecionada'} onKeyDown={boardKeyDown} onCopy={copyNode} onCut={event=>{if(selected&&!isTextTarget(event.target)){copyNode(event);removeSelected();}}} onPaste={pasteNode} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onDoubleClick={event=>{if(readOnly||drawing||event.target!==event.currentTarget)return;const p=point(event);addIdeaAt(p.x-95,p.y-50);}}>
      <svg className={`note-board-lines ${drawing?'is-drawing':''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerDown={startStroke} onPointerMove={draw} onPointerUp={finishStroke} onPointerCancel={finishStroke}>
        {visibleEdges.map(edge=>{const from=nodesById.get(edge.from),to=nodesById.get(edge.to);if(!from||!to)return null;const ends=segment(from,to);return <g key={edge.id}><line ref={element=>{if(element)edgeElements.current.set(edge.id,element);else edgeElements.current.delete(edge.id);}} className="note-board-edge" {...ends}/>{edge.label&&<text ref={element=>{if(element)edgeLabelElements.current.set(edge.id,element);else edgeLabelElements.current.delete(edge.id);}} className="note-board-edge-label" x={(ends.x1+ends.x2)/2} y={(ends.y1+ends.y2)/2-8} textAnchor="middle"><NoteHighlight text={searchQuery.trim()?edge.label:edge.label.length>28?`${edge.label.slice(0,27)}…`:edge.label} query={searchQuery} svg active={activeSearch?.kind==='edge'&&activeSearch.id===edge.id?activeSearch:undefined}/></text>}</g>;})}
        {board.strokes.map(item=><path key={item.id} d={item.path} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}
        <line ref={linkPreview} className="note-board-link-preview" x1="0" y1="0" x2="0" y2="0"/>
        <path ref={strokePreview} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {drawing&&<><path d={pen.path} fill="none" stroke="#e5c88d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle className="note-board-pen" cx={pen.x} cy={pen.y} r="6"/></>}
      </svg>
      {!board.nodes.length&&!board.strokes.length&&<div className="note-board-empty"><strong>Sua primeira ideia</strong>{readOnly?'Este mapa mental ainda está vazio.':'Clique em “Novo cartão”, escreva sua ideia e arraste para organizar.'}</div>}
      {!!board.nodes.length&&!visibleNodes.length&&<div className="note-board-empty" role="status"><strong>Nenhum cartão neste filtro</strong>Altere o tipo ou a etiqueta no índice para ver mais ideias.</div>}
      {visibleNodes.map(node=><article key={node.id} data-node-id={node.id} className={`note-board-node ${selected===node.id?'is-selected':''} ${selectedCards.has(node.id)?'is-group-selected':''} ${linkFrom===node.id?'is-link-source':''} ${activeSearch?.kind==='node'&&activeSearch.id===node.id?'has-find-current':''}`} style={{left:node.x,top:node.y}} onClick={event=>{if(event.target.tagName==='IMG')selectCard(node.id,event.shiftKey);}}>
        <button type="button" className={`note-board-node-grip ${readOnly?'is-readonly':''}`} aria-label={`Selecionar ${node.text||'ideia'}${readOnly?'':'; Shift+clique ou Shift+Enter inclui na seleção, Enter edita e setas movem'}`} aria-pressed={selectedCards.has(node.id)} onClick={event=>{event.stopPropagation();selectCard(node.id,event.shiftKey);}} onDoubleClick={()=>startEditing(node.id)} onPointerDown={event=>moveNode(event,node.id)} onPointerMove={dragging} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={event=>{if(event.shiftKey&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();selectCard(node.id,true);}else if(event.key==='Enter'&&!readOnly){event.preventDefault();startEditing(node.id);}else nudge(event,node.id);}}>{node.kind==='image'?'Imagem':'Ideia'}<span aria-hidden="true">⋮⋮</span></button>
        {node.kind==='image'&&<img src={node.assetId?assetPath(node.assetId):node.src} alt={node.text||'Imagem anexada'} width="170" height="106" loading="lazy" draggable="false"/>}
        {(node.category||nodeTags(node).length>0)&&<div className="note-board-node-meta"><span>{CARD_TYPES[node.category]||'Sem tipo'}</span>{nodeTags(node).map(tag=><span key={tag} className="note-board-tag">{tag}</span>)}</div>}
        {node.pointId&&<span className="note-board-node-point"><MapPin size={12} aria-hidden="true"/>{points.find(item=>item.id===node.pointId)?.name||'Ponto removido'}</span>}
        {editingId===node.id&&!readOnly?(node.kind==='image'?<input aria-label="Legenda da imagem" value={node.text} maxLength={100} autoComplete="off" onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>:<textarea aria-label="Texto da ideia" value={node.text} maxLength={500} autoComplete="off" onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>):<button type="button" className="note-board-preview" onClick={()=>{if(!linkFrom&&!readOnly&&selected===node.id)startEditing(node.id);else selectCard(node.id);}} onDoubleClick={()=>startEditing(node.id)} onKeyDown={event=>nudge(event,node.id)} aria-label={`${node.kind==='image'?'Legenda':'Texto'}: ${node.text||'sem texto'}.${readOnly?'':' Ative novamente para editar'}`}><NoteHighlight text={node.text||'Sem texto'} query={searchQuery} active={activeSearch?.kind==='node'&&activeSearch.id===node.id?activeSearch:undefined}/></button>}
        {!readOnly&&!drawing&&<button type="button" className="note-board-connector" aria-label={`Ligar ${node.text||'ideia'} a outra ideia`} aria-pressed={linkFrom===node.id} onPointerDown={event=>startLink(event,node.id)} onPointerMove={moveLink} onPointerUp={finishLink} onPointerCancel={cancelLink} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();chooseConnector(node.id);}}}><Link2 size={17} aria-hidden="true"/></button>}
        {!readOnly&&selected===node.id&&!drawing&&<button type="button" className="note-board-node-delete" aria-label={`Excluir ${node.text||'ideia'}`} onClick={removeSelected}><Trash2 size={15} aria-hidden="true"/></button>}
      </article>)}
    </div></div></div>
    <div className="note-board-overlays">
    {!readOnly&&selectedCards.size>=2&&<div className="note-board-arrange" role="group" aria-label="Organizar cartões selecionados"><strong>{selectedCards.size} cartões selecionados</strong><button type="button" onClick={()=>arrangeCards('align-x')}>Alinhar à esquerda</button><button type="button" onClick={()=>arrangeCards('align-y')}>Alinhar ao topo</button><button type="button" disabled={selectedCards.size<3} onClick={()=>arrangeCards('distribute-x')}>Distribuir na horizontal</button><button type="button" disabled={selectedCards.size<3} onClick={()=>arrangeCards('distribute-y')}>Distribuir na vertical</button><button type="button" onClick={()=>selectOnly(null)}>Limpar seleção</button></div>}
    {selectedNode&&<details key={selectedNode.id} className="note-board-card-details"><summary>Detalhes do cartão <span>{selectedNode.text.slice(0,36)||'Sem texto'}</span></summary>
      {!readOnly&&<div className="note-board-card-actions"><button type="button" onClick={()=>startEditing(selectedNode.id)}>Editar texto</button><button type="button" aria-pressed={linkFrom===selectedNode.id} disabled={drawing} onClick={()=>chooseConnector(selectedNode.id)}><Link2 size={16} aria-hidden="true"/>{linkFrom===selectedNode.id?'Cancelar conexão':'Conectar a outro cartão'}</button><button type="button" onClick={removeSelected}><Trash2 size={16} aria-hidden="true"/>Excluir cartão</button></div>}
    <div className="note-board-metadata" role="group" aria-label="Classificação do cartão selecionado">
      {!readOnly?<>
        <label>Tipo do cartão<select name="board-card-type" autoComplete="off" value={selectedNode.category||''} onChange={event=>changeCategory(event.target.value)}><option value="">Sem tipo</option>{Object.entries(CARD_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Etiquetas, separadas por vírgula<input name="board-card-tags" autoComplete="off" type="text" value={tagInput} maxLength={248} placeholder="Ex.: mistério, sessão 2…" onChange={event=>{setTagInput(event.target.value);setTagError('');}} onBlur={saveTags} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveTags();event.currentTarget.blur();}}}/></label>
      </>:<><span>{selectedNode.category?CARD_TYPES[selectedNode.category]:'Sem tipo'}</span><span>{nodeTags(selectedNode).length?nodeTags(selectedNode).join(' · '):'Sem etiquetas'}</span></>}
      {tagError&&<p className="note-board-error" role="alert">{tagError}</p>}
    </div>
    {!readOnly&&selectedNode?.kind==='image'&&selectedNode.src&&roomId&&<button type="button" className="note-board-collect" disabled={assetUploads>0} onClick={()=>void storeImage(selectedNode.id,selectedNode.text||'Imagem',selectedNode.src)}>Guardar esta imagem na coleção</button>}
    {selectedNode&&<div className="note-board-point-link"><MapPin size={16} aria-hidden="true"/>{!readOnly&&<label>Vincular cartão a ponto<select name="board-card-point" autoComplete="off" aria-label="Ponto vinculado à ideia selecionada" value={selectedNode.pointId||''} onChange={event=>associatePoint(event.target.value)}><option value="">Nenhum ponto</option>{points.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}{selectedNode.pointId&&!linkedPoint&&<option value={selectedNode.pointId}>Ponto removido</option>}</select></label>}{linkedPoint?<button type="button" onClick={()=>onOpenPoint?.(linkedPoint.id)}>Abrir {linkedPoint.name} no mapa</button>:readOnly&&<span>{selectedNode.pointId?'Ponto removido':'Sem ponto vinculado'}</span>}</div>}
    </details>}
    </div>
    </div>
  </section>;
}
