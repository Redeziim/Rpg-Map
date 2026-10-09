import React,{useEffect,useId,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {AlignHorizontalSpaceBetween,AlignStartHorizontal,AlignStartVertical,AlignVerticalSpaceBetween,Clapperboard,Fingerprint,ImagePlus,Link2,MapPin,MoreHorizontal,Pencil,Plus,Redo2,SlidersHorizontal,Trash2,Undo2,User,X,ZoomIn,ZoomOut} from 'lucide-react';
import {imageSignatureMatches} from '../shared/imageSignature.js';
import {api} from '../api.js';
import {emptyNoteBoard} from './noteBoardDefaults.js';
import {NoteHighlight} from './NoteFind.jsx';
import {anchor,grownBoard as grown,routeBetween as route,MIN_WIDTH,MIN_HEIGHT} from './noteBoardGeometry.js';
import './NoteBoard.css';

// Quadro de ideias simples, no espírito do Canvas do Obsidian: cartões só com texto, setas curvas com ponta, ferramentas que flutuam sobre o
// quadro e aparecem junto do que está selecionado. O formato dos dados é o mesmo de sempre (nós, conexões e traços), para as notas salvas abrirem iguais.
const MIN_ZOOM=.05;
const CARD_WIDTH=200,CARD_HEIGHT=72;
const CARD_TYPES={person:'Pessoa',place:'Local',scene:'Cena',clue:'Pista'};
const TYPE_ICONS={person:User,place:MapPin,scene:Clapperboard,clue:Fingerprint};
const bounded=(value,max)=>Math.max(0,Math.min(max,value));
const isTextTarget=target=>Boolean(target?.closest?.('textarea,input,[contenteditable="true"]'));
const nodeTags=node=>Array.isArray(node?.tags)?node.tags.filter(tag=>typeof tag==='string'):[];
const validTags=tags=>Array.isArray(tags)&&tags.length<=8&&tags.every(tag=>typeof tag==='string'&&tag===tag.trim()&&tag.length>=1&&tag.length<=30)&&new Set(tags.map(tag=>tag.toLocaleLowerCase('pt-BR'))).size===tags.length;
const copiedMetadata=payload=>({...(CARD_TYPES[payload?.category]?{category:payload.category}:{}),...(validTags(payload?.tags)?{tags:payload.tags}:{})});

const zoomMemory=key=>'grimorio-board-zoom-v1:'+key;
function readZoom(key){try{const saved=Number(localStorage.getItem(zoomMemory(key)));return saved>=MIN_ZOOM&&saved<=2?saved:1;}catch{return 1;}}
export const BOARD_SHORTCUTS=[['N','Novo cartão no centro da vista'],['Duplo clique no fundo','Novo cartão naquele ponto'],['Setas','Mover o cartão selecionado de 10 em 10 pixels'],['Enter','Editar o cartão selecionado'],['Shift + clique ou Shift + Enter','Selecionar vários cartões'],['Delete ou Backspace','Remover o cartão ou a conexão selecionada'],['Esc','Sair da edição, limpar a seleção ou cancelar o traço'],['Ctrl + Z','Desfazer'],['Ctrl + Y ou Ctrl + Shift + Z','Refazer'],['Ctrl + C e Ctrl + V','Copiar e colar um cartão; colar uma imagem cria um cartão de imagem'],['Ctrl + roda do mouse','Aproximar ou afastar'],['Ctrl + F','Buscar nesta nota'],['No modo desenho: setas','Mover a caneta (Shift = 25 pixels)'],['No modo desenho: Enter ou Espaço','Começar e terminar o traço']];

export default function NoteBoard({value,onChange,readOnly=false,points=[],onOpenPoint,roomId,searchQuery='',activeSearch,searchNavigation=0,zoomKey}){
  const board=value||emptyNoteBoard();
  const width=board.width||MIN_WIDTH,height=board.height||MIN_HEIGHT;
  const uid=useId().replace(/:/g,''),menuId=useId();
  const [zoom,setZoom]=useState(()=>zoomKey?readZoom(zoomKey):1);
  const [menuOpen,setMenuOpen]=useState(false),menuButton=useRef(null),menu=useRef(null);
  const [drawing,setDrawing]=useState(false),[selected,setSelected]=useState(null),[selectedCards,setSelectedCards]=useState(new Set()),[editingId,setEditingId]=useState(null);
  const [selectedEdge,setSelectedEdge]=useState(null),[editingEdge,setEditingEdge]=useState(null),[edgeDraft,setEdgeDraft]=useState('');
  const [detailsFor,setDetailsFor]=useState(null);
  const [linkFrom,setLinkFrom]=useState(null),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('all'),[tagFilter,setTagFilter]=useState('all');
  const [tagInput,setTagInput]=useState(''),[tagError,setTagError]=useState('');
  const [pen,setPen]=useState({x:480,y:310,path:''});
  const [libraryLoaded,setLibraryLoaded]=useState(false),[libraryLoading,setLibraryLoading]=useState(false),[librarySearch,setLibrarySearch]=useState(''),[assets,setAssets]=useState([]),[assetUploads,setAssetUploads]=useState(0);
  const [,setLayoutTick]=useState(0);
  const boardRef=useRef(null),scrollRef=useRef(null),fileRef=useRef(null),strokePreview=useRef(null),linkPreview=useRef(null),edgeElements=useRef(new Map());
  const stroke=useRef(null),drag=useRef(null),pan=useRef(null),linking=useRef(null),readOnlyRef=useRef(readOnly),aliveRef=useRef(true),zoomRef=useRef(zoom);
  const boardValue=useRef(board),history=useRef({past:[],future:[]}),nodeHistory=useRef(new Map());
  const sizes=useRef(new Map()),observer=useRef(null),observed=useRef(new Map()),refs=useRef(new Map());
  boardValue.current=board;readOnlyRef.current=readOnly;zoomRef.current=zoom;
  useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;observer.current?.disconnect();};},[]);

  // Cada cartão é medido de verdade (ResizeObserver): as conexões saem da borda real, mesmo com texto longo ou imagem.
  function measureRef(id){
    let callback=refs.current.get(id);
    if(callback)return callback;
    callback=element=>{
      if(!observer.current&&typeof ResizeObserver!=='undefined')observer.current=new ResizeObserver(entries=>{
        let changed=false;
        for(const entry of entries){
          const nodeId=entry.target.dataset.nodeId,box=entry.borderBoxSize?.[0];
          const w=Math.round(box?box.inlineSize:entry.contentRect.width),h=Math.round(box?box.blockSize:entry.contentRect.height),old=sizes.current.get(nodeId);
          if(nodeId&&w>0&&(!old||old.w!==w||old.h!==h)){sizes.current.set(nodeId,{w,h});changed=true;}
        }
        if(changed&&aliveRef.current)setLayoutTick(tick=>tick+1);
      });
      const previous=observed.current.get(id);
      if(previous&&previous!==element){observer.current?.unobserve(previous);observed.current.delete(id);}
      if(element){observed.current.set(id,element);observer.current?.observe(element);}
      else sizes.current.delete(id);
    };
    refs.current.set(id,callback);
    return callback;
  }
  const rectOf=node=>{const size=sizes.current.get(node.id);return {x:node.x,y:node.y,w:size?.w||CARD_WIDTH,h:size?.h||CARD_HEIGHT};};

  useEffect(()=>{
    if(!menuOpen)return undefined;
    const escape=event=>{
      if(event.key!=='Escape')return;
      event.stopPropagation();
      if(menu.current?.contains(document.activeElement))menuButton.current?.focus();
      setMenuOpen(false);
    };
    const outside=event=>{if(!menu.current?.contains(event.target)&&!menuButton.current?.contains(event.target))setMenuOpen(false);};
    document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',outside);};
  },[menuOpen]);
  useEffect(()=>{if(selected&&!board.nodes.some(node=>node.id===selected))setSelected(null);},[board.nodes,selected]);
  useEffect(()=>{if(selectedEdge&&!board.edges.some(edge=>edge.id===selectedEdge))setSelectedEdge(null);},[board.edges,selectedEdge]);
  const nodesById=new Map(board.nodes.map(node=>[node.id,node]));
  const availableTags=[...new Map(board.nodes.flatMap(nodeTags).map(tag=>[tag.toLocaleLowerCase('pt-BR'),tag])).values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const visibleNodes=board.nodes.filter(node=>(categoryFilter==='all'||(categoryFilter==='none'?!node.category:node.category===categoryFilter))&&(tagFilter==='all'||(tagFilter==='none'?!nodeTags(node).length:nodeTags(node).some(tag=>tag.toLocaleLowerCase('pt-BR')===tagFilter.toLocaleLowerCase('pt-BR')))));
  const matchingAssets=assets.filter(asset=>asset.name.toLocaleLowerCase('pt-BR').includes(librarySearch.trim().toLocaleLowerCase('pt-BR')));
  const visibleIds=new Set(visibleNodes.map(node=>node.id));
  const visibleEdges=board.edges.filter(edge=>visibleIds.has(edge.from)&&visibleIds.has(edge.to));
  const filtered=categoryFilter!=='all'||tagFilter!=='all';
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
  // Ctrl + roda do mouse aproxima e afasta, como nos outros quadros; a roda sozinha continua rolando.
  useEffect(()=>{
    const viewport=scrollRef.current;if(!viewport)return undefined;
    const wheel=event=>{if(!(event.ctrlKey||event.metaKey))return;event.preventDefault();applyZoom(zoomRef.current*(event.deltaY<0?1.1:.9));};
    viewport.addEventListener('wheel',wheel,{passive:false});
    return()=>viewport.removeEventListener('wheel',wheel);
  },[]);

  function linePath(current,position){
    for(const link of current.links){
      const own={...position,w:current.size.w,h:current.size.h},other=rectOf(link.other);
      const next=link.from?route(own,other):route(other,own);
      link.group.querySelectorAll('path').forEach(path=>path.setAttribute('d',next.d));
      const label=link.group.querySelector('text');
      if(label){label.setAttribute('x',next.mid.x);label.setAttribute('y',next.mid.y-8);}
    }
  }
  const selectedNode=nodesById.get(selected),linkedPoint=points.find(item=>item.id===selectedNode?.pointId);
  const selectedTags=nodeTags(selectedNode).join(', ');
  useEffect(()=>{setTagInput(selectedTags);setTagError('');},[selected,selectedTags]);
  useEffect(()=>{if(detailsFor&&detailsFor!==selected)setDetailsFor(null);},[selected,detailsFor]);
  function selectOnly(id){setSelected(id);setSelectedCards(id?new Set([id]):new Set());setSelectedEdge(null);setEditingEdge(null);setLinkFrom(null);}
  function selectCard(id,additive=false){
    if(linkFrom&&linkFrom!==id&&!additive){connectNodes(linkFrom,id);return;}
    if(!additive){selectOnly(id);return;}
    const next=new Set(selectedCards);
    if(next.has(id))next.delete(id);else next.add(id);
    setSelectedCards(next);setSelected(next.has(id)?id:[...next].at(-1)||null);setSelectedEdge(null);setLinkFrom(null);
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
    boardRef.current?.focus({preventScroll:true});
  }
  function redo(){
    if(readOnlyRef.current)return;
    const next=history.current.future.pop();if(!next)return;
    history.current.past.push(boardValue.current);boardValue.current=next;onChange(next);
    setEditingId(null);setLinkFrom(null);setAnnouncement('Ação refeita.');
    boardRef.current?.focus({preventScroll:true});
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
    const left=Math.round(viewport.scrollLeft/zoom)+32,top=Math.round(viewport.scrollTop/zoom)+32,columns=Math.max(1,Math.floor((viewport.clientWidth/zoom-32)/240));
    for(let slot=0;slot<80;slot++){
      const x=bounded(left+(slot%columns)*240,width-220),y=bounded(top+Math.floor(slot/columns)*120,height-150);
      if(!nodes.some(node=>Math.abs(node.x-x)<220&&Math.abs(node.y-y)<100))return {x,y};
    }
    return center();
  }
  function center(){const viewport=scrollRef.current;return {x:bounded(Math.round((viewport.scrollLeft+viewport.clientWidth/2)/zoom-CARD_WIDTH/2),width-220),y:bounded(Math.round((viewport.scrollTop+viewport.clientHeight/2)/zoom-CARD_HEIGHT/2),height-150)};}
  function applyZoom(next,focus){
    const viewport=scrollRef.current,level=Math.max(MIN_ZOOM,Math.min(2,Math.round(next*20)/20)),current=zoomRef.current;
    if(!viewport||level===current)return;
    const x=focus?.x??(viewport.scrollLeft+viewport.clientWidth/2)/current,y=focus?.y??(viewport.scrollTop+viewport.clientHeight/2)/current;
    zoomRef.current=level;setZoom(level);
    // The zoom you chose is yours: it stays in this browser, per note.
    if(zoomKey){try{localStorage.setItem(zoomMemory(zoomKey),String(level));}catch{/* private mode: the zoom still works for this session */}}
    requestAnimationFrame(()=>{viewport.scrollLeft=x*level-viewport.clientWidth/2;viewport.scrollTop=y*level-viewport.clientHeight/2;});
  }
  const changeZoom=next=>applyZoom(next);
  function focusEditor(id){requestAnimationFrame(()=>{const field=boardRef.current?.querySelector(`[data-node-id="${id}"] textarea, [data-node-id="${id}"] input`);field?.focus();field?.select();});}
  function focusCard(id){requestAnimationFrame(()=>boardRef.current?.querySelector(`[data-node-id="${id}"] .note-board-card`)?.focus({preventScroll:true}));}
  function startEditing(id){if(readOnly)return;selectOnly(id);setEditingId(id);focusEditor(id);}
  function addIdeaAt(x,y,{text='Nova ideia',from=null,edit=true,metadata={}}={}){
    if(readOnly||boardValue.current.nodes.length>=80){setError('O mapa mental chegou ao limite de 80 elementos.');return;}
    if(from&&boardValue.current.edges.length>=120){setError('O mapa mental chegou ao limite de 120 conexões.');return;}
    const id=crypto.randomUUID(),node={id,kind:'text',x:bounded(Math.round(x),width-220),y:bounded(Math.round(y),height-150),text,...metadata};
    apply(previous=>({...previous,...grown(previous,node.x,node.y),nodes:[...previous.nodes,node],edges:from?[...previous.edges,{id:crypto.randomUUID(),from,to:id}]:previous.edges}),true);
    setCategoryFilter('all');setTagFilter('all');
    selectOnly(id);setError('');
    if(edit)startEditing(id);else focusCard(id);
  }
  const assetPath=id=>`/api/rooms/${encodeURIComponent(roomId)}/note-assets/${encodeURIComponent(id)}`;
  async function loadLibrary(){
    setLibraryLoaded(true);setLibraryLoading(true);setError('');
    try{const items=await api(`/rooms/${encodeURIComponent(roomId)}/note-assets`);if(aliveRef.current)setAssets(items);}
    catch(cause){if(aliveRef.current){setError(`Não foi possível abrir a coleção: ${cause.message}`);setLibraryLoaded(false);}}
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
    setCategoryFilter('all');setTagFilter('all');selectOnly(id);setMenuOpen(false);setError('');setAnnouncement('Referência adicionada. Salve a nota para compartilhar.');
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
  function attachImage(event){const file=event.target.files?.[0];event.target.value='';const p=freeSpot();createImage(file,p.x,p.y);}
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
  function editEdge(edge){if(readOnly)return;setSelected(null);setSelectedCards(new Set());setSelectedEdge(edge.id);setEditingEdge(edge.id);setEdgeDraft(edge.label||'');setError('');requestAnimationFrame(()=>boardRef.current?.querySelector('.note-board-edge-input')?.focus());}
  function removeEdge(id){
    if(readOnly)return;
    apply(previous=>({...previous,edges:previous.edges.filter(item=>item.id!==id)}),true);
    if(editingEdge===id)setEditingEdge(null);setSelectedEdge(null);setAnnouncement('Conexão removida. Ctrl+Z desfaz.');
    boardRef.current?.focus({preventScroll:true});
  }
  function chooseConnector(id){
    if(readOnly)return;
    if(linkFrom&&linkFrom!==id)connectNodes(linkFrom,id);
    else if(linkFrom===id){setLinkFrom(null);setAnnouncement('Conexão cancelada.');}
    else{selectOnly(id);setLinkFrom(id);setAnnouncement('Clique em outro cartão para conectar. Esc cancela.');}
  }
  function startLink(event,id,side){
    if(readOnly||drawing||event.button!==0)return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    linking.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,rect:boardRef.current.getBoundingClientRect(),zoom};
    const node=nodesById.get(id),line=linkPreview.current,start=anchor(rectOf(node),side);
    line.setAttribute('x1',start.x);line.setAttribute('y1',start.y);
    line.setAttribute('x2',start.x);line.setAttribute('y2',start.y);line.style.visibility='visible';
    setSelected(id);setSelectedCards(new Set([id]));setSelectedEdge(null);
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
      const p=point(event);addIdeaAt(p.x-CARD_WIDTH/2,p.y-CARD_HEIGHT/2,{from:current.id});return;
    }
    if(!current.moved)chooseConnector(current.id);
  }
  function cancelLink(){linking.current=null;if(linkPreview.current)linkPreview.current.style.visibility='hidden';}
  // O cartão inteiro é a alça: arrastar move, clicar seleciona e clicar de novo num cartão já selecionado edita.
  function downNode(event,id){
    if(event.button!==0||event.target.closest('textarea,input,select,.note-board-handle,.note-board-bar,.note-board-sheet'))return;
    if(linkFrom&&linkFrom!==id&&!event.shiftKey){connectNodes(linkFrom,id);return;}
    if(event.shiftKey){selectCard(id,true);return;}
    const wasSelected=selected===id&&selectedCards.size<=1&&editingId!==id;
    if(editingId===id)return;
    selectOnly(id);focusCard(id);
    if(readOnly||drawing){return;}
    const node=nodesById.get(id);if(!node)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const size={w:rectOf(node).w,h:rectOf(node).h};
    const links=boardValue.current.edges.filter(edge=>edge.from===id||edge.to===id).map(edge=>({group:edgeElements.current.get(edge.id),from:edge.from===id,other:nodesById.get(edge.from===id?edge.to:edge.from)})).filter(link=>link.group&&link.other);
    drag.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:node.x,y:node.y,node,links,size,element:event.currentTarget,wasSelected,moved:false};
  }
  function dragging(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    if(!current.moved&&Math.hypot(event.clientX-current.startX,event.clientY-current.startY)<4)return;
    current.moved=true;
    current.nextX=bounded(Math.round(current.x+(event.clientX-current.startX)/zoom),width-220);
    current.nextY=bounded(Math.round(current.y+(event.clientY-current.startY)/zoom),height-150);
    current.element.style.transform=`translate(${current.nextX-current.x}px,${current.nextY-current.y}px)`;
    current.element.classList.add('is-dragging');
    linePath(current,{x:current.nextX,y:current.nextY});
  }
  function finishDrag(event){
    const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
    drag.current=null;current.element.classList.remove('is-dragging');
    if(!current.moved&&event.type==='pointerup'&&current.wasSelected&&!readOnlyRef.current){startEditing(current.id);return;}
    if(event.type==='pointercancel'||!current.moved||current.nextX===undefined||readOnlyRef.current||current.nextX===current.x&&current.nextY===current.y){
      linePath(current,{x:current.x,y:current.y});current.element.style.transform='';return;
    }
    flushSync(()=>apply(previous=>({...previous,...grown(previous,current.nextX,current.nextY),nodes:previous.nodes.map(node=>node.id===current.id?{...node,x:current.nextX,y:current.nextY}:node)}),true));
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
    boardRef.current?.focus({preventScroll:true});
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
    if(event.target.tagName==='TEXTAREA'){event.target.style.height='auto';event.target.style.height=event.target.scrollHeight+'px';}
    if(current===undefined||value===current)return;
    const entry=nodeHistory.current.get(id)||{past:[],future:[]};entry.past.push(current);
    if(entry.past.length>100)entry.past.shift();entry.future=[];nodeHistory.current.set(id,entry);
    apply(previous=>({...previous,nodes:previous.nodes.map(node=>node.id===id?{...node,text:value}:node)}));
  }
  function nodeTextShortcut(id,event){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setEditingId(null);focusCard(id);return;}
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
    const x=bounded(node.x+delta[0],width-220),y=bounded(node.y+delta[1],height-150);
    apply(previous=>({...previous,...grown(previous,x,y),nodes:previous.nodes.map(item=>item.id===id?{...item,x,y}:item)}),true);
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
    if(!readOnly&&(event.key==='Delete'||event.key==='Backspace')&&(selected||selectedEdge)){event.preventDefault();if(selected)removeSelected();else removeEdge(selectedEdge);return;}
    if(event.key==='Escape'){if(linkFrom){setLinkFrom(null);setAnnouncement('Conexão cancelada.');return;}selectOnly(null);setEditingId(null);setDetailsFor(null);setPen(previous=>({...previous,path:''}));return;}
    if(!readOnly&&!modifier&&!event.altKey&&key==='n'){event.preventDefault();const p=freeSpot();addIdeaAt(p.x,p.y);return;}
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

  const cardLabel=node=>`${node.kind==='image'?'Imagem':CARD_TYPES[node.category]||'Ideia'}: ${node.text||'sem texto'}.${readOnly?'':' Enter edita, setas movem, Shift+Enter inclui na seleção.'}`;
  const selectedEdgeData=selectedEdge&&visibleEdges.find(edge=>edge.id===selectedEdge),edgeRoute=selectedEdgeData?route(rectOf(nodesById.get(selectedEdgeData.from)),rectOf(nodesById.get(selectedEdgeData.to))):null;
  const countText=`${board.nodes.length} ${board.nodes.length===1?'cartão':'cartões'}, ${board.edges.length} ${board.edges.length===1?'conexão':'conexões'}${filtered?`; ${visibleNodes.length} visíveis no filtro`:''}`;

  return <section className="note-board" aria-label="Mapa mental da nota">
    <p className="sr-only">Duplo clique no fundo cria um cartão. Clique em um cartão selecionado para editar. Puxe o círculo na borda do cartão até outro cartão para conectar. Shift+clique seleciona vários. Ctrl+C e Ctrl+V copiam e colam. Ctrl+Z desfaz. As setas movem o cartão selecionado. Para desenhar pelo teclado, foque o quadro e use Enter e as setas.</p>
    <div className="note-board-stage"><div ref={scrollRef} className="note-board-scroll"><div className="note-board-extent" style={{width:width*zoom,height:height*zoom}}><div ref={boardRef} className={`note-board-canvas ${drawing?'is-drawing':''}`} style={{width,height,transform:`scale(${zoom})`,'--zoom':zoom}} tabIndex={0} role="group" aria-label={drawing?'Quadro de desenho; Enter inicia ou termina, setas traçam, Escape cancela':'Quadro de ideias; duplo clique cria, N cria pelo teclado, Ctrl+C/V copia e cola a ideia selecionada'} onKeyDown={boardKeyDown} onCopy={copyNode} onCut={event=>{if(selected&&!isTextTarget(event.target)){copyNode(event);removeSelected();}}} onPaste={pasteNode} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onDoubleClick={event=>{if(readOnly||drawing||event.target!==event.currentTarget)return;const p=point(event);addIdeaAt(p.x-CARD_WIDTH/2,p.y-CARD_HEIGHT/2);}}>
      <svg className={`note-board-lines ${drawing?'is-drawing':''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerDown={startStroke} onPointerMove={draw} onPointerUp={finishStroke} onPointerCancel={finishStroke}>
        <defs>
          <marker id={`${uid}-arrow`} className="note-board-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1.5 1.5L10.5 6L1.5 10.5z"/></marker>
          <marker id={`${uid}-arrow-on`} className="note-board-arrow is-selected" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1.5 1.5L10.5 6L1.5 10.5z"/></marker>
        </defs>
        {visibleEdges.map(edge=>{
          const from=nodesById.get(edge.from),to=nodesById.get(edge.to);if(!from||!to)return null;
          const path=route(rectOf(from),rectOf(to)),on=selectedEdge===edge.id;
          return <g key={edge.id} className={on?'is-selected':''} ref={element=>{if(element)edgeElements.current.set(edge.id,element);else edgeElements.current.delete(edge.id);}}>
            <path className="note-board-edge-hit" d={path.d} onPointerDown={event=>{event.stopPropagation();setSelected(null);setSelectedCards(new Set());setSelectedEdge(edge.id);setEditingEdge(null);setLinkFrom(null);boardRef.current?.focus({preventScroll:true});}} onDoubleClick={event=>{event.stopPropagation();editEdge(edge);}}/>
            <path className="note-board-edge" d={path.d} markerEnd={`url(#${uid}-arrow${on?'-on':''})`}/>
            {edge.label&&<text className="note-board-edge-label" x={path.mid.x} y={path.mid.y-8} textAnchor="middle"><NoteHighlight text={searchQuery.trim()?edge.label:edge.label.length>28?`${edge.label.slice(0,27)}…`:edge.label} query={searchQuery} svg active={activeSearch?.kind==='edge'&&activeSearch.id===edge.id?activeSearch:undefined}/></text>}
          </g>;
        })}
        {board.strokes.map(item=><path key={item.id} className="note-board-stroke" d={item.path}/>)}
        <line ref={linkPreview} className="note-board-link-preview" x1="0" y1="0" x2="0" y2="0"/>
        <path ref={strokePreview} className="note-board-stroke"/>
        {drawing&&<><path className="note-board-stroke" d={pen.path}/><circle className="note-board-pen" cx={pen.x} cy={pen.y} r="6"/></>}
      </svg>
      {!board.nodes.length&&!board.strokes.length&&<div className="note-board-empty"><strong>Quadro vazio</strong>{readOnly?'Este mapa mental ainda está vazio.':'Dê dois cliques aqui para criar o primeiro cartão.'}</div>}
      {!!board.nodes.length&&!visibleNodes.length&&<div className="note-board-empty" role="status"><strong>Nenhum cartão neste filtro</strong>Mude o filtro em “Mais” para ver as ideias.</div>}
      {visibleNodes.map(node=>{
        const TypeIcon=TYPE_ICONS[node.category],editing=editingId===node.id&&!readOnly,isSelected=selected===node.id,showBar=isSelected&&!editing&&!drawing&&selectedCards.size<=1,flip=node.y*zoom<70;
        return <article key={node.id} ref={measureRef(node.id)} data-node-id={node.id} className={`note-board-node ${node.category?`type-${node.category}`:''} ${isSelected?'is-selected':''} ${selectedCards.has(node.id)?'is-group-selected':''} ${linkFrom===node.id?'is-link-source':''} ${activeSearch?.kind==='node'&&activeSearch.id===node.id?'has-find-current':''} ${readOnly?'is-readonly':''}`} style={{left:node.x,top:node.y}} onPointerDown={event=>downNode(event,node.id)} onPointerMove={dragging} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
          {node.kind==='image'&&<img src={node.assetId?assetPath(node.assetId):node.src} alt={node.text||'Imagem anexada'} loading="lazy" draggable="false"/>}
          {editing?(node.kind==='image'?<input className="note-board-edit" aria-label="Legenda da imagem" value={node.text} maxLength={100} autoComplete="off" onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>
            :<textarea className="note-board-edit" aria-label="Texto da ideia" value={node.text} maxLength={500} rows={2} autoComplete="off" ref={element=>{if(element&&element!==document.activeElement&&!element.style.height){element.style.height=element.scrollHeight+'px';}}} onChange={event=>editNodeText(node.id,event)} onKeyDown={event=>nodeTextShortcut(node.id,event)} onBlur={()=>setEditingId(current=>current===node.id?null:current)}/>)
            :<button type="button" className="note-board-card" aria-label={cardLabel(node)} aria-pressed={selectedCards.has(node.id)} onClick={event=>{if(event.detail!==0)return;if(linkFrom&&linkFrom!==node.id)connectNodes(linkFrom,node.id);else selectCard(node.id,false);}} onKeyDown={event=>{if(event.shiftKey&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();selectCard(node.id,true);}else if(event.key==='Enter'&&!readOnly){event.preventDefault();startEditing(node.id);}else nudge(event,node.id);}}>
              {TypeIcon&&<TypeIcon className="note-board-type" size={14} aria-hidden="true"/>}
              <span className="note-board-text"><NoteHighlight text={node.text||'Sem texto'} query={searchQuery} active={activeSearch?.kind==='node'&&activeSearch.id===node.id?activeSearch:undefined}/></span>
            </button>}
          {(nodeTags(node).length>0||node.pointId)&&<div className="note-board-node-meta">{nodeTags(node).map(tag=><span key={tag} className="note-board-tag">{tag}</span>)}{node.pointId&&<span className="note-board-node-point"><MapPin size={12} aria-hidden="true"/>{points.find(item=>item.id===node.pointId)?.name||'Ponto removido'}</span>}</div>}
          {!readOnly&&!drawing&&!editing&&['top','right','bottom','left'].map(side=><span key={side} className={`note-board-handle is-${side}`} aria-hidden="true" onPointerDown={event=>startLink(event,node.id,side)} onPointerMove={moveLink} onPointerUp={finishLink} onPointerCancel={cancelLink}/>)}
          {showBar&&<div className={`note-board-bar ${flip?'is-below':''}`} role="toolbar" aria-label={`Ações do cartão: ${node.text.slice(0,30)||'sem texto'}`}>
            {!readOnly&&<div className="note-board-swatches" role="group" aria-label="Tipo do cartão">
              <button type="button" className="note-board-swatch type-none" aria-pressed={!node.category} aria-label="Sem tipo" title="Sem tipo" onClick={()=>changeCategory('')}/>
              {Object.entries(CARD_TYPES).map(([type,label])=><button key={type} type="button" className={`note-board-swatch type-${type}`} aria-pressed={node.category===type} aria-label={label} title={label} onClick={()=>changeCategory(type)}/>)}
            </div>}
            {!readOnly&&<button type="button" aria-label="Editar texto" title="Editar texto (Enter)" onClick={()=>startEditing(node.id)}><Pencil size={16} aria-hidden="true"/></button>}
            {!readOnly&&<button type="button" aria-label={linkFrom===node.id?'Cancelar conexão':'Conectar a outro cartão'} title={linkFrom===node.id?'Cancelar conexão':'Conectar a outro cartão'} aria-pressed={linkFrom===node.id} onClick={()=>chooseConnector(node.id)}><Link2 size={16} aria-hidden="true"/></button>}
            <button type="button" aria-label="Detalhes do cartão" title="Etiquetas e ponto do mapa" aria-expanded={detailsFor===node.id} onClick={()=>setDetailsFor(current=>current===node.id?null:node.id)}><SlidersHorizontal size={16} aria-hidden="true"/></button>
            {!readOnly&&<button type="button" className="is-danger" aria-label="Excluir cartão" title="Excluir cartão (Delete)" onClick={removeSelected}><Trash2 size={16} aria-hidden="true"/></button>}
          </div>}
          {showBar&&detailsFor===node.id&&<div className={`note-board-sheet ${flip?'is-below':''}`} role="group" aria-label="Detalhes do cartão" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setDetailsFor(null);focusCard(node.id);}}}>
            {!readOnly?<>
              <label>Etiquetas, separadas por vírgula<input name="board-card-tags" autoComplete="off" type="text" value={tagInput} maxLength={248} placeholder="Ex.: mistério, sessão 2…" onChange={event=>{setTagInput(event.target.value);setTagError('');}} onBlur={saveTags} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveTags();event.currentTarget.blur();}}}/></label>
              <label>Ponto do mapa<select name="board-card-point" autoComplete="off" value={node.pointId||''} onChange={event=>associatePoint(event.target.value)}><option value="">Nenhum ponto</option>{points.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}{node.pointId&&!linkedPoint&&<option value={node.pointId}>Ponto removido</option>}</select></label>
            </>:<p>{CARD_TYPES[node.category]||'Sem tipo'} · {nodeTags(node).length?nodeTags(node).join(', '):'sem etiquetas'}{node.pointId&&!linkedPoint?' · ponto removido':''}</p>}
            {tagError&&<p className="note-board-error" role="alert">{tagError}</p>}
            {linkedPoint&&<button type="button" onClick={()=>onOpenPoint?.(linkedPoint.id)}><MapPin size={14} aria-hidden="true"/>Abrir {linkedPoint.name} no mapa</button>}
            {!readOnly&&node.kind==='image'&&node.src&&roomId&&<button type="button" disabled={assetUploads>0} onClick={()=>void storeImage(node.id,node.text||'Imagem',node.src)}>Guardar esta imagem na coleção</button>}
          </div>}
        </article>;
      })}
      {selectedEdgeData&&edgeRoute&&<div className="note-board-bar is-edge" role="toolbar" aria-label="Ações da conexão" style={{left:edgeRoute.mid.x,top:edgeRoute.mid.y}}>
        {editingEdge===selectedEdgeData.id&&!readOnly?<input className="note-board-edge-input" name="board-edge-label" aria-label="Rótulo da conexão" autoComplete="off" type="text" value={edgeDraft} maxLength={80} placeholder="Rótulo…" onChange={event=>setEdgeDraft(event.target.value)} onBlur={saveEdgeLabel} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveEdgeLabel();boardRef.current?.focus({preventScroll:true});}else if(event.key==='Escape'){event.stopPropagation();setEditingEdge(null);setEdgeDraft('');boardRef.current?.focus({preventScroll:true});}}}/>
          :!readOnly&&<><button type="button" aria-label="Rótulo da conexão" title="Rótulo da conexão" onClick={()=>editEdge(selectedEdgeData)}><Pencil size={16} aria-hidden="true"/></button><button type="button" className="is-danger" aria-label="Remover conexão" title="Remover conexão (Delete)" onClick={()=>removeEdge(selectedEdgeData.id)}><Trash2 size={16} aria-hidden="true"/></button></>}
      </div>}
    </div></div></div>
    {!readOnly&&<div className="note-board-dock" role="toolbar" aria-label="Adicionar ao quadro">
      {!drawing&&<button type="button" className="note-board-new" onClick={()=>{const p=freeSpot();addIdeaAt(p.x,p.y);}}><Plus size={16} aria-hidden="true"/>Novo cartão</button>}
      {!drawing&&<button type="button" aria-label="Adicionar imagem" title="Adicionar imagem" onClick={()=>fileRef.current?.click()}><ImagePlus size={17} aria-hidden="true"/></button>}
      <button type="button" aria-pressed={drawing} aria-label={drawing?'Terminar desenho':'Desenhar'} title={drawing?'Terminar desenho':'Desenhar à mão livre'} className={drawing?'is-active':''} onClick={()=>{setDrawing(previous=>!previous);selectOnly(null);}}><Pencil size={17} aria-hidden="true"/>{drawing&&'Terminar desenho'}</button>
      <input ref={fileRef} className="note-board-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Anexar imagem ao mapa mental" tabIndex={-1} onChange={attachImage}/>
    </div>}
    <div className="note-board-rail" role="toolbar" aria-label="Zoom, histórico e opções do quadro">
      <button type="button" aria-label="Aproximar quadro" title="Aproximar" disabled={zoom>=2} onClick={()=>changeZoom(zoom+(zoom<.5?.05:.25))}><ZoomIn size={17} aria-hidden="true"/></button>
      <button type="button" className="note-board-percent" aria-label="Voltar o zoom para 100%" title="Voltar a 100%" onClick={()=>changeZoom(1)}><output aria-live="polite">{Math.round(zoom*100)}%</output></button>
      <button type="button" aria-label="Afastar quadro" title="Afastar" disabled={zoom<=MIN_ZOOM} onClick={()=>changeZoom(zoom-(zoom<=.5?.05:.25))}><ZoomOut size={17} aria-hidden="true"/></button>
      {!readOnly&&<><hr/><button type="button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!history.current.past.length} onClick={undo}><Undo2 size={17} aria-hidden="true"/></button><button type="button" aria-label="Refazer" title="Refazer (Ctrl+Y)" disabled={!history.current.future.length} onClick={redo}><Redo2 size={17} aria-hidden="true"/></button></>}
      <hr/><button type="button" ref={menuButton} className={menuOpen?'is-active':''} aria-label="Mais opções do quadro" title="Imagens, filtros, conexões e atalhos" aria-expanded={menuOpen} aria-controls={menuId} onClick={()=>setMenuOpen(open=>!open)}><MoreHorizontal size={17} aria-hidden="true"/></button>
    </div>
    {!readOnly&&selectedCards.size>=2&&<div className="note-board-arrange" role="group" aria-label="Organizar cartões selecionados"><strong>{selectedCards.size} cartões</strong>
      <button type="button" aria-label="Alinhar à esquerda" title="Alinhar à esquerda" onClick={()=>arrangeCards('align-x')}><AlignStartVertical size={16} aria-hidden="true"/></button>
      <button type="button" aria-label="Alinhar ao topo" title="Alinhar ao topo" onClick={()=>arrangeCards('align-y')}><AlignStartHorizontal size={16} aria-hidden="true"/></button>
      <button type="button" aria-label="Distribuir na horizontal" title="Distribuir na horizontal (3 ou mais)" disabled={selectedCards.size<3} onClick={()=>arrangeCards('distribute-x')}><AlignHorizontalSpaceBetween size={16} aria-hidden="true"/></button>
      <button type="button" aria-label="Distribuir na vertical" title="Distribuir na vertical (3 ou mais)" disabled={selectedCards.size<3} onClick={()=>arrangeCards('distribute-y')}><AlignVerticalSpaceBetween size={16} aria-hidden="true"/></button>
      <button type="button" aria-label="Limpar seleção" title="Limpar seleção" onClick={()=>selectOnly(null)}><X size={16} aria-hidden="true"/></button>
    </div>}
    <div id={menuId} ref={menu} className="note-board-menu" role="region" aria-label="Mais opções do mapa mental" hidden={!menuOpen}>
      <header><strong>Quadro</strong><span>{countText}</span><button type="button" aria-label="Fechar opções" onClick={()=>{setMenuOpen(false);menuButton.current?.focus();}}><X size={16} aria-hidden="true"/></button></header>
      <div className="note-board-menu-body">
        {!readOnly&&<details onToggle={event=>{if(event.currentTarget.open&&!libraryLoaded&&roomId)void loadLibrary();}}><summary>Coleção de imagens</summary>
          <div className="note-board-library">
            <label>Encontrar imagem<input type="search" name="board-library-search" autoComplete="off" value={librarySearch} onChange={event=>setLibrarySearch(event.target.value)} placeholder="Nome da imagem"/></label>
            {libraryLoading?<p role="status">Carregando imagens…</p>:assets.length?<ul>{matchingAssets.slice(0,40).map(asset=><li key={asset.id}><button type="button" onClick={()=>insertAsset(asset)}><img src={assetPath(asset.id)} alt="" loading="lazy" width="48" height="38"/><span>{asset.name}<small>{Math.ceil(asset.bytes/1024)} KB · inserir no quadro</small></span></button></li>)}</ul>:<p role="status">Nenhuma imagem disponível. Use o botão de imagem para enviar uma referência.</p>}
            {!libraryLoading&&assets.length>0&&matchingAssets.length===0&&<p role="status">Nenhuma imagem com este nome.</p>}
            {!libraryLoading&&matchingAssets.length>40&&<p role="status">Mostrando 40 de {matchingAssets.length} imagens. Busque pelo nome para encontrar as demais.</p>}
          </div>
        </details>}
        <details open={filtered}><summary>Filtrar cartões{filtered?' · ativo':''}</summary>
          <div className="note-board-filters" role="group" aria-label="Filtrar cartões do mapa mental">
            <label>Tipo<select name="board-category-filter" autoComplete="off" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">Todos</option><option value="none">Sem tipo</option>{Object.entries(CARD_TYPES).map(([type,label])=><option key={type} value={type}>{label}</option>)}</select></label>
            <label>Etiqueta<select name="board-tag-filter" autoComplete="off" value={tagFilter} onChange={event=>setTagFilter(event.target.value)}><option value="all">Todas</option><option value="none">Sem etiqueta</option>{availableTags.map(tag=><option key={tag.toLocaleLowerCase('pt-BR')} value={tag.toLocaleLowerCase('pt-BR')}>{tag}</option>)}</select></label>
            <output aria-live="polite">{visibleNodes.length} de {board.nodes.length} cartões</output>
          </div>
        </details>
        {!!visibleEdges.length&&<details><summary>Conexões ({visibleEdges.length})</summary>
          <ul className="note-board-links">{visibleEdges.map(edge=>{const from=nodesById.get(edge.from)?.text||'Ideia',to=nodesById.get(edge.to)?.text||'Ideia';return <li key={edge.id}>
            <span className="note-board-relation">{from} → {to}{edge.label&&<em> · <NoteHighlight text={edge.label} query={searchQuery} active={activeSearch?.kind==='edge'&&activeSearch.id===edge.id?activeSearch:undefined}/></em>}</span>
            {!readOnly&&<div className="note-board-link-actions"><button type="button" aria-label={`Editar rótulo da conexão entre ${from} e ${to}`} onClick={()=>{setMenuOpen(false);editEdge(edge);}}>Rótulo</button><button type="button" aria-label={`Remover conexão entre ${from} e ${to}`} onClick={()=>removeEdge(edge.id)}><Trash2 size={14} aria-hidden="true"/></button></div>}
          </li>;})}</ul>
        </details>}
        <details><summary>Atalhos do teclado</summary><dl className="note-board-shortcuts">{BOARD_SHORTCUTS.map(([keys,action])=><div key={keys}><dt>{keys}</dt><dd>{action}</dd></div>)}</dl><p className="note-board-note">O zoom que você escolher fica guardado neste navegador, para cada nota.</p></details>
      </div>
    </div>
    {assetUploads>0&&<p className="note-board-asset-status" role="status">Guardando {assetUploads} {assetUploads===1?'imagem':'imagens'} na coleção…</p>}
    {error&&<p className="note-board-error is-toast" role="alert">{error}<button type="button" aria-label="Fechar aviso" onClick={()=>setError('')}><X size={14} aria-hidden="true"/></button></p>}
    <span className="sr-only" role="status">{countText}</span>
    <span className="note-board-announcement" role="status">{announcement}</span>
    </div>
  </section>;
}
