import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const DICE_HISTORY_LIMIT=500,DICE_RECEIPT_TTL=7*86400000;
const PAGE_SIZE=20;
const identifier=value=>typeof value==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
const expression=terms=>terms.map((term,index)=>`${index?(term.sign<0?' − ':' + '):term.sign<0?'−':''}${term.qty}d${term.sides}`).join('');
export function assertDiceEntry(entry){
  if(!entry||entry.schemaVersion!==1||!identifier(entry.id)||typeof entry.author!=='string'||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<=0||!['tray','sheet','group'].includes(entry.origin)||!['public','private'].includes(entry.visibility)||!Array.isArray(entry.parts)||entry.parts.length<1||entry.parts.length>6||typeof entry.cocked!=='boolean')throw Error('Registro de rolagem inválido.');
  for(const part of entry.parts)if(![4,6,8,10,12,20,100].includes(part.sides)||!Number.isInteger(part.qty)||part.qty<1||part.qty>20||![1,-1].includes(part.sign)||!Array.isArray(part.rolls)||part.rolls.length!==part.qty||part.rolls.some(value=>!Number.isInteger(value)||value<1||value>part.sides))throw Error('Resultados de rolagem inválidos.');
  const total=entry.parts.reduce((sum,part)=>sum+part.sign*part.rolls.reduce((a,b)=>a+b,0),0);
  if(entry.expression!==expression(entry.parts)||entry.total!==(entry.cocked?null:total)||typeof entry.context?.roomName!=='string'||!entry.context.combat||!Number.isSafeInteger(entry.context.combat.round)||entry.context.combat.round<0||!(entry.context.combat.activeId===null||typeof entry.context.combat.activeId==='string')||!(entry.context.scene===null||typeof entry.context.scene?.id==='string'&&typeof entry.context.scene?.title==='string'))throw Error('Contexto ou total de rolagem inválido.');
  return entry;
}
export function projectDiceEntry(entry,scenes){
  // A recorded scene remains subject to its current visibility, including fog.
  return {...entry,context:{...entry.context,scene:entry.context.scene&&scenes.some(scene=>scene.id===entry.context.scene.id)?entry.context.scene:null}};
}
export function assertSavedDiceHistory(db){
  for(const row of db.prepare('SELECT d.*,u.username FROM dice_rolls d JOIN users u ON u.id=d.user_id').iterate()){
    let entry;try{entry=assertDiceEntry(JSON.parse(row.entry));}catch{throw Error('Histórico de rolagem inválido.');}
    if(entry.id!==row.id||entry.author!==row.username||entry.createdAt!==row.created_at)throw Error('Autoria ou identidade de rolagem inválida.');
  }
  for(const row of db.prepare('SELECT * FROM dice_receipts').iterate())if(!identifier(row.operation_id)||!identifier(row.roll_id)||!Number.isSafeInteger(row.requested_at)||row.requested_at<=0||!Number.isSafeInteger(row.expires)||row.expires<=row.requested_at||!/^[a-f\d]{64}$/.test(row.request_hash))throw Error('Confirmação de rolagem inválida.');
  for(const row of db.prepare('SELECT l.*,d.entry FROM dice_live l LEFT JOIN dice_rolls d ON d.room_id=l.room_id AND d.id=json_extract(l.roll,\'$.id\')').iterate()){
    let roll,entry;try{roll=JSON.parse(row.roll);entry=JSON.parse(row.entry);}catch{throw Error('Última rolagem inválida.');}
    if(!entry||roll.id!==entry.id||roll.username!==entry.author||roll.total!==entry.total||!!roll.cocked!==entry.cocked||!isDeepStrictEqual(roll.parts,entry.parts)||!Number.isSafeInteger(roll.startedAt)||roll.startedAt<=0||!Number.isFinite(roll.duration)||roll.duration<=0||roll.structureId!=='tray'||!Array.isArray(roll.dice)||!Array.isArray(roll.frames)||roll.frames.length<2)throw Error('Última rolagem incompatível com o histórico.');
  }
}
// Padrão de privacidade (decisão de 2026-10-07): só a rolagem feita na mesa (origem "group") é pública; as demais são privadas.
// Uma marca explícita (true/false) sempre vence o padrão.
export const isPrivateRoll=body=>typeof body.private==='boolean'?body.private:(body.origin??'tray')!=='group';
// Rolagem privada: lida por quem rolou e pelo ADM da mesa. O leitor é {userId,username,admin}.
export const canReadPrivate=(viewer,author)=>!!viewer&&(viewer.admin===true||viewer.username===author);
export function createDiceHistory(db){
  const receipt=db.prepare('SELECT * FROM dice_receipts WHERE room_id=? AND user_id=? AND operation_id=?');
  const latest=db.prepare('SELECT roll FROM dice_live WHERE room_id=?');
  const ordered=db.prepare('SELECT entry FROM dice_rolls WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT ?');
  return {
    prepare(roomId,userId,body){
      const keys=new Set(['operationId','requestedAt','terms','skinId','gesture','physics','structureId','origin','sceneId','private']);
      if(Object.keys(body).some(key=>!keys.has(key)))fail(400,'Campo de rolagem desconhecido.');
      if(body.structureId&&body.structureId!=='tray')fail(400,'As rolagens usam apenas a bandeja.');
      if(body.private!==undefined&&typeof body.private!=='boolean')fail(400,'A visibilidade da rolagem deve ser verdadeira ou falsa.');
      if(body.origin!==undefined&&!['tray','sheet','group'].includes(body.origin))fail(400,'Origem de rolagem inválida.');
      if(body.sceneId!==undefined&&body.sceneId!==null&&(typeof body.sceneId!=='string'||body.sceneId.length>100))fail(400,'Cena de rolagem inválida.');
      const legacy=body.operationId===undefined&&body.requestedAt===undefined,operationId=legacy?randomUUID():body.operationId,requestedAt=legacy?Date.now():body.requestedAt;
      if(!identifier(operationId)||!Number.isSafeInteger(requestedAt))fail(400,'Identidade do lançamento inválida.');
      const requestHash=createHash('sha256').update(JSON.stringify({private:isPrivateRoll(body),terms:Array.isArray(body.terms)?body.terms.map(term=>({sides:term?.sides,qty:term?.qty,sign:term?.sign})):body.terms,skinId:body.skinId??null,gesture:body.gesture?['x','z','vx','vz'].map(key=>body.gesture[key]):null,physics:body.physics?Object.keys(body.physics).sort().map(key=>[key,body.physics[key]]):null,origin:body.origin||'tray',sceneId:body.sceneId||null})).digest('hex');
      const previous=receipt.get(roomId,userId,operationId),now=Date.now();
      if(previous){
        if(previous.requested_at!==requestedAt||previous.request_hash!==requestHash)fail(409,'Este lançamento já foi enviado com outros dados. Confira o histórico.');
        if(previous.expires<=now)fail(410,'A confirmação deste lançamento expirou. Confira o histórico antes de iniciar outro.');
        return {confirmed:{id:previous.roll_id,operationId}};
      }
      if(requestedAt<now-120000||requestedAt>now+60000)fail(410,'Este lançamento expirou. Guarde os dados e prepare uma nova jogada.');
      return {operationId,requestedAt,requestHash};
    },
    // Sem leitor, devolve a última rolagem bruta (uso interno do servidor). Com leitor, esconde rolagem privada de quem não pode ler.
    latest(roomId,viewer){const row=latest.get(roomId);if(!row)return null;const roll=JSON.parse(row.roll);return viewer&&roll.private&&!canReadPrivate(viewer,roll.username)?null:roll;},
    record(room,user,body,operation,roll,scenes){
      const scene=body.sceneId?scenes.find(scene=>scene.id===body.sceneId):null;
      if(body.sceneId&&!scene)fail(403,'Esta cena não está disponível para sua rolagem.');
      const entry=assertDiceEntry({schemaVersion:1,id:roll.id,author:user.username,createdAt:Date.now(),expression:expression(roll.parts),parts:roll.parts,total:roll.total,cocked:!!roll.cocked,origin:body.origin||'tray',visibility:isPrivateRoll(body)?'private':'public',context:{roomName:room.name,scene:scene?{id:scene.id,title:scene.title}:null,combat:{version:room.state.combat.version,activeId:room.state.combat.activeId,round:room.state.combat.round}}});
      db.prepare('INSERT INTO dice_rolls VALUES(?,?,?,?,?)').run(roll.id,room.id,user.id,entry.createdAt,JSON.stringify(entry));
      db.prepare('INSERT INTO dice_receipts VALUES(?,?,?,?,?,?,?)').run(room.id,user.id,operation.operationId,operation.requestedAt,operation.requestHash,roll.id,Date.now()+DICE_RECEIPT_TTL);
      db.prepare('INSERT INTO dice_live VALUES(?,?) ON CONFLICT(room_id) DO UPDATE SET roll=excluded.roll').run(room.id,JSON.stringify(roll));
      db.prepare('DELETE FROM dice_rolls WHERE room_id=? AND id NOT IN (SELECT id FROM dice_rolls WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT ?)').run(room.id,room.id,DICE_HISTORY_LIMIT);
      const revision=db.prepare('SELECT revision FROM rooms WHERE id=?').get(room.id).revision;
      if(!Number.isSafeInteger(revision+1))fail(409,'Limite de revisão da mesa atingido.');
      db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(room.id);
      return {id:roll.id,operationId:operation.operationId};
    },
    page(roomId,scenes,before=null,viewer=null){
      let rows;const admin=viewer?.admin===true?1:0,userId=viewer?.userId??'',visible="(json_extract(entry,'$.visibility')='public' OR ?=1 OR user_id=?)";
      if(before){
        const cursor=db.prepare('SELECT created_at,id FROM dice_rolls WHERE room_id=? AND id=?').get(roomId,before);
        if(!cursor)fail(409,'O histórico mudou. Reabra para carregar os registros disponíveis.');
        rows=db.prepare(`SELECT entry FROM dice_rolls WHERE room_id=? AND (created_at<? OR (created_at=? AND id<?)) AND ${visible} ORDER BY created_at DESC,id DESC LIMIT ?`).all(roomId,cursor.created_at,cursor.created_at,cursor.id,admin,userId,PAGE_SIZE+1);
      }else rows=db.prepare(`SELECT entry FROM dice_rolls WHERE room_id=? AND ${visible} ORDER BY created_at DESC,id DESC LIMIT ?`).all(roomId,admin,userId,PAGE_SIZE+1);
      return {entries:rows.slice(0,PAGE_SIZE).map(row=>projectDiceEntry(JSON.parse(row.entry),scenes)),hasMore:rows.length>PAGE_SIZE};
    },
  };
}
