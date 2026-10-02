import {emptyMapFog} from '../src/shared/mapFog.js';
import {emptyMapPositions} from '../src/shared/mapPositions.js';
import {defaultMapLegend,isMapLegend} from '../src/shared/mapExploration.js';

export const ROOM_STATE_VERSION=1;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalid=label=>{throw Error(`Estado de mesa inválido: ${label}. A migração não foi aplicada.`);};
export const emptyNoteBoard=()=>({nodes:[],edges:[],strokes:[],width:960,height:620});
export const newPlayerSheet=()=>({values:{},extraFields:[],observations:'',notebooks:[]});
export const newStatusProfile=()=>({avatar:null,bars:[]});
export function ensureRoomMemberState(state,username){
  if(!Object.hasOwn(state.playerSheets,username))Object.defineProperty(state.playerSheets,username,{value:newPlayerSheet(),enumerable:true,configurable:true,writable:true});
  if(!Object.hasOwn(state.statusBarsData,username))Object.defineProperty(state.statusBarsData,username,{value:newStatusProfile(),enumerable:true,configurable:true,writable:true});
}
export const createRoomState=()=>({stateVersion:ROOM_STATE_VERSION,points:[],mapImage:null,mapStrokes:[],mapFog:emptyMapFog(),mapScale:null,mapPositions:emptyMapPositions(),mapLegend:defaultMapLegend(),mapRoutes:[],mapObjects:[],campaignScenes:[],sheetFields:[],sheetFont:'cinzel',masterNotes:'',masterNotebooks:[],turnOrder:[],turnExcluded:[],turnNpcs:[],activePlayer:null,playerSheets:{},statusBarsData:{}});

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
  for(const key of ['points','mapStrokes','mapRoutes','mapObjects','campaignScenes','sheetFields','turnOrder','turnExcluded','turnNpcs'])if(!Array.isArray(state[key]))invalid(key);
  if(!object(state.playerSheets)||!object(state.statusBarsData)||typeof state.masterNotes!=='string'||typeof state.sheetFont!=='string'||state.mapImage!==null&&typeof state.mapImage!=='string'||state.activePlayer!==null&&typeof state.activePlayer!=='string')invalid('campos principais');
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
export function migrateRoomState(value,{usernames=[]}={}){
  if(!object(value))invalid('documento antigo');
  const version=value.stateVersion??0;
  if(!Number.isInteger(version)||version<0||version>ROOM_STATE_VERSION)throw Error('Versão do estado de mesa não suportada por esta aplicação.');
  if(version===ROOM_STATE_VERSION){assertRoomState(value);assertRoomMembers(value,usernames);return value;}
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
  state.stateVersion=ROOM_STATE_VERSION;
  return assertRoomState(state);
}
