export const emptyScenePresentation=()=>({sceneId:null,sessionId:null,status:'stopped',position:0,changedAt:0,version:0});
export function isScenePresentation(value){
  return value&&Object.keys(value).length===6&&['stopped','playing','paused'].includes(value.status)&&Number.isSafeInteger(value.version)&&value.version>=0&&Number.isSafeInteger(value.changedAt)&&value.changedAt>=0&&Number.isFinite(value.position)&&value.position>=0&&value.position<=86400&&(value.status==='stopped'?value.sceneId===null&&value.sessionId===null&&value.position===0:typeof value.sceneId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value.sceneId)&&typeof value.sessionId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value.sessionId));
}
export const presentationPosition=(presentation,now)=>Math.max(0,presentation.position+(presentation.status==='playing'?Math.max(0,now-presentation.changedAt)/1000:0));
