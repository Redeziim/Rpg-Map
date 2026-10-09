import {randomUUID} from 'node:crypto';
import {SHEET_MODEL_LIMITS,SHEET_MODEL_SOURCES,SheetModelError,cleanModelName,cleanSheetFields} from '../src/shared/sheetModels.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const toRow=row=>({id:row.id,name:row.name,source:row.source,fields:JSON.parse(row.fields),createdAt:row.created_at,updatedAt:row.updated_at});
// Erro de validação compartilhado com o navegador vira resposta 400.
const checked=work=>{try{return work();}catch(error){if(error instanceof SheetModelError)fail(400,error.message);throw error;}};
const onlyKeys=(data,allowed)=>{if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail(400,'Pedido de modelo inválido.');};

// Biblioteca de modelos de ficha de cada conta. Só o dono lê, renomeia ou apaga; nada aqui vai para a mesa sem a pessoa aplicar o modelo.
export function createSheetModels(db){
  const list=db.prepare('SELECT * FROM sheet_models WHERE owner_id=? ORDER BY updated_at DESC,id');
  const one=db.prepare('SELECT * FROM sheet_models WHERE id=? AND owner_id=?');
  const count=db.prepare('SELECT count(*) AS n FROM sheet_models WHERE owner_id=?');
  const named=db.prepare('SELECT id FROM sheet_models WHERE owner_id=? AND lower(name)=lower(?)');
  return {
    list:ownerId=>list.all(ownerId).map(toRow),
    create(ownerId,data,now=Date.now()){
      onlyKeys(data,['name','fields','source']);
      const name=checked(()=>cleanModelName(data.name)),fields=checked(()=>cleanSheetFields(data.fields));
      const source=data.source===undefined?'manual':data.source;
      if(!SHEET_MODEL_SOURCES.includes(source))fail(400,'Origem do modelo inválida.');
      if(count.get(ownerId).n>=SHEET_MODEL_LIMITS.models)fail(400,`Limite de ${SHEET_MODEL_LIMITS.models} modelos por conta. Apague um modelo antes de guardar outro.`);
      if(named.get(ownerId,name))fail(409,'Você já tem um modelo com esse nome.');
      const id=randomUUID();
      db.prepare('INSERT INTO sheet_models VALUES(?,?,?,?,?,?,?)').run(id,ownerId,name,JSON.stringify(fields),source,now,now);
      return toRow(one.get(id,ownerId));
    },
    rename(ownerId,id,data,now=Date.now()){
      onlyKeys(data,['name']);
      const previous=one.get(id,ownerId);if(!previous)fail(404,'Modelo não encontrado.');
      const name=checked(()=>cleanModelName(data.name)),clash=named.get(ownerId,name);
      if(clash&&clash.id!==id)fail(409,'Você já tem um modelo com esse nome.');
      db.prepare('UPDATE sheet_models SET name=?,updated_at=? WHERE id=? AND owner_id=?').run(name,Math.max(now,previous.updated_at),id,ownerId);
      return toRow(one.get(id,ownerId));
    },
    remove(ownerId,id){
      if(!one.get(id,ownerId))fail(404,'Modelo não encontrado.');
      db.prepare('DELETE FROM sheet_models WHERE id=? AND owner_id=?').run(id,ownerId);
    },
  };
}

// Conferência de um banco existente (migração, backup, restauração): cada modelo precisa passar pelas mesmas regras da API.
export function assertSavedSheetModels(db){
  const perOwner=new Map();
  for(const row of db.prepare('SELECT * FROM sheet_models').iterate()){
    let fields;
    try{fields=JSON.parse(row.fields);const clean=cleanSheetFields(fields);if(JSON.stringify(clean)!==JSON.stringify(fields))throw Error();cleanModelName(row.name);}
    catch{throw Error('Modelo de ficha persistido inválido.');}
    if(!SHEET_MODEL_SOURCES.includes(row.source)||row.name!==row.name.trim()||!Number.isSafeInteger(row.created_at)||!Number.isSafeInteger(row.updated_at)||row.updated_at<row.created_at)throw Error('Modelo de ficha persistido inválido.');
    const key=`${row.owner_id}:${row.name.replace(/[A-Z]/g,letter=>letter.toLowerCase())}`,total=(perOwner.get(row.owner_id)||0)+1;
    if(perOwner.has(key)||total>SHEET_MODEL_LIMITS.models)throw Error('Modelos de ficha repetidos ou acima do limite.');
    perOwner.set(row.owner_id,total);perOwner.set(key,1);
  }
}
