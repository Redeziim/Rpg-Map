import {createHash} from 'node:crypto';
import {TIMELINE_KINDS,TIMELINE_PAGE_SIZE,TIMELINE_RESERVED_KINDS,isTimelineDate,timelinePage,visibleTimelineEntries} from '../src/shared/campaignTimeline.js';

const fail=(status,message,details)=>{throw Object.assign(Error(message),{status,...(details?{details}:{})});};
export const TIMELINE_LIMITS=Object.freeze({title:120,body:10000,links:20,entries:500,versions:50});
const VISIBILITY=['master','table'];
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{8,100}$/.test(value);
const linkId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const hasControl=text=>/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
const entryFromRow=row=>({id:row.id,kind:row.kind,date:row.entry_date,title:row.title,body:row.body,visibility:row.visibility,pointIds:JSON.parse(row.point_ids),sceneIds:JSON.parse(row.scene_ids),archived:row.archived===1,author:row.author,createdAt:row.created_at,updatedAt:row.updated_at,version:row.version});
const links=(value,label)=>{
  if(!Array.isArray(value)||value.length>TIMELINE_LIMITS.links||value.some(item=>!linkId(item))||new Set(value).size!==value.length)fail(400,`${label} inválidos. Use até ${TIMELINE_LIMITS.links} vínculos, sem repetição.`);
  return value;
};
// Shared by new input and by saved rows, so a backup cannot carry an entry the API would refuse.
export function assertTimelineEntry(entry){
  if(!entry||!identifier(entry.id)||!Object.hasOwn(TIMELINE_KINDS,entry.kind)||!isTimelineDate(entry.date)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>TIMELINE_LIMITS.title||typeof entry.body!=='string'||entry.body.length>TIMELINE_LIMITS.body||!VISIBILITY.includes(entry.visibility)||typeof entry.archived!=='boolean'||typeof entry.author!=='string'||!entry.author||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<1||!Number.isSafeInteger(entry.updatedAt)||entry.updatedAt<entry.createdAt||!Number.isSafeInteger(entry.version)||entry.version<1)throw Error('Registro da linha do tempo inválido.');
  if(TIMELINE_RESERVED_KINDS.includes(entry.kind)&&entry.visibility!=='master')throw Error('Registro da linha do tempo inválido.');
  if(!Array.isArray(entry.pointIds)||!Array.isArray(entry.sceneIds)||entry.pointIds.length>TIMELINE_LIMITS.links||entry.sceneIds.length>TIMELINE_LIMITS.links||[...entry.pointIds,...entry.sceneIds].some(item=>!linkId(item)))throw Error('Vínculos da linha do tempo inválidos.');
  return entry;
}
function parseFields(data,{partial,allowed}){
  const fields={};
  if(Object.keys(data).some(key=>!allowed.includes(key)))fail(400,'Campo desconhecido no registro da campanha.');
  if(data.kind!==undefined||!partial){if(!Object.hasOwn(TIMELINE_KINDS,data.kind))fail(400,'Escolha Sessão ou Decisão.');fields.kind=data.kind;}
  if(data.date!==undefined||!partial){if(!isTimelineDate(data.date))fail(400,'Informe uma data válida no calendário.');fields.date=data.date;}
  if(data.title!==undefined||!partial){
    if(typeof data.title!=='string'||hasControl(data.title))fail(400,'Título inválido.');
    const title=data.title.trim();if(!title||title.length>TIMELINE_LIMITS.title)fail(400,`O título deve ter de 1 a ${TIMELINE_LIMITS.title} caracteres.`);fields.title=title;
  }
  if(data.body!==undefined||!partial){
    const body=data.body??'';if(typeof body!=='string'||hasControl(body))fail(400,'Texto inválido.');
    if(body.length>TIMELINE_LIMITS.body)fail(400,`O texto aceita até ${TIMELINE_LIMITS.body} caracteres.`);fields.body=body;
  }
  if(data.visibility!==undefined){if(!VISIBILITY.includes(data.visibility))fail(400,'Visibilidade inválida.');fields.visibility=data.visibility;}
  if(data.pointIds!==undefined)fields.pointIds=links(data.pointIds,'Pontos');
  if(data.sceneIds!==undefined)fields.sceneIds=links(data.sceneIds,'Cenas');
  return fields;
}
const requireReservedKind=entry=>{if(TIMELINE_RESERVED_KINDS.includes(entry.kind)&&entry.visibility!=='master')fail(400,'A preparação do mestre é sempre reservada. Mude o tipo antes de publicar.');};
// Master entries stay reserved until the master publishes them.
export function createCampaignTimeline(db){
  const byRoom=db.prepare('SELECT * FROM timeline_entries WHERE room_id=?');
  const one=db.prepare('SELECT * FROM timeline_entries WHERE room_id=? AND id=?');
  const stamp=db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(version),0) AS versions,COALESCE(MAX(updated_at),0) AS updated FROM timeline_entries WHERE room_id=? AND (?=1 OR (visibility=\'table\' AND archived=0))');
  const record=db.prepare('INSERT INTO timeline_versions VALUES(?,?,?,?,?,?)');
  const prune=db.prepare('DELETE FROM timeline_versions WHERE room_id=? AND entry_id=? AND version<=?');
  const reference=({pointIds=new Set(),sceneIds=new Set()}={})=>({pointIds,sceneIds});
  function revision(roomId,master){
    const row=stamp.get(roomId,master?1:0);
    return createHash('sha256').update(`${row.count}:${row.versions}:${row.updated}:${master?'m':'p'}`).digest('hex').slice(0,24);
  }
  function snapshotOf(entry){return JSON.stringify({kind:entry.kind,date:entry.date,title:entry.title,body:entry.body,visibility:entry.visibility,pointIds:entry.pointIds,sceneIds:entry.sceneIds,archived:entry.archived});}
  function save(roomId,entry,editor){
    assertTimelineEntry(entry);
    record.run(roomId,entry.id,entry.version,snapshotOf(entry),editor,entry.updatedAt);
    prune.run(roomId,entry.id,entry.version-TIMELINE_LIMITS.versions);
  }
  function requireKnownLinks(fields,known){
    // Only a master can write links, and only to objects that still exist on this table.
    if(fields.pointIds?.some(id=>!known.pointIds.has(id)))fail(400,'Um dos pontos vinculados não existe nesta mesa.');
    if(fields.sceneIds?.some(id=>!known.sceneIds.has(id)))fail(400,'Uma das cenas vinculadas não existe nesta mesa.');
  }
  return {
    revision,
    // `viewer` carries the already authorized points and scenes of the person asking.
    page(roomId,{master,pointIds,sceneIds,kind='all',archived=false,before=null,knownRevision=null}){
      const current=revision(roomId,master);
      if(before&&knownRevision!==current)fail(409,'A linha do tempo mudou. Volte aos mais recentes para continuar.');
      if(archived&&!master)fail(403,'Registros arquivados exigem o modo mestre.');
      let entries=byRoom.all(roomId).map(entryFromRow);
      entries=archived?entries.filter(entry=>entry.archived).map(entry=>({...entry,archived:false})):entries;
      const visible=visibleTimelineEntries(entries,{master,...reference({pointIds,sceneIds})});
      let result;try{result=timelinePage(visible,{kind,before});}catch(error){fail(400,error.message);}
      return {...result,entries:result.entries.map(entry=>archived?{...entry,archived:true}:entry),revision:current,pageSize:TIMELINE_PAGE_SIZE};
    },
    get(roomId,id,{master,pointIds,sceneIds}){
      const row=one.get(roomId,id);if(!row)fail(404,'Registro não encontrado.');
      const entry=entryFromRow(row);
      if(!master&&(entry.visibility!=='table'||entry.archived))fail(404,'Registro não encontrado.');
      return visibleTimelineEntries([{...entry,archived:false}],{master,...reference({pointIds,sceneIds})}).map(item=>({...item,archived:entry.archived}))[0];
    },
    // The caller owns the transaction. Author comes from the session.
    create(roomId,user,data,known,now=Date.now()){
      const id=data.id;
      if(!identifier(id))fail(400,'Identidade do registro inválida.');
      const fields=parseFields({...data,id:undefined},{partial:false,allowed:['id','kind','date','title','body','visibility','pointIds','sceneIds']});
      requireKnownLinks(fields,known);
      const existing=one.get(roomId,id);
      const entry={id,kind:fields.kind,date:fields.date,title:fields.title,body:fields.body,visibility:fields.visibility||'master',pointIds:fields.pointIds||[],sceneIds:fields.sceneIds||[],archived:false,author:user.username,createdAt:now,updatedAt:now,version:1};
      requireReservedKind(entry);
      if(existing){
        const saved=entryFromRow(existing);
        // A repeated request after a lost response must not duplicate or overwrite the entry.
        const same=['kind','date','title','body','visibility','pointIds','sceneIds'].every(key=>JSON.stringify(saved[key])===JSON.stringify(entry[key]));
        if(same&&saved.author===user.username)return {entry:saved,repeated:true};
        fail(409,'Este registro já existe com outro conteúdo. Confira a linha do tempo.');
      }
      if(db.prepare('SELECT COUNT(*) AS count FROM timeline_entries WHERE room_id=?').get(roomId).count>=TIMELINE_LIMITS.entries)fail(413,`A mesa atingiu o limite de ${TIMELINE_LIMITS.entries} registros. Arquive ou exporte antes de criar outro.`);
      db.prepare('INSERT INTO timeline_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,roomId,1,entry.kind,entry.date,entry.title,entry.body,entry.visibility,JSON.stringify(entry.pointIds),JSON.stringify(entry.sceneIds),0,entry.author,now,now);
      save(roomId,entry,user.username);
      return {entry,repeated:false};
    },
    update(roomId,user,id,data,known,now=Date.now()){
      const {expectedVersion,archived,...rest}=data;
      if(!Number.isSafeInteger(expectedVersion))fail(400,'Informe a versão do registro que você está editando.');
      if(archived!==undefined&&typeof archived!=='boolean')fail(400,'O estado de arquivo deve ser verdadeiro ou falso.');
      const fields=parseFields(rest,{partial:true,allowed:['kind','date','title','body','visibility','pointIds','sceneIds']});
      requireKnownLinks(fields,known);
      const row=one.get(roomId,id);if(!row)fail(404,'Registro não encontrado.');
      const current=entryFromRow(row);
      if(current.version!==expectedVersion)fail(409,'O registro mudou em outra janela. Revise antes de salvar.',{current});
      if(!Number.isSafeInteger(current.version+1))fail(409,'Limite de versão do registro atingido.');
      const next={...current,...fields,archived:archived??current.archived,version:current.version+1,updatedAt:Math.max(now,current.updatedAt)};
      requireReservedKind(next);
      if(snapshotOf(next)===snapshotOf(current))return {entry:current,changed:false};
      db.prepare('UPDATE timeline_entries SET version=?,kind=?,entry_date=?,title=?,body=?,visibility=?,point_ids=?,scene_ids=?,archived=?,updated_at=? WHERE room_id=? AND id=?').run(next.version,next.kind,next.date,next.title,next.body,next.visibility,JSON.stringify(next.pointIds),JSON.stringify(next.sceneIds),next.archived?1:0,next.updatedAt,roomId,id);
      save(roomId,next,user.username);
      return {entry:next,changed:true};
    },
    versions(roomId,id){
      if(!one.get(roomId,id))fail(404,'Registro não encontrado.');
      return db.prepare('SELECT version,snapshot,editor,created_at FROM timeline_versions WHERE room_id=? AND entry_id=? ORDER BY version DESC').all(roomId,id).map(row=>({version:row.version,editor:row.editor,createdAt:row.created_at,...JSON.parse(row.snapshot)}));
    },
    // Restoring writes a new version with the old content; history is never rewritten.
    restore(roomId,user,id,{version,expectedVersion},known,now=Date.now()){
      if(!Number.isSafeInteger(version)||version<1)fail(400,'Informe a versão a restaurar.');
      const old=db.prepare('SELECT snapshot FROM timeline_versions WHERE room_id=? AND entry_id=? AND version=?').get(roomId,id,version);
      if(!old)fail(404,'Esta versão não está mais disponível.');
      const {kind,date,title,body,visibility,pointIds,sceneIds}=JSON.parse(old.snapshot);
      // Links can point to objects that no longer exist; drop them instead of failing the restore.
      return this.update(roomId,user,id,{expectedVersion,kind,date,title,body,visibility,pointIds:pointIds.filter(item=>known.pointIds.has(item)),sceneIds:sceneIds.filter(item=>known.sceneIds.has(item))},known,now);
    },
    // Portable view for the person exporting: reserved and archived entries only for a master.
    exportEntries(roomId,{master,pointIds,sceneIds}){
      const entries=byRoom.all(roomId).map(entryFromRow);
      return visibleTimelineEntries(entries.map(entry=>({...entry,archived:master?false:entry.archived})),{master,...reference({pointIds,sceneIds})})
        .map(entry=>({...entry,archived:entries.find(item=>item.id===entry.id).archived}))
        .sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt||b.id.localeCompare(a.id));
    },
  };
}
export function assertSavedTimeline(db){
  const authors=new Set(db.prepare('SELECT username FROM users').all().map(row=>row.username));
  for(const row of db.prepare('SELECT * FROM timeline_entries').iterate()){
    let entry;try{entry=assertTimelineEntry(entryFromRow(row));}catch{throw Error('Registro da linha do tempo persistido inválido.');}
    if(!authors.has(entry.author))throw Error('Autoria de registro da linha do tempo inválida.');
    const versions=db.prepare('SELECT version,snapshot FROM timeline_versions WHERE room_id=? AND entry_id=? ORDER BY version').all(row.room_id,row.id);
    const latest=versions.at(-1);
    if(!latest||latest.version!==entry.version||versions.length>TIMELINE_LIMITS.versions)throw Error('Histórico de versões da linha do tempo incompatível.');
    let snapshot;try{snapshot=JSON.parse(latest.snapshot);}catch{throw Error('Versão da linha do tempo com JSON inválido.');}
    const expected=JSON.parse(JSON.stringify({kind:entry.kind,date:entry.date,title:entry.title,body:entry.body,visibility:entry.visibility,pointIds:entry.pointIds,sceneIds:entry.sceneIds,archived:entry.archived}));
    if(JSON.stringify(snapshot)!==JSON.stringify(expected))throw Error('A última versão do registro difere do registro atual.');
  }
  if(db.prepare('SELECT 1 FROM timeline_versions v LEFT JOIN timeline_entries e ON e.room_id=v.room_id AND e.id=v.entry_id WHERE e.id IS NULL').get())throw Error('Versão de registro sem registro correspondente.');
}
