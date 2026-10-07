import {DatabaseSync} from 'node:sqlite';
import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {databaseSchemaIdentity,DATABASE_TABLES} from './databaseSchema.js';

function fileBytes(path){try{return statSync(path).size;}catch(error){if(error.code==='ENOENT')return 0;throw error;}}
function check(db,pragma){
  const rows=db.prepare(`PRAGMA ${pragma}`).all();
  return {ok:rows.length===1&&Object.values(rows[0])[0]==='ok',issueCount:rows.filter(row=>Object.values(row)[0]!=='ok').length};
}
function sum(db,table,expression,roomId){
  return db.prepare(`SELECT count(*) AS count,COALESCE(sum(${expression}),0) AS bytes FROM ${table} WHERE room_id=?`).get(roomId);
}

export function inspectDatabaseUsage(path,{full=false}={}){
  path=resolve(path);
  const db=new DatabaseSync(path,{readOnly:true,timeout:5000});
  try{
    db.exec('PRAGMA query_only=ON; BEGIN');
    const quick=check(db,'quick_check'),integrity=full?check(db,'integrity_check'):null;
    let foreignKeyViolations=0;
    for(const _ of db.prepare('PRAGMA foreign_key_check').iterate())foreignKeyViolations++;
    const userVersion=db.prepare('PRAGMA user_version').get().user_version;
    const applicationId=db.prepare('PRAGMA application_id').get().application_id;
    let schemaCompatible=false;
    try{databaseSchemaIdentity(db);schemaCompatible=true;}catch{}
    const tables=new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name));
    const rooms=tables.has('rooms')?db.prepare('SELECT id,state FROM rooms ORDER BY id').all():[];
    const roomUsage=rooms.map(room=>{
      const models=tables.has('map_assets')?sum(db,'map_assets','length(CAST(bundle AS BLOB))',room.id):{count:0,bytes:0};
      const modelSource=tables.has('map_assets')?db.prepare('SELECT COALESCE(sum(bytes),0) AS bytes FROM map_assets WHERE room_id=?').get(room.id).bytes:0;
      const images=tables.has('note_assets')?sum(db,'note_assets','length(data)',room.id):{count:0,bytes:0};
      const sceneMedia=tables.has('scene_media')?sum(db,'scene_media','length(data)',room.id):{count:0,bytes:0};
      const histories=tables.has('note_versions')?sum(db,'note_versions','length(CAST(content AS BLOB))+length(CAST(shared_with AS BLOB))+length(CAST(asset_ids AS BLOB))+length(CAST(summary AS BLOB))',room.id):{count:0,bytes:0};
      const records=tables.has('room_audit')?sum(db,'room_audit','length(CAST(details AS BLOB))',room.id):{count:0,bytes:0};
      const structures=tables.has('dice_structures')?sum(db,'dice_structures','length(CAST(mesh AS BLOB))',room.id):{count:0,bytes:0};
      const diceRolls=tables.has('dice_rolls')?sum(db,'dice_rolls','length(CAST(entry AS BLOB))',room.id):{count:0,bytes:0};
      const diceLive=tables.has('dice_live')?sum(db,'dice_live','length(CAST(roll AS BLOB))',room.id):{count:0,bytes:0};
      const timeline=tables.has('timeline_entries')?sum(db,'timeline_entries','length(CAST(title AS BLOB))+length(CAST(body AS BLOB))',room.id):{count:0,bytes:0};
      const timelineVersions=tables.has('timeline_versions')?sum(db,'timeline_versions','length(CAST(snapshot AS BLOB))',room.id):{count:0,bytes:0};
      const stateBytes=Buffer.byteLength(room.state||'');
      return {roomId:room.id,stateBytes,timeline:{count:timeline.count,payloadBytes:timeline.bytes},timelineVersions:{count:timelineVersions.count,payloadBytes:timelineVersions.bytes},models:{count:models.count,payloadBytes:models.bytes,sourceBytes:modelSource},images:{count:images.count,payloadBytes:images.bytes},histories:{count:histories.count,payloadBytes:histories.bytes},records:{count:records.count,payloadBytes:records.bytes},structures:{count:structures.count,payloadBytes:structures.bytes},diceRolls:{count:diceRolls.count,payloadBytes:diceRolls.bytes},diceLive:{count:diceLive.count,payloadBytes:diceLive.bytes},sceneMedia:{count:sceneMedia.count,payloadBytes:sceneMedia.bytes},estimatedPayloadBytes:sceneMedia.bytes+timeline.bytes+timelineVersions.bytes+stateBytes+models.bytes+images.bytes+histories.bytes+records.bytes+structures.bytes+diceRolls.bytes+diceLive.bytes};
    });
    const counts=Object.fromEntries(Object.keys(DATABASE_TABLES).filter(table=>tables.has(table)).map(table=>[table,db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count]));
    const pageSize=db.prepare('PRAGMA page_size').get().page_size,pageCount=db.prepare('PRAGMA page_count').get().page_count,freePages=db.prepare('PRAGMA freelist_count').get().freelist_count;
    const report={formatVersion:1,checks:{quick,integrity,foreignKeyViolations,schemaCompatible},database:{userVersion,applicationId,pageSize,pageCount,freePages,mainFileBytes:fileBytes(path),walFileBytes:fileBytes(path+'-wal'),shmFileBytes:fileBytes(path+'-shm')},counts,rooms:roomUsage,totals:{roomCount:roomUsage.length,estimatedPayloadBytes:roomUsage.reduce((size,room)=>size+room.estimatedPayloadBytes,0)}};
    report.ok=quick.ok&&(integrity===null||integrity.ok)&&foreignKeyViolations===0&&schemaCompatible;
    return report;
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}
