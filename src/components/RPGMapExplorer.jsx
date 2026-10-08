import '../legacy.css';
import Notebook from './Notebook.jsx';
import TurnTracker from './TurnTracker.jsx';
import ToolSection from './ToolSection.jsx';
import PointFinder from './PointFinder.jsx';
import {activeInstruments,instrumentStatuses} from '../shared/mapInstruments.js';
import './MasterTools.css';
import {POINT_TYPE_ALL,centerOnPoint,filterPoints} from '../shared/pointSearch.js';
import {CloudFog as FogIcon,Download as DownloadIcon,Tag as TagIcon,Ruler as RulerIcon,Route as RouteIcon,Layers as LayersIcon} from 'lucide-react';
import {AboutPanel,ScenesPanel} from './CampaignPages.jsx';
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Camera, Map, ShieldCheck, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks, Clapperboard, Info, Pencil, Undo2, Redo2, Eraser, Hand, Ruler, BookOpen } from 'lucide-react';
import PointDetails from './PointDetails.jsx';
import MapStrokeColor from './MapStrokeColor.jsx';
import MapLayers,{MapStrokeAudience,loadMapLayers} from './MapLayers.jsx';
import MapFog,{MapFogOverlay} from './MapFog.jsx';
import MapMeasurement,{MapGrid,MapRuler,loadMapMeasurementPrefs} from './MapMeasurement.jsx';
import MapPositions,{MapPositionMarkers} from './MapPositions.jsx';
import MapImageUpload from './MapImageUpload.jsx';
import MapExploration,{MapLegendEditor,MapRouteOverlay,MapLegend} from './MapExploration.jsx';
import MapViewExport from './MapViewExport.jsx';
import {defaultMapLegend,visibleMapRoutes} from '../shared/mapExploration.js';
import {readMapImageFile,openMapBitmap} from './mapImagePreparation.js';
import {fitMapImage,resizedMapPoints} from '../shared/mapImages.js';
import {canShareMapPosition,visibleMapPositions} from '../shared/mapPositions.js';
import {visibleCampaignScenes,indexPointLinks,pointLinkLabel} from '../shared/campaignScenes.js';
import {gridStride,formatDistance} from '../shared/mapMeasurement.js';
import {emptyMapFog,mapArea,isMapPointRevealed,isMapStrokeRevealed} from '../shared/mapFog.js';
import {canReadMapStroke,strokeVisibility,visibleMapStrokes} from '../shared/mapLayers.js';
import {mapCoordinates,markerScreenScale,strokeNear} from './mapStrokeGeometry.js';
import {canEraseMapStroke,canManageMap} from '../shared/mapPermissions.js';
import RoomManagement from './RoomManagement.jsx';
import DiceHistory from './DiceHistory.jsx';
import ScenePresentation from './SceneMediaPlayer.jsx';
import { ROLE_LABELS } from '../api.js';
import StatusBars from './StatusBars.jsx';
import { SHEET_FONTS, FIELD_TYPES, evaluateFormula } from './sheetHelpers.jsx';
import { trapDialogFocus } from './trapDialogFocus.js';

const TabletopMap=lazy(()=>import('./tabletop/TabletopMap.jsx'));
const DiceTray=lazy(()=>import('./DiceTray.jsx'));
const DiceFocus=lazy(()=>import('./DiceFocus.jsx'));
const DiceRoller=lazy(()=>import('./DiceRoller.jsx'));
const CharacterSheet=lazy(()=>import('./CharacterSheet.jsx'));
const GroupStatus=lazy(()=>import('./GroupStatus.jsx'));
const CampaignTimelinePanel=lazy(()=>import('./CampaignTimelinePanel.jsx'));

