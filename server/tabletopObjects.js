import {randomUUID} from 'node:crypto';
import {validateMapTransform} from './mapAssets.js';
import {expandSelection,transformSelection} from '../src/shared/tabletopSelection.js';
import {referenceKey} from '../src/shared/tabletopReferences.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function copyName(name,entries){
  const root=name.replace(/ — cópia(?: \d+)?$/,'').slice(0,102),used=new Set(entries.map(entry=>entry.name));let number=1,candidate;
  do{candidate=`${root} — cópia${number===1?'':' '+number}`;number++;}while(used.has(candidate));return candidate;
}
export function changeTabletopObjects(state,data){
  const keys={group:['name'],ungroup:[],duplicate:[],transform:['delta','patches'],lock:['locked'],remove:[],link:['reference'],unlink:['referenceId']};
  if(!data||!Object.hasOwn(keys,data.action)||Object.keys(data).some(key=>!['version','action','ids',...keys[data.action]].includes(key)))fail(400,'Ação de objetos inválida.');
  if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>100||data.ids.some(id=>typeof id!=='string')||new Set(data.ids).size!==data.ids.length)fail(400,'Selecione os objetos da ação.');
  if(data.ids.some(id=>!state.mapObjects.some(item=>item.id===id)))fail(404,'Um objeto selecionado não está mais na mesa.');
  const linking=['link','unlink'].includes(data.action);
  if(linking&&data.ids.length!==1)fail(400,'Escolha um objeto para alterar seus vínculos.');
  const ids=linking?data.ids:expandSelection(state.mapObjects,data.ids),items=state.mapObjects.filter(item=>ids.includes(item.id));
  if(items.some(item=>!Number.isSafeInteger(item.version+1)))fail(409,'Limite de versão do objeto atingido.');
  let selectionIds=ids;
  if(data.action==='link'){
    const item=items[0];if(item.references.length>=90)fail(400,'Limite de 90 vínculos por objeto.');
    if(item.references.some(ref=>referenceKey(ref)===referenceKey(data.reference)))fail(409,'Este destino já está vinculado ao objeto.');
    item.references.push({id:randomUUID(),...data.reference});
  }else if(data.action==='unlink'){
    const item=items[0];if(typeof data.referenceId!=='string'||!item.references.some(ref=>ref.id===data.referenceId))fail(404,'Vínculo não encontrado.');
    item.references=item.references.filter(ref=>ref.id!==data.referenceId);
  }else if(data.action==='group'){
    if(items.length<2)fail(400,'Selecione pelo menos dois objetos.');
    const {name}=validateMapTransform({name:data.name}),id=randomUUID();
    state.mapGroups=state.mapGroups.filter(group=>!items.some(item=>item.groupId===group.id));state.mapGroups.push({id,name});
    for(const item of items)item.groupId=id;
  }else if(data.action==='ungroup'){
    state.mapGroups=state.mapGroups.filter(group=>!items.some(item=>item.groupId===group.id));for(const item of items)item.groupId=null;
  }else if(data.action==='duplicate'){
    if(state.mapObjects.length+items.length>100)fail(400,'Limite de 100 objetos por mesa.');
    const groups=new Map();
    for(const item of items)if(item.groupId&&!groups.has(item.groupId)){
      const id=randomUUID(),original=state.mapGroups.find(group=>group.id===item.groupId);groups.set(item.groupId,id);state.mapGroups.push({id,name:copyName(original.name,state.mapGroups)});
    }
    const copies=[];for(const item of items)copies.push({...item,id:randomUUID(),name:copyName(item.name,[...state.mapObjects,...copies]),position:validateMapTransform({position:[item.position[0]+1,item.position[1],item.position[2]+1]}).position,rotation:[...item.rotation],scale:[...item.scale],references:item.references.map(ref=>({...ref,id:randomUUID()})),version:1,groupId:groups.get(item.groupId)||null});
    state.mapObjects.push(...copies);selectionIds=copies.map(item=>item.id);
  }else if(data.action==='transform'){
    if(items.some(item=>item.locked))fail(423,'Desbloqueie os objetos antes de mover, girar ou mudar o tamanho.');
    let patches;
    if(data.delta){
      const delta=data.delta;if(typeof delta!=='object'||Array.isArray(delta)||data.patches||Object.keys(delta).some(key=>!['position','rotation','scale'].includes(key))||!Number.isFinite(delta.scale??1)||(delta.scale??1)<=0)fail(400,'Transformação da seleção inválida.');
      validateMapTransform({position:delta.position??[0,0,0],rotation:delta.rotation??[0,0,0]});patches=transformSelection(items,delta);
    }else{
      patches=data.patches;if(!Array.isArray(patches)||patches.length!==ids.length||new Set(patches.map(patch=>patch?.id)).size!==ids.length||patches.some(patch=>!patch||!ids.includes(patch.id)))fail(400,'Transformação da seleção incompleta.');
    }
    for(const patch of patches){const {id,...pose}=patch;Object.assign(items.find(item=>item.id===id),validateMapTransform(pose));}
  }else if(data.action==='lock'){
    if(typeof data.locked!=='boolean')fail(400,'Bloqueio inválido.');for(const item of items)item.locked=data.locked;
  }else if(data.action==='remove'){
    state.mapObjects=state.mapObjects.filter(item=>!ids.includes(item.id));state.mapGroups=state.mapGroups.filter(group=>state.mapObjects.some(item=>item.groupId===group.id));selectionIds=[];
  }
  for(const item of items)if(data.action!=='remove')item.version++;
  return {selectionIds,removedAssetIds:data.action==='remove'?[...new Set(items.map(item=>item.assetId))]:[]};
}
