import {DATABASE_SCHEMA_V1_SQL,DATABASE_TABLES,DATABASE_EXPIRY_INDEXES,DATABASE_USER_VERSION,DATABASE_APPLICATION_ID,databaseSchemaIdentity} from './databaseSchema.js';
import {ROOM_STATE_VERSION,migrateRoomState} from './roomState.js';
import {assertRoomAudit} from './roomAudit.js';

export const SCHEMA_MIGRATIONS=Object.freeze([{version:1,name:'001-versioned-database',sql:DATABASE_SCHEMA_V1_SQL},{version:2,name:'002-room-audit',sql:DATABASE_TABLES.room_audit+';'},{version:3,name:'003-expiry-indexes',sql:Object.values(DATABASE_EXPIRY_INDEXES).join(';\n')+';'}]);
export function assertMigrationLedger(db,{throughVersion=DATABASE_USER_VERSION}={}){
  const rows=db.prepare('SELECT version,name,applied_at FROM schema_migrations ORDER BY version').all();
  const expected=SCHEMA_MIGRATIONS.filter(item=>item.version<=throughVersion);
  if(rows.length!==expected.length||rows.some((row,index)=>row.version!==expected[index].version||row.name!==expected[index].name||!Number.isSafeInteger(row.applied_at)||row.applied_at<=0))throw Error('Histórico de migrações do banco incompleto ou incompatível.');
}
export function assertRoomMigrationLedger(db){
  for(const row of db.prepare('SELECT m.*,r.revision AS current_revision FROM room_state_migrations m LEFT JOIN rooms r ON r.id=m.room_id').iterate()){
    if(row.version!==ROOM_STATE_VERSION||row.from_version!==0||!Number.isSafeInteger(row.from_revision)||row.from_revision<0||row.to_revision!==row.from_revision+1||!Number.isSafeInteger(row.applied_at)||row.applied_at<=0||row.current_revision<row.to_revision||row.current_revision===null)throw Error('Histórico de migrações de mesa incompleto ou incompatível.');
  }
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
      const usernames=db.prepare('SELECT u.username FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=?').all(room.id).map(row=>row.username);
      const fromVersion=state?.stateVersion??0,next=migrateRoomState(state,{usernames});
      if(fromVersion<ROOM_STATE_VERSION){
        if(!Number.isSafeInteger(room.revision+1))throw Error('Limite de revisão de mesa atingido.');
        update.run(JSON.stringify(next),room.revision+1,room.id);
        record.run(room.id,ROOM_STATE_VERSION,fromVersion,room.revision,room.revision+1,Date.now());
        result.roomsMigrated++;
      }
    }
    assertRoomMigrationLedger(db);assertRoomAudit(db);
    if(db.prepare('PRAGMA user_version').get().user_version!==DATABASE_USER_VERSION)throw Error('Migração do banco incompleta.');
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return result;
}
