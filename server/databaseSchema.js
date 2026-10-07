import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

export const DATABASE_USER_VERSION = 7;
export const DATABASE_APPLICATION_ID = 0x4752494d; // GRIM
export const LEGACY_DATABASE_TABLES = Object.freeze({
  users: 'CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL)',
  sessions: 'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL)',
  rooms: 'CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)',
  members: "CREATE TABLE IF NOT EXISTS members(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('admin','master','player')),PRIMARY KEY(room_id,user_id))",
  dice_structures: 'CREATE TABLE IF NOT EXISTS dice_structures(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),name TEXT NOT NULL,mesh TEXT NOT NULL)',
  map_assets: 'CREATE TABLE IF NOT EXISTS map_assets(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),bundle TEXT NOT NULL,bytes INTEGER NOT NULL)',
  note_assets: 'CREATE TABLE IF NOT EXISTS note_assets(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),owner_id TEXT NOT NULL REFERENCES users(id),hash TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(room_id,owner_id,hash))',
  note_versions: 'CREATE TABLE IF NOT EXISTS note_versions(room_id TEXT NOT NULL REFERENCES rooms(id),scope TEXT NOT NULL,note_id TEXT NOT NULL,version INTEGER NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,shared_with TEXT NOT NULL,asset_ids TEXT NOT NULL,summary TEXT NOT NULL,created_at INTEGER,author TEXT,kind TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(room_id,scope,note_id,version))',
  invites: "CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('master','player')),expires INTEGER NOT NULL,created_by TEXT NOT NULL REFERENCES users(id))",
  feedback: 'CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),category TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL)',
});
export const DATABASE_V1_TABLES = Object.freeze({
  ...LEGACY_DATABASE_TABLES,
  schema_migrations: 'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at INTEGER NOT NULL)',
  room_state_migrations: 'CREATE TABLE IF NOT EXISTS room_state_migrations(room_id TEXT NOT NULL REFERENCES rooms(id),version INTEGER NOT NULL,from_version INTEGER NOT NULL,from_revision INTEGER NOT NULL,to_revision INTEGER NOT NULL,applied_at INTEGER NOT NULL,PRIMARY KEY(room_id,version))',
});
export const DATABASE_V2_TABLES = Object.freeze({
  ...DATABASE_V1_TABLES,
  room_audit: 'CREATE TABLE IF NOT EXISTS room_audit(room_id TEXT NOT NULL REFERENCES rooms(id),sequence INTEGER NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),actor_username TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at INTEGER NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(room_id,sequence))',
});
export const DATABASE_V4_TABLES = Object.freeze({
  ...DATABASE_V2_TABLES,
  map_imports: "CREATE TABLE IF NOT EXISTS map_imports(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),phase TEXT NOT NULL CHECK(phase IN ('prepared','uploading','checking','confirmed','cancelled','failed')),created_at INTEGER NOT NULL,deadline INTEGER NOT NULL,expires INTEGER NOT NULL,result TEXT NOT NULL)",
});
export const DATABASE_V5_TABLES = Object.freeze({
  ...DATABASE_V4_TABLES,
  dice_rolls: 'CREATE TABLE IF NOT EXISTS dice_rolls(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,entry TEXT NOT NULL)',
  dice_receipts: 'CREATE TABLE IF NOT EXISTS dice_receipts(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),operation_id TEXT NOT NULL,requested_at INTEGER NOT NULL,request_hash TEXT NOT NULL,roll_id TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(room_id,user_id,operation_id))',
  dice_live: 'CREATE TABLE IF NOT EXISTS dice_live(room_id TEXT PRIMARY KEY REFERENCES rooms(id),roll TEXT NOT NULL)',
});
export const DATABASE_V6_TABLES = Object.freeze({
  ...DATABASE_V5_TABLES,
  combat_operations: 'CREATE TABLE IF NOT EXISTS combat_operations(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),operation_id TEXT NOT NULL,requested_at INTEGER NOT NULL,request_hash TEXT NOT NULL,action TEXT NOT NULL,result_version INTEGER NOT NULL,changed INTEGER NOT NULL CHECK(changed IN (0,1)),expires INTEGER NOT NULL,PRIMARY KEY(room_id,user_id,operation_id))',
});
export const DATABASE_TABLES = Object.freeze({...DATABASE_V6_TABLES,
  scene_media: 'CREATE TABLE IF NOT EXISTS scene_media(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),hash TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(room_id,hash))',
});
export const DATABASE_EXPIRY_INDEXES = Object.freeze({
  idx_sessions_expires: 'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)',
  idx_invites_expires: 'CREATE INDEX IF NOT EXISTS idx_invites_expires ON invites(expires)',
});
export const DATABASE_IMPORT_INDEX='CREATE INDEX IF NOT EXISTS idx_map_imports_expires ON map_imports(expires)';
export const DATABASE_DICE_INDEXES=Object.freeze({
  idx_dice_rolls_room: 'CREATE INDEX IF NOT EXISTS idx_dice_rolls_room ON dice_rolls(room_id,created_at,id)',
  idx_dice_receipts_expires: 'CREATE INDEX IF NOT EXISTS idx_dice_receipts_expires ON dice_receipts(expires)',
});
export const DATABASE_COMBAT_INDEX='CREATE INDEX IF NOT EXISTS idx_combat_operations_expires ON combat_operations(expires)';
export const DATABASE_SCHEMA_V1_SQL = Object.values(DATABASE_V1_TABLES).join(';\n') + ';';
export const DATABASE_SCHEMA_SQL = [...Object.values(DATABASE_TABLES),...Object.values(DATABASE_EXPIRY_INDEXES),DATABASE_IMPORT_INDEX,...Object.values(DATABASE_DICE_INDEXES),DATABASE_COMBAT_INDEX].join(';\n') + ';';
const normalizeSQL=sql=>sql.replace(/\s+/g,' ').replace(/\s*([(),])\s*/g,'$1').trim();
const schemaRows=db=>db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY name").all().map(row=>({...row,sql:normalizeSQL(row.sql||'')}));
let expectedSchema;
function expectedTables(){
  if(!expectedSchema){
    const db=new DatabaseSync(':memory:');
    try{db.exec(DATABASE_SCHEMA_SQL);expectedSchema=new Map(schemaRows(db).map(row=>[row.name,row]));}finally{db.close();}
  }
  return expectedSchema;
}
export function databaseSchemaIdentity(db,{allowEmpty=false}={}){
  const userVersion=db.prepare('PRAGMA user_version').get().user_version,applicationId=db.prepare('PRAGMA application_id').get().application_id;
  const legacy=userVersion===0&&applicationId===0;
  if(!legacy&&(![1,2,3,4,5,6,DATABASE_USER_VERSION].includes(userVersion)||applicationId!==DATABASE_APPLICATION_ID))throw Error('Versão de banco não suportada por esta aplicação. Use a versão correspondente do projeto.');
  const rows=schemaRows(db),names=new Set(rows.map(row=>row.name)),expected=expectedTables();
  if(allowEmpty&&legacy&&!rows.length)return {userVersion,applicationId,schemaKind:'empty',schemaFingerprint:createHash('sha256').update('[]').digest('hex'),missingTables:Object.keys(DATABASE_TABLES)};
  const definitions=legacy?LEGACY_DATABASE_TABLES:userVersion===1?DATABASE_V1_TABLES:userVersion===2?DATABASE_V2_TABLES:userVersion===3?{...DATABASE_V2_TABLES,...DATABASE_EXPIRY_INDEXES}:{...(userVersion===4?DATABASE_V4_TABLES:userVersion===5?DATABASE_V5_TABLES:userVersion===6?DATABASE_V6_TABLES:DATABASE_TABLES),...DATABASE_EXPIRY_INDEXES,idx_map_imports_expires:DATABASE_IMPORT_INDEX,...(userVersion>=5?DATABASE_DICE_INDEXES:{}),...(userVersion>=6?{idx_combat_operations_expires:DATABASE_COMBAT_INDEX}:{})},optional=legacy?new Set(['note_assets','note_versions','feedback']):new Set();
  if(rows.some(row=>!Object.hasOwn(definitions,row.name)||expected.get(row.name)?.sql!==row.sql||expected.get(row.name)?.type!==row.type)||Object.keys(definitions).some(name=>!optional.has(name)&&!names.has(name)))throw Error('Esquema SQLite desconhecido ou incompatível com o Grimório.');
  if(legacy&&names.has('note_versions')&&!names.has('note_assets'))throw Error('Esquema incompleto: histórico de notas sem a biblioteca de imagens.');
  const missingTables=[...optional].filter(name=>!names.has(name));
  return {userVersion,applicationId,schemaKind:legacy?(missingTables.length?'legacy-unversioned':'current-unversioned'):'current-versioned',schemaFingerprint:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),missingTables};
}
