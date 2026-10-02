import {isMapPointRevealed} from './mapFog.js';

export const emptyMapPositions=()=>({enabled:false,markers:{},generation:'initial'});
export function canShareMapPosition(role,viewMode){
  return role==='player'||role==='admin'&&viewMode==='player';
}
export function isMapPosition(point){
  return !!point&&typeof point==='object'&&!Array.isArray(point)&&Object.keys(point).sort().join(',')==='x,y'
    &&[point.x,point.y].every(value=>Number.isInteger(value)&&value>=0&&value<=16000);
}
export function visibleMapPositions(positions,members,master=false,fog){
  if(!positions?.enabled)return {};
  const players=new Set(members.filter(member=>member.role!=='master').map(member=>member.id));
  return Object.fromEntries(Object.entries(positions.markers||{}).filter(([id,point])=>players.has(id)&&(master||isMapPointRevealed(fog,point))));
}
