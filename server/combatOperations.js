import {createHash} from 'node:crypto';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const identifier=value=>typeof value==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
const ACTIONS=new Set(['next','skip','end','select','up','down','remove','include','add','initiative','sort','effect-add','effect-remove']);
export const COMBAT_OPERATION_TTL=7*86400000;
const present=row=>({phase:'confirmed',operationId:row.operation_id,action:row.action,resultVersion:row.result_version,changed:!!row.changed});

export function assertCombatOperations(db){
  for(const row of db.prepare('SELECT o.*,r.state FROM combat_operations o JOIN rooms r ON r.id=o.room_id').iterate()){
    if(!identifier(row.operation_id)||!Number.isSafeInteger(row.requested_at)||row.requested_at<=0||!Number.isSafeInteger(row.expires)||row.expires<=row.requested_at||!/^[a-f\d]{64}$/.test(row.request_hash)||!ACTIONS.has(row.action)||![0,1].includes(row.changed)||!Number.isSafeInteger(row.result_version)||row.result_version<1||row.result_version>JSON.parse(row.state).combat.version)throw Error('Confirmação de combate inválida.');
  }
}

export function createCombatOperations(db){
  const read=db.prepare('SELECT * FROM combat_operations WHERE room_id=? AND user_id=? AND operation_id=?');
  return {
    prepare(roomId,userId,body){
      const {operationId,requestedAt,...command}=body;
      if(operationId===undefined&&requestedAt===undefined)return {command};
      if(!identifier(operationId)||!Number.isSafeInteger(requestedAt)||requestedAt<=0)fail(400,'Identidade do comando de combate inválida.');
      const requestHash=createHash('sha256').update(JSON.stringify(Object.entries(command).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
      const row=read.get(roomId,userId,operationId);
      if(row){
        if(row.requested_at!==requestedAt||row.request_hash!==requestHash)fail(409,'Este comando já foi enviado com outros dados. Confira a ordem atual.');
        if(row.expires<=Date.now())fail(410,'A confirmação deste comando expirou. Confira a ordem atual antes de continuar.');
        return {confirmed:present(row)};
      }
      if(requestedAt<Date.now()-120000||requestedAt>Date.now()+60000)fail(410,'Este comando expirou. Confira a ordem atual antes de continuar.');
      return {command,operation:{operationId,requestedAt,requestHash}};
    },
    confirm(roomId,userId,operation,command,combat,changed){
      if(!operation)return null;
      db.prepare('INSERT INTO combat_operations VALUES(?,?,?,?,?,?,?,?,?)').run(roomId,userId,operation.operationId,operation.requestedAt,operation.requestHash,command.action,combat.version,changed?1:0,Date.now()+COMBAT_OPERATION_TTL);
      return present(read.get(roomId,userId,operation.operationId));
    },
    status(roomId,userId,operationId,requestedAt){
      if(!identifier(operationId)||!Number.isSafeInteger(requestedAt)||requestedAt<=0)fail(400,'Identidade do comando de combate inválida.');
      const row=read.get(roomId,userId,operationId);
      if(row&&row.requested_at!==requestedAt)fail(409,'Os dados deste comando não correspondem à confirmação.');
      if(row&&row.expires>Date.now())return present(row);
      return {phase:row||requestedAt<Date.now()-120000?'expired':'unconfirmed',operationId};
    },
  };
}