const RPGMapExplorer = ({room,user,mutate,onExit,onLogout,connection,saving,error,adminMode,setAdminMode}) => {
  const [heldDice,setHeldDice]=useState(null);
  const [diceStructure,setDiceStructure]=useState('tray');
  const diceLaunch=useRef(null);
  const onTrayRoll=(terms,skinId,options={})=>{diceLaunch.current=null;setHeldDice({terms,skinId,structureId:'tray',origin:activeTab==='grupo'?'group':'sheet',sceneId:options.sceneId||null,private:options.private===true,operationId:crypto.randomUUID()});return true;};
  const throwHeldDice=async (gesture,physics)=>{if(!heldDice)return false;diceLaunch.current||={...heldDice,gesture,physics,requestedAt:Date.now()};const launch=diceLaunch.current,result=await mutate('/tray-rolls',launch,'POST');if(result&&diceLaunch.current===launch){diceLaunch.current=null;setHeldDice(null);}return result;};
  const [selectedPlayer,setSelectedPlayer]=useState('');
  const viewMode=room.role==='admin'?adminMode:room.role==='master'?'master':'player';
  const canManageMap2D=canManageMap(room.role,viewMode);
  const canSharePosition=canShareMapPosition(room.role,viewMode),positionsEnabled=room.state.mapPositions?.enabled===true;
  const mapRequestPath=path=>`${path}?mapViewMode=${viewMode}`;
  const canManageScenes=canManageMap2D;
  const [activeTab,setActiveTab]=useState('mesa');
  const [sceneRequest,setSceneRequest]=useState(null);
  const [mapMode,setMapMode]=useState('3d');
  const [tabletopSelection,setTabletopSelection]=useState([]);
  const [mapFocus,setMapFocus]=useState(false);
  const [map2dToolsOpen,setMap2dToolsOpen]=useState(false);
  const [mapCanvasSize,setMapCanvasSize]=useState({width:0,height:0});
  const [mapViewportSize,setMapViewportSize]=useState({width:0,height:0});
  const [mapImageError,setMapImageError]=useState(false),[mapImageRetry,setMapImageRetry]=useState(0);
  const [imageUpload,setImageUpload]=useState(null);
  const [routeDraft,setRouteDraft]=useState(null),[routeCursor,setRouteCursor]=useState(null),[legendDraft,setLegendDraft]=useState(null);
  const explorationPrefsKey=`grimorio-map-exploration-v1:${room.id}:${user.id}`;
  const [explorationPrefs,setExplorationPrefs]=useState(()=>{try{const stored=JSON.parse(localStorage.getItem(explorationPrefsKey));return {routes:stored?.routes!==false,legend:stored?.legend===true};}catch{return {routes:true,legend:false};}});
  const changeExplorationPrefs=next=>{setExplorationPrefs(next);try{localStorage.setItem(explorationPrefsKey,JSON.stringify(next));}catch{}};
  const {masterNotes='',mapImage,points:allPoints,mapStrokes=[],mapFog=emptyMapFog(),sheetFields,sheetFont,playerSheets,statusBarsData}=room.state;
  const points=canManageMap2D?allPoints:allPoints.filter(point=>isMapPointRevealed(mapFog,point));
  const mapLegend=room.state.mapLegend||defaultMapLegend(),mapRoutes=visibleMapRoutes(room.state.mapRoutes,canManageMap2D,mapFog);
  const displayedRoutes=explorationPrefs.routes?mapRoutes.filter(route=>!route.archived):[];
  const mapScale=room.state.mapScale||null,measurementPrefsKey=`grimorio-map-measure-v1:${room.id}:${user.id}`;
  const [measurementPrefs,setMeasurementPrefs]=useState(()=>loadMapMeasurementPrefs(measurementPrefsKey));
  const [measureRecord,setMeasureRecord]=useState(null);
  const measurement=measureRecord?.imageVersion===room.mapImageVersion?measureRecord.points:null;
  const changeMeasurement=points=>setMeasureRecord({imageVersion:room.mapImageVersion,points});
  const changeMeasurementPrefs=prefs=>{setMeasurementPrefs(prefs);try{localStorage.setItem(measurementPrefsKey,JSON.stringify(prefs));}catch{}};
  const [positionChoice,setPositionChoice]=useState(null);
  const positionDraft=canSharePosition&&positionsEnabled&&positionChoice?.imageVersion===room.mapImageVersion?positionChoice:null;
  const positionCovered=!!positionDraft&&!isMapPointRevealed(mapFog,positionDraft.point);
  const positionConflict=positionDraft&&(positionDraft.settingsVersion!==room.mapPositionSettingsVersion?'A opção da mesa mudou. Confira antes de compartilhar.':positionDraft.version!==room.ownMapPositionVersion?'Sua posição mudou em outra tela. Sua escolha foi preservada.':'');
  const playerMarkers=visibleMapPositions(room.state.mapPositions,room.members,canManageMap2D,mapFog);
  const layerSettingsKey=`grimorio-map-layers-v1:${room.id}:${user.id}`;
  const [layerSettings,setLayerSettings]=useState(()=>loadMapLayers(layerSettingsKey));
  const [strokeAudience,setStrokeAudience]=useState('table');
  const readableStrokes=mapStrokes.filter(stroke=>canReadMapStroke(room.role,viewMode,stroke)&&(canManageMap2D||isMapStrokeRevealed(mapFog,stroke)));
  const displayedStrokes=visibleMapStrokes(readableStrokes,{role:room.role,viewMode,username:user.username,...layerSettings});
  const changeLayerSettings=settings=>{setLayerSettings(settings);try{localStorage.setItem(layerSettingsKey,JSON.stringify(settings));}catch{}};
  const playerName=user.username;
  const [selectedPoint,setSelectedPoint]=useState(null);
  const [openNoteRequest,setOpenNoteRequest]=useState(null);
  const [showPointModal,setShowPointModal]=useState(false);
  const [pointSaveError,setPointSaveError]=useState(false);
  const [newPoint,setNewPoint]=useState({x:0,y:0,name:'',description:'',type:'cidade'});
  const [selectedMapTool,setMapTool]=useState('pan'),[strokeColor,setStrokeColor]=useState('#d9b777'),[drawError,setDrawError]=useState(''),[mapBusy,setMapBusy]=useState(false),[markingsShown,setMarkingsShown]=useState(40),[,setHistoryTick]=useState(0);
  useEffect(()=>{if(!drawError||drawError.startsWith('Não foi possível'))return;const timer=setTimeout(()=>setDrawError(''),6000);return()=>clearTimeout(timer);},[drawError]);
  const mapTool=['reveal','cover'].includes(selectedMapTool)&&(!canManageMap2D||!mapFog.enabled)||selectedMapTool==='position'&&(!canSharePosition||!positionsEnabled)||selectedMapTool==='route'&&(!canManageMap2D||!routeDraft||routeDraft.imageVersion!==room.mapImageVersion)?'pan':selectedMapTool;
  const [scale,setScale]=useState(1);
  const [pointQuery,setPointQuery]=useState(''),[pointType,setPointType]=useState(POINT_TYPE_ALL),[foundPointId,setFoundPointId]=useState(null);
  const [position,setPosition]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const panGesture=useRef(null),drawGesture=useRef(null),keyboardPen=useRef(null),strokePreviewRef=useRef(null),suppressCanvasClick=useRef(false);
  const strokeHistory=useRef({undo:[],redo:[]}),mapBusyRef=useRef(false);
  const fogGesture=useRef(null),fogPreviewRef=useRef(null),fogStartRef=useRef(null);
  const rulerRef=useRef(null);
  const canvasRef=useRef(null),canvasWrapperRef=useRef(null),mapRef=useRef(null),pointDialogRef=useRef(null),pointNameRef=useRef(null);
  useEffect(()=>{const warn=event=>{if(routeDraft||legendDraft){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[routeDraft,legendDraft]);
  useEffect(()=>{
    if(!showPointModal){setPointSaveError(false);return;}
    const dialog=pointDialogRef.current,opener=document.activeElement;
    dialog.showModal();
    pointNameRef.current?.focus();
    return()=>{if(dialog.open)dialog.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};
  },[showPointModal]);
  const mapFit=mapCanvasSize.width&&mapCanvasSize.height&&mapViewportSize.width&&mapViewportSize.height
    ?Math.min((mapViewportSize.width-20)/mapCanvasSize.width,(mapViewportSize.height-20)/mapCanvasSize.height):1;
  const markerScale=markerScreenScale(scale),markerUnit=markerScale/(mapFit*scale);
  useEffect(()=>{strokeHistory.current={undo:[],redo:[]};setHistoryTick(tick=>tick+1);},[room.mapImageVersion]);
  const saveShared=patch=>{
    const mapChange='points'in patch||'mapImage'in patch;
    if(mapChange&&!canManageMap2D)return Promise.resolve(false);
    return mutate(mapChange?mapRequestPath('/state'):'/state',{...patch,...('points'in patch?{pointsVersion:room.pointsVersion}:{})},'PATCH',current=>({...current,state:{...current.state,...patch}}));
  };
  const saveSheetFields=sheetFields=>saveShared({sheetFields});
  const saveSheetFont=sheetFont=>saveShared({sheetFont});
  const savePlayerName=()=>{};
  const updatePlayerSheet=(name,updates)=>mutate(`/sheets/${encodeURIComponent(name)}`,updates,'PATCH',current=>{
    const previous=current.state.playerSheets[name]||{values:{},extraFields:[]};
    return {...current,state:{...current.state,playerSheets:{...current.state.playerSheets,[name]:{...previous,...updates,values:{...previous.values,...updates.values}}}}};
  });
  const updateProfile=(name,updates)=>mutate(`/profiles/${encodeURIComponent(name)}`,updates,'PATCH',current=>({...current,state:{...current.state,statusBarsData:{...current.state.statusBarsData,[name]:{...current.state.statusBarsData[name],...updates}}}}));
  const updatePlayerBars=(name,bars)=>updateProfile(name,{bars});
  const updatePlayerAvatar=(name,avatar)=>updateProfile(name,{avatar});
  const savePoints=points=>saveShared({points});
  const openedPoint=points.find(point=>point.id===selectedPoint?.point.id);
  const selectPoint=(point,snapshot=room)=>setSelectedPoint({point,version:snapshot.pointVersions?.[point.id]});
  // "Ver no mapa": centers the point (zooming in a little when the map is wide open) without opening its details.
  const foundTimer=useRef(null);
  useEffect(()=>()=>clearTimeout(foundTimer.current),[]);
  const showPointOnMap=point=>{
    if(!mapCanvasSize.width||!mapFit)return;
    const zoom=Math.max(scale,1.5);
    setScale(zoom);setPosition(centerOnPoint(point,{width:mapCanvasSize.width,height:mapCanvasSize.height,fit:mapFit,scale:zoom}));
    setFoundPointId(point.id);clearTimeout(foundTimer.current);foundTimer.current=setTimeout(()=>setFoundPointId(null),5000);
    // On a narrow screen the tools panel covers the map; close it so the point can be seen.
    if(window.matchMedia('(max-width:760px)').matches)setMap2dToolsOpen(false);
  };
  const openLinkedPoint=id=>{const point=points.find(point=>point.id===id);if(!point)return;setMapMode('2d');setActiveTab('mapa');selectPoint(point);};
  const visibleLinkedNotes=[...(viewMode==='master'?(room.state.masterNotebooks||[]).map(note=>({...note,scope:'@master'})):[]),...(room.state.playerSheets?.[user.username]?.notebooks||[]).map(note=>({...note,scope:user.username})),...(room.state.sharedNotebooks||[])];
  const visibleScenes=visibleCampaignScenes(room.state.campaignScenes,points,canManageScenes,room.state.scenePresentation);
  const presentScene=(action,scene,position)=>mutate(mapRequestPath('/scene-presentation'),{action,version:room.state.scenePresentation.version,...(action==='stop'?{}:{sceneId:scene.id,sceneVersion:scene.version,position})},'POST');
  const pointLinks=indexPointLinks(visibleLinkedNotes,visibleScenes);
  const openLinkedScene=scene=>{setSelectedPoint(null);setSceneRequest({id:scene.id,token:crypto.randomUUID()});setActiveTab('cenas');};
  const createPointScene=point=>{setSelectedPoint(null);setSceneRequest({pointId:point.id,create:true,token:crypto.randomUUID()});setActiveTab('cenas');};
  const openLinkedNote=note=>{setSelectedPoint(null);setOpenNoteRequest({scope:note.scope,id:note.id,token:crypto.randomUUID()});};
  const openObjectReference=({referenceTarget,...snapshot})=>{
    const {kind,target}=referenceTarget;
    if(kind==='point'){setMapMode('2d');setActiveTab('mapa');selectPoint(target,snapshot);}
    else if(kind==='scene')openLinkedScene(target);
    else {setSelectedPoint(null);setOpenNoteRequest({scope:target.scope,id:target.id,view:'preserve',token:crypto.randomUUID()});}
  };
  const savePointDetails=(id,fields,version)=>canManageMap2D?mutate(mapRequestPath(`/points/${encodeURIComponent(id)}`),{...fields,version},'PATCH'):Promise.resolve(false);
  const canEraseStroke=stroke=>canReadMapStroke(room.role,viewMode,stroke)&&(canManageMap2D||isMapStrokeRevealed(mapFog,stroke))&&canEraseMapStroke(room.role,user.username,stroke.author,viewMode);
  const canApplyStrokeHistory=direction=>{const entry=strokeHistory.current[direction].at(-1);return !!entry&&(entry.kind==='visibility'?canManageMap2D:canEraseStroke(entry.stroke));};
  const performStrokeAction=async (operation,stroke)=>{
    if(!canEraseStroke(stroke)){setDrawError('No modo jogador, você pode alterar apenas seus próprios traços.');return false;}
    if(mapBusyRef.current){setDrawError('Aguarde o mapa terminar de salvar.');return false;}
    mapBusyRef.current=true;setMapBusy(true);setDrawError('');
    const result=operation==='add'
      ?await mutate(mapRequestPath('/map-strokes'),{id:stroke.id,path:stroke.path,color:stroke.color,...(stroke.visibility?{visibility:stroke.visibility}:{}),...(stroke.author===user.username?{}:{author:stroke.author})},'POST')
      :await mutate(mapRequestPath(`/map-strokes/${stroke.id}`),undefined,'DELETE');
    mapBusyRef.current=false;setMapBusy(false);
    if(!result){setDrawError('Não foi possível alterar o traço. Atualize o mapa e tente novamente.');return false;}
    return true;
  };
  const recordStrokeAction=(kind,stroke)=>{
    const history=strokeHistory.current;history.undo.push({kind,stroke});
    if(history.undo.length>100)history.undo.shift();
    history.redo=[];setHistoryTick(tick=>tick+1);
  };
  const createStroke=async (path,color=strokeColor,visibility=canManageMap2D?strokeAudience:'table')=>{
    const stroke={id:crypto.randomUUID(),path,color,author:user.username,...(visibility==='master'?{visibility}:{})};
    if(!canManageMap2D&&!isMapStrokeRevealed(mapFog,stroke)){setDrawError('Desenhe apenas dentro das áreas reveladas. Seu traço não foi salvo.');return;}
    if(!layerSettings.mine)changeLayerSettings({...layerSettings,mine:true});
    if(await performStrokeAction('add',stroke)){recordStrokeAction('add',stroke);setDrawError('Traço salvo. Ctrl+Z desfaz.');}
  };
  const eraseStroke=async stroke=>{
    if(await performStrokeAction('remove',stroke)){recordStrokeAction('remove',stroke);setDrawError('Traço apagado. Ctrl+Z restaura.');}
  };
  const changeStrokeVisibility=async (stroke,visibility,previousVisibility=strokeVisibility(stroke),record=true)=>{
    if(!canManageMap2D||mapBusyRef.current)return false;
    mapBusyRef.current=true;setMapBusy(true);setDrawError('');
    const result=await mutate(mapRequestPath(`/map-strokes/${stroke.id}`),{visibility,previousVisibility},'PATCH');
    mapBusyRef.current=false;setMapBusy(false);
    if(!result){setDrawError('Não foi possível mudar a visibilidade. Revise o traço atualizado e tente novamente.');return false;}
    if(record){strokeHistory.current.undo.push({kind:'visibility',stroke,before:previousVisibility,after:visibility});if(strokeHistory.current.undo.length>100)strokeHistory.current.undo.shift();strokeHistory.current.redo=[];setHistoryTick(tick=>tick+1);}
    setDrawError(visibility==='master'?'Traço disponível só para mestres. Ctrl+Z desfaz.':'Traço disponível para todos. Ctrl+Z desfaz.');
    return true;
  };
  const applyStrokeHistory=async direction=>{
    const history=strokeHistory.current,source=history[direction],entry=source.at(-1);
    if(!entry){setDrawError(direction==='undo'?'Nada para desfazer no mapa.':'Nada para refazer no mapa.');return;}
    if(entry.kind==='visibility'){
      if(!canManageMap2D){setDrawError('Alterar a visibilidade exige o modo mestre.');return;}
      if(!await changeStrokeVisibility(entry.stroke,direction==='undo'?entry.before:entry.after,direction==='undo'?entry.after:entry.before,false))return;
      source.pop();history[direction==='undo'?'redo':'undo'].push(entry);setHistoryTick(tick=>tick+1);return;
    }
    if(!canEraseStroke(entry.stroke)){setDrawError('No modo jogador, você só pode desfazer ou refazer seus próprios traços.');return;}
    const operation=(direction==='undo')===(entry.kind==='add')?'remove':'add';
    if(!await performStrokeAction(operation,entry.stroke))return;
    source.pop();history[direction==='undo'?'redo':'undo'].push(entry);
    setHistoryTick(tick=>tick+1);
    setDrawError(direction==='undo'?'Última ação do mapa desfeita.':'Ação do mapa refeita.');
  };
  const handleMapShortcut=e=>{
    if(activeTab!=='mapa'||mapMode!=='2d'||showPointModal||selectedPoint||!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const key=e.key.toLowerCase();
    if(key==='z'||key==='y'){
      e.preventDefault();
      applyStrokeHistory(key==='y'||e.shiftKey?'redo':'undo');
    }
  };
  const changeFog=async (operation,area,version=room.fogVersion)=>{
    if(!canManageMap2D||mapBusyRef.current)return;
    mapBusyRef.current=true;setMapBusy(true);setDrawError('');
    const result=await mutate(mapRequestPath('/map-fog'),{operation,version,...(area?{area}:{})},'PATCH');
    mapBusyRef.current=false;setMapBusy(false);
    setDrawError(result?operation==='enable'?'Névoa ativada. Escolha Revelar área para começar.':operation==='disable'?'Mapa inteiro disponível para jogadores.':operation==='reveal'?'Área revelada e salva na mesa.':'Área coberta e salva na mesa.':'Não foi possível alterar a névoa. Revise o mapa atualizado e tente novamente.');
  };
  const saveMapScale=async (next,version)=>{
    if(!canManageMap2D||mapBusyRef.current)return false;
    mapBusyRef.current=true;setMapBusy(true);setDrawError('');
    const result=await mutate(mapRequestPath('/map-scale'),{scale:next,version},'PATCH');
    mapBusyRef.current=false;setMapBusy(false);
    if(result){changeMeasurementPrefs({...measurementPrefs,grid:true});setDrawError('Escala salva na mesa. A régua usa a unidade definida.');}
    return result;
  };
  const paintFogPreview=gesture=>{
    const preview=fogPreviewRef.current;
    if(!preview)return;
    if(!gesture){preview.setAttribute('visibility','hidden');fogStartRef.current?.setAttribute('visibility','hidden');return;}
    for(const [key,value] of Object.entries(mapArea(gesture.from,gesture.to)))preview.setAttribute(key,String(value));
    preview.setAttribute('visibility','visible');
    fogStartRef.current?.setAttribute('cx',String(gesture.from.x));fogStartRef.current?.setAttribute('cy',String(gesture.from.y));fogStartRef.current?.setAttribute('r',String(6/(mapFit*scale)));fogStartRef.current?.setAttribute('visibility','visible');
  };
  const selectMapTool=tool=>{
    keyboardPen.current=null;strokePreviewRef.current?.setAttribute('d','');
    fogGesture.current=null;paintFogPreview(null);
    rulerRef.current?.cancelDraft();
    if(tool!=='position')setPositionChoice(null);
    setDrawError('');setMapTool(tool);
  };
  const beginPositionChoice=()=>{if(!mapCanvasSize.width||mapImageError){setDrawError('Aguarde o mapa terminar de abrir. Se a imagem falhar, use Tentar novamente.');return;}selectMapTool('position');setMap2dToolsOpen(false);canvasRef.current?.focus({preventScroll:true});};
  const stopRouteChoice=()=>{selectMapTool('pan');setMap2dToolsOpen(true);};
  const chooseRouteWaypoint=point=>{
    if(!canManageMap2D||!routeDraft||routeDraft.imageVersion!==room.mapImageVersion)return;
    if(routeDraft.fields.waypoints.length>=100){setDrawError('A rota atingiu 100 paradas. Volte aos detalhes para remover uma.');return;}
    const next={x:Math.round(Math.max(0,Math.min(mapCanvasSize.width-1,point.x))),y:Math.round(Math.max(0,Math.min(mapCanvasSize.height-1,point.y)))};
    if(routeDraft.fields.waypoints.at(-1)?.x===next.x&&routeDraft.fields.waypoints.at(-1)?.y===next.y){setDrawError('Escolha uma parada diferente da anterior.');return;}
    setRouteCursor(next);setRouteDraft(current=>({...current,fields:{...current.fields,waypoints:[...current.fields.waypoints,next]}}));setDrawError('Parada adicionada à prévia. Volte aos detalhes para salvar a rota.');
  };
  const beginRouteChoice=()=>{if(!mapCanvasSize.width||mapImageError){setDrawError('Aguarde o mapa terminar de abrir.');return;}selectMapTool('route');setRouteCursor(routeDraft?.fields.waypoints.at(-1)||{x:Math.floor(mapCanvasSize.width/2),y:Math.floor(mapCanvasSize.height/2)});setMap2dToolsOpen(false);canvasRef.current?.focus({preventScroll:true});};
  const saveRoute=async draft=>{
    const result=await mutate(mapRequestPath(`/map-routes${draft.version?'/'+encodeURIComponent(draft.id):''}`),{...draft.fields,name:draft.fields.name.trim(),...(draft.version?{version:draft.version}:{id:draft.id}),imageVersion:draft.imageVersion},draft.version?'PATCH':'POST');
    if(result){setRouteDraft(null);setRouteCursor(null);selectMapTool('pan');setDrawError('Rota salva na mesa.');}return result;
  };
  const archiveRoute=(route,archived)=>mutate(mapRequestPath(`/map-routes/${encodeURIComponent(route.id)}/archive`),{archived,version:room.mapRouteVersions[route.id],imageVersion:room.mapImageVersion},'PATCH');
  const saveLegend=(legend,version)=>mutate(mapRequestPath('/map-legend'),{legend,version},'PATCH');
  const cancelPositionChoice=()=>{setPositionChoice(null);selectMapTool('pan');};
  const choosePosition=point=>{
    const next={x:Math.round(Math.max(0,Math.min(mapCanvasSize.width-1,point.x))),y:Math.round(Math.max(0,Math.min(mapCanvasSize.height-1,point.y)))};
    setPositionChoice(current=>{
      const base=current?.imageVersion===room.mapImageVersion?current:{imageVersion:room.mapImageVersion,version:room.ownMapPositionVersion,settingsVersion:room.mapPositionSettingsVersion};
      return {...base,point:next};
    });
    setDrawError(isMapPointRevealed(mapFog,next)?'Prévia escolhida. Compartilhe para mostrar aos outros jogadores.':'Escolha uma área revelada. Use as setas para mover a prévia ou toque em outro lugar.');
  };
  const changePositionSettings=async enabled=>{
    if(!canManageMap2D||mapBusyRef.current)return;
    mapBusyRef.current=true;setMapBusy(true);
    const result=await mutate(mapRequestPath('/map-position-settings'),{enabled,version:room.mapPositionSettingsVersion},'PATCH');
    mapBusyRef.current=false;setMapBusy(false);
    if(result){setPositionChoice(null);setDrawError(enabled?'Posições liberadas. Cada jogador escolhe se quer compartilhar.':'Posições desativadas e marcadores removidos.');}
    return result;
  };
  const saveOwnPosition=async (point=positionDraft?.point,version=positionDraft?.version,settingsVersion=positionDraft?.settingsVersion)=>{
    if(!canSharePosition||!positionsEnabled||mapBusyRef.current||point===undefined)return;
    if(point!==null&&!isMapPointRevealed(mapFog,point)){setDrawError('Escolha sua posição dentro de uma área revelada.');return;}
    mapBusyRef.current=true;setMapBusy(true);
    const result=await mutate(mapRequestPath('/map-position'),{position:point,version,settingsVersion},'PATCH');
    mapBusyRef.current=false;setMapBusy(false);
    if(result){setPositionChoice(null);setMapTool('pan');setDrawError(point?'Sua posição foi compartilhada na mesa.':'Sua posição foi removida.');}
    else setDrawError('Não foi possível alterar sua posição. Sua escolha foi preservada; confira a mesa antes de tentar novamente.');
  };
  const handleImageUpload=e=>{
    const input=e.currentTarget,file=input.files[0];
    input.value='';
    if(!file||!canManageMap2D||saving)return;
    setImageUpload({file,version:room.mapImageVersion,pointsVersion:room.pointsVersion});
  };
  const publishMapImage=async(image,version,adjust,dimensions,pointsVersion)=>{
    if(!canManageMap2D)return false;
    const result=await mutate(mapRequestPath('/state'),{mapImage:image,mapImageVersion:version,...(adjust?{points:resizedMapPoints(allPoints,mapCanvasSize,dimensions),pointsVersion}:{})},'PATCH');
    if(result){setImageUpload(null);setScale(1);setPosition({x:0,y:0});setMapTool('pan');setDrawError('Imagem publicada na mesa.');}
    return result;
  };

  const pointTypes = [
    { value: 'cidade', label: 'Cidade', icon: Castle, color: '#c7ab76' },
    { value: 'dungeon', label: 'Dungeon', icon: Skull, color: '#8b0000' },
    { value: 'taverna', label: 'Taverna', icon: Scroll, color: '#cd853f' },
    { value: 'floresta', label: 'Floresta', icon: Grid, color: '#228b22' },
    { value: 'evento', label: 'Evento', icon: Sword, color: '#ff4500' },
  ].map(type=>({...type,...mapLegend.find(entry=>entry.type===type.value)}));
  // With a search or a type chosen, markers outside the result fade on the map; with none, every marker stays as it is.
  const pointFilterIds=pointQuery.trim()||pointType!==POINT_TYPE_ALL?new Set(filterPoints(points,{query:pointQuery,type:pointType,typeLabels:Object.fromEntries(pointTypes.map(type=>[type.value,type.label]))}).map(point=>point.id)):null;

  const handleCanvasClick = (e) => {
    if(['draw','reveal','cover','measure'].includes(mapTool))return;
    if (suppressCanvasClick.current) {
      suppressCanvasClick.current=false;
      return;
    }

    const canvas=canvasRef.current;
    if(!mapCanvasSize.width||mapImageError)return;
    canvas.focus();
    const rect=canvas.getBoundingClientRect();
    const {x,y}=mapCoordinates(e.clientX,e.clientY,rect,mapCanvasSize.width,mapCanvasSize.height);
    if(mapTool==='route'){chooseRouteWaypoint({x,y});return;}
    if(mapTool==='position'){choosePosition({x,y});return;}
    if(mapTool==='erase'){
      const radius=12*mapCanvasSize.width/rect.width;
      const stroke=strokeNear(displayedStrokes,x,y,radius,canEraseStroke);
      if(stroke)eraseStroke(stroke);
      else setDrawError(canManageMap2D?'Nenhum traço encontrado aqui.':'Nenhum traço seu encontrado aqui. Você pode apagar apenas seus próprios traços.');
      return;
    }

    // Verificar se clicou em um ponto existente
    const clickedPoint = points.find(p => {
      const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
      return distance < (12*markerScale+5)*mapCanvasSize.width/rect.width;
    });

    if (clickedPoint) {
      selectPoint(clickedPoint);
    } else if (canManageMap2D) {
      setNewPoint({ ...newPoint, x, y });
      setShowPointModal(true);
    }
  };

  const handlePointClick = (point) => {
    selectPoint(point);
  };

  const addPoint = async () => {
    if (!canManageMap2D||saving||!newPoint.name.trim()) return;
    
    const point = {
      ...newPoint,name:newPoint.name.trim(),
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    const saved=await savePoints([...points, point]);
    if(!saved){setPointSaveError(true);return;}
    setPointSaveError(false);
    setShowPointModal(false);
    selectPoint(point,saved);
    setNewPoint({ x: 0, y: 0, name: '', description: '', type: 'cidade' });
  };

  const deletePoint = async (pointId) => {
    if(!canManageMap2D||saving)return;
    const point=points.find(point=>point.id===pointId);
    if(!point||!window.confirm(`Excluir o ponto “${point.name}”? Esta ação não pode ser desfeita.`))return;
    await savePoints(points.filter(p => p.id !== pointId));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  const handleCanvasKeyDown=e=>{
    if(!mapCanvasSize.width||mapImageError)return;
    if(mapTool==='route'){
      if(e.key==='Escape'){e.preventDefault();stopRouteChoice();return;}
      const cursor=routeCursor||{x:Math.floor(mapCanvasSize.width/2),y:Math.floor(mapCanvasSize.height/2)};
      if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseRouteWaypoint(cursor);return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(delta){e.preventDefault();const step=e.shiftKey?5:20;setRouteCursor({x:Math.max(0,Math.min(mapCanvasSize.width-1,cursor.x+delta[0]*step)),y:Math.max(0,Math.min(mapCanvasSize.height-1,cursor.y+delta[1]*step))});return;}
    }
    if(mapTool==='position'){
      if(e.key==='Escape'){e.preventDefault();cancelPositionChoice();return;}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();if(positionDraft){if(!positionConflict)saveOwnPosition();else setDrawError('Revise sua escolha nas ferramentas antes de compartilhar.');}else choosePosition({x:Math.floor(mapCanvasSize.width/2),y:Math.floor(mapCanvasSize.height/2)});return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(delta&&positionDraft){e.preventDefault();const step=e.shiftKey?5:20;choosePosition({x:positionDraft.point.x+delta[0]*step,y:positionDraft.point.y+delta[1]*step});return;}
    }
    if(mapTool==='measure'&&rulerRef.current?.keyDown(e))return;
    if(['reveal','cover'].includes(mapTool)){
      const canvas=canvasRef.current,gesture=fogGesture.current;
      if(e.key==='Escape'){e.preventDefault();fogGesture.current=null;paintFogPreview(null);setDrawError('Área cancelada.');return;}
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        if(!gesture){const x=Math.floor(mapCanvasSize.width/2),y=Math.floor(mapCanvasSize.height/2);fogGesture.current={from:{x,y},to:{x,y},operation:mapTool,version:room.fogVersion};paintFogPreview(fogGesture.current);setDrawError('Área iniciada no centro. Setas ajustam; Enter salva.');}
        else{const area=mapArea(gesture.from,gesture.to);if(!area.width||!area.height){setDrawError('Use as setas para marcar largura e altura antes de salvar.');return;}fogGesture.current=null;paintFogPreview(null);changeFog(gesture.operation,area,gesture.version);}
        return;
      }
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(gesture&&delta){
        e.preventDefault();const step=e.shiftKey?5:20;
        if(e.altKey){const area=mapArea(gesture.from,gesture.to),dx=Math.max(-area.x,Math.min(mapCanvasSize.width-area.x-area.width,delta[0]*step)),dy=Math.max(-area.y,Math.min(mapCanvasSize.height-area.y-area.height,delta[1]*step));gesture.from={x:gesture.from.x+dx,y:gesture.from.y+dy};gesture.to={x:gesture.to.x+dx,y:gesture.to.y+dy};}
        else gesture.to={x:Math.max(0,Math.min(mapCanvasSize.width,gesture.to.x+delta[0]*step)),y:Math.max(0,Math.min(mapCanvasSize.height,gesture.to.y+delta[1]*step))};
        paintFogPreview(gesture);return;
      }
    }
    if(mapTool==='draw'){
      const canvas=canvasRef.current,pen=keyboardPen.current;
      if(e.key==='Escape'&&pen){e.preventDefault();keyboardPen.current=null;strokePreviewRef.current?.setAttribute('d','');setDrawError('Traço cancelado.');return;}
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        if(!pen){const x=Math.round(mapCanvasSize.width/2),y=Math.round(mapCanvasSize.height/2);keyboardPen.current={x,y,path:`M ${x} ${y}`,count:0,color:strokeColor,visibility:canManageMap2D?strokeAudience:'table'};strokePreviewRef.current?.setAttribute('d',keyboardPen.current.path);setDrawError('Traço iniciado no centro. Use as setas e pressione Enter para salvar.');}
        else{keyboardPen.current=null;strokePreviewRef.current?.setAttribute('d','');setDrawError('');if(pen.count)createStroke(pen.path,pen.color,pen.visibility);}
        return;
      }
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(pen&&delta){e.preventDefault();const step=e.shiftKey?5:20;pen.x=Math.max(0,Math.min(mapCanvasSize.width,pen.x+delta[0]*step));pen.y=Math.max(0,Math.min(mapCanvasSize.height,pen.y+delta[1]*step));if(pen.path.length<11800){pen.path+=` L ${pen.x} ${pen.y}`;pen.count++;strokePreviewRef.current?.setAttribute('d',pen.path);}return;}
    }
    const step=e.shiftKey?16:48;
    if(e.key==='ArrowLeft')setPosition(p=>({...p,x:p.x+step}));
    else if(e.key==='ArrowRight')setPosition(p=>({...p,x:p.x-step}));
    else if(e.key==='ArrowUp')setPosition(p=>({...p,y:p.y+step}));
    else if(e.key==='ArrowDown')setPosition(p=>({...p,y:p.y-step}));
    else if(e.key==='+'||e.key==='=')setScale(s=>Math.min(s*1.2,3));
    else if(e.key==='-')setScale(s=>Math.max(s/1.2,.5));
    else if(e.key==='Home'){setScale(1);setPosition({x:0,y:0});}
    else return;
    e.preventDefault();
  };

  const handleMapPointerDown = (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    if(!mapCanvasSize.width||mapImageError)return;
    suppressCanvasClick.current=false;
    if(mapTool==='erase'||mapTool==='position'||mapTool==='route')return;
    if(mapTool==='measure'){
      const canvas=canvasRef.current,rect=canvas?.getBoundingClientRect();
      if(!rect||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
      canvas.focus({preventScroll:true});rulerRef.current?.start(mapCoordinates(e.clientX,e.clientY,rect,mapCanvasSize.width,mapCanvasSize.height),e.pointerId);
      e.currentTarget.setPointerCapture(e.pointerId);setDrawError('');return;
    }
    if(['reveal','cover'].includes(mapTool)){
      if(mapBusyRef.current)return;
      const canvas=canvasRef.current,rect=canvas?.getBoundingClientRect();
      if(!rect||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
      const from={x:Math.round((e.clientX-rect.left)*mapCanvasSize.width/rect.width),y:Math.round((e.clientY-rect.top)*mapCanvasSize.height/rect.height)};
      fogGesture.current=fogGesture.current?.tap?{...fogGesture.current,pointerId:e.pointerId,to:from}:{pointerId:e.pointerId,from,to:from,operation:mapTool,version:room.fogVersion};paintFogPreview(fogGesture.current);
      e.currentTarget.setPointerCapture(e.pointerId);setDrawError('');return;
    }
    if(mapTool==='draw'){
      if(mapBusyRef.current){setDrawError('Aguarde o mapa terminar de salvar.');return;}
      const canvas=canvasRef.current,rect=canvas?.getBoundingClientRect();
      if(!rect||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
      const x=Math.round((e.clientX-rect.left)*mapCanvasSize.width/rect.width),y=Math.round((e.clientY-rect.top)*mapCanvasSize.height/rect.height);
      drawGesture.current={pointerId:e.pointerId,path:`M ${x} ${y}`,lastX:x,lastY:y,count:0,color:strokeColor,visibility:canManageMap2D?strokeAudience:'table'};
      e.currentTarget.setPointerCapture(e.pointerId);
      strokePreviewRef.current?.setAttribute('d',drawGesture.current.path);
      setDrawError('');
      return;
    }
    panGesture.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,origin:position,moved:false};
  };

  const handleMapPointerMove = (e) => {
    if(mapTool==='measure'){
      const canvas=canvasRef.current,rect=canvas?.getBoundingClientRect();
      if(rect)rulerRef.current?.move(mapCoordinates(e.clientX,e.clientY,rect,mapCanvasSize.width,mapCanvasSize.height),e.pointerId);
      return;
    }
    const fog=fogGesture.current;
    if(fog&&fog.pointerId===e.pointerId){
      const canvas=canvasRef.current,rect=canvas.getBoundingClientRect();
      fog.to={x:Math.round(Math.max(0,Math.min(mapCanvasSize.width,(e.clientX-rect.left)*mapCanvasSize.width/rect.width))),y:Math.round(Math.max(0,Math.min(mapCanvasSize.height,(e.clientY-rect.top)*mapCanvasSize.height/rect.height)))};
      paintFogPreview(fog);return;
    }
    const stroke=drawGesture.current;
    if(stroke&&stroke.pointerId===e.pointerId){
      const canvas=canvasRef.current,rect=canvas.getBoundingClientRect();
      const x=Math.round(Math.max(0,Math.min(mapCanvasSize.width,(e.clientX-rect.left)*mapCanvasSize.width/rect.width)));
      const y=Math.round(Math.max(0,Math.min(mapCanvasSize.height,(e.clientY-rect.top)*mapCanvasSize.height/rect.height)));
      if(Math.hypot(x-stroke.lastX,y-stroke.lastY)<2||stroke.path.length>11800)return;
      stroke.path+=` L ${x} ${y}`;stroke.lastX=x;stroke.lastY=y;stroke.count++;
      strokePreviewRef.current?.setAttribute('d',stroke.path);
      return;
    }
    const gesture=panGesture.current;
    if (!gesture || gesture.pointerId!==e.pointerId) return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if (!gesture.moved && Math.hypot(dx,dy)<6) return;
    if (!gesture.moved) {gesture.moved=true;setDragging(true);}
    setPosition({x:gesture.origin.x+dx,y:gesture.origin.y+dy});
  };

  const handleMapPointerEnd = (e) => {
    if(mapTool==='measure'){suppressCanvasClick.current=true;rulerRef.current?.end(e.pointerId,e.type==='pointercancel');return;}
    const fog=fogGesture.current;
    if(fog&&fog.pointerId===e.pointerId){
      suppressCanvasClick.current=true;
      const area=mapArea(fog.from,fog.to);
      if(e.type==='pointercancel'){fogGesture.current=null;paintFogPreview(null);return;}
      if(!area.width||!area.height){fogGesture.current={...fog,pointerId:undefined,tap:true};paintFogPreview(fogGesture.current);setDrawError('Primeiro canto marcado. Toque no canto oposto para salvar a área, ou Escape para cancelar.');return;}
      fogGesture.current=null;paintFogPreview(null);changeFog(fog.operation,area,fog.version);
      return;
    }
    const stroke=drawGesture.current;
    if(stroke&&stroke.pointerId===e.pointerId){
      drawGesture.current=null;strokePreviewRef.current?.setAttribute('d','');
      suppressCanvasClick.current=true;
      if(e.type!=='pointercancel'&&stroke.count>0)createStroke(stroke.path,stroke.color,stroke.visibility);
      return;
    }
    const gesture=panGesture.current;
    if (!gesture || gesture.pointerId!==e.pointerId) return;
    suppressCanvasClick.current=gesture.moved;
    panGesture.current=null;
    setDragging(false);
  };

  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const task=new AbortController();let bitmap;
    setMapImageError(false);setMapCanvasSize({width:0,height:0});canvas.width=canvas.height=0;
    (async()=>{
      try{
        const response=await fetch(mapImage,{signal:task.signal});if(!response.ok)throw Error('Não foi possível carregar o mapa. Confira sua conexão e tente novamente.');
        const file=await response.blob();await readMapImageFile(file,task.signal);bitmap=await openMapBitmap(file,task.signal);
        const logical={width:bitmap.width,height:bitmap.height},rendered=fitMapImage(logical.width,logical.height);
        canvas.width=rendered.width;canvas.height=rendered.height;ctx.drawImage(bitmap.image||bitmap,0,0,canvas.width,canvas.height);setMapCanvasSize(logical);
      }catch(reason){if(!task.signal.aborted){canvas.width=canvas.height=0;setMapImageError(reason.name==='InvalidStateError'?'A imagem não pôde ser aberta. Peça ao mestre para conferir o arquivo.':reason.message);}}
      finally{bitmap?.close();}
    })();
    return()=>{task.abort();bitmap?.close();canvas.width=canvas.height=0;};
  }, [mapImage, mapMode, activeTab,mapImageRetry]);

  useEffect(()=>{
    if(mapMode!=='2d'||activeTab!=='mapa'||!mapImage||!canvasWrapperRef.current)return;
    const wrapper=canvasWrapperRef.current;
    const measure=()=>{const rect=wrapper.getBoundingClientRect();setMapViewportSize(previous=>previous.width===rect.width&&previous.height===rect.height?previous:{width:rect.width,height:rect.height});};
    const observer=new ResizeObserver(measure);
    observer.observe(wrapper);measure();
    return()=>observer.disconnect();
  },[mapMode,activeTab,mapImage]);

  const playerNames=room.members.filter(m=>m.role!=='master').map(m=>m.username);
  const groupEntries=room.groupBars;
  const instruments=instrumentStatuses({mapImage:!!mapImage,pointCount:points.length,scale,gridVisible:!!measurementPrefs.grid,hasScale:!!mapScale,fogEnabled:!!mapFog.enabled,positionsEnabled:!!positionsEnabled,routeCount:mapRoutes.length,legendVisible:!!explorationPrefs.legend,strokeCount:readableStrokes.length,mapTool,routeDraft:!!routeDraft}),inUse=activeInstruments(instruments);
  return (
    <div className={`rpg-container mist-theme ${activeTab==='mapa'&&mapFocus?'map-focus':''}`}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <ScenePresentation roomId={room.id} scenes={visibleScenes} viewMode={viewMode} presentation={room.state.scenePresentation} serverTime={room.serverTime} editable={canManageScenes} saving={saving} connection={connection} onCommand={presentScene}/>
      
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="brand-mark"><ScrollText size={25} /></div><div><span className="brand-kicker">SUA MESA DE RPG</span><h1>Grimório</h1></div>
          </div>
          <div className="header-controls">
            <div className="room-title-nav">{room.name}</div>
            {room.role==='admin'?<button className={`mode-btn ${viewMode==='master'?'active':''}`} onClick={()=>{setAdminMode(viewMode==='master'?'player':'master');setDrawError('');}} title="Como ADM, você pode alternar entre jogador e mestre"><ShieldCheck size={18}/>{viewMode==='master'?'ADM · modo mestre':'ADM · modo jogador'}</button>:<div className="identity-label">{ROLE_LABELS[room.role]} · @{user.username}</div>}
            <span className={`sync-status ${connection!=='online'?'offline':''}`} role="status">{saving?'Enviando alterações…':connection==='online'?'Conectado à mesa':connection==='connecting'?'Conectando…':'Reconectando ao servidor…'}</span>
            <details className="account-menu"><summary>@{user.username}</summary><div className="account-nav-actions"><button onClick={onExit}>Minhas mesas</button><button onClick={onLogout}>Sair da conta</button></div></details>
            <div className="user-indicator">
              <Users size={20} />
              <span>{points.length} {points.length===1?'ponto':'pontos'}</span>
            </div>
          </div>
        </div>
        <nav className="tab-nav" aria-label="Navegação principal"><button className={`tab-btn ${activeTab==='mesa'?'active':''}`} aria-pressed={activeTab==='mesa'} onClick={()=>setActiveTab('mesa')}><Users size={18}/>Mesa</button>
          <button
            className={`tab-btn ${activeTab === 'mapa' ? 'active' : ''}`}
            aria-pressed={activeTab === 'mapa'}
            onClick={() => setActiveTab('mapa')}
          >
            <Map size={18} />
            Mapa
          </button>
          <button
            className={`tab-btn ${activeTab === 'ficha' ? 'active' : ''}`}
            aria-pressed={activeTab === 'ficha'}
            onClick={() => setActiveTab('ficha')}
          >
            <ScrollText size={18} />
            <span className="tab-label-full">{viewMode==='master'?'Mestre · fichas':'Jogador · ficha'}</span><span className="tab-label-short">Ficha</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'grupo' ? 'active' : ''}`}
            aria-pressed={activeTab === 'grupo'}
            onClick={() => setActiveTab('grupo')}
          >
            <Heart size={18} />
            <span className="tab-label-full">Status do Grupo</span><span className="tab-label-short">Grupo</span>
          </button>
          <button className={`tab-btn ${activeTab==='cenas'?'active':''}`} aria-pressed={activeTab==='cenas'} onClick={()=>setActiveTab('cenas')}><Clapperboard size={18} aria-hidden="true"/>Cenas</button>
          <button className={`tab-btn ${activeTab==='linha'?'active':''}`} aria-pressed={activeTab==='linha'} onClick={()=>setActiveTab('linha')}><BookOpen size={18} aria-hidden="true"/><span className="tab-label-full">Linha do tempo</span><span className="tab-label-short">Diário</span></button>
        </nav>
        <div className="nav-footer"><button className={`nav-about-button ${activeTab==='sobre'?'active':''}`} aria-pressed={activeTab==='sobre'} onClick={()=>setActiveTab('sobre')}><Info size={18} aria-hidden="true"/>Sobre</button></div>
      </header>

      <div className="room-content">{connection!=='online'&&connection!=='connecting'&&<p className="connection-banner" role="status">Sem conexão com o servidor. Suas alterações só serão enviadas quando a conexão voltar; o que você está vendo pode estar desatualizado.</p>}<div className="session-strip"><TurnTracker key={`${room.id}:${user.id}`} room={room} username={user.username} userId={user.id} editable={viewMode==='master'} saving={saving} connection={connection} mutate={mutate}/><Notebook key={room.id+':personal:'+user.id} storageKey={`${room.id}:${user.id}:${user.username}`} className="personal-notebook" title="Minhas notas" hint="Privadas · você escolhe com quem compartilhar" scope={user.username} username={user.username} members={room.members} canShare notes={room.state.playerSheets?.[user.username]?.notebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(scope,id,note)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}`,note,'PATCH')} onShare={(scope,id,data)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}/share`,data,'PATCH')} onTrash={(scope,id,trashed,version)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}/trash`,{trashed,version},'PATCH')} onEmptyTrash={scope=>mutate(`/notes/${encodeURIComponent(scope)}/trash`,undefined,'DELETE')}/>{viewMode==='master'&&<Notebook key={room.id+':master'} storageKey={room.id+':'+user.id+':master'} className="master-notebook" title="Notas do mestre" hint="Privadas · várias janelas" scope="@master" username={user.username} members={room.members} canShare notes={room.state.masterNotebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(_,id,note)=>mutate('/notes/@master/'+id,note,'PATCH')} onShare={(_,id,data)=>mutate('/notes/@master/'+id+'/share',data,'PATCH')} onTrash={(_,id,trashed,version)=>mutate('/notes/@master/'+id+'/trash',{trashed,version},'PATCH')} onEmptyTrash={()=>mutate('/notes/@master/trash',undefined,'DELETE')}/>}<Notebook key={room.id+':shared:'+user.id} storageKey={room.id+':'+user.id+':shared'} className="shared-notebook" title="Notas compartilhadas" hint="Acesso e edição em grupo" scope="shared" username={user.username} members={room.members} notes={room.state.sharedNotebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(scope,id,note)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}`,note,'PATCH')}/></div>
      <main id="main-content" className={`main-content view-${activeTab}`} tabIndex={-1} onKeyDown={handleMapShortcut}>
        {activeTab==='mesa'?<RoomManagement room={room} mutate={mutate} viewMode={viewMode}/>:activeTab === 'mapa' ? (
          <>
            <h2 className="sr-only">Mapa da mesa</h2>
            <div className="map-mode-tabs" role="group" aria-label="Visualização do mapa"><button aria-pressed={mapMode==='3d'} onClick={()=>setMapMode('3d')}>Mesa 3D</button><button aria-pressed={mapMode==='2d'} onClick={()=>setMapMode('2d')}>Mapa 2D e pontos</button>{mapMode==='2d'&&<button aria-expanded={map2dToolsOpen} aria-controls="map-2d-tools" onClick={()=>setMap2dToolsOpen(open=>!open)}>{map2dToolsOpen?'Fechar ferramentas':'Ferramentas 2D'}</button>}<button className="map-focus-button" aria-pressed={mapFocus} onClick={()=>setMapFocus(focus=>!focus)}>{mapFocus?'Sair do foco':'Ampliar mapa'}</button></div>
            {mapMode==='2d'&&mapImage&&<div className="map-draw-tools" role="toolbar" aria-label="Ferramentas de anotação do mapa">
              <button type="button" aria-pressed={mapTool==='pan'} onClick={()=>selectMapTool('pan')}><Hand size={16} aria-hidden="true"/>Mover</button>
              <button type="button" aria-pressed={mapTool==='draw'} onClick={()=>selectMapTool('draw')}><Pencil size={16} aria-hidden="true"/>Desenhar</button>
              <button type="button" aria-pressed={mapTool==='erase'} onClick={()=>selectMapTool('erase')}><Eraser size={16} aria-hidden="true"/>Borracha</button>
              <button type="button" aria-pressed={mapTool==='measure'} onClick={()=>selectMapTool('measure')}><Ruler size={16} aria-hidden="true"/>Medir</button>
              {canSharePosition&&positionsEnabled&&<button type="button" aria-pressed={mapTool==='position'} onClick={beginPositionChoice}><Users size={16} aria-hidden="true"/>Minha posição</button>}
              {mapTool==='draw'&&<MapStrokeColor color={strokeColor} onChange={setStrokeColor}/>}
              {mapTool==='draw'&&canManageMap2D&&<MapStrokeAudience value={strokeAudience} onChange={setStrokeAudience}/>}
              <button type="button" onClick={()=>applyStrokeHistory('undo')} disabled={mapBusy||!canApplyStrokeHistory('undo')} title="Ctrl+Z"><Undo2 size={16} aria-hidden="true"/>Desfazer</button>
              <button type="button" onClick={()=>applyStrokeHistory('redo')} disabled={mapBusy||!canApplyStrokeHistory('redo')} title="Ctrl+Shift+Z"><Redo2 size={16} aria-hidden="true"/>Refazer</button>
            </div>}
            <div className="map-messages">
            {mapMode==='2d'&&mapImage&&mapTool!=='pan'&&<p className="map-draw-help">{mapTool==='route'?'Clique ou toque para marcar paradas. Enter adiciona, setas movem e Escape volta aos detalhes. A rota só será publicada ao salvar.':mapTool==='position'?'Escolha no mapa e use Compartilhar posição nas ferramentas. Pelo teclado: Enter inicia, setas escolhem, Enter compartilha e Escape cancela.':mapTool==='measure'?'Arraste ou toque em dois pontos para medir. Enter inicia, setas movem o destino, Alt+setas movem o trecho, Enter fixa e Esc limpa.':['reveal','cover'].includes(mapTool)?`Arraste para ${mapTool==='reveal'?'revelar':'cobrir'} uma área · Teclado: foque o mapa, Enter inicia, setas ajustam, Enter salva e Esc cancela.`:mapTool==='draw'?'Arraste para desenhar · Teclado: foque o mapa, Enter inicia e salva, setas traçam, Esc cancela. Ctrl+Z desfaz · Ctrl+Shift+Z refaz.':'Clique ou toque num traço para apagá-lo. Cada jogador apaga os próprios traços; o mestre pode apagar todos. Ctrl+Z desfaz · Ctrl+Shift+Z refaz.'}</p>}
            {mapMode==='2d'&&mapTool==='route'&&<div className="map-route-choice-bar"><span>{routeDraft.fields.waypoints.length} paradas na prévia</span><button type="button" onClick={stopRouteChoice}>Voltar aos detalhes da rota</button></div>}
            {drawError&&<p className={drawError.startsWith('Não foi possível')?'map-draw-error':'map-draw-notice'} role="status">{drawError}</p>}
            {mapMode==='2d'&&mapTool==='position'&&<div className="map-position-actions" role="group" aria-label="Sua posição no mapa">{positionConflict&&<p role="alert">{positionConflict}</p>}{positionCovered&&<p role="alert">A escolha está em uma área oculta. Mova para uma área revelada.</p>}{positionDraft&&<button type="button" disabled={mapBusy||saving||!!positionConflict||positionCovered} onClick={()=>saveOwnPosition()}>Compartilhar posição</button>}{positionConflict&&<button type="button" onClick={()=>setMap2dToolsOpen(true)}>Abrir revisão da posição</button>}<button type="button" disabled={mapBusy||saving} onClick={cancelPositionChoice}>Cancelar escolha</button></div>}
            {mapMode==='2d'&&mapImageError&&<p className="map-draw-error" role="alert">{mapImageError} <button type="button" onClick={()=>setMapImageRetry(value=>value+1)}>Tentar novamente</button></p>}
            </div>
            {mapMode==='3d'?<Suspense fallback={<p role="status">Preparando a mesa 3D…</p>}><TabletopMap key={`${room.id}:${user.id}`} room={room} userId={user.id} mutate={mutate} editable={canManageMap2D} viewMode={viewMode} selected={tabletopSelection} setSelected={setTabletopSelection} destinations={{points,scenes:visibleScenes,notes:visibleLinkedNotes}} onOpenReference={openObjectReference}/></Suspense>:<div className="legacy-map-layout">
            {/* Sidebar */}
            <aside id="map-2d-tools" className="sidebar" aria-label="Ferramentas do mapa 2D" hidden={!map2dToolsOpen}>
              <header className="tools-head"><h2>{canManageMap2D?'Ferramentas do mestre':'Ferramentas do mapa'}</h2><p role="status" aria-live="polite">{inUse.length?`Em uso: ${inUse.join(', ')}`:'Nenhum instrumento em uso'}</p></header>
              <ToolSection id="pontos" title="Pontos de interesse" icon={<Grid size={16} aria-hidden="true"/>} defaultOpen={!canManageMap2D} status={instruments.pontos.status}>
                <PointFinder points={points} types={pointTypes} query={pointQuery} onQuery={setPointQuery} type={pointType} onType={setPointType} linkLabel={point=>pointLinkLabel(pointLinks.get(point.id))} canDelete={canManageMap2D} saving={saving} onOpen={handlePointClick} onShow={showPointOnMap} onDelete={deletePoint} foundId={foundPointId}/>
              </ToolSection>

              <ToolSection id="controles" status={instruments.controles.status} active={instruments.controles.active} title="Controles e zoom" icon={<Settings2 size={16} aria-hidden="true"/>}>
                <div className="controls-info">
                  <p><strong>Roda do mouse:</strong> aproximar ou afastar</p>
                  <p><strong>Arrastar:</strong> mover o mapa no modo Mover; desenhar no modo Desenhar</p>
                  <p><strong>Clique:</strong> {canManageMap2D ? 'adicionar ponto' : 'ver ponto'} no modo Mover; apagar traço no modo Borracha</p>
                  <p><strong>Permissões:</strong> {canManageMap2D?'Você pode editar pontos e apagar traços de todos.':'Você pode desenhar e apagar somente seus próprios traços. Os pontos são para consulta.'}</p>
                  <p id="map-keyboard-help"><strong>Teclado:</strong> foco no mapa, setas para mover, +/− para zoom e Home para centralizar. Abra pontos pela lista acima.</p>
                </div>
                {mapImage&&<div className="map-keyboard-actions" role="group" aria-label="Controles do mapa 2D">
                  <button onClick={()=>setScale(prev=>Math.min(prev*1.2,3))}>Aproximar</button>
                  <button onClick={()=>setScale(prev=>Math.max(prev/1.2,.5))}>Afastar</button>
                  <button onClick={()=>{setScale(1);setPosition({x:0,y:0});}}>Centralizar</button>
                  {canManageMap2D&&<button disabled={saving||!mapCanvasSize.width||!!mapImageError} onClick={()=>{setNewPoint({...newPoint,x:mapCanvasSize.width/2,y:mapCanvasSize.height/2});setShowPointModal(true);}}>Adicionar ponto no centro</button>}
                </div>}
                <div className="zoom-indicator">
                  Zoom: {Math.round(scale * 100)}%
                </div>
              </ToolSection>
              <ToolSection id="medida" status={instruments.medida.status} active={instruments.medida.active} title="Grade e régua" icon={<RulerIcon size={16} aria-hidden="true"/>} forceOpen={mapTool==='measure'}><MapMeasurement scale={mapScale} version={room.mapScaleVersion} measurement={measurement} canManage={canManageMap2D} tool={mapTool} onTool={selectMapTool} onClear={()=>rulerRef.current?.clear()} onSave={saveMapScale} busy={mapBusy||saving} hasImage={!!mapImage} prefs={measurementPrefs} onPrefs={changeMeasurementPrefs} screenRatio={mapFit*scale}/></ToolSection>
              <ToolSection id="nevoa" status={instruments.nevoa.status} active={instruments.nevoa.active} title="Névoa de guerra" icon={<FogIcon size={16} aria-hidden="true"/>} forceOpen={['reveal','cover'].includes(mapTool)}><MapFog fog={mapFog} canManage={canManageMap2D} tool={mapTool} onTool={selectMapTool} onChange={changeFog} busy={mapBusy||saving} hasImage={!!mapImage}/></ToolSection>
              <ToolSection id="posicoes" status={instruments.posicoes.status} active={instruments.posicoes.active} title="Posições dos jogadores" icon={<Users size={16} aria-hidden="true"/>} forceOpen={mapTool==='position'}><MapPositions key={room.mapPositionSettingsVersion} enabled={positionsEnabled} canManage={canManageMap2D} canShare={canSharePosition} hasOwn={room.hasOwnMapPosition} markers={playerMarkers} members={room.members} userId={user.id} draft={positionDraft} conflict={positionConflict} covered={positionCovered} onEnable={changePositionSettings} onChoose={beginPositionChoice} onShare={()=>saveOwnPosition()} onClear={()=>saveOwnPosition(null,room.ownMapPositionVersion,room.mapPositionSettingsVersion)} onCancel={cancelPositionChoice} onRebase={()=>setPositionChoice(current=>({...current,version:room.ownMapPositionVersion,settingsVersion:room.mapPositionSettingsVersion}))} tool={mapTool} busy={mapBusy||saving} hasImage={!!mapImage}/></ToolSection>
              <ToolSection id="rotas" status={instruments.rotas.status} active={instruments.rotas.active} title="Rotas de exploração" icon={<RouteIcon size={16} aria-hidden="true"/>} forceOpen={!!routeDraft}><MapExploration routes={mapRoutes} versions={room.mapRouteVersions||{}} imageVersion={room.mapImageVersion} scale={mapScale} canManage={canManageMap2D} draft={routeDraft} onDraft={setRouteDraft} onChoose={beginRouteChoice} choosing={mapTool==='route'} onStop={stopRouteChoice} onSave={saveRoute} onArchive={archiveRoute} busy={mapBusy||saving} hasImage={!!mapImage} prefs={explorationPrefs} onPrefs={changeExplorationPrefs} error={error}/></ToolSection>
              <ToolSection id="legenda" status={instruments.legenda.status} active={instruments.legenda.active} title="Legenda do mapa" icon={<TagIcon size={16} aria-hidden="true"/>} forceOpen={false}><MapLegendEditor legend={mapLegend} version={room.mapLegendVersion} canManage={canManageMap2D} onSave={saveLegend} busy={mapBusy||saving} prefs={explorationPrefs} onPrefs={changeExplorationPrefs} draft={legendDraft} onDraft={setLegendDraft}/></ToolSection>
              <ToolSection id="exportar" status={instruments.exportar.status} active={instruments.exportar.active} title="Exportar vista" icon={<DownloadIcon size={16} aria-hidden="true"/>}><MapViewExport ready={!!mapImage&&!!mapCanvasSize.width&&!mapImageError} master={canManageMap2D} capture={()=>({
                canvas:canvasRef.current,viewport:canvasWrapperRef.current,dimensions:mapCanvasSize,points,
                pointLabels:Object.fromEntries(points.map(point=>[point.id,pointLinkLabel(pointLinks.get(point.id))])),
                legend:mapLegend,showLegend:explorationPrefs.legend,strokes:displayedStrokes,routes:displayedRoutes,
                fog:mapFog,master:canManageMap2D,markers:playerMarkers,members:room.members,userId:user.id,scale:mapScale,
                grid:measurementPrefs.grid,measurement,screenRatio:mapFit*scale,markerUnit,roomName:room.name
              })}/></ToolSection>
              <ToolSection id="tracos" status={instruments.tracos.status} active={instruments.tracos.active} title="Mostrar traços" icon={<LayersIcon size={16} aria-hidden="true"/>} forceOpen={false}><MapLayers strokes={readableStrokes} username={user.username} settings={layerSettings} onChange={changeLayerSettings}/></ToolSection>
              {canManageMap2D&&<ToolSection id="imagem" title="Imagem do mapa" icon={<Upload size={16} aria-hidden="true"/>} status={instruments.imagem.status}>
                <label className="upload-btn"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageUpload} disabled={saving||!!imageUpload} aria-label={mapImage?'Trocar imagem':'Selecionar imagem'}/>{mapImage?'Trocar imagem':'Selecionar imagem'}</label>
              </ToolSection>}
              {!!readableStrokes.length&&<details className="map-markings"><summary>Traços do mapa ({readableStrokes.length})</summary><ol>{readableStrokes.slice(-markingsShown).map((stroke,visibleIndex)=>{const index=readableStrokes.length-Math.min(markingsShown,readableStrokes.length)+visibleIndex;return <li key={stroke.id}><span>Traço {index+1} · {stroke.author}{strokeVisibility(stroke)==='master'?' · Só mestres':''}{!displayedStrokes.includes(stroke)?' · Oculto nesta visão':''}</span>{canEraseStroke(stroke)&&<button type="button" onClick={()=>eraseStroke(stroke)} disabled={mapBusy} aria-label={`Apagar traço ${index+1} de ${stroke.author}`}>Apagar</button>}{canManageMap2D&&<label className="map-marking-audience">Visibilidade do traço {index+1}<select name={`map-marking-audience-${stroke.id}`} autoComplete="off" value={strokeVisibility(stroke)} disabled={mapBusy} onChange={event=>changeStrokeVisibility(stroke,event.target.value)}><option value="table">Todos</option><option value="master">Só mestres</option></select></label>}</li>;})}</ol>{readableStrokes.length>markingsShown&&<button type="button" className="map-markings-more" onClick={()=>setMarkingsShown(count=>count+40)}>Mostrar traços anteriores</button>}</details>}
            </aside>

            {/* Canvas principal */}
            <section className="canvas-area">
              {!mapImage ? (
                <div className="empty-state">
                  <Map size={40} aria-hidden="true" />
                  <h2>Nenhum mapa carregado</h2>
                  <p>{canManageMap2D ? 'Envie a imagem do mapa em Ferramentas 2D para começar a exploração. Pontos, rotas e névoa dependem dela.' : 'O mestre ainda não revelou o mapa desta jornada.'}</p>
                  {canManageMap2D&&!map2dToolsOpen&&<button type="button" className="map-empty-action" onClick={()=>setMap2dToolsOpen(true)}>Abrir Ferramentas 2D</button>}
                </div>
              ) : (
                <div 
                  className="canvas-wrapper"
                  ref={canvasWrapperRef}
                  onWheel={handleWheel}
                  onPointerDown={handleMapPointerDown}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerEnd}
                  onPointerCancel={handleMapPointerEnd}
                  onPointerLeave={handleMapPointerEnd}
                >
                  <div className="map-artwork" style={{width:mapCanvasSize.width*mapFit||undefined,height:mapCanvasSize.height*mapFit||undefined,transform:`translate(${position.x}px, ${position.y}px) scale(${scale})`,cursor:['draw','reveal','cover','measure','position','route'].includes(mapTool)?'crosshair':mapTool==='erase'?'cell':dragging?'grabbing':'grab'}}>
                  <canvas
                    ref={canvasRef}
                    className="map-canvas"
                    tabIndex={0}
                    role="group"
                    aria-label={mapTool==='route'?'Mapa 2D para escolher paradas da rota. Enter adiciona, setas movem, Escape volta aos detalhes.':mapTool==='position'?'Mapa 2D para escolher sua posição. Enter inicia, setas escolhem, Enter compartilha e Escape cancela.':mapTool==='measure'?'Mapa 2D para medir distância. Arraste ou toque em dois pontos. Enter inicia, setas movem o destino, Alt+setas movem o trecho, Enter fixa e Escape limpa.':['reveal','cover'].includes(mapTool)?`Mapa 2D para ${mapTool==='reveal'?'revelar':'cobrir'} áreas. Enter inicia ou salva; setas ajustam; Escape cancela.`:mapTool==='draw'?'Mapa 2D para desenho. Enter inicia ou salva um traço; setas desenham; Escape cancela.':mapTool==='erase'?'Mapa 2D para apagar traços. Clique ou toque num traço, ou use a lista de traços nas ferramentas.':'Mapa 2D. Setas movem, mais e menos ajustam zoom, Home centraliza. Abra pontos na lista das ferramentas.'}
                    onClick={handleCanvasClick}
                    onKeyDown={handleCanvasKeyDown}
                    style={{
                      width:'100%',height:'100%'
                    }}
                  />
                  <svg className="map-strokes" viewBox={`0 0 ${mapCanvasSize.width||1} ${mapCanvasSize.height||1}`} preserveAspectRatio="none" aria-hidden="true">
                    <MapGrid scale={mapScale} visible={measurementPrefs.grid} dimensions={mapCanvasSize} screenRatio={mapFit*scale} id={`map-grid-${room.id}`}/>
                    <MapFogOverlay fog={mapFog} master={canManageMap2D} id={`map-fog-${room.id}`}/>
                    <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">{displayedStrokes.map(stroke=><path key={stroke.id} data-stroke-id={stroke.id} d={stroke.path} stroke={stroke.color}/>)}</g>
                    <path ref={strokePreviewRef} fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <MapRouteOverlay routes={displayedRoutes} draft={canManageMap2D&&routeDraft?.imageVersion===room.mapImageVersion?routeDraft:null} cursor={mapTool==='route'?routeCursor:null} screenRatio={mapFit*scale} scale={mapScale}/>
                    <g className="map-point-markers">{points.map(point=>{const type=pointTypes.find(item=>item.value===point.type),label=pointLinkLabel(pointLinks.get(point.id));return <g key={point.id} data-point-id={point.id} className={foundPointId===point.id?'is-found':pointFilterIds&&!pointFilterIds.has(point.id)?'is-dimmed':undefined} transform={`translate(${point.x} ${point.y}) scale(${markerUnit})`}><circle r="12" fill={type?.color||'#c7ab76'} stroke="#fff1cf" strokeWidth="2"/><text x="0" y="-21" textAnchor="middle">{point.name.length>28?point.name.slice(0,27)+'…':point.name}</text>{label&&<g className="map-point-link-badge"><rect x="18" y="-9" width={label.length*6.5+12} height="22"/><text x="24" y="6">{label}</text></g>}</g>;})}</g>
                    <MapPositionMarkers markers={playerMarkers} members={room.members} userId={user.id} draft={positionDraft} screenRatio={mapFit*scale}/>
                    <rect ref={fogPreviewRef} visibility="hidden" fill={mapTool==='cover'?'#a84d51':'#d9b777'} fillOpacity=".2" stroke={mapTool==='cover'?'#eea4a7':'#f0d391'} strokeWidth="2" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>
                    <circle ref={fogStartRef} visibility="hidden" fill={mapTool==='cover'?'#eea4a7':'#f0d391'}/>
                    <MapRuler key={room.mapImageVersion} ref={rulerRef} measurement={measurement} onChange={changeMeasurement} onNotice={setDrawError} scale={mapScale} dimensions={mapCanvasSize} screenRatio={mapFit*scale} fog={mapFog} canManage={canManageMap2D}/>
                  </svg>
                  </div>
                  {explorationPrefs.legend&&<MapLegend legend={mapLegend}/>}
                  {mapScale&&<div className="map-scale-caption">{measurementPrefs.grid?`${formatDistance(mapScale.cellDistance*gridStride(mapScale,mapFit*scale),mapScale.unit)} por quadrado`:`Régua em ${mapScale.unit} · linha reta`}</div>}
                </div>
              )}
            </section>
            </div>}
          </>
        ) : activeTab === 'ficha' ? (
          <>
            {/* Área principal da Ficha de Personagem */}
            <section className="sheet-area">
              <Suspense fallback={<p role="status">Preparando a ficha…</p>}>
              <CharacterSheet
                notebookKey={`${room.id}:${user.id}`}
                roomId={room.id}
                onSaveNote={(name,id,note)=>mutate(`/notes/${encodeURIComponent(name)}/${id}`,note,'PATCH')}
                onShareNote={(name,id,data)=>mutate(`/notes/${encodeURIComponent(name)}/${id}/share`,data,'PATCH')}
                notebookMembers={room.members}
                notebookUsername={user.username}
                mapPoints={points}
                onOpenPoint={openLinkedPoint}
                openNoteRequest={openNoteRequest}
                canEditSelected={room.role==='admin'}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                playerNames={playerNames}
                profile={<StatusBars
                selectedPlayer={selectedPlayer}
                viewMode={viewMode}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                allPlayersBars={statusBarsData}
                onUpdatePlayerBars={updatePlayerBars}
                onUpdatePlayerAvatar={updatePlayerAvatar}
              />}
                viewMode={viewMode}
                sheetFields={sheetFields}
                onFieldsChange={saveSheetFields}
                sheetFont={sheetFont}
                onFontChange={saveSheetFont}
                playerName={playerName}
                onPlayerNameChange={savePlayerName}
                playerSheets={playerSheets}
                onUpdatePlayerSheet={updatePlayerSheet}
              />
              </Suspense>
            </section>

            {/* Painel lateral com o Dado */}
            <aside className="sheet-sidebar">
              <Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll} scenes={room.state.campaignScenes}/></Suspense>
              <DiceHistory key={`${room.id}:${room.role}:${viewMode}`} room={room} viewMode={viewMode}/>
            </aside>
          </>
        ) : activeTab==='cenas' ? <ScenesPanel roomId={room.id} userId={user.id} scenes={visibleScenes} points={points} editable={canManageScenes} viewMode={viewMode} presentation={room.state.scenePresentation} connection={connection} onPresent={presentScene} request={sceneRequest} onRequestHandled={()=>setSceneRequest(null)} onOpenPoint={openLinkedPoint} saving={saving} error={error} onSave={(id,fields,version)=>mutate(mapRequestPath(version?`/campaign-scenes/${id}`:'/campaign-scenes'),version?{...fields,version}:{...fields,id},version?'PATCH':'POST')} onArchive={(scene,archived)=>mutate(mapRequestPath(`/campaign-scenes/${scene.id}`),{archived,version:scene.version},'PATCH')}/> : activeTab==='linha' ? <Suspense fallback={<p role="status">Abrindo o diário da campanha…</p>}><CampaignTimelinePanel key={`${room.id}:${viewMode}`} roomId={room.id} userId={user.id} viewMode={viewMode} editable={canManageScenes} revision={room.timelineRevision} points={points} scenes={visibleScenes} connection={connection} onOpenPoint={openLinkedPoint} onOpenScene={id=>{const scene=visibleScenes.find(item=>item.id===id);if(scene)openLinkedScene(scene);}}/></Suspense> : activeTab==='sobre' ? <AboutPanel roomId={room.id} username={user.username} role={room.role}/> : (
          <section className="group-status-area"><div className="sheet-heading"><div><span className="eyebrow">Companheiros de jornada</span><h2>Status do grupo</h2></div><span className="sheet-seal"><Users size={16} />{playerNames.length} {playerNames.length===1?'jogador':'jogadores'}</span></div>
            <div className="group-workspace"><section className="party-roster" aria-label="Personagens da mesa"><Suspense fallback={<p role="status">Preparando o grupo…</p>}><GroupStatus
              viewMode={viewMode}
              activePlayer={room.state.combat.activeId}
              allPlayersBars={groupEntries}
              onOpenSheet={name => {setSelectedPlayer(name);setActiveTab('ficha');}}
              onUpdatePlayerBars={updatePlayerBars}
            /></Suspense>
            </section><aside className="group-roll-station" aria-label="Bandeja e dados"><Suspense fallback={<p role="status">Preparando a bandeja…</p>}><DiceTray roll={room.trayRoll} serverTime={room.serverTime} held={heldDice} onThrow={throwHeldDice} onCancel={()=>setHeldDice(null)}/></Suspense><div className="group-dice-controls"><Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll} scenes={room.state.campaignScenes} sharedOnly/></Suspense></div><DiceHistory key={`${room.id}:${room.role}:${viewMode}`} room={room} viewMode={viewMode}/></aside></div>
          </section>
        )}
      </main>

      </div>
      {activeTab!=='grupo'&&<Suspense fallback={<p role="status">Preparando a bandeja…</p>}><DiceTray roll={room.trayRoll} serverTime={room.serverTime} held={heldDice} onThrow={throwHeldDice} onCancel={()=>setHeldDice(null)} compact/></Suspense>}
      <Suspense fallback={null}><DiceFocus roll={room.trayRoll} serverTime={room.serverTime} enabled={activeTab==='grupo'||room.trayRoll?.username===user.username}/></Suspense>
      {/* Modal de adicionar ponto */}
      {showPointModal && (
        <dialog ref={pointDialogRef} className="modal-overlay" aria-labelledby="new-point-title" onKeyDown={trapDialogFocus} onCancel={e=>{e.preventDefault();setShowPointModal(false);}}>
          <div className="modal">
            <div className="modal-header">
              <h2 id="new-point-title">Novo Ponto de Interesse</h2>
              <button aria-label="Fechar novo ponto" onClick={() => setShowPointModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-point-name">Nome</label>
                <input
                  id="new-point-name"
                  ref={pointNameRef}
                  name="pointName"
                  autoComplete="off"
                  type="text"
                  maxLength={120}
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                  placeholder="Ex: Cidade de Eldoria"
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-point-description">Descrição</label>
                <textarea
                  id="new-point-description"
                  name="pointDescription"
                  maxLength={4000}
                  value={newPoint.description}
                  onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                  placeholder="Descreva este local..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <span id="new-point-type" className="form-label">Tipo</span>
                <div className="type-grid" role="group" aria-labelledby="new-point-type">
                  {pointTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        className={`type-btn ${newPoint.type === type.value ? 'active' : ''}`}
                        aria-pressed={newPoint.type === type.value}
                        onClick={() => setNewPoint({ ...newPoint, type: type.value })}
                        style={{ '--type-color': type.color }}
                      >
                        <Icon size={20} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {!canManageMap2D&&<p className="modal-error" role="alert">Seu acesso mudou. É preciso ser mestre ou ADM no modo mestre para adicionar pontos.</p>}
            {pointSaveError&&<p className="modal-error" role="alert">{error||'Não foi possível salvar o ponto. Revise o mapa e tente novamente.'}</p>}
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPointModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={addPoint} disabled={saving||!canManageMap2D||!newPoint.name.trim()}>
                <Plus size={18} />
                {saving?'Adicionando…':'Adicionar Ponto'}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {imageUpload&&<MapImageUpload file={imageUpload.file} initialVersion={imageUpload.version} version={room.mapImageVersion} initialPointsVersion={imageUpload.pointsVersion} pointsVersion={room.pointsVersion} hasImage={!!mapImage} points={allPoints} currentSize={mapCanvasSize} strokeCount={mapStrokes.length} routeCount={room.state.mapRoutes?.length||0} fogEnabled={mapFog.enabled} hasScale={!!mapScale} positionCount={Object.keys(room.state.mapPositions?.markers||{}).length} editable={canManageMap2D} saving={saving} error={error} onPublish={publishMapImage} onClose={()=>setImageUpload(null)}/>}
      {selectedPoint&&<PointDetails key={selectedPoint.point.id} point={openedPoint} initialPoint={selectedPoint.point} initialVersion={selectedPoint.version} latestVersion={room.pointVersions?.[selectedPoint.point.id]} types={pointTypes} editable={canManageMap2D} linkedNotes={pointLinks.get(selectedPoint.point.id)?.notes||[]} linkedScenes={pointLinks.get(selectedPoint.point.id)?.scenes||[]} onOpenScene={openLinkedScene} onCreateScene={()=>createPointScene(openedPoint)} onOpenNote={openLinkedNote} onClose={()=>setSelectedPoint(null)} onSave={savePointDetails} saving={saving} error={error}/>}

    </div>
  );
};

export default RPGMapExplorer;
