import {canManageMap} from './mapPermissions.js';

export const strokeVisibility=stroke=>stroke.visibility||'table';
export function canReadMapStroke(role,viewMode,stroke){
  return strokeVisibility(stroke)==='table'||canManageMap(role,viewMode);
}
export function visibleMapStrokes(strokes,{role,viewMode,username,mine=true,others=true}){
  return strokes.filter(stroke=>canReadMapStroke(role,viewMode,stroke)&&(stroke.author===username?mine:others));
}
