import {validatePhysics} from '../src/shared/trayConfig.js';
import {simulateThrow} from './trayPhysics.js';
import { randomInt, randomUUID } from 'node:crypto';
import { sampleOrientation, percentileValue } from '../src/components/diceGeometry.js';
export function createTrayRoll(username, terms, skinId,gesture={x:0,z:1,vx:2,vz:-6},physicsInput) {
  const physicsConfig=validatePhysics(physicsInput);
  if(!Array.isArray(terms)||!terms.length||terms.length>6||terms.some(t=>!t||![4,6,8,10,12,20,100].includes(t.sides)||!Number.isInteger(t.qty)||t.qty<1||![1,-1].includes(t.sign))||terms.reduce((n,t)=>n+t.qty*(t.sides===100?2:1),0)>20)throw Object.assign(Error('Escolha até 20 dados físicos para a bandeja (d100 usa dois).'),{status:400});
  if(!gesture||['x','z','vx','vz'].some(k=>!Number.isFinite(gesture[k]))||Math.abs(gesture.x)>2.5||Math.abs(gesture.z)>2||Math.hypot(gesture.vx,gesture.vz)>12)throw Object.assign(Error('Gesto de lançamento inválido.'),{status:400});
  const dice=[],parts=[];
  const random=()=>randomInt(0,0x100000000)/0x100000000;
  for(const term of terms)for(let n=0;n<term.qty;n++)for(let part=0;part<(term.sides===100?2:1);part++){
    dice.push({sides:term.sides===100?10:term.sides,notation:term.sides===100?(part===0?'tens':'units'):null,initial:sampleOrientation(random).toArray()});
  }
  const physics=simulateThrow(dice,gesture,random,physicsConfig);let index=0;
  for(const term of terms){
    const rolls=[];
    for(let n=0;n<term.qty;n++)rolls.push(term.sides===100?percentileValue(dice[index++].value,dice[index++].value):dice[index++].value);
    parts.push({sides:term.sides,qty:term.qty,sign:term.sign,rolls});
  }
  return {id:randomUUID(),username,skinId:['nebulosa','chamas','floresta','ametista','pedra','carmesim','safira'].includes(skinId)?skinId:'carmesim',startedAt:Date.now()+250,...physics,physics:physicsConfig,dice,parts,total:physics.cocked?null:parts.reduce((n,p)=>n+p.sign*p.rolls.reduce((a,b)=>a+b,0),0)};
}
