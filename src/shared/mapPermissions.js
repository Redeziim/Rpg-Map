export function canAnnotateMap(role){
  return ['admin','master','player'].includes(role);
}

export function canManageMap(role,viewMode){
  return ['admin','master'].includes(role)&&viewMode!=='player';
}

export function canEraseMapStroke(role,username,author,viewMode){
  return canAnnotateMap(role)&&(author===username||canManageMap(role,viewMode));
}
