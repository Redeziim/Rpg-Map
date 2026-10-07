import {canManageMap} from '../src/shared/mapPermissions.js';
import {isMapPointRevealed} from '../src/shared/mapFog.js';
import {visibleCampaignScenes} from '../src/shared/campaignScenes.js';
import {isTabletopReference} from '../src/shared/tabletopReferences.js';

export function projectNoteBoard(board,pointIds){
  return {...board,nodes:board.nodes.map(node=>{if(!node.pointId||pointIds.has(node.pointId))return node;const {pointId,...rest}=node;return rest;})};
}
export function resolveTabletopReference(state,ref,{username,role,viewMode,members}){
  const master=canManageMap(role,viewMode);
  if(ref.kind==='point')return (state.points||[]).find(point=>point.id===ref.targetId&&(master||isMapPointRevealed(state.mapFog,point)))||null;
  if(ref.kind==='scene'){
    const points=(state.points||[]).filter(point=>master||isMapPointRevealed(state.mapFog,point));
    return visibleCampaignScenes(state.campaignScenes,points,master,state.scenePresentation).find(scene=>scene.id===ref.targetId&&!scene.archived)||null;
  }
  if(ref.kind!=='note')return null;
  const note=ref.scope==='@master'?state.masterNotebooks?.find(note=>note.id===ref.targetId):members.some(member=>member.username===ref.scope)?state.playerSheets[ref.scope]?.notebooks.find(note=>note.id===ref.targetId):null;
  if(!note||!(ref.scope==='@master'&&master||ref.scope===username||note.sharedWith.includes(username)))return null;
  const pointIds=new Set(state.points.filter(point=>master||isMapPointRevealed(state.mapFog,point)).map(point=>point.id));
  return {...note,scope:ref.scope,board:projectNoteBoard(note.board,pointIds)};
}
export function assertLinkTarget(state,ref,access){
  if(!ref||typeof ref!=='object'||Object.hasOwn(ref,'id')||!isTabletopReference({...ref,id:'validation'}))throw Object.assign(Error('Destino do vínculo inválido.'),{status:400});
  if(!resolveTabletopReference(state,ref,access))throw Object.assign(Error('Destino indisponível nesta visão.'),{status:404});
}
export function projectTabletopReferences(state,access,{includeUnavailable=canManageMap(access.role,access.viewMode)}={}){
  return state.mapObjects.map(item=>({...item,references:(item.references||[]).flatMap(ref=>resolveTabletopReference(state,ref,access)?[{...ref}]:includeUnavailable?[{id:ref.id,kind:ref.kind,unavailable:true}]:[])}));
}
