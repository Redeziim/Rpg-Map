export const REFERENCE_LABELS={point:'Ponto',scene:'Cena',note:'Nota'};
export const referenceKey=ref=>JSON.stringify([ref.kind,ref.scope||null,ref.targetId]);
export function isTabletopReference(ref){
  if(!ref||typeof ref!=='object'||Array.isArray(ref)||!Object.hasOwn(REFERENCE_LABELS,ref.kind)||Object.keys(ref).some(key=>!['id','kind','targetId','scope'].includes(key)))return false;
  if(![ref.id,ref.targetId].every(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id)))return false;
  return ref.kind==='note'?typeof ref.scope==='string'&&(ref.scope==='@master'||/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$/.test(ref.scope)):ref.scope===undefined;
}
export function referenceTargets({points=[],scenes=[],notes=[]}){
  const index=new Map();
  for(const point of points)index.set(referenceKey({kind:'point',targetId:point.id}),{kind:'point',targetId:point.id,title:point.name});
  for(const scene of scenes)if(!scene.archived)index.set(referenceKey({kind:'scene',targetId:scene.id}),{kind:'scene',targetId:scene.id,title:scene.title});
  for(const note of notes)index.set(referenceKey({kind:'note',targetId:note.id,scope:note.scope}),{kind:'note',targetId:note.id,scope:note.scope,title:note.title});
  return index;
}
