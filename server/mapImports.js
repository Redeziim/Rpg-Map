import {randomUUID} from 'node:crypto';

const pending=new Set(['prepared','uploading','checking']);
const failure=(status,message)=>Object.assign(Error(message),{status});
export function createMapImports(db){
  const active=new Map();let closed=false;
  const read=db.prepare('SELECT * FROM map_imports WHERE id=? AND room_id=? AND user_id=? AND expires>?');
  const update=db.prepare("UPDATE map_imports SET phase=?,result=? WHERE id=? AND phase IN ('prepared','uploading','checking')");
  const present=row=>({id:row.id,phase:row.phase,createdAt:row.created_at,expiresAt:row.expires,...JSON.parse(row.result)});
  function owned(roomId,userId,id){
    const row=read.get(id,roomId,userId,Date.now());if(!row)throw failure(404,'Importação não encontrada ou expirada.');
    if(pending.has(row.phase)&&row.deadline<=Date.now()){update.run('cancelled',JSON.stringify({message:'O prazo da importação terminou.'}),id);active.get(id)?.abort();return owned(roomId,userId,id);}return row;
  }
  return {
    prepare(roomId,userId){
      const id=randomUUID(),now=Date.now();
      db.prepare('INSERT INTO map_imports VALUES(?,?,?,?,?,?,?,?)').run(id,roomId,userId,'prepared',now,now+180000,now+7*86400000,'{}');return present(owned(roomId,userId,id));
    },
    status:(roomId,userId,id)=>present(owned(roomId,userId,id)),
    cancel(roomId,userId,id){
      const row=owned(roomId,userId,id);
      if(pending.has(row.phase)){update.run('cancelled',JSON.stringify({message:'Importação cancelada. Os arquivos não foram adicionados.'}),id);active.get(id)?.abort();}
      return present(owned(roomId,userId,id));
    },
    watch(roomId,userId,id,abort){
      const row=owned(roomId,userId,id),entry={abort,timer:setTimeout(()=>{if(!closed){update.run('cancelled',JSON.stringify({message:'O prazo da importação terminou.'}),id);abort();}},Math.max(0,row.deadline-Date.now()))};
      entry.timer.unref();active.set(id,entry);
      return()=>{clearTimeout(entry.timer);if(active.get(id)===entry)active.delete(id);};
    },
    begin(roomId,userId,id){owned(roomId,userId,id);if(!db.prepare("UPDATE map_imports SET phase='uploading' WHERE id=? AND phase='prepared' AND deadline>?").run(id,Date.now()).changes)throw failure(409,'Esta importação já começou ou terminou. Confira o resultado.');},
    checking(roomId,userId,id){const row=owned(roomId,userId,id);if(!pending.has(row.phase))throw failure(499,'Importação cancelada.');update.run('checking','{}',id);},
    confirmed(roomId,userId,id,objectId,warnings){const row=owned(roomId,userId,id);if(!pending.has(row.phase))throw failure(499,'Importação cancelada.');update.run('confirmed',JSON.stringify({objectId,warnings}),id);},
    failed(id,error){if(!closed)update.run(error.status===499?'cancelled':'failed',JSON.stringify({message:error.status?error.message:'Não foi possível concluir a importação.',status:error.status||500}),id);},
    close(){for(const [id,entry]of active){clearTimeout(entry.timer);update.run('cancelled',JSON.stringify({message:'A importação foi interrompida ao encerrar o servidor.'}),id);entry.abort();}active.clear();closed=true;},
  };
}
