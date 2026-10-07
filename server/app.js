import {tower} from './structurePhysics.js';
import {validateStructure} from './structures.js';
import {validateMapAsset,validateMapTransform} from './mapAssets.js';
import {readMapAssetRequest,sendMapAsset} from './mapAssetTransfer.js';
import {MAP_ASSET_MEDIA,mapAssetPlacement} from '../src/shared/mapAssetTransfer.js';
import {createModelValidator} from './modelValidation.js';
import {createMapImports} from './mapImports.js';
import {createDiceHistory,isPrivateRoll} from './diceHistory.js';
import {createCampaignTimeline} from './campaignTimeline.js';
import {createCombatOperations} from './combatOperations.js';
import {changeTabletopObjects} from './tabletopObjects.js';
import {assertLinkTarget,projectNoteBoard,projectTabletopReferences,resolveTabletopReference} from './tabletopReferences.js';
import {isLightingPreset} from '../src/shared/tabletopLighting.js';
import {assertCombat,changeCombat,reconcileCombat,projectCombat} from './combat.js';
import {imageSignatureMatches} from '../src/shared/imageSignature.js';
import {canAnnotateMap,canEraseMapStroke,canManageMap} from '../src/shared/mapPermissions.js';
import {isMapStrokeColor} from '../src/shared/mapStrokeColor.js';
import {canReadMapStroke,strokeVisibility} from '../src/shared/mapLayers.js';
import {emptyMapFog,revealMapArea,coverMapArea,isMapPointRevealed,isMapStrokeRevealed} from '../src/shared/mapFog.js';
import {mapImageDimensions,createMapFogRenderer} from './mapFog.js';
import {isMapScale} from '../src/shared/mapMeasurement.js';
import {emptyMapPositions,canShareMapPosition,isMapPosition,visibleMapPositions} from '../src/shared/mapPositions.js';
import {sceneFields,visibleCampaignScenes} from '../src/shared/campaignScenes.js';
import {readSceneMedia,mediaMetadata,changeScenePresentation,sendSceneMedia} from './sceneMedia.js';
import {emptyScenePresentation} from '../src/shared/scenePresentation.js';
import {createMapImageValidator} from './mapImages.js';
import {defaultMapLegend,isMapLegend,isMapRouteFields,visibleMapRoutes} from '../src/shared/mapExploration.js';
import { createTrayRoll } from './tray.js';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from './databaseMigrations.js';
import {createRoomState,newPlayerSheet,ensureRoomMemberState,emptyNoteBoard,assertRoomState} from './roomState.js';
import {createRoomMediaTransfer,roomImageSources} from './roomMedia.js';
import {isRoomImageReference,mapNoteBoardImages} from '../src/shared/roomMedia.js';
import {createRoomAuditStore,roomAuditChanges} from './roomAudit.js';
import {createRoomExports} from './roomExport.js';
import {createMaintenance} from './maintenance.js';
import {createDiagnostics} from './diagnostics.js';
import {defaultExportRoot,exportRootPath} from './exportWorkspace.js';
import {AUDIT_CATEGORIES} from '../src/shared/roomAudit.js';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
const scrypt = promisify(scryptCallback);
const digest = s => createHash('sha256').update(s).digest('hex');
const SESSION_MS = 7 * 86400000;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const safeKeys = x => {
  if (!x || typeof x !== 'object') return;
  for (const [k,v] of Object.entries(x)) {
    if (['__proto__','constructor','prototype'].includes(k)) fail(400,'Nome de campo inválido.');
    safeKeys(v);
  }
};
const string = (value, max, label, min=0) => {
  if(typeof value!=='string'||value.length<min||value.length>max) fail(400,`${label}: use entre ${min} e ${max} caracteres.`);
  return value;
};
const image = value => value===null || (typeof value==='string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value));
function validBoardImage(value){
  if(typeof value!=='string')return false;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length>Math.ceil(2*1024*1024*4/3)+2)return false;
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>2*1024*1024||bytes.toString('base64')!==match[2])return false;
  return imageSignatureMatches(`image/${match[1]}`,bytes);
}
const emptyBoard=emptyNoteBoard;
function noteBoard(value){
  if(!object(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges)||!Array.isArray(value.strokes))fail(400,'Quadro da nota inválido.');
  if(value.nodes.length>80||value.edges.length>120||value.strokes.length>150||JSON.stringify(value).length>6*1024*1024)fail(413,'Quadro muito grande. Reduza imagens e traços.');
  const width=value.width===undefined?960:value.width,height=value.height===undefined?620:value.height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<960||width>3840||height<620||height>2480)fail(400,'Dimensões do quadro inválidas.');
  const ids=new Set(),edgeIds=new Set(),strokeIds=new Set();
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
  for(const node of value.nodes){
    if(!object(node)||!validId(node.id)||ids.has(node.id)||!['text','image'].includes(node.kind)||!Number.isFinite(node.x)||!Number.isFinite(node.y)||node.x<0||node.x>width-220||node.y<0||node.y>height-150)fail(400,'Elemento do quadro inválido.');
    ids.add(node.id);
    if(typeof node.text!=='string'||node.text.length>500)fail(400,'Texto do quadro inválido.');
    if(node.category!==undefined&&!['person','place','scene','clue'].includes(node.category))fail(400,'Tipo de cartão inválido.');
    if(node.tags!==undefined&&(!Array.isArray(node.tags)||node.tags.length>8||node.tags.some(tag=>typeof tag!=='string'||tag!==tag.trim()||tag.length<1||tag.length>30)||new Set(node.tags.map(tag=>tag.toLocaleLowerCase('pt-BR'))).size!==node.tags.length))fail(400,'Use até 8 etiquetas diferentes de 1 a 30 caracteres.');
    if(node.pointId!==undefined&&!validId(node.pointId))fail(400,'Vínculo com ponto inválido.');
    if(node.kind==='image'&&!((node.assetId===undefined&&validBoardImage(node.src))||(node.src===undefined&&typeof node.assetId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(node.assetId))))fail(400,'Imagem do quadro inválida. Use uma imagem enviada ou PNG, JPEG ou WebP de até 2 MB.');
  }
  for(const edge of value.edges){
    if(!object(edge)||!validId(edge.id)||edgeIds.has(edge.id)||!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)fail(400,'Conexão do quadro inválida.');
    if(edge.label!==undefined&&(typeof edge.label!=='string'||edge.label!==edge.label.trim()||edge.label.length<1||edge.label.length>80))fail(400,'Rótulo da conexão inválido.');
    edgeIds.add(edge.id);
  }
  for(const stroke of value.strokes){
    if(!object(stroke)||!validId(stroke.id)||strokeIds.has(stroke.id)||typeof stroke.path!=='string'||stroke.path.length>15000||!/^[ML0-9.,\s-]+$/.test(stroke.path))fail(400,'Traço do quadro inválido.');
    strokeIds.add(stroke.id);
  }
  return {...value,width,height};
}
const initialState=createRoomState;
async function body(req,maxBytes=10*1024*1024) {
  if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Envie JSON.');
  let size=0,chunks=[];
  for await (const chunk of req) { size+=chunk.length;req.diagnosticBytes=size;if(size>maxBytes)fail(413,'Arquivo muito grande para esta operação.');chunks.push(chunk); }
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'JSON inválido.');}
  if(!object(value))fail(400,'Dados inválidos.');safeKeys(value);return value;
}

