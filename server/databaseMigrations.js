import {DATABASE_SCHEMA_V1_SQL,DATABASE_TABLES,DATABASE_EXPIRY_INDEXES,DATABASE_IMPORT_INDEX,DATABASE_DICE_INDEXES,DATABASE_COMBAT_INDEX,DATABASE_TIMELINE_INDEX,DATABASE_USER_VERSION,DATABASE_APPLICATION_ID,databaseSchemaIdentity} from './databaseSchema.js';
import {ROOM_STATE_VERSION,migrateRoomState} from './roomState.js';
import {assertRoomAudit} from './roomAudit.js';
import {assertSavedDiceHistory} from './diceHistory.js';
import {assertCombatOperations} from './combatOperations.js';
import {assertSavedSceneMedia} from './sceneMedia.js';
import {assertSavedTimeline} from './campaignTimeline.js';

export const SCHEMA_MIGRATIONS=Object.freeze([{version:1,name:'001-versioned-database',sql:DATABASE_SCHEMA_V1_SQL},{version:2,name:'002-room-audit',sql:DATABASE_TABLES.room_audit+';'},{version:3,name:'003-expiry-indexes',sql:Object.values(DATABASE_EXPIRY_INDEXES).join(';\n')+';'},{version:4,name:'004-model-import-receipts',sql:DATABASE_TABLES.map_imports+';'+DATABASE_IMPORT_INDEX+';'},{version:5,name:'005-dice-history',sql:['dice_rolls','dice_receipts','dice_live'].map(key=>DATABASE_TABLES[key]+';').join('\n')+Object.values(DATABASE_DICE_INDEXES).join(';\n')+';'},{version:6,name:'006-combat-confirmations',sql:DATABASE_TABLES.combat_operations+';'+DATABASE_COMBAT_INDEX+';'},{version:7,name:'007-scene-media',sql:DATABASE_TABLES.scene_media+';'},{version:8,name:'008-campaign-timeline',sql:DATABASE_TABLES.timeline_entries+';\n'+DATABASE_TABLES.timeline_versions+';\n'+DATABASE_TIMELINE_INDEX+';'}]);
export function assertMigrationLedger(db,{throughVersion=DATABASE_USER_VERSION}={}){
  const rows=db.prepare('SELECT version,name,applied_at FROM schema_migrations ORDER BY version').all();
  const expected=SCHEMA_MIGRATIONS.filter(item=>item.version<=throughVersion);
  if(rows.length!==expected.length||rows.some((row,index)=>row.version!==expected[index].version||row.name!==expected[index].name||!Number.isSafeInteger(row.applied_at)||row.applied_at<=0))throw Error('Histórico de migrações do banco incompleto ou incompatível.');
}
export function assertRoomMigrationLedger(db){
  let previous=null;const last=new Map();
  for(const row of db.prepare('SELECT m.*,r.revision AS current_revision,r.state AS current_state FROM room_state_migrations m LEFT JOIN rooms r ON r.id=m.room_id ORDER BY m.room_id,m.version').iterate()){
    if(!Number.isInteger(row.version)||row.version<1||row.version>ROOM_STATE_VERSION||!Number.isInteger(row.from_version)||row.from_version<0||row.from_version>=row.version||!Number.isSafeInteger(row.from_revision)||row.from_revision<0||row.to_revision!==row.from_revision+1||!Number.isSafeInteger(row.applied_at)||row.applied_at<=0||row.current_revision<row.to_revision||row.current_revision===null)throw Error('Histórico de migrações de mesa incompleto ou incompatível.');
    if(previous?.room_id===row.room_id&&(row.from_version!==previous.version||row.from_revision<previous.to_revision))throw Error('Histórico de migrações de mesa incompleto ou incompatível.');
    previous=row;last.set(row.room_id,row);
  }
  for(const row of last.values()){let state;try{state=JSON.parse(row.current_state);}catch{throw Error('JSON inválido no estado de uma mesa.');}if(state?.stateVersion!==row.version)throw Error('Histórico de migrações de mesa incompleto ou incompatível.');}
}
export function initializeDatabase(db){
  db.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
  // Keep the two version markers and schema in one read snapshot.
  db.exec('BEGIN');
  try{databaseSchemaIdentity(db,{allowEmpty:true});}finally{db.exec('ROLLBACK');}
  const result={schemaApplied:0,roomsMigrated:0};
  db.exec('BEGIN IMMEDIATE');
  try{
    // Re-read after the lock: another startup may have completed the migration.
    const identity=databaseSchemaIdentity(db,{allowEmpty:true});
    for(const migration of SCHEMA_MIGRATIONS.filter(item=>item.version>identity.userVersion)){
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(migration.version,migration.name,Date.now());
      db.exec(`PRAGMA user_version=${migration.version}; PRAGMA application_id=${DATABASE_APPLICATION_ID};`);
      result.schemaApplied++;
    }
    databaseSchemaIdentity(db);assertMigrationLedger(db);
    const checks=db.prepare('PRAGMA quick_check').all();
    if(checks.length!==1||checks[0].quick_check!=='ok')throw Error('Integridade inválida impede a migração do banco.');
    if(db.prepare('PRAGMA foreign_key_check').get())throw Error('Referências inválidas impedem a migração do banco.');
    const update=db.prepare('UPDATE rooms SET state=?,revision=? WHERE id=?');
    const record=db.prepare('INSERT INTO room_state_migrations VALUES(?,?,?,?,?,?)');
    for(const room of db.prepare('SELECT id,state,revision FROM rooms ORDER BY rowid').iterate()){
      let state;try{state=JSON.parse(room.state);}catch{throw Error('JSON inválido no estado de uma mesa. A migração não foi aplicada.');}
      if(!Number.isSafeInteger(room.revision)||room.revision<0)throw Error('Revisão de mesa inválida. A migração não foi aplicada.');
      const members=db.prepare('SELECT u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username').all(room.id),usernames=members.map(row=>row.username);
      const fromVersion=state?.stateVersion??0,next=migrateRoomState(state,{usernames,members});
      if(fromVersion<ROOM_STATE_VERSION){
        if(!Number.isSafeInteger(room.revision+1))throw Error('Limite de revisão de mesa atingido.');
        update.run(JSON.stringify(next),room.revision+1,room.id);
        record.run(room.id,ROOM_STATE_VERSION,fromVersion,room.revision,room.revision+1,Date.now());
        result.roomsMigrated++;
      }
    }
    assertRoomMigrationLedger(db);assertRoomAudit(db);assertSavedDiceHistory(db);assertCombatOperations(db);assertSavedSceneMedia(db);assertSavedTimeline(db);
    if(db.prepare('PRAGMA user_version').get().user_version!==DATABASE_USER_VERSION)throw Error('Migração do banco incompleta.');
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return result;
}
