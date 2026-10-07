import Notebook from './Notebook.jsx';
import TurnTracker from './TurnTracker.jsx';
import {AboutPanel,ScenesPanel} from './CampaignPages.jsx';
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Camera, Map, ShieldCheck, Users, Eye, Edit3, Plus, X, Upload, Grid, ChevronRight, Castle, Sword, Scroll, Skull, ScrollText, Dices, RotateCw, Image as ImageIcon, Type, GripVertical, Trash2, ListPlus, Settings2, ShoppingBag, Check, Hash, ArrowUp, ArrowDown, Palette, Minus, Heart, Calculator, ListChecks, Clapperboard, Info, Pencil, Undo2, Redo2, Eraser, Hand, Ruler } from 'lucide-react';
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

const RPGMapExplorer = ({room,user,mutate,onExit,onLogout,connection,saving,error,adminMode,setAdminMode}) => {
  const [heldDice,setHeldDice]=useState(null);
  const [diceStructure,setDiceStructure]=useState('tray');
  const diceLaunch=useRef(null);
  const onTrayRoll=(terms,skinId,options={})=>{diceLaunch.current=null;setHeldDice({terms,skinId,structureId:'tray',origin:activeTab==='grupo'?'group':'sheet',sceneId:options.sceneId||null,operationId:crypto.randomUUID()});return true;};
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
  const mapTool=['reveal','cover'].includes(selectedMapTool)&&(!canManageMap2D||!mapFog.enabled)||selectedMapTool==='position'&&(!canSharePosition||!positionsEnabled)||selectedMapTool==='route'&&(!canManageMap2D||!routeDraft||routeDraft.imageVersion!==room.mapImageVersion)?'pan':selectedMapTool;
  const [scale,setScale]=useState(1);
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
            <div className="account-nav-actions"><button onClick={onExit}>Minhas mesas</button><button onClick={onLogout}>Sair da conta</button></div>
            <div className="user-indicator">
              <Users size={20} />
              <span>{points.length} pontos</span>
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
            aria-label={viewMode==='master'?'Mestre · fichas':'Jogador · ficha'}
            aria-pressed={activeTab === 'ficha'}
            onClick={() => setActiveTab('ficha')}
          >
            <ScrollText size={18} />
            <span className="tab-label-full">{viewMode==='master'?'Mestre · fichas':'Jogador · ficha'}</span><span className="tab-label-short" aria-hidden="true">Ficha</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'grupo' ? 'active' : ''}`}
            aria-label="Status do Grupo"
            aria-pressed={activeTab === 'grupo'}
            onClick={() => setActiveTab('grupo')}
          >
            <Heart size={18} />
            <span className="tab-label-full">Status do Grupo</span><span className="tab-label-short" aria-hidden="true">Grupo</span>
          </button>
          <button className={`tab-btn ${activeTab==='cenas'?'active':''}`} aria-pressed={activeTab==='cenas'} onClick={()=>setActiveTab('cenas')}><Clapperboard size={18} aria-hidden="true"/>Cenas</button>
        </nav>
        <div className="nav-footer"><button className={`nav-about-button ${activeTab==='sobre'?'active':''}`} aria-pressed={activeTab==='sobre'} onClick={()=>setActiveTab('sobre')}><Info size={18} aria-hidden="true"/>Sobre</button></div>
      </header>

      <div className="room-content"><div className="session-strip"><TurnTracker key={`${room.id}:${user.id}`} room={room} username={user.username} userId={user.id} editable={viewMode==='master'} saving={saving} connection={connection} mutate={mutate}/><Notebook key={room.id+':personal:'+user.id} storageKey={`${room.id}:${user.id}:${user.username}`} className="personal-notebook" title="Minhas notas" hint="Privadas · você escolhe com quem compartilhar" scope={user.username} username={user.username} members={room.members} canShare notes={room.state.playerSheets?.[user.username]?.notebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(scope,id,note)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}`,note,'PATCH')} onShare={(scope,id,data)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}/share`,data,'PATCH')}/>{viewMode==='master'&&<Notebook key={room.id+':master'} storageKey={room.id+':'+user.id+':master'} className="master-notebook" title="Notas do mestre" hint="Privadas · várias janelas" scope="@master" username={user.username} members={room.members} canShare notes={room.state.masterNotebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(_,id,note)=>mutate('/notes/@master/'+id,note,'PATCH')} onShare={(_,id,data)=>mutate('/notes/@master/'+id+'/share',data,'PATCH')}/>}<Notebook key={room.id+':shared:'+user.id} storageKey={room.id+':'+user.id+':shared'} className="shared-notebook" title="Notas compartilhadas" hint="Acesso e edição em grupo" scope="shared" username={user.username} members={room.members} notes={room.state.sharedNotebooks||[]} points={points} onOpenPoint={openLinkedPoint} openRequest={openNoteRequest} roomId={room.id} onSave={(scope,id,note)=>mutate(`/notes/${encodeURIComponent(scope)}/${id}`,note,'PATCH')}/></div>
      <div id="main-content" className={`main-content view-${activeTab}`} tabIndex={-1} onKeyDown={handleMapShortcut}>
        {activeTab==='mesa'?<RoomManagement room={room} mutate={mutate} viewMode={viewMode}/>:activeTab === 'mapa' ? (
          <>
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
            {mapMode==='2d'&&mapImage&&mapTool!=='pan'&&<p className="map-draw-help">{mapTool==='route'?'Clique ou toque para marcar paradas. Enter adiciona, setas movem e Escape volta aos detalhes. A rota só será publicada ao salvar.':mapTool==='position'?'Escolha no mapa e use Compartilhar posição nas ferramentas. Pelo teclado: Enter inicia, setas escolhem, Enter compartilha e Escape cancela.':mapTool==='measure'?'Arraste ou toque em dois pontos para medir. Enter inicia, setas movem o destino, Alt+setas movem o trecho, Enter fixa e Esc limpa.':['reveal','cover'].includes(mapTool)?`Arraste para ${mapTool==='reveal'?'revelar':'cobrir'} uma área · Teclado: foque o mapa, Enter inicia, setas ajustam, Enter salva e Esc cancela.`:mapTool==='draw'?'Arraste para desenhar · Teclado: foque o mapa, Enter inicia e salva, setas traçam, Esc cancela. Ctrl+Z desfaz · Ctrl+Shift+Z refaz.':'Clique ou toque num traço para apagá-lo. Cada jogador apaga os próprios traços; o mestre pode apagar todos. Ctrl+Z desfaz · Ctrl+Shift+Z refaz.'}</p>}
            {mapMode==='2d'&&mapTool==='route'&&<div className="map-route-choice-bar"><span>{routeDraft.fields.waypoints.length} paradas na prévia</span><button type="button" onClick={stopRouteChoice}>Voltar aos detalhes da rota</button></div>}
            {drawError&&<p className={drawError.startsWith('Não foi possível')?'map-draw-error':'map-draw-notice'} role="status">{drawError}</p>}
            {mapMode==='2d'&&mapTool==='position'&&<div className="map-position-actions" role="group" aria-label="Sua posição no mapa">{positionConflict&&<p role="alert">{positionConflict}</p>}{positionCovered&&<p role="alert">A escolha está em uma área oculta. Mova para uma área revelada.</p>}{positionDraft&&<button type="button" disabled={mapBusy||saving||!!positionConflict||positionCovered} onClick={()=>saveOwnPosition()}>Compartilhar posição</button>}{positionConflict&&<button type="button" onClick={()=>setMap2dToolsOpen(true)}>Abrir revisão da posição</button>}<button type="button" disabled={mapBusy||saving} onClick={cancelPositionChoice}>Cancelar escolha</button></div>}
            {mapMode==='2d'&&mapImageError&&<p className="map-draw-error" role="alert">{mapImageError} <button type="button" onClick={()=>setMapImageRetry(value=>value+1)}>Tentar novamente</button></p>}
            {mapMode==='3d'?<Suspense fallback={<p role="status">Preparando a mesa 3D…</p>}><TabletopMap key={`${room.id}:${user.id}`} room={room} userId={user.id} mutate={mutate} editable={canManageMap2D} viewMode={viewMode} selected={tabletopSelection} setSelected={setTabletopSelection} destinations={{points,scenes:visibleScenes,notes:visibleLinkedNotes}} onOpenReference={openObjectReference}/></Suspense>:<div className="legacy-map-layout">
            {/* Sidebar */}
            <aside id="map-2d-tools" className="sidebar" hidden={!map2dToolsOpen}>
              <div className="sidebar-section">
                <h3>
                  <Upload size={18} />
                  Mapa
                </h3>
                {canManageMap2D && (
                  <label className="upload-btn">
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageUpload} disabled={saving||!!imageUpload} aria-label={mapImage?'Trocar imagem':'Selecionar imagem'}/>
                    {mapImage?'Trocar imagem':'Selecionar imagem'}
                  </label>
                )}
              </div>

              <div className="sidebar-section">
                <h3>
                  <Grid size={18} />
                  Pontos de Interesse ({points.length})
                </h3>
                <div className="points-list">
                  {points.map(point => {
                    const typeInfo = pointTypes.find(t => t.value === point.type);
                    const Icon = typeInfo?.icon || Castle;
                    return (
                      <div key={point.id} className="point-item">
                        <button className="point-info" onClick={() => handlePointClick(point)}>
                          <Icon size={16} style={{ color: typeInfo?.color }} />
                          <div>
                            <strong>{point.name}</strong>
                            <small>{typeInfo?.label||point.type}</small>
                            {pointLinks.has(point.id)&&<small className="point-link-count">{pointLinkLabel(pointLinks.get(point.id))}</small>}
                          </div>
                        </button>
                        {canManageMap2D && (
                          <button 
                            className="delete-btn"
                            aria-label={`Excluir ponto ${point.name}`}
                            disabled={saving}
                            onClick={() => deletePoint(point.id)}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sidebar-section">
                <h3>Controles</h3>
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
              </div>
              <MapMeasurement scale={mapScale} version={room.mapScaleVersion} measurement={measurement} canManage={canManageMap2D} tool={mapTool} onTool={selectMapTool} onClear={()=>rulerRef.current?.clear()} onSave={saveMapScale} busy={mapBusy||saving} hasImage={!!mapImage} prefs={measurementPrefs} onPrefs={changeMeasurementPrefs} screenRatio={mapFit*scale}/>
              <MapFog fog={mapFog} canManage={canManageMap2D} tool={mapTool} onTool={selectMapTool} onChange={changeFog} busy={mapBusy||saving} hasImage={!!mapImage}/>
              <MapPositions key={room.mapPositionSettingsVersion} enabled={positionsEnabled} canManage={canManageMap2D} canShare={canSharePosition} hasOwn={room.hasOwnMapPosition} markers={playerMarkers} members={room.members} userId={user.id} draft={positionDraft} conflict={positionConflict} covered={positionCovered} onEnable={changePositionSettings} onChoose={beginPositionChoice} onShare={()=>saveOwnPosition()} onClear={()=>saveOwnPosition(null,room.ownMapPositionVersion,room.mapPositionSettingsVersion)} onCancel={cancelPositionChoice} onRebase={()=>setPositionChoice(current=>({...current,version:room.ownMapPositionVersion,settingsVersion:room.mapPositionSettingsVersion}))} tool={mapTool} busy={mapBusy||saving} hasImage={!!mapImage}/>
              <MapExploration routes={mapRoutes} versions={room.mapRouteVersions||{}} imageVersion={room.mapImageVersion} scale={mapScale} canManage={canManageMap2D} draft={routeDraft} onDraft={setRouteDraft} onChoose={beginRouteChoice} choosing={mapTool==='route'} onStop={stopRouteChoice} onSave={saveRoute} onArchive={archiveRoute} busy={mapBusy||saving} hasImage={!!mapImage} prefs={explorationPrefs} onPrefs={changeExplorationPrefs} error={error}/>
              <MapLegendEditor legend={mapLegend} version={room.mapLegendVersion} canManage={canManageMap2D} onSave={saveLegend} busy={mapBusy||saving} prefs={explorationPrefs} onPrefs={changeExplorationPrefs} draft={legendDraft} onDraft={setLegendDraft}/>
              <MapViewExport ready={!!mapImage&&!!mapCanvasSize.width&&!mapImageError} master={canManageMap2D} capture={()=>({
                canvas:canvasRef.current,viewport:canvasWrapperRef.current,dimensions:mapCanvasSize,points,
                pointLabels:Object.fromEntries(points.map(point=>[point.id,pointLinkLabel(pointLinks.get(point.id))])),
                legend:mapLegend,showLegend:explorationPrefs.legend,strokes:displayedStrokes,routes:displayedRoutes,
                fog:mapFog,master:canManageMap2D,markers:playerMarkers,members:room.members,userId:user.id,scale:mapScale,
                grid:measurementPrefs.grid,measurement,screenRatio:mapFit*scale,markerUnit,roomName:room.name
              })}/>
              <MapLayers strokes={readableStrokes} username={user.username} settings={layerSettings} onChange={changeLayerSettings}/>
              {!!readableStrokes.length&&<details className="map-markings"><summary>Traços do mapa ({readableStrokes.length})</summary><ol>{readableStrokes.slice(-markingsShown).map((stroke,visibleIndex)=>{const index=readableStrokes.length-Math.min(markingsShown,readableStrokes.length)+visibleIndex;return <li key={stroke.id}><span>Traço {index+1} · {stroke.author}{strokeVisibility(stroke)==='master'?' · Só mestres':''}{!displayedStrokes.includes(stroke)?' · Oculto nesta visão':''}</span>{canEraseStroke(stroke)&&<button type="button" onClick={()=>eraseStroke(stroke)} disabled={mapBusy} aria-label={`Apagar traço ${index+1} de ${stroke.author}`}>Apagar</button>}{canManageMap2D&&<label className="map-marking-audience">Visibilidade do traço {index+1}<select name={`map-marking-audience-${stroke.id}`} autoComplete="off" value={strokeVisibility(stroke)} disabled={mapBusy} onChange={event=>changeStrokeVisibility(stroke,event.target.value)}><option value="table">Todos</option><option value="master">Só mestres</option></select></label>}</li>;})}</ol>{readableStrokes.length>markingsShown&&<button type="button" className="map-markings-more" onClick={()=>setMarkingsShown(count=>count+40)}>Mostrar traços anteriores</button>}</details>}
            </aside>

            {/* Canvas principal */}
            <main className="canvas-area">
              {!mapImage ? (
                <div className="empty-state">
                  <Map size={64} />
                  <h2>Nenhum mapa carregado</h2>
                  <p>{canManageMap2D ? 'Envie um mapa pelo painel para começar a exploração.' : 'O mestre ainda não revelou o mapa desta jornada.'}</p>
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
                    <g className="map-point-markers">{points.map(point=>{const type=pointTypes.find(item=>item.value===point.type),label=pointLinkLabel(pointLinks.get(point.id));return <g key={point.id} data-point-id={point.id} transform={`translate(${point.x} ${point.y}) scale(${markerUnit})`}><circle r="12" fill={type?.color||'#c7ab76'} stroke="#fff1cf" strokeWidth="2"/><text x="0" y="-21" textAnchor="middle">{point.name.length>28?point.name.slice(0,27)+'…':point.name}</text>{label&&<g className="map-point-link-badge"><rect x="18" y="-9" width={label.length*6.5+12} height="22"/><text x="24" y="6">{label}</text></g>}</g>;})}</g>
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
            </main>
            </div>}
          </>
        ) : activeTab === 'ficha' ? (
          <>
            {/* Área principal da Ficha de Personagem */}
            <main className="sheet-area">
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
            </main>

            {/* Painel lateral com o Dado */}
            <aside className="sheet-sidebar">
              <Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll} scenes={room.state.campaignScenes}/></Suspense>
              <DiceHistory key={`${room.id}:${room.role}:${viewMode}`} room={room} viewMode={viewMode}/>
            </aside>
          </>
        ) : activeTab==='cenas' ? <ScenesPanel roomId={room.id} userId={user.id} scenes={visibleScenes} points={points} editable={canManageScenes} viewMode={viewMode} presentation={room.state.scenePresentation} connection={connection} onPresent={presentScene} request={sceneRequest} onRequestHandled={()=>setSceneRequest(null)} onOpenPoint={openLinkedPoint} saving={saving} error={error} onSave={(id,fields,version)=>mutate(mapRequestPath(version?`/campaign-scenes/${id}`:'/campaign-scenes'),version?{...fields,version}:{...fields,id},version?'PATCH':'POST')} onArchive={(scene,archived)=>mutate(mapRequestPath(`/campaign-scenes/${scene.id}`),{archived,version:scene.version},'PATCH')}/> : activeTab==='sobre' ? <AboutPanel roomId={room.id} username={user.username} role={room.role}/> : (
          <main className="group-status-area"><div className="sheet-heading"><div><span className="eyebrow">Companheiros de jornada</span><h2>Status do grupo</h2></div><span className="sheet-seal"><Users size={16} />{playerNames.length} {playerNames.length===1?'jogador':'jogadores'}</span></div>
            <div className="group-workspace"><section className="party-roster" aria-label="Personagens da mesa"><Suspense fallback={<p role="status">Preparando o grupo…</p>}><GroupStatus
              viewMode={viewMode}
              activePlayer={room.state.combat.activeId}
              allPlayersBars={groupEntries}
              onOpenSheet={name => {setSelectedPlayer(name);setActiveTab('ficha');}}
              onUpdatePlayerBars={updatePlayerBars}
            /></Suspense>
            </section><aside className="group-roll-station" aria-label="Bandeja e dados"><Suspense fallback={<p role="status">Preparando a bandeja…</p>}><DiceTray roll={room.trayRoll} serverTime={room.serverTime} held={heldDice} onThrow={throwHeldDice} onCancel={()=>setHeldDice(null)}/></Suspense><div className="group-dice-controls"><Suspense fallback={<p role="status">Preparando os dados…</p>}><DiceRoller onTrayRoll={onTrayRoll} scenes={room.state.campaignScenes} sharedOnly/></Suspense></div><DiceHistory key={`${room.id}:${room.role}:${viewMode}`} room={room} viewMode={viewMode}/></aside></div>
          </main>
        )}
      </div>

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
                <span id="new-point-type">Tipo</span>
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:wght@300;400;600&family=MedievalSharp&family=Uncial+Antiqua&family=IM+Fell+English:ital@0;1&family=Metamorphous&family=Grenze:wght@400;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .rpg-container {
          width: 100%;
          height: 100vh;
          font-family: 'Crimson Pro', serif;
          background: linear-gradient(135deg, #121413 0%, #222321 100%);
          color: #e9dfcd;
          position: relative;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(25, 28, 26, 0.85) 100%);
          border-bottom: 3px solid #c7ab76;
          box-shadow: 0 4px 20px rgba(199, 171, 118, 0.2);
          position: relative;
          z-index: 10;
        }

        .header-content {
          max-width: 1800px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo svg {
          color: #c7ab76;
          filter: drop-shadow(0 2px 4px rgba(199, 171, 118, 0.5));
        }

        .logo h1 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #c7ab76;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          letter-spacing: 1px;
        }

        .header-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(151, 126, 96, 0.3);
          border: 2px solid #51493e;
          border-radius: 8px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .mode-btn:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(199, 171, 118, 0.3);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        .user-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          border: 1px solid rgba(199, 171, 118, 0.3);
        }

        .tab-nav {
          display: flex;
          gap: 0.5rem;
          max-width: 1800px;
          margin: 0 auto;
          padding: 0 2rem 0.75rem;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          background: rgba(0, 0, 0, 0.25);
          border: 2px solid rgba(151, 126, 96, 0.6);
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          color: #b9b09f;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .tab-btn:hover {
          color: #e9dfcd;
          background: rgba(151, 126, 96, 0.3);
        }

        .tab-btn.active {
          color: #191c1a;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          box-shadow: 0 -2px 12px rgba(199, 171, 118, 0.4);
        }

        .sheet-area {
          flex: 1;
          position: relative;
          overflow-y: auto;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .sheet-sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(20, 23, 21, 0.95) 100%);
          border-left: 3px solid #51493e;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .status-player-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .status-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .status-avatar-img,
        .status-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #c7ab76;
        }

        .status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          color: #a39988;
        }

        .status-avatar-upload-btn {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #121413;
        }

        .status-avatar-upload-btn input {
          display: none;
        }

        .group-status-area {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .group-status-empty {
          height: 100%;
        }

        .group-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .group-status-card {
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(199, 171, 118, 0.35);
          border-radius: 12px;
          padding: 1.1rem;
          transition: none;
        }

        .group-status-card:hover {
          border-color: #d6b36b;
          background: #252117;
        }

        .group-status-card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(199, 171, 118, 0.2);
        }

        .group-status-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #c7ab76;
          flex-shrink: 0;
        }

        .group-status-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.3);
          color: #a39988;
        }

        .group-status-card-header h4 {
          font-family: 'Cinzel', serif;
          color: #e9dfcd;
          font-size: 1rem;
        }

        .group-status-bars {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* --- Animações de dano/cura no Status do Grupo --- */

        .bar-float-text {
          position: absolute;
          left: 50%;
          bottom: 100%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
          pointer-events: none;
          white-space: nowrap;
          animation: floatUpFade 1.6s ease-out forwards;
          z-index: 3;
        }

        .bar-float-damage {
          color: #ff4d4d;
        }

        .bar-float-heal {
          color: #4dff8f;
        }

        @keyframes floatUpFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.8); }
          15% { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.15); }
          70% { opacity: 1; transform: translateX(-50%) translateY(-22px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-34px) scale(0.95); }
        }

        .bar-flash-damage {
          animation: barFlashDamage 0.5s ease-out;
        }

        .bar-flash-heal {
          animation: barFlashHeal 0.5s ease-out;
        }

        @keyframes barFlashDamage {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(255, 60, 60, 0.7); }
        }

        @keyframes barFlashHeal {
          0%, 100% { box-shadow: none; }
          25% { box-shadow: 0 0 0 3px rgba(80, 255, 140, 0.7); }
        }

        .card-hit-shake {
          animation: cardHitShake 0.4s ease-in-out;
        }

        @keyframes cardHitShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        .bar-down-badge {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.7rem;
          filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
          z-index: 2;
        }

        .status-bars-panel {
          max-width: 1000px;
          margin: 0 auto 1.5rem;
          padding: 1.25rem 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(199, 171, 118, 0.35);
          border-radius: 12px;
        }

        .status-bars-panel h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'Cinzel', serif;
          color: #c7ab76;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint {
          color: #b9b09f;
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
        }

        .status-bars-hint strong {
          color: #c7ab76;
        }

        .status-name-row,
        .status-master-select-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .status-name-row input,
        .status-master-select-row select {
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.9rem;
        }

        .status-master-select-row {
          margin-bottom: 1rem;
          color: #b9b09f;
          font-size: 0.85rem;
        }

        .status-master-select-row select {
          flex: 1;
          max-width: 260px;
        }

        .status-bar-list {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-bottom: 1rem;
        }

        .status-bar-row {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .status-bar-top {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .status-bar-label {
          color: #e9dfcd;
          font-weight: 600;
        }

        .status-bar-numbers {
          color: #b9b09f;
        }

        .status-bar-track {
          position: relative;
          width: 100%;
          height: 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 8px;
          overflow: visible;
        }

        .status-bar-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.3s ease;
        }

        .status-bar-controls {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .status-bar-controls button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.3);
          border: 1px solid #51493e;
          border-radius: 4px;
          color: #e9dfcd;
          cursor: pointer;
        }

        .status-bar-controls button:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .status-bar-controls input[type="number"] {
          width: 60px;
          padding: 0.3rem;
          text-align: center;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 4px;
          color: #e9dfcd;
          font-size: 0.85rem;
        }

        .status-bar-quick {
          width: auto !important;
          padding: 0 0.5rem;
          font-size: 0.7rem;
        }

        .status-bar-remove {
          margin-left: auto;
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .status-bar-remove:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .status-bar-add-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(199, 171, 118, 0.2);
        }

        .status-bar-add-row input[type="text"] {
          flex: 1;
          min-width: 160px;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.85rem;
        }

        .status-bar-add-row input[type="color"] {
          width: 40px;
          height: 36px;
          padding: 2px;
          background: transparent;
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          cursor: pointer;
        }

        .status-bar-max-input {
          width: 70px !important;
          flex: none !important;
        }


          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .sheet-master-toolbar {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .save-status {
          position: sticky;
          top: 0;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.75rem;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          font-family: 'Crimson Pro', serif;
          font-size: 0.8rem;
          transition: opacity 0.3s ease;
          min-height: 1.6rem;
        }

        .save-status-idle {
          opacity: 0;
          pointer-events: none;
        }

        .save-status-saving {
          background: rgba(151, 126, 96, 0.3);
          color: #c7ab76;
        }

        .save-status-saved {
          background: rgba(34, 139, 34, 0.2);
          color: #7ed17e;
        }

        .sheet-tool-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.1rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #191c1a;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .sheet-tool-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(199, 171, 118, 0.4);
        }

        .font-picker-panel {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .font-swatch-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.9rem 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 8px;
          color: #e9dfcd;
          font-size: 1.3rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .font-swatch-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .font-swatch-btn.active {
          border-color: #c7ab76;
          background: rgba(199, 171, 118, 0.15);
          box-shadow: 0 0 12px rgba(199, 171, 118, 0.3);
        }

        .font-swatch-btn small {
          font-family: 'Crimson Pro', serif;
          font-size: 0.7rem;
          color: #b9b09f;
        }

        .field-builder-panel {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .field-builder-panel h4 {
          font-family: 'Cinzel', serif;
          color: #c7ab76;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.85rem;
        }

        .field-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .field-type-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.7rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .field-type-btn:hover {
          background: rgba(151, 126, 96, 0.4);
        }

        .field-type-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
        }

        .field-add-row {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }

        .field-add-row input {
          flex: 1;
          padding: 0.6rem 0.85rem;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-size: 0.9rem;
        }

        .field-add-row input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .field-add-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: none;
          border-radius: 6px;
          color: #191c1a;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
        }

        .field-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Dica de auto-categorização enquanto o nome é digitado */
        .auto-cat-hint {
          font-family: 'Crimson Pro', serif;
          font-size: 0.78rem;
          color: #c7ab76;
          white-space: nowrap;
          font-style: italic;
          animation: hintPulse 1.4s ease-in-out infinite;
        }

        @keyframes hintPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .field-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-list-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.6rem;
          background: rgba(151, 126, 96, 0.15);
          border: 1px solid rgba(199, 171, 118, 0.2);
          border-radius: 6px;
        }

        .field-list-icon {
          color: #c7ab76;
          flex-shrink: 0;
        }

        .field-list-label-input {
          flex: 1;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 4px;
          color: #e9dfcd;
          font-size: 0.85rem;
          min-width: 100px;
        }

        .field-list-label-input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .field-list-type {
          font-size: 0.72rem;
          color: #a39988;
          white-space: nowrap;
        }

        .field-list-row button {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #51493e;
          border-radius: 4px;
          color: #e9dfcd;
          cursor: pointer;
          flex-shrink: 0;
        }

        .field-list-row button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .field-list-row button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .field-remove-btn {
          background: rgba(139, 0, 0, 0.25) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .field-remove-btn:hover {
          background: rgba(139, 0, 0, 0.5) !important;
        }

        .field-tab-input {
          width: 130px !important;
          flex: none !important;
        }

        .field-list-tab-input {
          width: 100px;
          padding: 0.35rem 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.25);
          border-radius: 4px;
          color: #b9b09f;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .field-list-tab-input:focus {
          outline: none;
          border-color: #c7ab76;
          color: #e9dfcd;
        }

        .sheet-subtab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid rgba(199, 171, 118, 0.25);
        }

        .sheet-subtab-btn {
          padding: 0.5rem 1.1rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 20px;
          color: #b9b09f;
          font-family: 'Cinzel', serif;
          font-size: 0.82rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .sheet-subtab-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          color: #e9dfcd;
        }

        .sheet-subtab-btn.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
          font-weight: 700;
        }

        .sheet-fields-area {
          min-height: 200px;
        }

        .sheet-fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .sheet-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(151, 126, 96, 0.5);
          border-radius: 10px;
          /* Light animation on attribute borders — subtle golden pulse */
          animation: borderGlow 3s ease-in-out infinite;
        }

        @keyframes borderGlow {
          0%, 100% {
            border-color: rgba(151, 126, 96, 0.5);
            box-shadow: 0 0 0px rgba(199, 171, 118, 0);
          }
          50% {
            border-color: rgba(199, 171, 118, 0.7);
            box-shadow: 0 0 8px rgba(199, 171, 118, 0.15);
          }
        }

        .sheet-field-textarea,
        .sheet-field-image,
        .sheet-field-list,
        .sheet-field-attack,
        .sheet-field-checklist {
          grid-column: span 2;
        }

        .sheet-field label {
          color: #c7ab76;
          font-size: 1rem;
          letter-spacing: 0.5px;
        }

        .sheet-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sheet-field-remove-mini {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 4px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .sheet-field-remove-mini:hover {
          background: rgba(139, 0, 0, 0.5);
        }

        .extra-field-builder {
          grid-column: 1 / -1;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px dashed rgba(199, 171, 118, 0.3);
        }

        .sheet-field input[type="text"],
        .sheet-field input[type="number"],
        .sheet-field textarea {
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-size: 0.95rem;
          font-family: 'Crimson Pro', serif;
          resize: vertical;
        }

        .sheet-field input:focus,
        .sheet-field textarea:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .sheet-field-image {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .sheet-field-image img {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid #c7ab76;
        }

        .sheet-field-image-placeholder {
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 2px dashed rgba(199, 171, 118, 0.4);
          border-radius: 8px;
          color: #a39988;
        }

        .sheet-image-upload-btn {
          font-size: 0.8rem;
          padding: 0.5rem 1rem;
        }

        .sheet-field-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sheet-list-item {
          display: flex;
          gap: 0.5rem;
        }

        .sheet-list-item input {
          flex: 1;
          padding: 0.5rem 0.7rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-list-item input:focus {
          outline: none;
          border-color: #c7ab76;
        }

        .sheet-list-item button {
          width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
        }

        .sheet-list-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 1px dashed rgba(199, 171, 118, 0.4);
          border-radius: 6px;
          color: #c7ab76;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .sheet-list-add-btn:hover {
          background: rgba(151, 126, 96, 0.4);
        }

        .formula-input {
          min-width: 180px;
        }

        .sheet-field-formula {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          padding: 0.6rem 0.75rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
        }

        .formula-result {
          font-family: 'Cinzel', serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: #c7ab76;
        }

        .formula-expr {
          font-size: 0.75rem;
          color: #a39988;
          font-family: 'Crimson Pro', serif;
        }

        .sheet-field-attack {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .attack-inputs-row {
          display: flex;
          gap: 1rem;
        }

        .attack-mini-label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .attack-mini-label input {
          padding: 0.45rem 0.6rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
          width: 90px;
        }

        .attack-roll-row {
          display: flex;
          gap: 0.6rem;
        }

        .attack-roll-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.8rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: none;
          border-radius: 6px;
          color: #191c1a;
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .attack-roll-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .attack-dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .attack-result-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: #e9dfcd;
          padding-top: 0.4rem;
          border-top: 1px dashed rgba(199, 171, 118, 0.25);
        }

        .attack-result-row strong {
          color: #c7ab76;
        }

        .sheet-field-checklist {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .checklist-item-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .checklist-item-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #c7ab76;
          flex-shrink: 0;
        }

        .checklist-item-row input[type="text"] {
          flex: 1;
          padding: 0.45rem 0.65rem;
          background: rgba(0, 0, 0, 0.35);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #ece6f7;
          font-family: 'Crimson Pro', serif;
        }

        .checklist-text-done {
          text-decoration: line-through;
          opacity: 0.55;
        }

        .checklist-item-row button {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 0, 0, 0.25);
          border: 1px solid #8b0000;
          border-radius: 6px;
          color: #ff6b6b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .dice-roller h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #c7ab76;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pouch-btn {
          margin-left: auto;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(151, 126, 96, 0.25);
          border: 2px solid rgba(199, 171, 118, 0.4);
          border-radius: 8px;
          color: #c7ab76;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .pouch-btn:hover {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
          transform: scale(1.05);
        }

        .pouch-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 10px;
        }

        .pouch-skin-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          padding: 0.4rem;
          background: transparent;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .pouch-skin-btn:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.25);
        }

        .pouch-skin-btn.active {
          border-color: #c7ab76;
          background: rgba(199, 171, 118, 0.15);
        }

        .pouch-skin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pouch-skin-btn img {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(199, 171, 118, 0.4);
        }

        .pouch-skin-btn span {
          font-size: 0.68rem;
          color: #b3a8d6;
          text-align: center;
        }

        .pouch-check {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          padding: 1px;
        }

        .dice-formula-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          min-height: 2.2rem;
        }

        .dice-formula-empty {
          font-size: 0.85rem;
          color: #a39988;
          font-style: italic;
        }

        .dice-term-chip {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.4rem;
          background: rgba(151, 126, 96, 0.25);
          border: 1px solid rgba(199, 171, 118, 0.4);
          border-radius: 20px;
        }

        .term-sign {
          color: #c7ab76;
          font-weight: 700;
          font-size: 0.9rem;
          padding-left: 0.15rem;
        }

        .dice-term-chip button {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #51493e;
          border-radius: 50%;
          color: #e9dfcd;
          font-weight: 700;
          font-size: 0.8rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .dice-term-chip button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.5);
          border-color: #c7ab76;
        }

        .dice-term-chip button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .term-label {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          font-weight: 600;
          color: #e9dfcd;
          min-width: 2.4rem;
          text-align: center;
        }

        .term-remove {
          background: rgba(139, 0, 0, 0.3) !important;
          border-color: #8b0000 !important;
          color: #ff6b6b !important;
        }

        .term-remove:hover:not(:disabled) {
          background: rgba(139, 0, 0, 0.6) !important;
        }

        .dice-op-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.8rem;
          color: #b9b09f;
        }

        .dice-op-toggle button {
          width: 28px;
          height: 28px;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .dice-op-toggle button:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .dice-op-toggle button.active {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border-color: #c7ab76;
          color: #191c1a;
        }

        .dice-type-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .dice-type-btn {
          padding: 0.5rem 0.25rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Cinzel', serif;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background-color 0.25s ease;
        }

        .dice-type-btn:hover:not(:disabled) {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
        }

        .dice-type-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dice-display-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.25rem;
        }

        .dice-multi-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-start;
          gap: 0.6rem;
        }

        .dice-face-3d {
          position: relative;
          width: 150px;
          height: 150px;
          background: linear-gradient(135deg, #222321 0%, #191c1a 100%);
          border: 3px solid #c7ab76;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(199, 171, 118, 0.12);
          overflow: hidden;
        }

        .dice-face-3d-empty {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dice-face-3d-empty .dice-face-label {
          position: static;
          transform: none;
        }

        .dice-face-3d-mini {
          width: 84px;
          height: 84px;
          border-width: 2px;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .dice-mini-sign {
          position: absolute;
          top: -2px;
          left: -8px;
          z-index: 2;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #c7ab76;
          color: #191c1a;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .dice-3d-canvas {
          width: 100%;
          height: 100%;
        }

        .dice-3d-canvas canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }

        .dice-face-label {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 0.75rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
          pointer-events: none;
        }

        .dice-face-3d-mini .dice-face-label {
          top: 4px;
          font-size: 0.55rem;
        }

        .dice-face-value {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Cinzel', serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #c7ab76;
          text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.9);
          background: rgba(0, 0, 0, 0.4);
          padding: 0.1rem 0.7rem;
          border-radius: 6px;
          pointer-events: none;
          transition: color 0.1s ease;
        }

        .dice-face-value-mini {
          bottom: 3px;
          font-size: 0.75rem;
          padding: 0.05rem 0.4rem;
        }

        .dice-total-line {
          font-family: 'Cinzel', serif;
          font-size: 1rem;
          color: #b9b09f;
        }

        .dice-total-line strong {
          color: #c7ab76;
          font-size: 1.2rem;
        }

        .dice-face-value.flicker {
          color: #ff9d2e;
        }

        .dice-breakdown {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #b9b09f;
          text-align: center;
        }

        .dice-breakdown-part {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .breakdown-sign {
          color: #c7ab76;
          font-weight: 700;
        }

        .roll-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.85rem;
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #191c1a;
          font-family: 'Cinzel', serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .roll-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        .roll-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .roll-btn .spin {
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dice-history {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(151, 126, 96, 0.3);
        }

        .dice-history h4 {
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          color: #b9b09f;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.6rem;
        }

        .dice-history-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #e9dfcd;
          padding: 0.4rem 0;
          border-bottom: 1px dashed rgba(151, 126, 96, 0.3);
        }

        .dice-history-item strong {
          color: #c7ab76;
        }

        .main-content {
          display: flex;
          height: calc(100vh - 80px);
          position: relative;
          z-index: 1;
        }

        .sidebar {
          width: 320px;
          background: linear-gradient(180deg, rgba(25, 28, 26, 0.95) 0%, rgba(20, 23, 21, 0.95) 100%);
          border-right: 3px solid #51493e;
          padding: 1.5rem;
          overflow-y: auto;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
        }

        .sidebar-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(151, 126, 96, 0.3);
        }

        .sidebar-section:last-child {
          border-bottom: none;
        }

        .sidebar-section h3 {
          font-family: 'Cinzel', serif;
          font-size: 1.1rem;
          color: #c7ab76;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          background: linear-gradient(135deg, #51493e 0%, #2e2354 100%);
          border: 2px solid #c7ab76;
          border-radius: 8px;
          color: #e9dfcd;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
          text-align: center;
        }

        .upload-btn:hover {
          background: linear-gradient(135deg, #6654a0 0%, #51493e 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(199, 171, 118, 0.4);
        }

        .upload-btn input {
          display: none;
        }

        .points-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .point-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: rgba(151, 126, 96, 0.2);
          border: 1px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          transition: background-color 0.3s ease;
        }

        .point-item:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: #c7ab76;
          transform: translateX(4px);
        }

        .point-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          flex: 1;
        }

        .point-info div {
          display: flex;
          flex-direction: column;
        }

        .point-info strong {
          font-size: 0.95rem;
          color: #e9dfcd;
        }

        .point-info small {
          font-size: 0.8rem;
          color: #b9b09f;
          text-transform: capitalize;
        }

        .delete-btn {
          background: rgba(139, 0, 0, 0.3);
          border: 1px solid #8b0000;
          border-radius: 4px;
          padding: 0.4rem;
          color: #ff6b6b;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .delete-btn:hover {
          background: rgba(139, 0, 0, 0.6);
          transform: scale(1.1);
        }

        .controls-info {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid rgba(199, 171, 118, 0.2);
        }

        .controls-info p {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .zoom-indicator {
          margin-top: 1rem;
          text-align: center;
          font-size: 1.1rem;
          font-weight: 600;
          color: #c7ab76;
          padding: 0.5rem;
          background: rgba(199, 171, 118, 0.1);
          border-radius: 4px;
        }

        .canvas-area {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at center, #191c1a 0%, #121413 100%);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #a39988;
        }

        .empty-state svg {
          opacity: 0.3;
        }

        .empty-state h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.8rem;
          color: #b9b09f;
        }

        .canvas-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .map-canvas {
          transform-origin: center;
          transition: transform 0.1s ease-out;
          touch-action: none;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          border: 4px solid #51493e;
          border-radius: 4px;
        }

        .map-canvas:focus-visible {
          outline: 3px solid #e2c786;
          outline-offset: 5px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        dialog.modal-overlay {
          width: 100vw;
          height: 100dvh;
          max-width: none;
          max-height: none;
          margin: 0;
          padding: 0;
          border: 0;
          color: inherit;
          overscroll-behavior: contain;
        }

        dialog.modal-overlay::backdrop {
          background: rgba(0, 0, 0, 0.85);
        }

        @media (prefers-reduced-motion: reduce) {
          .modal-overlay, .modal { animation: none; }
          .map-canvas { transition: none; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal {
          background: linear-gradient(180deg, #191c1a 0%, #141715 100%);
          border: 3px solid #c7ab76;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { 
            transform: translateY(50px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 2px solid #51493e;
        }

        .modal-header h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.5rem;
          color: #c7ab76;
        }

        .modal-header button {
          background: transparent;
          border: none;
          color: #e9dfcd;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .modal-header button:hover {
          color: #c7ab76;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #c7ab76;
          font-family: 'Cinzel', serif;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          transition: background-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #c7ab76;
          background: rgba(151, 126, 96, 0.3);
          box-shadow: 0 0 0 3px rgba(199, 171, 118, 0.1);
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .type-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(151, 126, 96, 0.2);
          border: 2px solid rgba(199, 171, 118, 0.3);
          border-radius: 6px;
          color: #e9dfcd;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .type-btn:hover {
          background: rgba(151, 126, 96, 0.4);
          border-color: var(--type-color);
          transform: translateY(-2px);
        }

        .type-btn.active {
          background: var(--type-color);
          border-color: var(--type-color);
          color: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 2px solid #51493e;
        }

        .modal-error {
          margin: 0 1.5rem;
          color: #ffd0c6;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .btn-secondary,
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-family: 'Crimson Pro', serif;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .btn-secondary {
          background: rgba(151, 126, 96, 0.3);
          border: 2px solid #51493e;
          color: #e9dfcd;
        }

        .btn-secondary:hover {
          background: rgba(151, 126, 96, 0.5);
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #c7ab76 0%, #b98867 100%);
          border: 2px solid #c7ab76;
          color: #191c1a;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #e0bf47 0%, #c7ab76 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(199, 171, 118, 0.5);
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(25, 28, 26, 0.3);
        }

        ::-webkit-scrollbar-thumb {
          background: #51493e;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #c7ab76;
        }
      `}</style>
    </div>
  );
};

export default RPGMapExplorer;
