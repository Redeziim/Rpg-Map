import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uniqueIds=value=>Array.isArray(value)&&value.every(id=>typeof id==='string'&&id.length>0)&&new Set(value).size===value.length;
export const createCombat=()=>({schemaVersion:2,version:1,order:[],excluded:[],npcs:[],initiative:{},activeId:null,round:0,effects:[]});
const durationValid=duration=>object(duration)&&Object.keys(duration).sort().join(',')==='kind,remaining'&&(duration.kind==='manual'?duration.remaining===null:duration.kind==='rounds'?Number.isInteger(duration.remaining)&&duration.remaining>=0&&duration.remaining<=99:duration.kind==='next-turn'&&[0,1].includes(duration.remaining));
export const projectCombat=(combat,master)=>({...combat,effects:combat.effects.filter(effect=>master||effect.visibility==='all')});

function checkCombat(combat,schemaVersion){
  const invalid=()=>{throw Error('Estado de mesa inválido: combate. A migração não foi aplicada.');};
  const keys=schemaVersion===1?'activeId,excluded,initiative,npcs,order,round,schemaVersion,version':'activeId,effects,excluded,initiative,npcs,order,round,schemaVersion,version';
  if(!object(combat)||Object.keys(combat).sort().join(',')!==keys||combat.schemaVersion!==schemaVersion||!Number.isSafeInteger(combat.version)||combat.version<1||!uniqueIds(combat.order)||!uniqueIds(combat.excluded)||!Array.isArray(combat.npcs)||combat.npcs.length>40||!object(combat.initiative)||!Number.isSafeInteger(combat.round)||combat.round<0)invalid();
  const npcIds=new Set();
  for(const npc of combat.npcs){
    if(!object(npc)||typeof npc.id!=='string'||!/^npc:[a-zA-Z0-9-]+$/.test(npc.id)||npcIds.has(npc.id)||typeof npc.name!=='string'||npc.name!==npc.name.trim()||npc.name.length<2||npc.name.length>50||!['enemy','npc'].includes(npc.kind)||!combat.order.includes(npc.id))invalid();
    npcIds.add(npc.id);
  }
  if(combat.excluded.some(id=>combat.order.includes(id)||id.startsWith('npc:'))||combat.order.some(id=>id.startsWith('npc:')&&!npcIds.has(id)))invalid();
  if(combat.activeId===null?combat.round!==0:!combat.order.includes(combat.activeId)||combat.round<1)invalid();
  const ids=new Set([...combat.order,...combat.excluded]);
  for(const [id,value]of Object.entries(combat.initiative))if(!ids.has(id)||!Number.isInteger(value)||Math.abs(value)>999)invalid();
  if(schemaVersion===2){
    if(!Array.isArray(combat.effects)||combat.effects.length>80)invalid();
    const effectIds=new Set(),counts=new Map();
    for(const effect of combat.effects){
      if(!object(effect)||Object.keys(effect).sort().join(',')!=='actorId,duration,id,name,origin,visibility'||typeof effect.id!=='string'||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(effect.id)||effectIds.has(effect.id)||!ids.has(effect.actorId)||typeof effect.name!=='string'||effect.name!==effect.name.trim()||effect.name.length<2||effect.name.length>60||typeof effect.origin!=='string'||effect.origin!==effect.origin.trim()||effect.origin.length>120||!['all','master'].includes(effect.visibility)||!durationValid(effect.duration))invalid();
      effectIds.add(effect.id);counts.set(effect.actorId,(counts.get(effect.actorId)||0)+1);if(counts.get(effect.actorId)>10)invalid();
    }
  }
  return combat;
}
export const assertCombat=combat=>checkCombat(combat,2);
export function migrateCombatEffects(combat){checkCombat(combat,1);return assertCombat({...combat,schemaVersion:2,effects:[]});}

