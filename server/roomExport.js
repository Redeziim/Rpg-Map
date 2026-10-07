import {createHash,randomUUID} from 'node:crypto';
import {createWriteStream,createReadStream,rmSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {createRoomState} from './roomState.js';
import {canManageMap} from '../src/shared/mapPermissions.js';
import {canReadMapStroke} from '../src/shared/mapLayers.js';
import {isMapPointRevealed,isMapStrokeRevealed} from '../src/shared/mapFog.js';
import {visibleMapPositions} from '../src/shared/mapPositions.js';
import {visibleMapRoutes} from '../src/shared/mapExploration.js';
import {visibleCampaignScenes} from '../src/shared/campaignScenes.js';
import {projectTabletopReferences} from './tabletopReferences.js';
import {createExportWorkspace,defaultExportRoot} from './exportWorkspace.js';
import {projectDiceEntry} from './diceHistory.js';
import {projectCombat} from './combat.js';
import {createCampaignTimeline} from './campaignTimeline.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
const hash=value=>createHash('sha256').update(value).digest('hex');
const MAX_BYTES=1024*1024*1024,TTL=5*60*1000;

function projection(db,{roomId,user,viewMode}){
  const room=db.prepare('SELECT * FROM rooms WHERE id=?').get(roomId);
  const members=db.prepare('SELECT u.id,u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE room_id=? ORDER BY u.username').all(roomId);
  const role=members.find(member=>member.id===user.id)?.role,master=canManageMap(role,viewMode);
  const raw=JSON.parse(room.state);
  const state=pick(raw,Object.keys(createRoomState())),names=new Set(members.map(member=>member.username));
  state.combat=projectCombat(raw.combat,master);
  state.points=raw.points.filter(point=>master||isMapPointRevealed(raw.mapFog,point)).map(point=>pick(point,['id','name','description','type','x','y']));
  state.mapStrokes=raw.mapStrokes.filter(stroke=>canReadMapStroke(role,viewMode,stroke)&&(master||isMapStrokeRevealed(raw.mapFog,stroke)));
  state.mapPositions={enabled:raw.mapPositions.enabled,markers:visibleMapPositions(raw.mapPositions,members,master,raw.mapFog)};
  state.mapRoutes=visibleMapRoutes(raw.mapRoutes,master,raw.mapFog);
  state.campaignScenes=visibleCampaignScenes(raw.campaignScenes,state.points,master,raw.scenePresentation);
  state.statusBarsData=Object.fromEntries(Object.entries(raw.statusBarsData).filter(([name])=>names.has(name)));
  const groupBars=Object.fromEntries(members.map(member=>[member.username,{
    ...raw.statusBarsData[member.username],
    bars:[...raw.statusBarsData[member.username].bars,...raw.sheetFields.filter(field=>field.type==='status').map((field,index)=>({
      id:field.id,label:field.label,color:['#a84d51','#c8a65e','#ddd0b2'][index%3],...(raw.playerSheets[member.username]?.values[field.id]||{current:0,max:0}),
    }))],
  }]));
  const pointIds=new Set(state.points.map(point=>point.id));
  const cleanBoard=board=>({...pick(board,['width','height','edges','strokes']),nodes:board.nodes.map(node=>{
    const copy=pick(node,['id','kind','x','y','text','src','assetId','pointId','category','tags']);
    if(copy.pointId&&!pointIds.has(copy.pointId))delete copy.pointId;
    return copy;
  })});
  const cleanNote=note=>({...pick(note,['id','title','body','version']),sharedWith:note.sharedWith.filter(name=>names.has(name)),board:cleanBoard(note.board)});
  const notes=[];
  state.masterNotebooks=raw.masterNotebooks.filter(note=>master||note.sharedWith.includes(user.username)).map(note=>{notes.push({scope:'@master',note,manager:master});return cleanNote(note);});
  if(!master){delete state.masterNotes;delete state.masterNotebooks;}
  state.sharedNotebooks=[];
  if(!master)state.sharedNotebooks.push(...raw.masterNotebooks.filter(note=>note.sharedWith.includes(user.username)&&!note.trashed).map(note=>({...cleanNote(note),scope:'@master',owner:'Mestre'})));
  state.playerSheets=Object.fromEntries(Object.entries(raw.playerSheets).filter(([name])=>names.has(name)&&(master||name===user.username)).map(([name,sheet])=>{
    const own=name===user.username;
    const notebooks=sheet.notebooks.filter(note=>own||note.sharedWith.includes(user.username)&&!note.trashed).map(note=>{notes.push({scope:name,note,manager:own});return cleanNote(note);});
    return [name,{...pick(sheet,['values','extraFields']),observations:own?sheet.observations:'',notebooks}];
  }));
  // Shared notes from sheets outside the player's projection still belong in the export.
  for(const [name,sheet] of Object.entries(raw.playerSheets)){
    if(!names.has(name)||name===user.username)continue;
    for(const note of sheet.notebooks.filter(note=>note.sharedWith.includes(user.username)&&!note.trashed)){
      state.sharedNotebooks.push({...cleanNote(note),scope:name,owner:name});
      if(!master)notes.push({scope:name,note,manager:false});
    }
  }
  const assetIds=new Set(),histories=[];
  state.mapObjects=projectTabletopReferences(raw,{username:user.username,role,viewMode,members},{includeUnavailable:false});
  const addAssets=board=>board.nodes.forEach(node=>{if(node.assetId)assetIds.add(node.assetId);});
  for(const {scope,note,manager} of notes){
    addAssets(note.board);
    const versions=db.prepare('SELECT version,shared_with,asset_ids FROM note_versions WHERE room_id=? AND scope=? AND note_id=? ORDER BY version DESC').all(roomId,scope,note.id)
      .filter(row=>manager||JSON.parse(row.shared_with).includes(user.username));
    for(const row of versions)for(const id of JSON.parse(row.asset_ids))assetIds.add(id);
    histories.push({scope,noteId:note.id,versions,cleanBoard});
  }
  const noteAssets=db.prepare('SELECT id,owner_id,name,mime,bytes,created_at FROM note_assets WHERE room_id=? ORDER BY id').all(roomId).filter(asset=>asset.owner_id===user.id||assetIds.has(asset.id));
  const models=db.prepare('SELECT id FROM map_assets WHERE room_id=? ORDER BY id').all(roomId);
  const mediaIds=new Set(state.campaignScenes.map(scene=>scene.mediaId).filter(Boolean));
  const sceneMedia=db.prepare('SELECT id,name,mime,bytes FROM scene_media WHERE room_id=? ORDER BY id').all(roomId).filter(asset=>master||mediaIds.has(asset.id));
  const structures=db.prepare('SELECT id FROM dice_structures WHERE room_id=? ORDER BY id').all(roomId);
  const audit=master?db.prepare('SELECT * FROM room_audit WHERE room_id=? ORDER BY sequence DESC').all(roomId).map(row=>({sequence:row.sequence,actor:{id:row.actor_id,username:row.actor_username},action:row.action,details:JSON.parse(row.details),createdAt:row.created_at,revision:row.revision})):[];
  const diceHistory=db.prepare("SELECT entry FROM dice_rolls WHERE room_id=? AND (json_extract(entry,'$.visibility')='public' OR ?=1 OR user_id=?) ORDER BY created_at DESC,id DESC").all(roomId,role==='admin'?1:0,user.id).map(row=>projectDiceEntry(JSON.parse(row.entry),state.campaignScenes));
  // Reserved and archived entries leave the table only inside a master export; links follow the same projection as the state.
  const timeline=createCampaignTimeline(db).exportEntries(roomId,{master,pointIds:new Set(state.points.map(point=>point.id)),sceneIds:new Set(state.campaignScenes.map(scene=>scene.id))});
  return {room:pick(room,['id','name','revision']),members,state,groupBars,raw,master,histories,noteAssets,models,sceneMedia,structures,audit,diceHistory,timeline,role,
    counts:{points:state.points.length,notes:notes.length,versions:histories.reduce((n,h)=>n+h.versions.length,0),noteImages:noteAssets.length,models:models.length,scenes:state.campaignScenes.length,participants:members.length,audit:audit.length,diceRolls:diceHistory.length,timeline:timeline.length}};
}

export function createRoomExports({db,renderMapFog,exportRoot=defaultExportRoot()}){
  const jobs=new Map();let workspace,closed=false;
  const guard=roomId=>{
    const room=db.prepare('SELECT revision FROM rooms WHERE id=?').get(roomId);
    const members=db.prepare('SELECT user_id,role FROM members WHERE room_id=? ORDER BY user_id').all(roomId);
    const audit=db.prepare('SELECT MAX(sequence) AS sequence FROM room_audit WHERE room_id=?').get(roomId);
    return hash(JSON.stringify([room?.revision,members,audit.sequence]));
  };
  function remove(job){jobs.delete(job.id);job.controller.abort();job.stream?.destroy();if(job.path)rmSync(job.path,{force:true});}
  const timer=setInterval(()=>{for(const job of jobs.values())if(job.expiresAt<=Date.now())remove(job);},30000);timer.unref();
  function check(job,checkAccess){
    job.controller.signal.throwIfAborted();
    if(closed||job.expiresAt<=Date.now())fail(410,'O arquivo expirou. Prepare a exportação novamente.');
    const access=checkAccess();
    if(access.id!==job.userId||access.token_hash!==job.tokenHash)fail(404,'Exportação não encontrada.');
    if(guard(job.roomId)!==job.guard)fail(409,'A mesa mudou. Prepare um novo arquivo para usar os dados e as permissões atuais.');
  }
  async function write(job,value,checkAccess){
    const bytes=Buffer.from(value);job.bytes+=bytes.length;
    if(job.bytes>MAX_BYTES)fail(413,'A exportação ultrapassa 1 GB. Reduza os arquivos da mesa antes de tentar novamente.');
    for(let offset=0;offset<bytes.length;offset+=65536){
      check(job,checkAccess);
      if(!job.stream.write(bytes.subarray(offset,offset+65536)))await once(job.stream,'drain',{signal:job.controller.signal});
    }
  }
  function lookup(roomId,id,user){
    const job=jobs.get(id);
    if(!job||job.roomId!==roomId||job.userId!==user.id||job.tokenHash!==user.token_hash)fail(404,'Exportação não encontrada.');
    return job;
  }
  const metadata=job=>({id:job.id,downloadUrl:`/api/rooms/${job.roomId}/exports/${job.id}/download`,filename:job.filename,bytes:job.bytes,expiresAt:job.expiresAt,counts:job.counts,revision:job.revision,viewMode:job.viewMode});
  return {
    async prepare({roomId,user,viewMode,signal,checkAccess}){
      if(!['master','player'].includes(viewMode))fail(400,'Modo de exportação inválido.');
      for(const job of jobs.values())if(job.expiresAt<=Date.now())remove(job);
      if([...jobs.values()].some(job=>job.userId===user.id))fail(429,'Você já tem uma exportação em preparo ou disponível. Cancele-a antes de preparar outra.');
      if(jobs.size>=4)fail(503,'O servidor já está preparando outras cópias. Aguarde um momento e tente novamente.');
      const expectedGuard=guard(roomId),plan=projection(db,{roomId,user,viewMode});
      if(expectedGuard!==guard(roomId))fail(409,'A mesa mudou durante a leitura. Prepare a cópia novamente.');
      const job={id:randomUUID(),roomId,userId:user.id,tokenHash:user.token_hash,viewMode:plan.master?'master':'player',guard:expectedGuard,expiresAt:Date.now()+TTL,controller:new AbortController(),bytes:0,revision:plan.room.revision,counts:plan.counts};
      jobs.set(job.id,job);
      const abort=()=>job.controller.abort();signal.addEventListener('abort',abort,{once:true});
      try{
        signal.throwIfAborted();
        if(!plan.master&&plan.raw.mapFog.enabled&&plan.raw.mapImage){
          const image=await renderMapFog(`${roomId}:${hash(plan.raw.mapImage+JSON.stringify(plan.raw.mapFog))}`,plan.raw.mapImage,plan.raw.mapFog);
          plan.state.mapImage='data:image/png;base64,'+image.toString('base64');
        }
        check(job,checkAccess);
        workspace||=createExportWorkspace(exportRoot);
        job.path=join(workspace.directory,job.id+'.json');job.filename=`grimorio-mesa-${roomId}-${new Date().toISOString().slice(0,10)}.json`;
        job.stream=createWriteStream(job.path,{flags:'wx',mode:0o600});
        // Capture failures even while waiting on another resource or a backpressure drain.
        job.stream.on('error',()=>job.controller.abort());
        const w=value=>write(job,value,checkAccess);
        const header={format:'grimorio-room',formatVersion:1,exportedAt:Date.now(),viewer:{username:user.username,role:plan.role,viewMode:job.viewMode},room:{...plan.room,members:plan.members},state:plan.state,groupBars:plan.groupBars};
        await w(JSON.stringify(header).slice(0,-1)+',"noteHistory":[');
        for(let i=0;i<plan.histories.length;i++){
          const history=plan.histories[i];await w((i?',':'')+JSON.stringify({scope:history.scope,noteId:history.noteId}).slice(0,-1)+',"versions":[');
          for(let j=0;j<history.versions.length;j++){
            check(job,checkAccess);
            const row=db.prepare('SELECT * FROM note_versions WHERE room_id=? AND scope=? AND note_id=? AND version=?').get(roomId,history.scope,history.noteId,history.versions[j].version);
            const content=JSON.parse(row.content);
            await w((j?',':'')+JSON.stringify({title:row.title,body:content.body,board:history.cleanBoard(content.board),version:row.version,createdAt:row.created_at,author:row.author,kind:row.kind}));
          }
          await w(']}');
        }
        await w('],"assets":{"notes":[');
        for(let i=0;i<plan.noteAssets.length;i++){
          check(job,checkAccess);const asset=plan.noteAssets[i];
          const row=db.prepare('SELECT data FROM note_assets WHERE room_id=? AND id=?').get(roomId,asset.id);
          await w((i?',':'')+JSON.stringify({id:asset.id,name:asset.name,mime:asset.mime,createdAt:asset.created_at,data:`data:${asset.mime};base64,${Buffer.from(row.data).toString('base64')}`}));
        }
        await w('],"models":[');
        for(let i=0;i<plan.models.length;i++){
          check(job,checkAccess);const asset=plan.models[i],row=db.prepare('SELECT bundle FROM map_assets WHERE room_id=? AND id=?').get(roomId,asset.id);
          const bundle=JSON.parse(row.bundle);
          await w((i?',':'')+JSON.stringify({id:asset.id,...pick(bundle,['main','files','kind','bytes'])}));
        }
        await w('],"sceneMedia":[');
        for(let i=0;i<plan.sceneMedia.length;i++){
          check(job,checkAccess);const asset=plan.sceneMedia[i],row=db.prepare('SELECT data FROM scene_media WHERE room_id=? AND id=?').get(roomId,asset.id);
          await w((i?',':'')+JSON.stringify({...asset,data:`data:${asset.mime};base64,${Buffer.from(row.data).toString('base64')}`}));
        }
        await w('],"diceStructures":[');
        for(let i=0;i<plan.structures.length;i++){
          check(job,checkAccess);const row=db.prepare('SELECT id,name,mesh FROM dice_structures WHERE room_id=? AND id=?').get(roomId,plan.structures[i].id);
          await w((i?',':'')+JSON.stringify({...row,mesh:JSON.parse(row.mesh)}));
        }
        await w(']},"audit":'+JSON.stringify(plan.audit)+',"diceHistory":'+JSON.stringify(plan.diceHistory)+',"timeline":'+JSON.stringify(plan.timeline)+'}');
        const finished=once(job.stream,'finish',{signal:job.controller.signal});job.stream.end();await finished;
        job.stream=null;job.bytes=(await stat(job.path)).size;check(job,checkAccess);job.ready=true;
        return metadata(job);
      }catch(error){remove(job);throw error;}
      finally{signal.removeEventListener('abort',abort);}
    },
    status({roomId,id,user,checkAccess}){const job=lookup(roomId,id,user);try{check(job,checkAccess);}catch(error){remove(job);throw error;}if(!job.ready)fail(409,'O arquivo ainda está sendo preparado.');return metadata(job);},
    async download({roomId,id,user,checkAccess,res}){
      const job=lookup(roomId,id,user);
      try{check(job,checkAccess);}catch(error){remove(job);throw error;}
      if(!job.ready)fail(409,'O arquivo ainda está sendo preparado.');
      if((job.downloads||0)>=2)fail(429,'Aguarde o download atual terminar.');
      job.downloads=(job.downloads||0)+1;
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':job.bytes,'Content-Disposition':`attachment; filename="${job.filename}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      const verify=new Transform({transform(chunk,encoding,callback){try{check(job,checkAccess);callback(null,chunk);}catch(error){callback(error);}}});
      try{await pipeline(createReadStream(job.path),verify,res,{signal:job.controller.signal});}
      catch(error){remove(job);if(!res.destroyed)res.destroy(error);}
      finally{job.downloads--;if(!job.downloads)remove(job);}
    },
    cancel({roomId,id,user}){remove(lookup(roomId,id,user));},
    revokeSession(tokenHash){for(const job of jobs.values())if(job.tokenHash===tokenHash)remove(job);},
    close(){closed=true;clearInterval(timer);for(const job of jobs.values())remove(job);workspace?.close();},
  };
}
