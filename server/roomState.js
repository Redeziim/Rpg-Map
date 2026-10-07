import {emptyMapFog} from '../src/shared/mapFog.js';
import {emptyMapPositions} from '../src/shared/mapPositions.js';
import {defaultMapLegend,isMapLegend} from '../src/shared/mapExploration.js';
import {isTabletopReference,referenceKey} from '../src/shared/tabletopReferences.js';
import {isLightingPreset} from '../src/shared/tabletopLighting.js';
import {createCombat,assertCombat,reconcileCombat,migrateCombat,migrateCombatEffects} from './combat.js';
import {emptyScenePresentation,isScenePresentation} from '../src/shared/scenePresentation.js';

export const ROOM_STATE_VERSION=7;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalid=label=>{throw Error(`Estado de mesa inválido: ${label}. A migração não foi aplicada.`);};
export const emptyNoteBoard=()=>({nodes:[],edges:[],strokes:[],width:960,height:620});
export const newPlayerSheet=()=>({values:{},extraFields:[],observations:'',notebooks:[]});
export const newStatusProfile=()=>({avatar:null,bars:[]});
export function ensureRoomMemberState(state,username){
  if(!Object.hasOwn(state.playerSheets,username))Object.defineProperty(state.playerSheets,username,{value:newPlayerSheet(),enumerable:true,configurable:true,writable:true});
  if(!Object.hasOwn(state.statusBarsData,username))Object.defineProperty(state.statusBarsData,username,{value:newStatusProfile(),enumerable:true,configurable:true,writable:true});
}
export const createRoomState=()=>({stateVersion:ROOM_STATE_VERSION,points:[],mapImage:null,mapStrokes:[],mapFog:emptyMapFog(),mapScale:null,mapPositions:emptyMapPositions(),mapLegend:defaultMapLegend(),mapRoutes:[],mapObjects:[],mapGroups:[],tabletopLighting:'default',campaignScenes:[],scenePresentation:emptyScenePresentation(),sheetFields:[],sheetFont:'cinzel',masterNotes:'',masterNotebooks:[],combat:createCombat(),playerSheets:{},statusBarsData:{}});