function advanceEffects(previous,next){
  const ids=new Set([...next.order,...next.excluded]),newRound=previous.round>0&&next.round>previous.round;
  const entered=next.activeId!==null&&(next.activeId!==previous.activeId||newRound);
  next.effects=next.effects.filter(effect=>ids.has(effect.actorId)).map(effect=>{
    if(effect.duration.remaining===0||!next.order.includes(effect.actorId))return effect;
    const {kind,remaining}=effect.duration;
    if(kind==='rounds'&&newRound)return {...effect,duration:{kind,remaining:remaining-1}};
    if(kind==='next-turn'&&entered&&effect.actorId===next.activeId)return {...effect,duration:{kind,remaining:0}};
    return effect;
  });
}

function confirmed(previous,next){
  advanceEffects(previous,next);
  if(isDeepStrictEqual(previous,next))return previous;
  if(!Number.isSafeInteger(previous.version+1))fail(409,'Limite de versão do combate atingido.');
  next.version=previous.version+1;
  return assertCombat(next);
}

// Choose the next survivor in the former order, including when membership removes several actors.
function preserveActive(previous,next){
  if(previous.activeId===null||next.order.includes(previous.activeId))return;
  const start=previous.order.indexOf(previous.activeId);
  for(let offset=1;offset<=previous.order.length;offset++){
    const index=(start+offset)%previous.order.length,id=previous.order[index];
    if(next.order.includes(id)){
      next.activeId=id;next.round=previous.round+(start+offset>=previous.order.length?1:0);return;
    }
  }
  next.activeId=null;next.round=0;
}

export function reconcileCombat(combat,members){
  const players=members.filter(member=>member.role!=='master').map(member=>member.username),playerSet=new Set(players);
  const excluded=combat.excluded.filter(id=>playerSet.has(id)),excludedSet=new Set(excluded);
  const available=[...players.filter(id=>!excludedSet.has(id)),...combat.npcs.map(npc=>npc.id)],ids=new Set(available);
  const order=[...new Set([...combat.order.filter(id=>ids.has(id)),...available])];
  const allIds=new Set([...order,...excluded]);
  const next={...combat,order,excluded,initiative:Object.fromEntries(Object.entries(combat.initiative).filter(([id])=>allIds.has(id)))};
  preserveActive(combat,next);
  return confirmed(combat,next);
}

export function migrateCombat(state,members){
  for(const key of ['turnOrder','turnExcluded'])if(state[key]!==undefined&&(!Array.isArray(state[key])||state[key].some(id=>typeof id!=='string'||!id)))throw Error('Estado de mesa inválido: ordem de combate antiga. A migração não foi aplicada.');
  if(state.turnNpcs!==undefined&&!Array.isArray(state.turnNpcs)||state.activePlayer!==undefined&&state.activePlayer!==null&&typeof state.activePlayer!=='string')throw Error('Estado de mesa inválido: combate antigo. A migração não foi aplicada.');
  const combat={...createCombat(),order:[...new Set(state.turnOrder??[])],excluded:[...new Set(state.turnExcluded??[])],npcs:state.turnNpcs??[],activeId:state.activePlayer??null};
  combat.round=combat.activeId===null?0:1;
  // Older snapshots appended members at read time. Materialize that order once during migration.
  const next=reconcileCombat(combat,members);
  next.version=1;
  return assertCombat(next);
}

