export const SCENE_FIELDS=['title','body','pointIds','visibility'];
export const sceneFields=scene=>({title:scene?.title||'',body:scene?.body||'',pointIds:scene?.pointIds||[],visibility:scene?.visibility||'master'});
export const sameSceneField=(field,a,b)=>field==='pointIds'?JSON.stringify([...a].sort())===JSON.stringify([...b].sort()):a===b;
export function mergeSceneFields(base,draft,latest,choices){
  return Object.fromEntries(SCENE_FIELDS.map(field=>[field,sameSceneField(field,base[field],draft[field])||choices[field]==='latest'?latest[field]:draft[field]]));
}
export function visibleCampaignScenes(scenes,points,master=false){
  if(master)return scenes||[];
  const ids=new Set(points.map(point=>point.id));
  return (scenes||[]).filter(scene=>!scene.archived&&scene.visibility==='table'&&(!scene.pointIds.length||scene.pointIds.some(id=>ids.has(id))))
    .map(scene=>({...scene,pointIds:scene.pointIds.filter(id=>ids.has(id))}));
}
export function indexPointLinks(notes,scenes){
  const index=new Map(),add=(id,kind,entry)=>{if(!index.has(id))index.set(id,{notes:[],scenes:[]});index.get(id)[kind].push(entry);};
  for(const note of notes){for(const id of new Set((note.board?.nodes||[]).map(node=>node.pointId).filter(Boolean)))add(id,'notes',note);}
  for(const scene of scenes){if(!scene.archived)for(const id of scene.pointIds)add(id,'scenes',scene);}
  return index;
}
const counts=new Intl.NumberFormat('pt-BR');
export function pointLinkLabel(links){
  if(!links)return '';
  return [links.notes.length?`${counts.format(links.notes.length)} ${links.notes.length===1?'nota':'notas'}`:'',links.scenes.length?`${counts.format(links.scenes.length)} ${links.scenes.length===1?'cena':'cenas'}`:''].filter(Boolean).join(' · ');
}