export function createApplication({dbPath=resolve('data/grimorio.sqlite'),distPath=resolve('dist'),production=false,publicOrigin='',rateLimit=true,heartbeatMs=20000,exportRoot=defaultExportRoot(),maintenanceBatchSize=100,maintenanceMaxExportDirs=16,maintenanceIntervalMs=30000,maintenanceLogger=(code,reason)=>console.warn(`Manutenção Grimório: ${code} (${reason})`),diagnosticsLogger=line=>console.info(line),modelValidationTimeoutMs=20000,modelValidationMaxWorkers=2}={}) {
  const modelValidator=createModelValidator({timeoutMs:modelValidationTimeoutMs,maxWorkers:modelValidationMaxWorkers});
  exportRoot=exportRootPath(exportRoot,{create:true});
  if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
  const db=new DatabaseSync(dbPath,{timeout:10000});
  let migration;
  try{migration=initializeDatabase(db);db.exec('PRAGMA journal_mode=WAL;');}catch(error){db.close();throw error;}
  const query=(sql,...params)=>db.prepare(sql).get(...params);
  const all=(sql,...params)=>db.prepare(sql).all(...params);
  const audit=createRoomAuditStore(db);
  const run=(sql,...params)=>db.prepare(sql).run(...params);
  // Callbacks are synchronous. Responses and live events are sent only after this returns.
  const transaction=fn=>{if(db.isTransaction)return fn();db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}};
  const clients=new Set(),limits=new Map(),renderMapFog=createMapFogRenderer(),validateMapImage=createMapImageValidator(),roomMedia=createRoomMediaTransfer();
  const diceHistory=createDiceHistory(db);
  const campaignTimeline=createCampaignTimeline(db);
  const combatOperations=createCombatOperations(db);
  const roomExports=createRoomExports({db,renderMapFog,exportRoot});
  const mapImports=createMapImports(db);
  const maintenance=createMaintenance({db,exportRoot,batchSize:maintenanceBatchSize,maxExportDirs:maintenanceMaxExportDirs,intervalMs:maintenanceIntervalMs,onIssue:maintenanceLogger});
  const diagnostics=createDiagnostics({logger:diagnosticsLogger});
  maintenance.start();
  const fogVersion=state=>digest((state.mapImage||'')+JSON.stringify(state.mapFog||emptyMapFog()));
  const fogImageVersion=state=>digest((state.mapImage||'')+fogVersion(state));
  const mapScaleVersion=state=>digest(digest(state.mapImage||'')+JSON.stringify(state.mapScale||null));
  const mapLegendVersion=state=>digest(JSON.stringify(state.mapLegend||defaultMapLegend()));
  const mapRouteVersion=(state,route)=>digest(digest(state.mapImage||'')+JSON.stringify(route));
  const positionSettingsVersion=state=>digest(digest(state.mapImage||'')+JSON.stringify([state.mapPositions?.enabled===true,state.mapPositions?.generation||'initial']));
  const ownPositionVersion=(state,userId)=>digest(positionSettingsVersion(state)+(state.mapPositions?.markers?.[userId]?.version||'none'));
  const mapObjectsVersion=state=>digest(JSON.stringify([state.mapObjects,state.mapGroups]));
  function limit(key,max){
    if(!rateLimit)return;
    const now=Date.now(),entry=limits.get(key);
    if(!entry||entry.until<now){limits.set(key,{count:1,until:now+60000});return;}
    if(++entry.count>max)fail(429,'Muitas tentativas. Aguarde um minuto.');
  }
  function auth(req){
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('grimorio_session='))?.slice(17);
    if(!token)fail(401,'Entre na sua conta.');
    const user=query('SELECT u.id,u.username,s.expires,s.token_hash FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?',digest(token),Date.now());
    if(!user)fail(401,'Sua sessão expirou. Entre novamente.');return user;
  }
  function membership(roomId,userId){
    const member=query('SELECT * FROM members WHERE room_id=? AND user_id=?',roomId,userId);
    if(!member)fail(403,'Você não participa desta mesa.');return member;
  }
  const privileged=m=>{if(!['master','admin'].includes(m.role))fail(403,'Esta ação é exclusiva do mestre ou ADM.');};
  const admin=m=>{if(m.role!=='admin')fail(403,'Somente o ADM pode fazer isso.');};
  function recordNoteVersion(roomId,scope,note,author=null,kind='baseline'){
    const board=note.board||emptyBoard(),content=JSON.stringify({title:note.title,body:note.body||'',board});
    const summary={characters:(note.body||'').length,nodes:board.nodes.length,edges:board.edges.length,strokes:board.strokes.length};
    const assets=[...new Set(board.nodes.map(node=>node.assetId).filter(Boolean))];
    run('INSERT OR IGNORE INTO note_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',roomId,scope,note.id,note.version||1,note.title,content,JSON.stringify(note.sharedWith||[]),JSON.stringify(assets),JSON.stringify(summary),author?Date.now():null,author,kind,Buffer.byteLength(content));
  }
  function pruneNoteVersions(roomId,scope,id){
    const rows=all('SELECT version,bytes FROM note_versions WHERE room_id=? AND scope=? AND note_id=? ORDER BY version DESC',roomId,scope,id);
    let bytes=0;
    rows.forEach((row,index)=>{bytes+=row.bytes;if(index>=30||index>=2&&bytes>20*1024*1024)run('DELETE FROM note_versions WHERE room_id=? AND scope=? AND note_id=? AND version=?',roomId,scope,id,row.version);});
  }
  function writeLegacyText(roomId,scope,container,text,author){
    const key=scope==='@master'?'masterNotebooks':'notebooks',field=scope==='@master'?'masterNotes':'observations';
    container[field]=text;
    const notes=container[key],index=notes.findIndex(note=>note.id==='legacy'),previous=notes[index];
    if((!previous&&!text)||previous?.body===text)return;
    if(!previous&&notes.length>=30)fail(400,'Limite de 30 notas por bloco.');
    if(previous&&!Number.isSafeInteger(previous.version+1))fail(409,'Limite de versão da nota atingido.');
    if(previous)recordNoteVersion(roomId,scope,previous);
    const note=previous?{...previous,body:text,version:previous.version+1}:{id:'legacy',title:scope==='@master'?'Notas do mestre':'Observações do jogador',body:text,board:emptyBoard(),sharedWith:[],version:1};
    if(previous)notes[index]=note;else notes.push(note);
    recordNoteVersion(roomId,scope,note,author,'save');pruneNoteVersions(roomId,scope,'legacy');
  }
  function visibleNoteAssetIds(roomId,userId){
    const view=snapshot(roomId,userId),state=view.state,username=query('SELECT username FROM users WHERE id=?',userId).username;
    const notes=[...(state.masterNotebooks||[]).map(note=>({...note,scope:'@master'})),...Object.entries(state.playerSheets||{}).flatMap(([scope,sheet])=>(sheet.notebooks||[]).map(note=>({...note,scope}))),...(state.sharedNotebooks||[])];
    const ids=new Set(notes.flatMap(note=>(note.board?.nodes||[]).map(node=>node.assetId).filter(Boolean)));
    for(const note of notes){
      const manager=view.role==='admin'||note.scope===username||note.scope==='@master'&&view.role==='master';
      if(!manager&&!note.sharedWith.includes(username))continue;
      for(const version of all('SELECT shared_with,asset_ids FROM note_versions WHERE room_id=? AND scope=? AND note_id=?',roomId,note.scope,note.id)){
        if(manager||JSON.parse(version.shared_with).includes(username))for(const id of JSON.parse(version.asset_ids))ids.add(id);
      }
    }
    return ids;
  }
  function canReadNoteAsset(asset,roomId,userId){return asset?.owner_id===userId||visibleNoteAssetIds(roomId,userId).has(asset?.id);}
  function snapshot(roomId,userId,viewMode){
    const m=membership(roomId,userId),room=query('SELECT * FROM rooms WHERE id=?',roomId);
    const members=all('SELECT u.id,u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE room_id=? ORDER BY u.username',roomId);
    const viewer=members.find(member=>member.id===userId)?.username;
    const state=JSON.parse(room.state);
    const master=canManageMap(m.role,viewMode),currentMapObjectsVersion=mapObjectsVersion(state);
    state.mapObjects=projectTabletopReferences(state,{username:viewer,role:m.role,viewMode,members});
    const currentFogVersion=fogVersion(state),mapImageVersion=digest(state.mapImage||''),currentScaleVersion=mapScaleVersion(state);
    const mapPositionSettingsVersion=positionSettingsVersion(state),ownMapPositionVersion=ownPositionVersion(state,userId);
    const positions=state.mapPositions||emptyMapPositions(),hasOwnMapPosition=positions.enabled&&m.role!=='master'&&!!positions.markers[userId];
    state.mapPositions={enabled:positions.enabled,markers:visibleMapPositions(positions,members,master,state.mapFog)};
    const usernames=new Set(members.map(u=>u.username));
    const groupBars=Object.fromEntries(members.map(u=>[u.username,{...(state.statusBarsData[u.username]||{avatar:null,bars:[]}),bars:[...(state.statusBarsData[u.username]?.bars||[]),...state.sheetFields.filter(f=>f.type==='status').map((f,i)=>({id:f.id,label:f.label,color:['#a84d51','#c8a65e','#ddd0b2'][i%3],...(state.playerSheets[u.username]?.values?.[f.id]||{current:0,max:0})}))]}]));
    state.sharedNotebooks=[
      ...state.masterNotebooks.filter(note=>note.sharedWith.includes(viewer)&&!master).map(note=>({...note,scope:'@master',owner:'Mestre'})),
      ...Object.entries(state.playerSheets).flatMap(([scope,sheet])=>scope===viewer||!usernames.has(scope)?[]:sheet.notebooks.filter(note=>note.sharedWith.includes(viewer)).map(note=>({...note,scope,owner:scope})))
    ];
    state.playerSheets=Object.fromEntries(Object.entries(state.playerSheets).filter(([name])=>usernames.has(name)&&(master||viewer===name)).map(([name,sheet])=>[name,{...sheet,observations:name===viewer?sheet.observations:'',notebooks:sheet.notebooks.filter(note=>name===viewer||note.sharedWith.includes(viewer))}]));
    state.statusBarsData=Object.fromEntries(Object.entries(state.statusBarsData).filter(([name])=>usernames.has(name)));
    state.combat=projectCombat(state.combat,master);
    if(!master){delete state.masterNotes;delete state.masterNotebooks;}
    state.mapStrokes=(state.mapStrokes||[]).filter(stroke=>canReadMapStroke(m.role,viewMode,stroke));
    if(!master&&state.mapFog?.enabled){
      state.points=(state.points||[]).filter(point=>isMapPointRevealed(state.mapFog,point));
      state.mapStrokes=state.mapStrokes.filter(stroke=>isMapStrokeRevealed(state.mapFog,stroke));
      state.mapImage=`/api/rooms/${roomId}/map-image?v=${fogImageVersion(state)}`;
    }
    state.campaignScenes=visibleCampaignScenes(state.campaignScenes,state.points||[],master,state.scenePresentation).map(scene=>({...scene,media:scene.mediaId?mediaMetadata(query('SELECT id,name,mime,bytes FROM scene_media WHERE room_id=? AND id=?',roomId,scene.mediaId)):null}));
    state.mapRoutes=visibleMapRoutes(state.mapRoutes,master,state.mapFog);
    const pointIds=new Set(state.points.map(point=>point.id)),cleanNote=note=>({...note,board:projectNoteBoard(note.board,pointIds)});
    if(state.masterNotebooks)state.masterNotebooks=state.masterNotebooks.map(cleanNote);
    state.sharedNotebooks=state.sharedNotebooks.map(cleanNote);
    for(const sheet of Object.values(state.playerSheets))sheet.notebooks=sheet.notebooks.map(cleanNote);
    const diceViewer={userId,username:viewer,admin:m.role==='admin'};const history=diceHistory.page(roomId,state.campaignScenes,null,diceViewer);
    return {id:room.id,name:room.name,ownerId:room.owner_id,role:m.role,revision:room.revision,mapViewMode:master?'master':'player',tabletopLightingVersion:digest(state.tabletopLighting),mapObjectsVersion:currentMapObjectsVersion,fogVersion:currentFogVersion,mapImageVersion,mapScaleVersion:currentScaleVersion,mapLegendVersion:mapLegendVersion(state),mapRouteVersions:Object.fromEntries(state.mapRoutes.map(route=>[route.id,digest(mapImageVersion+JSON.stringify(route))])),mapPositionSettingsVersion,ownMapPositionVersion,hasOwnMapPosition,pointsVersion:digest(JSON.stringify(state.points||[])),pointVersions:Object.fromEntries((state.points||[]).map(point=>[point.id,digest(JSON.stringify(point))])),members,state,groupBars,diceStructures:all('SELECT id,name FROM dice_structures WHERE room_id=?',roomId),trayRoll:diceHistory.latest(roomId,diceViewer),diceHistory:history.entries,diceHistoryHasMore:history.hasMore,timelineRevision:campaignTimeline.revision(roomId,master),serverTime:Date.now()};
  }
  function revoke(client,status){
    client.res.write(`event: revoked\ndata: ${JSON.stringify({status})}\n\n`);client.res.end();clients.delete(client);
  }
  function send(client,heartbeat=false){
    try{
      if(!query('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?',client.tokenHash,Date.now()))fail(401,'Sua sessão expirou.');
      if(heartbeat){membership(client.roomId,client.userId);client.res.write(': heartbeat\n\n');}
      else {
        let room=snapshot(client.roomId,client.userId,client.viewMode);
        const imageHash=digest(room.state.mapImage||'');
        if(client.mediaFormat){room=roomMedia.encode(room,client.userId,client.mediaVersion);client.mediaVersion=room.roomMedia.version;}
        if(client.mapImageHash===imageHash){delete room.state.mapImage;room.mapImageUnchanged=true;}
        else client.mapImageHash=imageHash;
        client.res.write(`event: room\ndata: ${JSON.stringify(room)}\n\n`);
      }
    }catch(error){
      if(error.status===401||error.status===403)revoke(client,error.status);
      else {client.diagnostic?.streamFailure(error);client.res.end();clients.delete(client);}
    }
  }
  const broadcast=roomId=>{for(const c of clients)if(c.roomId===roomId)send(c);};
  function saveState(roomId,state,actor){
    transaction(()=>{
      assertCombat(state.combat);
      state.combat=reconcileCombat(state.combat,all('SELECT u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username',roomId));
      assertRoomState(state);
      const json=JSON.stringify(state);if(Buffer.byteLength(json)>20*1024*1024)fail(413,'A mesa atingiu o limite de 20 MB. Reduza as imagens.');
      const before=actor?JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state):null;
      run('UPDATE rooms SET state=?,revision=revision+1 WHERE id=?',json,roomId);
      if(actor)for(const change of roomAuditChanges(before,state))audit.record(roomId,actor,change.action,change.details);
    });
  }
  function addMember(roomId,userId,role,actor,action='member.added'){
    if(query('SELECT 1 FROM members WHERE room_id=? AND user_id=?',roomId,userId))fail(409,'Esta pessoa já participa da mesa.');
    const username=query('SELECT username FROM users WHERE id=?',userId).username;
    transaction(()=>{
      run('INSERT INTO members VALUES(?,?,?)',roomId,userId,role);
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      ensureRoomMemberState(state,username);saveState(roomId,state);
      if(actor)audit.record(roomId,actor,action,{target:username,role});
    });
  }
  const timer=setInterval(()=>{
    for(const [key,v] of limits)if(v.until<Date.now())limits.delete(key);
    for(const client of clients)send(client,true);
  },heartbeatMs);timer.unref();
  function json(res,status,data){
    if(res.mediaFormat&&data?.state&&Array.isArray(data.members)&&typeof data.revision==='number')data=roomMedia.encode(data,res.mediaUserId,res.mediaVersion);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));
  }
  function assetResponse(req,res,mime,content,hash,vary='Cookie'){
    const etag=`"${hash}"`,headers={'Content-Type':mime,'Cache-Control':'private, no-cache, must-revalidate','Vary':vary,'ETag':etag};
    const matches=(req.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag);
    // Call only after session, membership and resource visibility have been checked.
    if(matches){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,{...headers,'Content-Length':Buffer.byteLength(content)});return res.end(content);
  }
  async function route(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    const url=new URL(req.url,'http://server'),path=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
    const mapView=()=>{
      const mode=url.searchParams.get('mapViewMode')??undefined;
      if(mode!==undefined&&!['player','master'].includes(mode))fail(400,'Modo do mapa inválido.');
      return mode;
    };
    if(path[0]!=='api'){
      if(!['GET','HEAD'].includes(method))fail(405,'Método inválido.');
      let file=resolve(distPath,'.'+url.pathname);
      if(!file.startsWith(resolve(distPath)+sep)&&file!==resolve(distPath))fail(403,'Caminho inválido.');
      if(!existsSync(file)||!statSync(file).isFile())file=resolve(distPath,'index.html');
      if(!existsSync(file))fail(404,'Execute npm run build para gerar o site.');
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});
      if(method==='HEAD')res.end();else createReadStream(file).pipe(res);return;
    }
    if(method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true});
    const ip=req.socket.remoteAddress || 'local';limit(`api:${ip}`,600);
    if(!['GET','HEAD'].includes(method)){
      const allowed=publicOrigin || `http://${req.headers.host}`;
      if(req.headers.origin && req.headers.origin!==allowed)fail(403,'Origem não autorizada.');
      if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Origem não autorizada.');
    }
    if(path[1]==='rooms'&&path[3]==='map-assets'&&method==='POST'&&path.length===4)return importMapAsset(req,res,path[2],mapView(),url.searchParams.get('importId'));
    if(path[1]==='rooms'&&path[3]==='scene-media'&&path.length===4&&method==='POST'){
      let uploader=auth(req);if(!canManageMap(membership(path[2],uploader.id).role,mapView()))fail(403,'Enviar mídia exige o modo mestre.');
      const file=await readSceneMedia(req,url.searchParams.get('name'));
      uploader=auth(req);if(!canManageMap(membership(path[2],uploader.id).role,mapView()))fail(403,'Seu acesso ao envio de mídia mudou.');
      const result=transaction(()=>{
        const existing=query('SELECT id,name,mime,bytes FROM scene_media WHERE room_id=? AND hash=?',path[2],file.hash);if(existing)return {asset:mediaMetadata(existing),status:200};
        const used=query('SELECT count(*) AS count,COALESCE(sum(bytes),0) AS bytes FROM scene_media WHERE room_id=?',path[2]);
        if(used.count>=100||used.bytes+file.bytes>500*1024*1024)fail(413,'Limite de 100 arquivos ou 500 MB por mesa. Exclua arquivos sem uso para liberar espaço.');
        const asset={id:randomUUID(),name:file.name,mime:file.mime,bytes:file.bytes};
        run('INSERT INTO scene_media VALUES(?,?,?,?,?,?,?,?)',asset.id,path[2],file.hash,file.name,file.mime,file.data,file.bytes,Date.now());return {asset,status:201};
      });return json(res,result.status,result.asset);
    }
    // Read the entire payload before checking current permissions; slow requests must not retain revoked access.
    if(path[3]==='map-assets'&&method==='POST'&&!canManageMap(membership(path[2],auth(req).id).role,mapView()))fail(403,'Importar modelos exige o modo mestre.');
    const binaryModel=path[3]==='map-assets'&&method==='POST'&&req.headers['content-type']?.split(';')[0]===MAP_ASSET_MEDIA;
    const requestBody=['POST','PATCH'].includes(method)&&url.pathname!=='/api/auth/logout'?(binaryModel?await readMapAssetRequest(req):await body(req,path[3]==='map-assets'?72*1024*1024:10*1024*1024)):{};
    if(path[1]==='auth'&&['login','register'].includes(path[2])&&method==='POST'){
      limit(`auth:${ip}`,12);const data=requestBody;
      const username=string(data.username,30,'Usuário',3).trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)||['constructor','prototype','__proto__'].includes(username))fail(400,'Use 3–30 letras sem acento, números, ponto, hífen ou sublinhado.');
      const password=string(data.password,128,'Senha',8);limit(`user:${username}`,12);
      let user=query('SELECT * FROM users WHERE username=?',username);
      if(path[2]==='register'){
        if(user)fail(409,'Esse nome de usuário já está em uso.');
        const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
        user={id:randomUUID(),username,password_hash:hash,salt};
      }else{
        const hash=await scrypt(password,user?.salt || 'invalid-user-salt',64);
        if(!user||!timingSafeEqual(hash,Buffer.from(user.password_hash,'hex')))fail(401,'Usuário ou senha incorretos.');
      }
      const token=randomBytes(32).toString('hex');
      transaction(()=>{
        if(path[2]==='register'){
          if(query('SELECT 1 FROM users WHERE username=?',username))fail(409,'Esse nome de usuário já está em uso.');
          run('INSERT INTO users VALUES(?,?,?,?)',user.id,username,user.password_hash,user.salt);
        }
        run('INSERT INTO sessions VALUES(?,?,?)',digest(token),user.id,Date.now()+SESSION_MS);
      });
      res.setHeader('Set-Cookie',`grimorio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS/1000}${production?'; Secure':''}`);
      return json(res,200,{id:user.id,username:user.username});
    }
    const user=auth(req);
    res.mediaFormat=req.headers['x-grimorio-media']==='1';res.mediaVersion=req.headers['x-grimorio-media-cache'];res.mediaUserId=user.id;
    if(url.pathname==='/api/auth/me'&&method==='GET')return json(res,200,{id:user.id,username:user.username});
    if(url.pathname==='/api/auth/logout'&&method==='POST'){
      run('DELETE FROM sessions WHERE token_hash=?',user.token_hash);roomExports.revokeSession(user.token_hash);res.setHeader('Set-Cookie',`grimorio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${production?'; Secure':''}`);
      for(const c of clients)if(c.tokenHash===user.token_hash)revoke(c,401);
      return json(res,200,{ok:true});
    }
    if(path[1]==='rooms'&&path.length===2){
      if(method==='GET')return json(res,200,all('SELECT r.id,r.name,m.role,(SELECT count(*) FROM members x WHERE x.room_id=r.id) AS memberCount FROM rooms r JOIN members m ON r.id=m.room_id WHERE m.user_id=? ORDER BY r.rowid DESC',user.id));
      if(method==='POST'){
        const data=requestBody,name=string(data.name,80,'Nome da mesa',1).trim();if(!name)fail(400,'Informe o nome da mesa.');
        if(query('SELECT count(*) AS n FROM rooms WHERE owner_id=?',user.id).n>=30)fail(400,'Limite de 30 mesas por conta.');
        const id=randomUUID();transaction(()=>{run('INSERT INTO rooms(id,name,owner_id,state) VALUES(?,?,?,?)',id,name,user.id,JSON.stringify(initialState()));addMember(id,user.id,'admin');audit.record(id,user,'room.created');});
        return json(res,201,snapshot(id,user.id));
      }
    }
    if(url.pathname==='/api/join'&&method==='POST'){
      limit(`join:${user.id}`,20);const data=requestBody;const code=string(data.code,100,'Código',10).trim();
      const invite=query('SELECT * FROM invites WHERE token_hash=? AND expires>?',digest(code),Date.now());if(!invite)fail(404,'Convite inválido, revogado ou expirado.');
      if(!query('SELECT 1 FROM members WHERE room_id=? AND user_id=?',invite.room_id,user.id))addMember(invite.room_id,user.id,invite.role,user,'member.joined');
      broadcast(invite.room_id);return json(res,200,snapshot(invite.room_id,user.id));
    }
    if(path[1]!=='rooms'||!path[2])fail(404,'Rota não encontrada.');
    const roomId=path[2],m=membership(roomId,user.id);
    let requestImages;
    const requestImage=value=>{
      if(!isRoomImageReference(value))return value;
      if(!res.mediaFormat)fail(400,'Referência de imagem inválida.');
      requestImages||=roomImageSources(snapshot(roomId,user.id,mapView())).images;
      const source=requestImages.get(value._roomImage);
      if(!source)fail(400,'Imagem de referência indisponível nesta visão. Confira a mesa ou envie a imagem novamente.');
      return source;
    };
    if(path.length===3&&method==='GET')return json(res,200,snapshot(roomId,user.id,mapView()));
    if(path[3]==='scene-media'){
      const master=canManageMap(m.role,mapView());
      if(path.length===4&&method==='GET'){
        if(!master)fail(403,'A biblioteca de arquivos exige o modo mestre.');
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),used=new Set(state.campaignScenes.map(scene=>scene.mediaId));
        return json(res,200,all('SELECT id,name,mime,bytes FROM scene_media WHERE room_id=? ORDER BY created_at DESC',roomId).map(row=>({...mediaMetadata(row),inUse:used.has(row.id)})));
      }
      if(path.length===5&&['GET','HEAD'].includes(method)){
        const row=query('SELECT id,name,mime,bytes,hash FROM scene_media WHERE room_id=? AND id=?',roomId,path[4]);
        if(!row||!master&&!snapshot(roomId,user.id,mapView()).state.campaignScenes.some(scene=>scene.mediaId===row.id))fail(404,'Arquivo indisponível nesta visão.');
        return sendSceneMedia(req,res,row,(start,length)=>Buffer.from(query('SELECT substr(data,?,?) AS data FROM scene_media WHERE room_id=? AND id=?',start+1,length,roomId,row.id).data));
      }
      if(path.length===5&&method==='DELETE'){
        if(!master)fail(403,'Excluir arquivos exige o modo mestre.');
        transaction(()=>{const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);if(state.campaignScenes.some(scene=>scene.mediaId===path[4]))fail(409,'Retire o arquivo das cenas, inclusive arquivadas, antes de excluí-lo.');run('DELETE FROM scene_media WHERE room_id=? AND id=?',roomId,path[4]);});return json(res,200,{ok:true});
      }
      fail(404,'Rota não encontrada.');
    }
    if(path[3]==='scene-presentation'&&path.length===4&&method==='POST'){
      if(!canManageMap(m.role,mapView()))fail(403,'Exibir cenas exige o modo mestre.');
      transaction(()=>{const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),next=changeScenePresentation(state,requestBody);if(next!==state.scenePresentation){state.scenePresentation=next;saveState(roomId,state,user);}});
      broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='audit'&&path.length===4&&method==='GET'){
      privileged(m);if(mapView()==='player')fail(403,'Consultar registros exige o modo mestre.');
      const before=url.searchParams.get('before'),rawLimit=url.searchParams.get('limit'),category=url.searchParams.get('category');
      const limit=rawLimit===null?50:Number(rawLimit);
      if(!Number.isSafeInteger(limit)||limit<1||limit>100||before!==null&&(!Number.isSafeInteger(Number(before))||Number(before)<1)||category!==null&&!Object.hasOwn(AUDIT_CATEGORIES,category))fail(400,'Filtro de registros inválido.');
      return json(res,200,audit.list(roomId,{before:before===null?undefined:Number(before),limit,category:category??undefined}));
    }
    if(path[3]==='campaign-scenes'){
      if(path.length===5&&method==='GET'){
        const scene=snapshot(roomId,user.id,mapView()).state.campaignScenes.find(scene=>scene.id===path[4]);
        if(!scene)fail(404,'Cena indisponível nesta visão.');return json(res,200,scene);
      }
      if(!canManageMap(m.role,mapView()))fail(403,'Alterar cenas exige o modo mestre e papel de mestre ou ADM.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),scenes=state.campaignScenes||[];
      const data=requestBody,creating=path.length===4&&method==='POST',editing=path.length===5&&method==='PATCH';
      if(!creating&&!editing)fail(404,'Rota não encontrada.');
      const allowed=creating?['id','title','body','pointIds','visibility','mediaId']:['title','body','pointIds','visibility','mediaId','archived','version'];
      if(Object.keys(data).some(key=>!allowed.includes(key)))fail(400,'Campo da cena inválido.');
      const id=creating?data.id:path[4];
      if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))fail(400,'Identificador de cena inválido.');
      const index=scenes.findIndex(scene=>scene.id===id),previous=scenes[index];
      if(editing&&!previous)fail(404,'Esta cena não está mais disponível. Seu rascunho foi mantido.');
      if(editing&&data.version!==previous.version)fail(409,'A cena mudou em outra tela. Revise antes de salvar.');
      const fields=sceneFields(previous);
      if('mediaId'in data){if(data.mediaId!==null&&(typeof data.mediaId!=='string'||!query('SELECT 1 FROM scene_media WHERE room_id=? AND id=?',roomId,data.mediaId)))fail(400,'Arquivo indisponível nesta mesa. Envie ou escolha o arquivo novamente.');fields.mediaId=data.mediaId;}
      if('title'in data||creating){fields.title=string(data.title,120,'Título da cena',1).trim();if(!fields.title)fail(400,'Dê um título à cena.');}
      if('body'in data||creating)fields.body=string(data.body,10000,'Texto da cena');
      if('visibility'in data){if(!['master','table'].includes(data.visibility))fail(400,'Visibilidade da cena inválida.');fields.visibility=data.visibility;}
      if('pointIds'in data){
        if(!Array.isArray(data.pointIds)||data.pointIds.length>30||new Set(data.pointIds).size!==data.pointIds.length||data.pointIds.some(id=>typeof id!=='string'||!state.points.some(point=>point.id===id)))fail(400,'Selecione até 30 pontos existentes desta mesa.');
        fields.pointIds=[...data.pointIds].sort();
      }
      if('archived'in data&&typeof data.archived!=='boolean')fail(400,'Opção de arquivo inválida.');
      if(creating&&previous){
        if(!previous.archived&&JSON.stringify(sceneFields(previous))===JSON.stringify(fields))return json(res,200,snapshot(roomId,user.id,mapView()));
        fail(409,'Esta cena já existe na mesa. Revise a versão salva.');
      }
      if(creating&&scenes.length>=100)fail(400,'Limite de 100 cenas por mesa.');
      const now=Date.now(),scene={...previous,...fields,id,archived:data.archived??previous?.archived??false,version:(previous?.version||0)+1,createdAt:previous?.createdAt||now,updatedAt:now,updatedBy:user.username};
      if(index<0)scenes.push(scene);else scenes[index]=scene;
      state.campaignScenes=scenes;
      if(state.scenePresentation.sceneId===id&&(scene.archived||scene.mediaId!==previous?.mediaId))state.scenePresentation={...emptyScenePresentation(),changedAt:Date.now(),version:state.scenePresentation.version+1};
      saveState(roomId,state,user);broadcast(roomId);return json(res,creating?201:200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-position-settings'&&path.length===4&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Liberar posições exige o modo mestre.');
      const {enabled,version}=requestBody;
      if(typeof enabled!=='boolean'||Object.keys(requestBody).some(key=>!['enabled','version'].includes(key)))fail(400,'Opção de posições inválida.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(version!==positionSettingsVersion(state))fail(409,'A opção de posições mudou. Confira a mesa e tente novamente.');
      if(!state.mapImage&&enabled)fail(400,'Envie uma imagem antes de liberar posições.');
      const previous=state.mapPositions||emptyMapPositions();
      if(previous.enabled===enabled)return json(res,200,snapshot(roomId,user.id,mapView()));
      state.mapPositions={enabled,markers:{},generation:randomUUID()};
      saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-position'&&path.length===4&&method==='PATCH'){
      const viewMode=mapView();
      if(!canShareMapPosition(m.role,viewMode))fail(403,'Você só pode compartilhar sua própria posição no modo jogador.');
      limit(`map-position:${user.id}`,60);
      const {position,version,settingsVersion}=requestBody;
      if(Object.keys(requestBody).some(key=>!['position','version','settingsVersion'].includes(key))||position!==null&&!isMapPosition(position))fail(400,'Posição inválida. Escolha um ponto dentro do mapa.');
      let state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      const check=()=>{
        if(!state.mapPositions?.enabled)fail(409,'As posições estão desativadas nesta mesa.');
        if(settingsVersion!==positionSettingsVersion(state))fail(409,'A opção da mesa ou a imagem mudou. Escolha novamente.');
        if(version!==ownPositionVersion(state,user.id))fail(409,'Sua posição mudou em outra tela. Revise antes de compartilhar.');
      };
      check();
      if(position!==null){
        if(!state.mapImage)fail(400,'O mapa ainda não está disponível.');
        let dimensions;try{dimensions=await mapImageDimensions(state.mapImage);}catch{fail(422,'Não foi possível abrir este mapa. Peça ao mestre para conferir a imagem.');}
        state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(!canShareMapPosition(membership(roomId,user.id).role,viewMode))fail(403,'Seu papel na mesa mudou.');
        check();
        if(position.x>=dimensions.width||position.y>=dimensions.height)fail(400,'Escolha um ponto dentro da imagem.');
        if(!isMapPointRevealed(state.mapFog,position))fail(403,'Compartilhe sua posição somente em áreas reveladas.');
        state.mapPositions.markers[user.id]={...position,version:randomUUID()};
      }else delete state.mapPositions.markers[user.id];
      saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-legend'&&path.length===4&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Editar a legenda exige o modo mestre.');
      const {legend,version}=requestBody;
      if(Object.keys(requestBody).some(key=>!['legend','version'].includes(key))||!isMapLegend(legend))fail(400,'Legenda inválida. Use nomes de 1 a 40 caracteres e cores para os cinco tipos.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(version!==mapLegendVersion(state))fail(409,'A legenda mudou em outra tela. Revise seus ajustes antes de salvar.');
      state.mapLegend=legend.map(entry=>({...entry,color:entry.color.toLowerCase()}));saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-routes'&&(['POST','PATCH'].includes(method))){
      if(!canManageMap(m.role,mapView()))fail(403,'Editar rotas exige o modo mestre.');
      limit(`map-routes:${user.id}`,60);
      const archive=path.length===6&&path[5]==='archive'&&method==='PATCH',create=path.length===4&&method==='POST',update=path.length===5&&method==='PATCH';
      if(!archive&&!create&&!update)fail(404,'Ação de rota não encontrada.');
      const {id,version,imageVersion,archived,...fields}=requestBody,routeId=create?id:path[4];
      if(typeof routeId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(routeId)||!create&&id!==undefined)fail(400,'Identificador de rota inválido.');
      if(archive?Object.keys(fields).length>0||typeof archived!=='boolean':archived!==undefined||!isMapRouteFields(fields))fail(400,'Rota inválida. Use nome, cor, visibilidade e de 2 a 100 paradas diferentes.');
      let state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      const check=()=>{
        if(!state.mapImage)fail(400,'Envie uma imagem antes de criar rotas.');
        if(imageVersion!==digest(state.mapImage))fail(409,'A imagem mudou. Confira o caminho no mapa atual.');
        const route=(state.mapRoutes||[]).find(route=>route.id===routeId);
        if(create){if(version!==undefined&&version!==null)fail(400,'Uma rota nova não deve ter versão.');if(route)fail(409,'Esta rota já existe. Revise a versão da mesa.');if((state.mapRoutes||[]).length>=100)fail(413,'Este mapa atingiu o limite de 100 rotas, incluindo arquivadas.');}
        else{if(!route)fail(404,'Esta rota não está mais neste mapa. Seus ajustes não foram publicados.');if(version!==mapRouteVersion(state,route))fail(409,'A rota mudou em outra tela. Revise seus ajustes antes de salvar.');if(!archive&&route.archived)fail(409,'Restaure a rota antes de editar seu caminho.');}
        return route;
      };
      check();
      if(!archive){
        let dimensions;try{dimensions=await mapImageDimensions(state.mapImage);}catch{fail(422,'Não foi possível abrir este mapa. Confira a imagem antes de traçar a rota.');}
        state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(!canManageMap(membership(roomId,user.id).role,mapView()))fail(403,'Seu papel na mesa mudou.');check();
        if(fields.waypoints.some(point=>point.x>=dimensions.width||point.y>=dimensions.height))fail(400,'Todas as paradas devem ficar dentro da imagem.');
      }
      const previous=check(),next=archive?{...previous,archived}:{...previous,...fields,id:routeId,archived:false,color:fields.color.toLowerCase()};
      state.mapRoutes=create?[...(state.mapRoutes||[]),next]:state.mapRoutes.map(route=>route.id===routeId?next:route);
      saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-scale'&&path.length===4&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Definir a escala exige o modo mestre.');
      const {scale,version}=requestBody;
      if(Object.keys(requestBody).some(key=>!['scale','version'].includes(key))||scale!==null&&!isMapScale(scale))fail(400,'Escala inválida. Confira tamanho, distância, unidade e alinhamento da grade.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(!state.mapImage)fail(400,'Envie uma imagem antes de definir a escala.');
      if(version!==mapScaleVersion(state))fail(409,'A escala mudou em outra tela. Revise os ajustes antes de salvar.');
      state.mapScale=scale;saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-image'&&path.length===4&&method==='GET'){
      limit(`map-image:${user.id}`,120);
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(!state.mapImage)fail(404,'Mapa não encontrado.');
      const version=fogImageVersion(state);
      let bytes,mime;
      if(!canManageMap(m.role,mapView())&&state.mapFog?.enabled){
        try{bytes=await renderMapFog(`${roomId}:${version}`,state.mapImage,state.mapFog);mime='image/png';}
        catch(error){if(error.status===503)fail(503,'O servidor está preparando outros mapas. Tente novamente em instantes.');fail(422,'Não foi possível abrir o mapa protegido. Peça ao mestre para enviar outra imagem.');}
      }else{
        const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(state.mapImage);
        if(!match)fail(422,'Imagem do mapa inválida.');
        mime=match[1];bytes=Buffer.from(match[2],'base64');
      }
      const currentMember=membership(roomId,user.id),currentState=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(currentMember.role!==m.role||fogImageVersion(currentState)!==version)fail(409,'O mapa mudou. Abra a versão atualizada.');
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});return res.end(bytes);
    }
    if(path[3]==='map-fog'&&path.length===4&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Alterar a névoa exige o modo mestre.');
      limit(`map-fog:${user.id}`,60);
      const {operation,area,version}=requestBody;
      if(Object.keys(requestBody).some(key=>!['operation','area','version'].includes(key))||!['enable','disable','reveal','cover','cover-all'].includes(operation))fail(400,'Alteração da névoa inválida.');
      let state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(!state.mapImage)fail(400,'Envie uma imagem antes de ativar a névoa.');
      if(version!==fogVersion(state))fail(409,'A névoa mudou em outra tela. Revise o mapa e tente novamente.');
      const imageBefore=state.mapImage;
      let fog=state.mapFog||emptyMapFog();
      if(operation==='enable'&&!fog.width){
        let dimensions;
        try{dimensions=await mapImageDimensions(state.mapImage);}catch{fail(422,'Não foi possível proteger esta imagem. Use PNG, JPEG, WebP ou GIF válido de até 32 milhões de pixels.');}
        state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(version!==fogVersion(state)||state.mapImage!==imageBefore)fail(409,'O mapa mudou durante a leitura. Revise e tente novamente.');
        if(!canManageMap(membership(roomId,user.id).role,mapView()))fail(403,'Alterar a névoa exige o modo mestre.');
        fog={...fog,...dimensions};
      }
      if(['enable','disable'].includes(operation)){
        if(area!==undefined)fail(400,'Esta ação não recebe uma área.');
        fog={...fog,enabled:operation==='enable'};
      }else{
        if(!fog.enabled)fail(400,'Ative a névoa antes de alterar áreas.');
        if(operation==='cover-all'){
          if(area!==undefined)fail(400,'Esta ação não recebe uma área.');
          fog={...fog,areas:[]};
        }else{
          if(!object(area)||Object.keys(area).sort().join(',')!=='height,width,x,y'||![area.x,area.y,area.width,area.height].every(Number.isInteger)||area.x<0||area.y<0||area.width<1||area.height<1||area.x+area.width>fog.width||area.y+area.height>fog.height)fail(400,'Área fora do mapa ou inválida.');
          const areas=operation==='reveal'?revealMapArea(fog.areas,area):coverMapArea(fog.areas,area);
          if(areas.length>200)fail(413,'Muitas áreas pequenas. Revele uma área maior para simplificar a névoa.');
          fog={...fog,areas};
        }
      }
      state.mapFog=fog;saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='feedback'&&path.length===4){
      if(method==='GET'){
        const visible=['master','admin'].includes(m.role)
          ?all('SELECT f.id,u.username,f.category,f.message,f.created_at AS createdAt FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.room_id=? ORDER BY f.created_at DESC LIMIT 30',roomId)
          :all('SELECT f.id,u.username,f.category,f.message,f.created_at AS createdAt FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.room_id=? AND f.user_id=? ORDER BY f.created_at DESC LIMIT 30',roomId,user.id);
        return json(res,200,visible);
      }
      if(method==='POST'){
        limit(`feedback:${user.id}`,10);
        const category=string(requestBody.category,20,'Tipo de feedback',1);
        if(!['suggestion','issue','other'].includes(category))fail(400,'Tipo de feedback inválido.');
        const message=string(requestBody.message,2000,'Feedback',10).trim();
        if(message.length<10)fail(400,'Escreva pelo menos 10 caracteres no feedback.');
        const entry={id:randomUUID(),username:user.username,category,message,createdAt:Date.now()};
        run('INSERT INTO feedback VALUES(?,?,?,?,?,?)',entry.id,roomId,user.id,category,message,entry.createdAt);
        return json(res,201,entry);
      }
    }
    if(path[3]==='exports'){
      const checkAccess=()=>{const current=auth(req);membership(roomId,current.id);return current;};
      if(method==='POST'&&path.length===4){
        if(Object.keys(requestBody).some(key=>key!=='viewMode'))fail(400,'Configuração de exportação inválida.');
        const controller=new AbortController(),abort=()=>controller.abort();
        res.on('close',abort);
        try{return json(res,201,await roomExports.prepare({roomId,user,viewMode:requestBody.viewMode,signal:controller.signal,checkAccess}));}
        catch(error){if(!res.destroyed)throw error;}
        finally{res.off('close',abort);}
      }
      if(path.length===5&&method==='GET')return json(res,200,roomExports.status({roomId,id:path[4],user,checkAccess}));
      if(path.length===6&&path[5]==='download'&&method==='GET')return roomExports.download({roomId,id:path[4],user,checkAccess,res});
      if(path.length===5&&method==='DELETE'){roomExports.cancel({roomId,id:path[4],user});return json(res,200,{ok:true});}
      fail(404,'Rota não encontrada.');
    }
    if(path[3]==='map-assets'){
      if(method==='GET'&&path[4]){
        const asset=query('SELECT bundle FROM map_assets WHERE id=? AND room_id=?',path[4],roomId);
        if(!asset)fail(404,'Modelo não encontrado.');
        if(req.headers.accept?.split(',').some(type=>type.trim()===MAP_ASSET_MEDIA)){
          const hash=digest(asset.bundle),controller=new AbortController(),abort=()=>controller.abort();res.once('close',abort);
          try{await modelValidator.validateSaved(asset.bundle,controller.signal,hash);}finally{res.off('close',abort);}
          if(res.destroyed||controller.signal.aborted)fail(499,'Carregamento cancelado.');
          return sendMapAsset(req,res,asset.bundle,hash,()=>{
            membership(roomId,auth(req).id);
            if(!query('SELECT 1 FROM map_assets WHERE id=? AND room_id=?',path[4],roomId))fail(404,'Modelo não encontrado.');
          });
        }
        return assetResponse(req,res,'application/json; charset=utf-8',asset.bundle,digest(asset.bundle),'Cookie, Accept');
      }
    }
    if(path[3]==='map-imports'){
      if(method==='POST'&&path.length===4){
        if(!canManageMap(m.role,mapView()))fail(403,'Importar modelos exige o modo mestre.');
        if(Object.keys(requestBody).length)fail(400,'Configuração da importação inválida.');limit(`map-prepare:${user.id}`,12);
        return json(res,201,mapImports.prepare(roomId,user.id));
      }
      if(method==='GET'&&path.length===5)return json(res,200,mapImports.status(roomId,user.id,path[4]));
      if(method==='DELETE'&&path.length===5)return json(res,200,mapImports.cancel(roomId,user.id,path[4]));
    }
    if(path[3]==='tabletop-lighting'&&path.length===4&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Alterar a luz da mesa exige o modo mestre.');
      if(Object.keys(requestBody).some(key=>!['preset','version'].includes(key))||!isLightingPreset(requestBody.preset))fail(400,'Escolha Padrão, Luz clara ou Luz baixa.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(requestBody.version!==digest(state.tabletopLighting))fail(409,'A iluminação mudou em outra tela. Confira a luz atual antes de escolher novamente.');
      if(state.tabletopLighting!==requestBody.preset){state.tabletopLighting=requestBody.preset;saveState(roomId,state,user);broadcast(roomId);}
      return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-object-actions'&&path.length===4&&method==='POST'){
      if(!canManageMap(m.role,mapView()))fail(403,'Editar objetos exige o modo mestre.');
      let result;transaction(()=>{
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(requestBody.version!==mapObjectsVersion(state))fail(409,'Os objetos mudaram em outra janela. Confira a mesa antes de tentar novamente.');
        if(requestBody.action==='link')assertLinkTarget(state,requestBody.reference,{username:user.username,role:m.role,viewMode:mapView(),members:all('SELECT u.username FROM users u JOIN members m ON u.id=m.user_id WHERE m.room_id=?',roomId)});
        result=changeTabletopObjects(state,requestBody);saveState(roomId,state,user);
        for(const assetId of result.removedAssetIds)if(!state.mapObjects.some(item=>item.assetId===assetId))run('DELETE FROM map_assets WHERE id=? AND room_id=?',assetId,roomId);
      });broadcast(roomId);return json(res,200,{...snapshot(roomId,user.id,mapView()),mapAction:{selectionIds:result.selectionIds}});
    }
    if(path[3]==='map-objects'&&path[5]==='references'&&path.length===7&&method==='GET'){
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),item=state.mapObjects.find(item=>item.id===path[4]),ref=item?.references.find(ref=>ref.id===path[6]);
      const target=ref&&resolveTabletopReference(state,ref,{username:user.username,role:m.role,viewMode:mapView(),members:all('SELECT u.username FROM users u JOIN members m ON u.id=m.user_id WHERE m.room_id=?',roomId)});
      if(!target)fail(404,'Destino indisponível nesta visão.');
      return json(res,200,{...snapshot(roomId,user.id,mapView()),referenceTarget:{kind:ref.kind,target}});
    }
    if(path[3]==='map-objects'&&path.length===5&&path[4]&&['PATCH','DELETE'].includes(method)){
      if(!canManageMap(m.role,mapView()))fail(403,'Editar modelos exige o modo mestre.');
      transaction(()=>{
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        const item=state.mapObjects?.find(o=>o.id===path[4]);if(!item)fail(404,'Objeto não encontrado.');
        const {expectedVersion,...patch}=requestBody;
        if(expectedVersion!==undefined&&expectedVersion!==item.version)fail(409,'O objeto mudou em outra janela. Confira a mesa antes de tentar novamente.');
        if(method==='PATCH'){
          const validated=validateMapTransform(patch),moves=['position','rotation','scale'].some(key=>key in validated);
          if(moves&&item.locked)fail(423,'Desbloqueie o objeto antes de mover, girar ou mudar o tamanho.');
          if(moves&&item.groupId)fail(409,'Transforme o grupo inteiro ou desagrupe antes de editar este objeto.');
          if(!Number.isSafeInteger(item.version+1))fail(409,'Limite de versão do objeto atingido.');Object.assign(item,validated);item.version++;
        }else {state.mapObjects=state.mapObjects.filter(o=>o.id!==item.id);state.mapGroups=state.mapGroups.filter(group=>state.mapObjects.some(object=>object.groupId===group.id));}
        saveState(roomId,state,user);if(method==='DELETE'&&!state.mapObjects.some(object=>object.assetId===item.assetId))run('DELETE FROM map_assets WHERE id=? AND room_id=?',item.assetId,roomId);
      });
      broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='events'&&method==='GET'){
      if([...clients].filter(c=>c.userId===user.id).length>=10)fail(429,'Muitas salas abertas. Feche algumas abas.');
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      const client={roomId,userId:user.id,tokenHash:user.token_hash,res,diagnostic:res.diagnostic,viewMode:mapView(),mediaFormat:url.searchParams.get('media')==='1'};clients.add(client);send(client);res.on('close',()=>clients.delete(client));return;
    }
    if(path[3]==='dice-history'&&method==='GET'&&path.length===4){
      const view=snapshot(roomId,user.id,mapView());
      return json(res,200,{...diceHistory.page(roomId,view.state.campaignScenes,url.searchParams.get('before'),{userId:user.id,username:user.username,admin:view.role==='admin'}),revision:view.revision});
    }
    if(path[3]==='timeline'){
      const mode=mapView(),master=canManageMap(m.role,mode);
      // Links shown to a reader are limited to what that reader can already see on the map and in the scenes.
      const access=()=>{const view=snapshot(roomId,user.id,mode);return {master,pointIds:new Set((view.state.points||[]).map(point=>point.id)),sceneIds:new Set(view.state.campaignScenes.map(scene=>scene.id))};};
      const changed=work=>{
        if(!master)fail(403,'Editar a linha do tempo exige o modo mestre.');
        limit(`timeline:${user.id}`,60);
        const result=transaction(()=>{
          if(!canManageMap(membership(roomId,user.id).role,mode))fail(403,'Seu papel na mesa mudou.');
          const done=work(access());
          if(done.repeated===false||done.changed===true){
            const revision=query('SELECT revision FROM rooms WHERE id=?',roomId).revision;
            if(!Number.isSafeInteger(revision+1))fail(409,'Limite de revisão da mesa atingido.');
            run('UPDATE rooms SET revision=revision+1 WHERE id=?',roomId);audit.record(roomId,user,'timeline.changed');
          }
          return done;
        });
        if(result.repeated===false||result.changed===true)broadcast(roomId);
        return result;
      };
      if(path.length===4&&method==='GET'){
        const raw=url.searchParams.get('before');let before=null;
        if(raw){const [date,createdAt,id,...extra]=raw.split(',');before={date,createdAt:Number(createdAt),id};if(extra.length||!/^\d+$/.test(createdAt||''))fail(400,'Página da campanha inválida.');}
        const kind=url.searchParams.get('kind')||'all';
        return json(res,200,campaignTimeline.page(roomId,{...access(),kind,archived:url.searchParams.get('archived')==='1',before,knownRevision:url.searchParams.get('revision')}));
      }
      if(path.length===4&&method==='POST'){
        const result=changed(known=>campaignTimeline.create(roomId,user,requestBody,known));
        return json(res,result.repeated?200:201,{entry:result.entry,revision:campaignTimeline.revision(roomId,true)});
      }
      if(path.length===5&&method==='GET')return json(res,200,{entry:campaignTimeline.get(roomId,path[4],access())});
      if(path.length===5&&method==='PATCH'){
        const result=changed(known=>campaignTimeline.update(roomId,user,path[4],requestBody,known));
        return json(res,200,{entry:result.entry,revision:campaignTimeline.revision(roomId,true)});
      }
      if(path.length===6&&path[5]==='versions'&&method==='GET'){
        if(!master)fail(403,'O histórico de versões exige o modo mestre.');
        return json(res,200,{versions:campaignTimeline.versions(roomId,path[4])});
      }
      if(path.length===6&&path[5]==='restore'&&method==='POST'){
        const result=changed(known=>campaignTimeline.restore(roomId,user,path[4],requestBody,known));
        return json(res,200,{entry:result.entry,revision:campaignTimeline.revision(roomId,true)});
      }
      fail(404,'Rota não encontrada.');
    }
    if(path[3]==='tray-rolls'&&method==='POST'&&path.length===4){
      const result=transaction(()=>{
        const operation=diceHistory.prepare(roomId,user.id,requestBody);
        if(operation.confirmed)return {repeated:true,receipt:operation.confirmed};
        const previous=diceHistory.latest(roomId);
        if(previous&&Date.now()<previous.startedAt+previous.duration)fail(409,'Aguarde os dados da mesa pararem.');
        limit(`tray:${user.id}`,30);
        const view=snapshot(roomId,user.id,mapView());
        if(requestBody.sceneId&&!view.state.campaignScenes.some(scene=>scene.id===requestBody.sceneId))fail(403,'Esta cena não está disponível para sua rolagem.');
        const roll=createTrayRoll(user.username,requestBody.terms,requestBody.skinId,requestBody.gesture,requestBody.physics);
        roll.structureId='tray';
        if(isPrivateRoll(requestBody))roll.private=true;
        return {receipt:diceHistory.record(view,user,requestBody,operation,roll,view.state.campaignScenes)};
      });
      if(!result.repeated)broadcast(roomId);
      return json(res,result.repeated?200:201,{...snapshot(roomId,user.id,mapView()),rollReceipt:result.receipt});
    }
    if(path[3]==='note-assets'){
      if(method==='GET'&&path.length===4){
        const visible=visibleNoteAssetIds(roomId,user.id);
        const assets=all('SELECT id,owner_id,name,mime,bytes,created_at FROM note_assets WHERE room_id=? ORDER BY created_at DESC',roomId)
          .filter(asset=>asset.owner_id===user.id||visible.has(asset.id))
          .map(({owner_id,created_at,...asset})=>({...asset,createdAt:created_at}));
        return json(res,200,assets);
      }
      if(method==='GET'&&path.length===5){
        const asset=query('SELECT id,owner_id,mime,data,bytes,hash FROM note_assets WHERE id=? AND room_id=?',path[4],roomId);
        if(!asset||!canReadNoteAsset(asset,roomId,user.id))fail(404,'Imagem não encontrada.');
        return assetResponse(req,res,asset.mime,Buffer.from(asset.data),asset.hash);
      }
      if(method==='POST'&&path.length===4){
        limit(`note-upload:${user.id}`,20);
        if(Object.keys(requestBody).some(field=>!['name','src'].includes(field)))fail(400,'Anexo inválido.');
        const name=string(requestBody.name,100,'Nome da imagem',1).trim();
        if(!name||!validBoardImage(requestBody.src))fail(400,'Use uma imagem PNG, JPEG ou WebP de até 2 MB.');
        const [,subtype,base64]=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(requestBody.src);
        const data=Buffer.from(base64,'base64'),hash=digest(data),mime=`image/${subtype}`;
        const existing=query('SELECT id,name,mime,bytes,created_at FROM note_assets WHERE room_id=? AND owner_id=? AND hash=?',roomId,user.id,hash);
        if(existing){const {created_at,...asset}=existing;return json(res,200,{...asset,createdAt:created_at});}
        const used=query('SELECT count(*) AS count,COALESCE(SUM(bytes),0) AS bytes FROM note_assets WHERE room_id=?',roomId);
        if(used.count>=200||used.bytes+data.length>100*1024*1024)fail(413,'A coleção da mesa chegou ao limite de 200 imagens ou 100 MB.');
        const id=randomUUID(),createdAt=Date.now();
        run('INSERT INTO note_assets VALUES(?,?,?,?,?,?,?,?,?)',id,roomId,user.id,hash,name,mime,data,data.length,createdAt);
        return json(res,201,{id,name,mime,bytes:data.length,createdAt});
      }
    }
    if(path[3]==='turn-operations'&&path.length===5&&method==='GET'){
      const operation=combatOperations.status(roomId,user.id,path[4],Number(url.searchParams.get('requestedAt')));
      return json(res,200,{...snapshot(roomId,user.id,mapView()),combatOperation:operation});
    }
    if(path[3]==='turns'&&path.length===4&&method==='POST'){
      if(!canManageMap(m.role,mapView()))fail(403,'Esta ação é exclusiva do mestre ou ADM em modo mestre.');
      let changed=false,operation;
      transaction(()=>{
        const prepared=combatOperations.prepare(roomId,user.id,requestBody);
        if(prepared.confirmed){operation=prepared.confirmed;return;}
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),combat=changeCombat(state.combat,prepared.command);
        if(combat!==state.combat){state.combat=combat;saveState(roomId,state,user);changed=true;}
        operation=combatOperations.confirm(roomId,user.id,prepared.operation,prepared.command,state.combat,changed);
      });
      if(changed)broadcast(roomId);return json(res,200,{...snapshot(roomId,user.id,mapView()),...(operation?{combatOperation:operation}:{})});
    }
    if(path[3]==='notes'&&path[4]&&path[5]&&['GET','PATCH'].includes(method)){
      const scope=path[4],id=string(path[5],100,'Identificador',1);
      if(!/^[a-zA-Z0-9-]+$/.test(id))fail(400,'Identificador de nota inválido.');
      const target=scope==='@master'?null:query('SELECT u.id FROM users u JOIN members m ON u.id=m.user_id WHERE m.room_id=? AND u.username=?',roomId,scope);
      if(scope!=='@master'&&!target)fail(404,'Jogador não encontrado nesta mesa.');
      const canManage=scope==='@master'?canManageMap(m.role,mapView()):target.id===user.id;
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      const container=scope==='@master'?state:state.playerSheets[scope];
      const key=scope==='@master'?'masterNotebooks':'notebooks';
      const notes=container[key];
      const index=notes.findIndex(n=>n.id===id);
      const previous=notes[index];
      if(!canManage&&(!previous||!previous.sharedWith?.includes(user.username)))fail(403,'Esta nota não foi compartilhada com você.');
      const version=previous?.version||1;
      const visiblePointIds=new Set(state.points.filter(point=>canManageMap(m.role,mapView())||isMapPointRevealed(state.mapFog,point)).map(point=>point.id));
      if(method==='GET'){
        if(path[6]!=='history'||![7,8].includes(path.length))fail(404,'Rota não encontrada.');
        if(!previous)fail(404,'Nota não encontrada.');
        const visible=row=>canManage||JSON.parse(row.shared_with).includes(user.username);
        if(path.length===7){
          const rows=all('SELECT version,title,shared_with,summary,created_at,author,kind FROM note_versions WHERE room_id=? AND scope=? AND note_id=? ORDER BY version DESC',roomId,scope,id).filter(visible);
          if(!rows.some(row=>row.version===version)){
            const board=previous.board||emptyBoard();
            rows.unshift({version,title:previous.title,summary:JSON.stringify({characters:(previous.body||'').length,nodes:board.nodes.length,edges:board.edges.length,strokes:board.strokes.length}),created_at:null,author:null,kind:'baseline'});
          }
          return json(res,200,{currentVersion:version,versions:rows.map(({shared_with,summary,created_at,...row})=>({...row,summary:JSON.parse(summary),createdAt:created_at}))});
        }
        const requested=Number(path[7]);
        if(!Number.isSafeInteger(requested)||requested<1)fail(400,'Versão inválida.');
        const row=query('SELECT * FROM note_versions WHERE room_id=? AND scope=? AND note_id=? AND version=?',roomId,scope,id,requested);
        if(row&&visible(row)){const content=JSON.parse(row.content);return json(res,200,{...content,board:projectNoteBoard(content.board||emptyBoard(),visiblePointIds),version:row.version,author:row.author,createdAt:row.created_at,kind:row.kind});}
        if(!row&&requested===version)return json(res,200,{title:previous.title,body:previous.body||'',board:projectNoteBoard(previous.board||emptyBoard(),visiblePointIds),version,author:null,createdAt:null,kind:'baseline'});
        fail(404,'Versão não encontrada ou indisponível para você.');
      }
      if(path[6]==='share'){
        if(path.length!==7||Object.keys(requestBody).some(field=>!['sharedWith','version'].includes(field)))fail(400,'Compartilhamento inválido.');
        if(!canManage)fail(403,'Somente o dono pode compartilhar esta nota.');
        if(!previous)fail(404,'Salve a nota antes de compartilhar.');
        if(requestBody.version!==version)fail(409,'A nota mudou em outra tela. Reabra o compartilhamento.');
        const sharedWith=requestBody.sharedWith;
        const members=all('SELECT u.username FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=?',roomId).map(row=>row.username);
        if(!Array.isArray(sharedWith)||sharedWith.length>30||new Set(sharedWith).size!==sharedWith.length||sharedWith.some(name=>typeof name!=='string'||name===scope||!members.includes(name)))fail(400,'Selecione participantes desta mesa.');
        transaction(()=>{
          recordNoteVersion(roomId,scope,previous);
          const next={...previous,sharedWith,version:version+1};notes[index]=next;container[key]=notes;
          saveState(roomId,state,user);recordNoteVersion(roomId,scope,next,user.username,'access');pruneNoteVersions(roomId,scope,id);
        });
        broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
      }
      if(path.length!==6||Object.keys(requestBody).some(field=>!['title','body','board','version'].includes(field)))fail(400,'Alteração de nota inválida.');
      if(index<0&&notes.length>=30)fail(400,'Limite de 30 notas por bloco.');
      if(previous&&requestBody.version!==version)fail(409,'A nota mudou em outra tela. Seu rascunho foi mantido; revise a versão atual antes de salvar.');
      if(!previous&&requestBody.version!==undefined)fail(409,'A nota foi criada em outra tela. Atualize a lista antes de salvar.');
      const title=string(requestBody.title,100,'Nome da nota',1).trim();
      if(!title)fail(400,'Dê um nome à nota.');
      const noteBody=string(requestBody.body,50000,'Texto da nota');
      const board=requestBody.board===undefined?(previous?.board||emptyBoard()):noteBoard(mapNoteBoardImages(requestBody.board,requestImage));
      // A filtered point binding is not a request to delete it when saving other note changes.
      if(requestBody.board!==undefined&&previous&&!canManageMap(m.role,mapView())){
        const priorNodes=new Map(previous.board.nodes.map(node=>[node.id,node]));
        board.nodes=board.nodes.map(node=>{const prior=priorNodes.get(node.id);return !node.pointId&&prior?.pointId&&!visiblePointIds.has(prior.pointId)?{...node,pointId:prior.pointId}:node;});
      }
      for(const node of board.nodes)if(node.kind==='image'&&node.assetId){
        const asset=query('SELECT id,owner_id FROM note_assets WHERE id=? AND room_id=?',node.assetId,roomId);
        if(!asset||!canReadNoteAsset(asset,roomId,user.id))fail(400,'Imagem de referência indisponível para esta nota.');
      }
      const note={id,title,body:noteBody,board,sharedWith:previous?.sharedWith||[],version:previous?version+1:1};
      if(index<0)notes.push(note);else notes[index]=note;
      container[key]=notes;
      if(id==='legacy')container[scope==='@master'?'masterNotes':'observations']=noteBody;
      transaction(()=>{
        if(previous)recordNoteVersion(roomId,scope,previous);
        saveState(roomId,state,user);recordNoteVersion(roomId,scope,note,user.username,'save');pruneNoteVersions(roomId,scope,id);
      });
      broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='points'&&path.length===5&&method==='PATCH'){
      if(!canManageMap(m.role,mapView()))fail(403,'Editar pontos exige o modo mestre e papel de mestre ou ADM.');
      const {version,...patch}=requestBody;
      if(!Object.keys(patch).length||Object.keys(patch).some(key=>!['name','description','type'].includes(key)))fail(400,'Campo do ponto inválido.');
      if('name'in patch){patch.name=string(patch.name,120,'Nome do ponto',1).trim();if(!patch.name)fail(400,'Informe o nome do ponto.');}
      if('description'in patch)string(patch.description,4000,'Descrição do ponto');
      if('type'in patch&&!['cidade','dungeon','taverna','floresta','evento'].includes(patch.type))fail(400,'Tipo do ponto inválido.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      const index=(state.points||[]).findIndex(point=>point.id===path[4]);
      if(index<0)fail(404,'Este ponto foi excluído da mesa. Seu rascunho continua aberto.');
      if(typeof version!=='string'||version!==digest(JSON.stringify(state.points[index])))fail(409,'Este ponto mudou em outra tela. Seu rascunho foi mantido; revise as alterações antes de salvar.');
      state.points[index]={...state.points[index],...patch};
      saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='state'&&method==='PATCH'){
      privileged(m);const {pointsVersion,mapImageVersion,...patch}=requestBody;const allowed=['points','mapImage','sheetFields','sheetFont','masterNotes'];
      if(Object.keys(patch).some(k=>!allowed.includes(k)))fail(400,'Campo de mesa inválido.');
      if(('points'in patch||'mapImage'in patch)&&!canManageMap(m.role,mapView()))fail(403,'Alterar pontos ou a imagem do mapa exige o modo mestre.');
      if('points'in patch && (!Array.isArray(patch.points)||patch.points.length>1000||patch.points.some(p=>!object(p)||typeof p.name!=='string'||p.name.length>120||!p.name.trim()||!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.description!==undefined&&(typeof p.description!=='string'||p.description.length>4000))||(p.type!==undefined&&!['cidade','dungeon','taverna','floresta','evento'].includes(p.type)))))fail(400,'Pontos inválidos.');
      if('mapImage'in patch){
        const before=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),version=digest(before.mapImage||'');
        if(mapImageVersion!==undefined&&mapImageVersion!==version)fail(409,'A imagem mudou durante a prévia. Confira o mapa atual antes de publicar.');
        patch.mapImage=requestImage(patch.mapImage);
        await validateMapImage(patch.mapImage);
        if(!canManageMap(membership(roomId,user.id).role,mapView()))fail(403,'Seu acesso ao mapa mudou. A imagem não foi publicada.');
        const fresh=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(version!==digest(fresh.mapImage||''))fail(409,'A imagem mudou durante a preparação. Confira a versão atual antes de publicar.');
      }else if(mapImageVersion!==undefined)fail(400,'Versão da imagem sem alteração de imagem.');
      if('sheetFields'in patch && (!Array.isArray(patch.sheetFields)||patch.sheetFields.length>200||patch.sheetFields.some(f=>!object(f)||typeof f.id!=='string'||typeof f.label!=='string'||!['text','number','textarea','image','list','checklist','formula','attack','status'].includes(f.type))))fail(400,'Modelo de ficha inválido.');
      if(patch.sheetFields){
        const ids=new Set();
        for(const field of patch.sheetFields){
          string(field.id,100,'Identificador',1);string(field.label,200,'Nome do campo',1);
          if(ids.has(field.id))fail(400,'Campos duplicados.');ids.add(field.id);
          if(field.tab!==undefined)string(field.tab,100,'Categoria');
          if(field.type==='formula')string(field.formula,1000,'Fórmula');
        }
      }
      if('sheetFont'in patch&&!['cinzel','medieval','uncial','fell','metamorphous','grenze'].includes(patch.sheetFont))fail(400,'Fonte inválida.');
      if('masterNotes'in patch)string(patch.masterNotes,50000,'Notas');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if('points'in patch){
        if(typeof pointsVersion!=='string'||pointsVersion!==digest(JSON.stringify(state.points||[])))fail(409,'Os pontos mudaram em outra tela. O mapa foi atualizado; revise e tente novamente.');
      }else if(pointsVersion!==undefined)fail(400,'Versão dos pontos sem alteração de pontos.');
      transaction(()=>{
        if('masterNotes'in patch)writeLegacyText(roomId,'@master',state,patch.masterNotes,user.username);
        saveState(roomId,{...state,...patch,...('mapImage'in patch?{mapStrokes:[],mapRoutes:[],mapFog:emptyMapFog(),mapScale:null,mapPositions:{...(state.mapPositions||emptyMapPositions()),markers:{},generation:randomUUID()}}:{})},user);
      });broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='map-strokes'){
      const viewMode=mapView();
      if(!canAnnotateMap(m.role))fail(403,'Você não pode desenhar neste mapa.');
      if(path.length===4&&method==='POST'){
        limit(`map-strokes:${user.id}`,120);
        if(Object.keys(requestBody).some(key=>!['id','path','color','author','visibility'].includes(key)))fail(400,'Traço inválido.');
        const visibility=requestBody.visibility??'table';
        if(!['table','master'].includes(visibility))fail(400,'Visibilidade do traço inválida.');
        if(visibility==='master'&&!canManageMap(m.role,viewMode))fail(403,'Traços privados exigem o modo mestre.');
        const strokePath=string(requestBody.path,12000,'Traço',5);
        if(!/^M (?:\d{1,5}(?:\.\d{1,2})? \d{1,5}(?:\.\d{1,2})?)(?: L \d{1,5}(?:\.\d{1,2})? \d{1,5}(?:\.\d{1,2})?)+$/.test(strokePath))fail(400,'Coordenadas do traço inválidas.');
        if(!isMapStrokeColor(requestBody.color))fail(400,'Use uma cor no formato #RRGGBB.');
        const strokeId=requestBody.id===undefined?randomUUID():string(requestBody.id,36,'Identificador do traço',36);
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strokeId))fail(400,'Identificador do traço inválido.');
        const author=requestBody.author===undefined?user.username:string(requestBody.author,30,'Autor do traço',3);
        if(author!==user.username){
          if(!canEraseMapStroke(m.role,user.username,author,viewMode))fail(403,'Você pode restaurar apenas seus próprios traços no modo jogador.');
          if(!query('SELECT 1 FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? AND u.username=?',roomId,author))fail(400,'Autor fora da mesa.');
        }
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        if(!state.mapImage)fail(400,'Carregue uma imagem do mapa antes de desenhar.');
        if(!canManageMap(m.role,viewMode)&&!isMapStrokeRevealed(state.mapFog,{path:strokePath}))fail(403,'Desenhe apenas dentro das áreas reveladas.');
        if((state.mapStrokes||[]).length>=300)fail(400,'O mapa atingiu o limite de 300 traços.');
        if((state.mapStrokes||[]).some(item=>item.id===strokeId))fail(409,'Este traço já existe no mapa.');
        state.mapStrokes=[...(state.mapStrokes||[]),{id:strokeId,path:strokePath,color:requestBody.color.toLowerCase(),author,visibility}];
        saveState(roomId,state,user);broadcast(roomId);return json(res,201,snapshot(roomId,user.id,mapView()));
      }
      if(path.length===5&&method==='PATCH'){
        if(!canManageMap(m.role,viewMode))fail(403,'Alterar a visibilidade exige o modo mestre.');
        if(Object.keys(requestBody).some(key=>!['visibility','previousVisibility'].includes(key))||!['table','master'].includes(requestBody.visibility)||!['table','master'].includes(requestBody.previousVisibility))fail(400,'Visibilidade do traço inválida.');
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),stroke=(state.mapStrokes||[]).find(item=>item.id===path[4]);
        if(!stroke)fail(404,'Traço não encontrado.');
        if(strokeVisibility(stroke)!==requestBody.previousVisibility)fail(409,'A visibilidade mudou em outra tela. Revise e tente novamente.');
        stroke.visibility=requestBody.visibility;
        saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
      }
      if(path.length===5&&method==='DELETE'){
        const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        const stroke=(state.mapStrokes||[]).find(item=>item.id===path[4]);
        if(!stroke||!canReadMapStroke(m.role,viewMode,stroke)||!canManageMap(m.role,viewMode)&&!isMapStrokeRevealed(state.mapFog,stroke))fail(404,'Traço não encontrado.');
        if(!canEraseMapStroke(m.role,user.username,stroke.author,viewMode))fail(403,'Você pode apagar apenas seus próprios traços no modo jogador.');
        state.mapStrokes=state.mapStrokes.filter(item=>item.id!==stroke.id);
        saveState(roomId,state,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
      }
    }
    if(['sheets','profiles'].includes(path[3])&&path[4]&&method==='PATCH'){
      const target=query('SELECT u.* FROM users u JOIN members m ON m.user_id=u.id WHERE m.room_id=? AND u.username=?',roomId,path[4]);
      if(!target)fail(404,'Jogador não encontrado nesta mesa.');
      if(m.role!=='admin'&&(m.role!=='player'||target.id!==user.id))fail(403,'Você pode editar apenas a sua ficha como jogador.');
      const patch=requestBody,state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(path[3]==='sheets'){
        if('observations'in patch&&target.id!==user.id)fail(403,'As notas pessoais só podem ser alteradas pelo dono ou por compartilhamento explícito.');
        if(Object.keys(patch).some(k=>!['values','observations'].includes(k)))fail(400,'Jogadores podem preencher campos e observações, sem alterar o modelo.');
        if('observations'in patch)string(patch.observations,50000,'Observações');
        if('values'in patch){
          if(!object(patch.values))fail(400,'Valores inválidos.');
          for(const [id,value] of Object.entries(patch.values)){
            const field=state.sheetFields.find(f=>f.id===id);if(!field)fail(400,'Campo fora do modelo da mesa.');
            if(field.type==='image'){patch.values[id]=requestImage(value);if(!image(patch.values[id]))fail(400,'Imagem inválida.');}
            if(['text','textarea'].includes(field.type)&&typeof value!=='string')fail(400,'Texto inválido.');
            if(field.type==='number'&&!(value===''||((typeof value==='string'||typeof value==='number')&&Number.isFinite(Number(value)))))fail(400,'Número inválido.');
            if(['list','checklist'].includes(field.type)&&!Array.isArray(value))fail(400,'Lista inválida.');
            if(field.type==='list'&&value.some(item=>typeof item!=='string'))fail(400,'Lista inválida.');
            if(field.type==='checklist'&&value.some(item=>!object(item)||typeof item.id!=='string'||typeof item.text!=='string'||typeof item.checked!=='boolean'))fail(400,'Lista marcável inválida.');
            if(field.type==='formula')fail(400,'Fórmulas são calculadas pelo modelo.');
            if(field.type==='status'&&(!object(value)||!Number.isFinite(value.max)||!Number.isFinite(value.current)||value.current<0||value.max<0||value.current>value.max))fail(400,'Recurso inválido.');
            if(field.type==='attack'&&(!object(value)||typeof value.damage!=='string'))fail(400,'Ataque inválido.');
          }
        }
        const previous=state.playerSheets[target.username]||newPlayerSheet();state.playerSheets[target.username]={...previous,...patch,values:{...previous.values,...patch.values}};
      }else{
        if(Object.keys(patch).some(k=>!['avatar','bars'].includes(k)))fail(400,'Perfil inválido.');
        if('avatar'in patch){patch.avatar=requestImage(patch.avatar);if(!image(patch.avatar))fail(400,'Imagem inválida.');}
        if('bars'in patch&&(!Array.isArray(patch.bars)||patch.bars.length>30||patch.bars.some(b=>!object(b)||typeof b.label!=='string'||!Number.isFinite(b.current)||!Number.isFinite(b.max)||b.max<0||b.current<0||b.current>b.max)))fail(400,'Barras inválidas.');
        state.statusBarsData[target.username]={...state.statusBarsData[target.username],...patch};
      }
      transaction(()=>{
        if(path[3]==='sheets'&&'observations'in patch)writeLegacyText(roomId,target.username,state.playerSheets[target.username],patch.observations,user.username);
        saveState(roomId,state,user);
      });broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
    }
    if(path[3]==='members'){
      if(method==='POST'){
        privileged(m);const data=requestBody,role=data.role||'player';
        if(!['player','master'].includes(role)||(m.role==='master'&&role!=='player'))fail(403,'Apenas o ADM pode nomear mestres.');
        const target=query('SELECT id FROM users WHERE username=?',string(data.username,30,'Usuário',3).toLowerCase().trim());if(!target)fail(404,'Conta não encontrada. Envie um convite para a pessoa se cadastrar.');
        addMember(roomId,target.id,role,user);broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
      }
      if(path[4]&&['PATCH','DELETE'].includes(method)){
        admin(m);
        transaction(()=>{
          const target=membership(roomId,path[4]);if(target.role==='admin')fail(400,'O criador da mesa permanece ADM.');
          if(method==='DELETE')run('DELETE FROM members WHERE room_id=? AND user_id=?',roomId,path[4]);
          else{const data=requestBody;if(!['player','master'].includes(data.role))fail(400,'Papel inválido.');run('UPDATE members SET role=? WHERE room_id=? AND user_id=?',data.role,roomId,path[4]);}
          const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
          if(method==='DELETE'||requestBody.role==='master')delete state.mapPositions.markers[path[4]];
          saveState(roomId,state,user);
          // Invitations granted by a removed or demoted member are no longer valid.
          if(method==='DELETE'||requestBody.role==='player')run('DELETE FROM invites WHERE room_id=? AND created_by=?',roomId,path[4]);
          const username=query('SELECT username FROM users WHERE id=?',path[4]).username;
          if(method==='DELETE'||target.role!==requestBody.role)audit.record(roomId,user,method==='DELETE'?'member.removed':'member.role',{target:username,fromRole:target.role,...(method==='PATCH'?{role:requestBody.role}:{})});
        });
        broadcast(roomId);return json(res,200,snapshot(roomId,user.id,mapView()));
      }
    }
    if(path[3]==='invites'){
      privileged(m);
      if(method==='GET')return json(res,200,all('SELECT id,role,expires FROM invites WHERE room_id=? AND expires>?',roomId,Date.now()).filter(i=>m.role==='admin'||i.role==='player'));
      if(method==='POST'){
        const data=requestBody,role=data.role||'player';if(!['master','player'].includes(role)||(m.role==='master'&&role!=='player'))fail(403,'Apenas o ADM pode convidar mestres.');
        if(query('SELECT count(*) AS n FROM invites WHERE room_id=? AND expires>?',roomId,Date.now()).n>=30)fail(400,'Revogue convites antigos antes de criar mais.');
        const code=randomBytes(18).toString('hex'),id=randomUUID(),expires=Date.now()+7*86400000;
        transaction(()=>{run('INSERT INTO invites VALUES(?,?,?,?,?,?)',id,roomId,digest(code),role,expires,user.id);audit.record(roomId,user,'invite.created',{role});});return json(res,201,{id,code,role,expires});
      }
      if(method==='DELETE'&&path[4]){
        const invitation=query('SELECT * FROM invites WHERE id=? AND room_id=?',path[4],roomId);if(!invitation)fail(404,'Convite não encontrado.');
        if(m.role!=='admin'&&invitation.role!=='player')fail(403,'Apenas o ADM pode revogar esse convite.');
        transaction(()=>{run('DELETE FROM invites WHERE id=?',path[4]);audit.record(roomId,user,'invite.revoked',{role:invitation.role});});return json(res,200,{ok:true});
      }
    }
    fail(404,'Rota não encontrada.');
  }
  async function importMapAsset(req,res,roomId,viewMode,importId){
    const user=auth(req);if(!canManageMap(membership(roomId,user.id).role,viewMode))fail(403,'Importar modelos exige o modo mestre.');
    limit(`map-upload:${user.id}`,12);
    if(importId!==null){
      if(!/^[a-f0-9-]{36}$/.test(importId))fail(400,'Identificador de importação inválido.');
      const receipt=mapImports.status(roomId,user.id,importId);
      if(receipt.phase==='confirmed'){req.resume();return json(res,200,{...snapshot(roomId,user.id,viewMode),import:receipt,modelValidation:{warnings:receipt.warnings}});}
      mapImports.begin(roomId,user.id,importId);
    }
    const controller=new AbortController(),abort=()=>{controller.abort();if(importId)mapImports.failed(importId,Object.assign(Error('Importação interrompida.'),{status:499}));};res.once('close',abort);
    const unwatch=importId?mapImports.watch(roomId,user.id,importId,()=>{controller.abort();if(!req.complete)req.destroy();}):()=>{};
    try{
      const requestBody=req.headers['content-type']?.split(';')[0]===MAP_ASSET_MEDIA?await readMapAssetRequest(req):await body(req,72*1024*1024);
      const placement=mapAssetPlacement(requestBody?.placement),bundle=validateMapAsset(requestBody),serialized=JSON.stringify(bundle);
      if(importId)mapImports.checking(roomId,user.id,importId);
      const modelValidation=await modelValidator.validate(bundle,controller.signal,digest(serialized));
      if(res.destroyed||controller.signal.aborted)fail(499,'Importação cancelada.');
      if(!canManageMap(membership(roomId,auth(req).id).role,viewMode))fail(403,'Importar modelos exige o modo mestre.');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state),objects=state.mapObjects||[];
      if(objects.length>=100)fail(400,'Limite de 100 objetos por mesa.');
      const used=query('SELECT COALESCE(SUM(bytes),0) AS size FROM map_assets WHERE room_id=?',roomId).size;
      if(used+bundle.bytes>300*1024*1024)fail(413,'Limite de 300 MB de modelos por mesa.');
      const id=randomUUID();state.mapObjects=[...objects,{id,assetId:id,name:bundle.main.split('/').pop().slice(0,120),version:1,locked:false,groupId:null,references:[],...placement}];
      transaction(()=>{
        run('INSERT INTO map_assets VALUES(?,?,?,?)',id,roomId,serialized,bundle.bytes);saveState(roomId,state,user);
        if(importId)mapImports.confirmed(roomId,user.id,importId,id,modelValidation.warnings);
      });
      broadcast(roomId);return json(res,201,{...snapshot(roomId,user.id,viewMode),modelValidation,...(importId?{import:mapImports.status(roomId,user.id,importId)}:{})});
    }catch(error){if(importId)mapImports.failed(importId,error);throw error;}
    finally{unwatch();res.off('close',abort);}
  }
  const server=createServer((req,res)=>{
    const diagnostic=diagnostics.observe(req,res);res.diagnostic=diagnostic;
    route(req,res).catch(e=>{
      diagnostic?.failed(e);
      if(res.headersSent)return res.end();
      json(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir a operação.',...(e.status&&e.details?{details:e.details}:{}),...(diagnostic?{requestId:diagnostic.requestId}:{})});
    });
  });
  return {server,db,migration,maintenance,diagnostics,close:()=>{
    mapImports.close();
    modelValidator.close();
    try{maintenance.stop();}catch(error){try{maintenanceLogger('maintenance-close',error.code||'failed');}catch{}}
    try{roomExports.close();}catch(error){try{maintenanceLogger('export-close',error.code||'failed');}catch{}}
    clearInterval(timer);for(const c of clients)c.res.end();server.close();db.close();
  }};
}
