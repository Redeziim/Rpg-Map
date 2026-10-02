import {AUDIT_ACTIONS,AUDIT_RETENTION} from '../src/shared/roomAudit.js';
import {isDeepStrictEqual} from 'node:util';

const username=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(value);
function validDetails(action,details){
  if(!details||typeof details!=='object'||Array.isArray(details))return false;
  const fields=action.startsWith('member.')?action==='member.role'?['target','fromRole','role']:action==='member.removed'?['target','fromRole']:['target','role']:action.startsWith('invite.')?['role']:['sheet.changed','profile.changed'].includes(action)?['target']:[];
  if(Object.keys(details).length!==fields.length||fields.some(field=>!Object.hasOwn(details,field)))return false;
  return fields.every(field=>field==='target'?username(details[field]):['admin','master','player'].includes(details[field]));
}
export function assertRoomAudit(db){
  for(const row of db.prepare('SELECT a.*,r.revision AS current_revision,u.username AS current_username FROM room_audit a JOIN rooms r ON r.id=a.room_id JOIN users u ON u.id=a.actor_id').iterate()){
    let details;try{details=JSON.parse(row.details);}catch{throw Error('JSON inválido no registro de alterações.');}
    if(!Object.hasOwn(AUDIT_ACTIONS,row.action)||!validDetails(row.action,details)||!username(row.actor_username)||row.actor_username!==row.current_username||!Number.isSafeInteger(row.sequence)||row.sequence<1||!Number.isSafeInteger(row.created_at)||row.created_at<1||!Number.isSafeInteger(row.revision)||row.revision<0||row.revision>row.current_revision)throw Error('Formato inválido no registro de alterações.');
  }
  if(db.prepare('SELECT room_id FROM room_audit GROUP BY room_id HAVING COUNT(*)>?').get(AUDIT_RETENTION))throw Error('Limite inválido no registro de alterações.');
}

// Compare content inside the server; store only an allowlist of action types and public usernames.
export function roomAuditChanges(before,after){
  const changes=[],changed=(a,b)=>!isDeepStrictEqual(a,b),add=(action,details={})=>changes.push({action,details});
  for(const [field,action] of [['mapImage','map.image'],['points','map.points'],['mapFog','map.fog'],['mapScale','map.scale'],['mapLegend','map.legend'],['mapRoutes','map.routes'],['mapStrokes','map.strokes'],['mapObjects','tabletop.changed'],['campaignScenes','campaign.changed']])if(changed(before[field],after[field]))add(action);
  if(before.mapPositions?.enabled!==after.mapPositions?.enabled)add('map.positions');
  if(changed(before.sheetFields,after.sheetFields)||before.sheetFont!==after.sheetFont)add('sheet.template');
  if(['turnOrder','turnNpcs','turnExcluded','activePlayer'].some(field=>changed(before[field],after[field])))add('turns.changed');
  const notes=(oldNotes=[],newNotes=[],master=false)=>{
    const previous=new Map(oldNotes.map(note=>[note.id,note]));
    for(const note of newNotes){
      const old=previous.get(note.id);
      if(!master&&!old?.sharedWith?.length&&!note.sharedWith?.length)continue;
      if(changed([...(old?.sharedWith||[])].sort(),[...(note.sharedWith||[])].sort()))add('note.access');
      if(!old||['title','body','board'].some(field=>changed(old[field],note[field])))add('note.changed');
    }
  };
  notes(before.masterNotebooks,after.masterNotebooks,true);
  for(const [username,sheet] of Object.entries(after.playerSheets||{})){
    const previous=before.playerSheets?.[username];
    if(previous&&changed(previous.values,sheet.values))add('sheet.changed',{target:username});
    notes(previous?.notebooks,sheet.notebooks);
  }
  for(const [username,profile] of Object.entries(after.statusBarsData||{}))if(before.statusBarsData?.[username]&&changed(before.statusBarsData[username],profile))add('profile.changed',{target:username});
  // One row per action type, even when several visible notes changed in the same save.
  return [...new Map(changes.map(change=>[change.action+':'+(change.details.target||''),change])).values()];
}

export function createRoomAuditStore(db){
  const append=db.prepare('INSERT INTO room_audit VALUES(?,?,?,?,?,?,?,?)');
  const latest=db.prepare('SELECT COALESCE(MAX(sequence),0) AS sequence FROM room_audit WHERE room_id=?');
  const revision=db.prepare('SELECT revision FROM rooms WHERE id=?');
  const prune=db.prepare('DELETE FROM room_audit WHERE room_id=? AND sequence<=?');
  return {
    record(roomId,actor,action,details={}){
      if(!db.isTransaction)throw Error('O registro de alterações exige a transação da ação.');
      if(!Object.hasOwn(AUDIT_ACTIONS,action)||!validDetails(action,details))throw Error('Tipo ou metadados de registro desconhecidos.');
      const sequence=latest.get(roomId).sequence+1;
      append.run(roomId,sequence,actor.id,actor.username,action,JSON.stringify(details),Date.now(),revision.get(roomId).revision);
      prune.run(roomId,sequence-AUDIT_RETENTION);
    },
    list(roomId,{before,limit=50,category}={}){
      const actions=category?Object.keys(AUDIT_ACTIONS).filter(action=>AUDIT_ACTIONS[action][0]===category):[];
      const rows=db.prepare(`SELECT * FROM room_audit WHERE room_id=? ${before?'AND sequence<?':''} ${category?`AND action IN (${actions.map(()=>'?').join(',')})`:''} ORDER BY sequence DESC LIMIT ?`).all(roomId,...(before?[before]:[]),...actions,limit+1);
      const entries=rows.slice(0,limit).map(row=>({sequence:row.sequence,actor:{id:row.actor_id,username:row.actor_username},action:row.action,details:JSON.parse(row.details),createdAt:row.created_at,revision:row.revision}));
      return {entries,nextBefore:rows.length>limit?entries.at(-1).sequence:null,retention:AUDIT_RETENTION};
    },
  };
}