function assertBoard(board){
  if(!object(board)||!['nodes','edges','strokes'].every(key=>Array.isArray(board[key]))||!Number.isInteger(board.width)||board.width<960||board.width>3840||!Number.isInteger(board.height)||board.height<620||board.height>2480)invalid('quadro de nota');
}
function assertNotes(notes){
  if(!Array.isArray(notes))invalid('caderno de notas');
  const ids=new Set();
  for(const note of notes){
    if(!object(note)||typeof note.id!=='string'||!note.id||ids.has(note.id)||typeof note.title!=='string'||typeof note.body!=='string'||!Array.isArray(note.sharedWith)||note.sharedWith.some(name=>typeof name!=='string')||!Number.isSafeInteger(note.version)||note.version<1)invalid('nota');
    ids.add(note.id);assertBoard(note.board);
  }
}
export function assertRoomState(state){
  if(!object(state))invalid('documento');
  if(state.stateVersion!==ROOM_STATE_VERSION)throw Error('Versão do estado de mesa não suportada por esta aplicação.');
  if(!isLightingPreset(state.tabletopLighting))invalid('iluminação 3D');
  for(const key of ['points','mapStrokes','mapRoutes','mapObjects','campaignScenes','sheetFields'])if(!Array.isArray(state[key]))invalid(key);
  if(['turnOrder','turnExcluded','turnNpcs','activePlayer'].some(key=>Object.hasOwn(state,key)))invalid('campos de combate antigos');
  assertCombat(state.combat);
  if(!isScenePresentation(state.scenePresentation)||state.campaignScenes.some(scene=>!object(scene)||scene.mediaId!==null&&(typeof scene.mediaId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(scene.mediaId))))invalid('mídia de cena');
  if(state.scenePresentation.sceneId&&!state.campaignScenes.some(scene=>scene.id===state.scenePresentation.sceneId&&scene.mediaId&&!scene.archived))invalid('cena em exibição');
  if(!Array.isArray(state.mapGroups)||state.mapGroups.length>100)invalid('grupos 3D');
  const groupIds=new Set();for(const group of state.mapGroups){if(!object(group)||typeof group.id!=='string'||!group.id||groupIds.has(group.id)||typeof group.name!=='string'||!group.name.trim()||group.name.length>120)invalid('grupo 3D');groupIds.add(group.id);}
  const objectIds=new Set();for(const item of state.mapObjects){
    if(!object(item)||typeof item.id!=='string'||!item.id||objectIds.has(item.id)||typeof item.assetId!=='string'||typeof item.name!=='string'||!Number.isSafeInteger(item.version)||item.version<1||typeof item.locked!=='boolean'||item.groupId!==null&&!groupIds.has(item.groupId))invalid('objeto 3D');
    objectIds.add(item.id);for(const key of ['position','rotation','scale'])if(!Array.isArray(item[key])||item[key].length!==3||item[key].some(value=>!Number.isFinite(value)||Math.abs(value)>10000||key==='scale'&&value<.001))invalid('transformação 3D');
    if(!Array.isArray(item.references)||item.references.length>90||item.references.some(ref=>!isTabletopReference(ref))||new Set(item.references.map(ref=>ref.id)).size!==item.references.length||new Set(item.references.map(referenceKey)).size!==item.references.length)invalid('vínculos 3D');
  }
  if(state.mapGroups.some(group=>!state.mapObjects.some(item=>item.groupId===group.id)))invalid('grupo 3D vazio');
  if(!object(state.playerSheets)||!object(state.statusBarsData)||typeof state.masterNotes!=='string'||typeof state.sheetFont!=='string'||state.mapImage!==null&&typeof state.mapImage!=='string')invalid('campos principais');
  if(!object(state.mapFog)||typeof state.mapFog.enabled!=='boolean'||!Array.isArray(state.mapFog.areas)||!Number.isFinite(state.mapFog.width)||!Number.isFinite(state.mapFog.height))invalid('névoa');
  if(state.mapScale!==null&&!object(state.mapScale))invalid('escala');
  if(!object(state.mapPositions)||typeof state.mapPositions.enabled!=='boolean'||!object(state.mapPositions.markers)||typeof state.mapPositions.generation!=='string')invalid('posições');
  if(!isMapLegend(state.mapLegend))invalid('legenda');
  assertNotes(state.masterNotebooks);
  for(const sheet of Object.values(state.playerSheets)){
    if(!object(sheet)||!object(sheet.values)||!Array.isArray(sheet.extraFields)||typeof sheet.observations!=='string')invalid('ficha');
    assertNotes(sheet.notebooks);
  }
  for(const profile of Object.values(state.statusBarsData))if(!object(profile)||!Array.isArray(profile.bars)||profile.avatar!==null&&typeof profile.avatar!=='string')invalid('perfil');
  for(const stroke of state.mapStrokes)if(!object(stroke)||!['master','table'].includes(stroke.visibility))invalid('visibilidade de traço');
  return state;
}
export function assertRoomMembers(state,usernames){
  for(const username of usernames)if(!Object.hasOwn(state.playerSheets,username)||!Object.hasOwn(state.statusBarsData,username))invalid('ficha ou perfil de participante ausente');
}
function notesToVersionOne(value,text,title){
  const notes=value??(text?[{id:'legacy',title,body:text}]:[]);
  if(!Array.isArray(notes))invalid('caderno antigo');
  return notes.map(note=>{
    if(!object(note))invalid('nota antiga');
    const board=note.board??emptyNoteBoard();if(!object(board))invalid('quadro antigo');
    return {...note,body:note.body??'',board:{...board,nodes:board.nodes??[],edges:board.edges??[],strokes:board.strokes??[],width:board.width??960,height:board.height??620},sharedWith:note.sharedWith??[],version:note.version??1};
  });
}
export function migrateRoomState(value,{usernames=[],members=usernames.map(username=>({username,role:'player'}))}={}){
  if(!object(value))invalid('documento antigo');
  const version=value.stateVersion??0;
  if(!Number.isInteger(version)||version<0||version>ROOM_STATE_VERSION)throw Error('Versão do estado de mesa não suportada por esta aplicação.');
  if(version===ROOM_STATE_VERSION){
    assertRoomState(value);assertRoomMembers(value,usernames);
    if(reconcileCombat(value.combat,members)!==value.combat)invalid('participantes do combate');
    return value;
  }
  const finish=next=>{
    next.combat=version===6?value.combat:version===5?migrateCombatEffects(value.combat):migrateCombat(value,members);
    if(version>=5&&reconcileCombat(next.combat,members)!==next.combat)invalid('participantes do combate antigo');
    next.scenePresentation=emptyScenePresentation();
    next.campaignScenes=next.campaignScenes.map(scene=>({...scene,mediaId:scene.mediaId??null}));
    for(const key of ['turnOrder','turnExcluded','turnNpcs','activePlayer'])delete next[key];
    next.stateVersion=ROOM_STATE_VERSION;assertRoomState(next);assertRoomMembers(next,usernames);return next;
  };
  if(version>=1){
    if(!Array.isArray(value.mapObjects))invalid('objetos 3D antigos');
    const next={...value};
    if(version<4)next.tabletopLighting=value.tabletopLighting??'default';
    if(version<3)next.mapObjects=value.mapObjects.map(item=>({...item,references:item.references??[]}));
    if(version===1){next.mapGroups=[];next.mapObjects=next.mapObjects.map(item=>({...item,version:1,locked:false,groupId:null,references:[]}));}
    return finish(next);
  }
  const state={...createRoomState(),...value};
  state.masterNotebooks=notesToVersionOne(value.masterNotebooks,state.masterNotes,'Notas do mestre');
  if(!object(state.playerSheets)||!object(state.statusBarsData))invalid('fichas antigas');
  state.playerSheets=Object.fromEntries(Object.entries(state.playerSheets).map(([username,sheet])=>{
    if(!object(sheet))invalid('ficha antiga');
    const next={...newPlayerSheet(),...sheet};next.notebooks=notesToVersionOne(sheet.notebooks,next.observations,'Observações do jogador');return [username,next];
  }));
  state.statusBarsData=Object.fromEntries(Object.entries(state.statusBarsData).map(([username,profile])=>{
    if(!object(profile))invalid('perfil antigo');return [username,{...newStatusProfile(),...profile}];
  }));
  for(const username of usernames)ensureRoomMemberState(state,username);
  if(!Array.isArray(state.mapStrokes))invalid('traços antigos');
  state.mapStrokes=state.mapStrokes.map(stroke=>{if(!object(stroke))invalid('traço antigo');return {...stroke,visibility:stroke.visibility??'table'};});
  if(!object(state.mapPositions))invalid('posições antigas');state.mapPositions={...emptyMapPositions(),...state.mapPositions};
  if(!object(state.mapFog))invalid('névoa antiga');state.mapFog={...emptyMapFog(),...state.mapFog};
  if(!Array.isArray(state.mapObjects))invalid('objetos 3D antigos');state.mapObjects=state.mapObjects.map(item=>({...item,version:1,locked:false,groupId:null,references:[]}));state.mapGroups=[];
  return finish(state);
}