export function changeCombat(combat,data){
  assertCombat(combat);
  const {action,player}=data;
  const fields=action==='effect-add'?['action','version','player','name','origin','visibility','duration']:action==='effect-remove'?['action','version','effectId']:action==='add'?['action','version','name','kind']:action==='initiative'?['action','version','player','value']:['select','up','down','remove','include'].includes(action)?['action','version','player']:['action','version'];
  if(Object.keys(data).some(key=>!fields.includes(key))||!Number.isSafeInteger(data.version)||data.version<1)fail(400,'Alteração de combate inválida. Atualize a mesa e tente novamente.');
  if(data.version!==combat.version)fail(409,'O combate mudou em outra tela. Confira a ordem atual antes de tentar novamente.');
  if(['select','up','down','remove','initiative'].includes(action)&&!combat.order.includes(player))fail(400,'Participante não encontrado na ordem de turnos.');
  const next=structuredClone(combat);
  if(action==='effect-add'){
    if(![...next.order,...next.excluded].includes(player))fail(400,'Participante não encontrado no combate.');
    if(next.effects.length>=80||next.effects.filter(effect=>effect.actorId===player).length>=10)fail(400,'Limite de 80 efeitos na mesa ou 10 por participante. Remova efeitos encerrados antes de adicionar outro.');
    const name=typeof data.name==='string'?data.name.trim():'',origin=typeof data.origin==='string'?data.origin.trim():null;
    if(name.length<2||name.length>60||origin===null||origin.length>120||!['all','master'].includes(data.visibility)||!durationValid(data.duration)||data.duration.remaining===0)fail(400,'Confira nome, origem, visibilidade e duração: use de 1 a 99 rodadas, próximo turno ou remoção manual.');
    next.effects.push({id:randomUUID(),actorId:player,name,origin,visibility:data.visibility,duration:{...data.duration}});
  }else if(action==='effect-remove'){
    if(!next.effects.some(effect=>effect.id===data.effectId))fail(400,'Efeito não encontrado. Confira a lista atual.');
    next.effects=next.effects.filter(effect=>effect.id!==data.effectId);
  }else if(action==='select'){next.activeId=player;next.round=Math.max(1,next.round);}
  else if(action==='end'){next.activeId=null;next.round=0;}
  else if(action==='next'||action==='skip'){
    if(!next.order.length)fail(400,'Adicione participantes antes de iniciar os turnos.');
    const index=next.order.indexOf(next.activeId),target=(index+1)%next.order.length;
    if(index===-1)next.round=1;else if(target===0)next.round++;
    next.activeId=next.order[target];
  }else if(action==='add'){
    if(next.npcs.length>=40)fail(400,'A ordem já tem 40 inimigos ou NPCs.');
    const name=typeof data.name==='string'?data.name.trim():'';
    if(name.length<2||name.length>50||!['enemy','npc'].includes(data.kind))fail(400,'Use um nome de 2 a 50 caracteres e escolha Inimigo ou NPC.');
    const npc={id:`npc:${randomUUID()}`,name,kind:data.kind};next.npcs.push(npc);next.order.push(npc.id);
  }else if(action==='remove'){
    if(player.startsWith('npc:')){next.npcs=next.npcs.filter(npc=>npc.id!==player);delete next.initiative[player];}
    else next.excluded.push(player);
    next.order=next.order.filter(id=>id!==player);preserveActive(combat,next);
  }else if(action==='include'){
    if(!next.excluded.includes(player))fail(400,'Jogador não está fora do combate.');
    next.excluded=next.excluded.filter(id=>id!==player);next.order.push(player);
  }else if(action==='up'||action==='down'){
    const index=next.order.indexOf(player),target=index+(action==='up'?-1:1);
    if(target<0||target>=next.order.length)fail(400,'O participante já está no limite da ordem.');
    [next.order[index],next.order[target]]=[next.order[target],next.order[index]];
  }else if(action==='initiative'){
    if(data.value===null)delete next.initiative[player];
    else if(Number.isInteger(data.value)&&Math.abs(data.value)<=999)Object.defineProperty(next.initiative,player,{value:data.value,enumerable:true,writable:true,configurable:true});
    else fail(400,'Use uma iniciativa inteira entre -999 e 999, ou deixe em branco.');
  }else if(action==='sort'){
    next.order.sort((a,b)=>(next.initiative[b]??-Infinity)-(next.initiative[a]??-Infinity));
  }else fail(400,'Ação de turno inválida.');
  return confirmed(combat,next);
}
