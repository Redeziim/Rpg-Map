import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';
import {diagnosticOperation,diagnosticOutcome,createDiagnostics} from '../server/diagnostics.js';

async function fixture(logger){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-diagnostics-'));
  const app=createApplication({dbPath:join(directory,'db.sqlite'),exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:logger});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  let cookie='';
  async function call(path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,requestId:response.headers.get('x-request-id'),body:await response.json()};
  }
  return {app,call,async close(){app.close();await new Promise(done=>app.server.once('close',done));rmSync(directory,{recursive:true,force:true});}};
}

test('diagnóstico classifica operações e resultados em um vocabulário controlado e correlaciona requisições',async()=>{
  assert.equal(diagnosticOperation('POST','/api/rooms/abc/map-assets'),'upload');
  assert.equal(diagnosticOperation('PATCH','/api/rooms/abc/notes/secret'),'save');
  assert.equal(diagnosticOperation('GET','/api/rooms/abc/events'),'sse');
  assert.equal(diagnosticOutcome(500,{code:'SQLITE_CONSTRAINT_TRIGGER'}),'storage');
  assert.equal(diagnosticOutcome(409),'conflict');
  assert.equal(diagnosticOutcome(403),'access');
  const lines=[],f=await fixture(line=>lines.push(JSON.parse(line)));
  try{
    const register=await f.call('/auth/register','POST',{username:'diagnostic-user',password:'private-password'});
    assert.equal(register.status,200);
    const room=await f.call('/rooms','POST',{name:'Mesa reservada'});
    assert.equal(room.status,201);
    const denied=await f.call(`/rooms/${room.body.id}/notes/@master/test`,'PATCH',{title:'',body:'segredo'});
    assert.equal(denied.status,400);
    const recorded=lines.find(line=>line.requestId===denied.requestId);
    assert.deepEqual({operation:recorded.operation,outcome:recorded.outcome,status:recorded.status},{operation:'save',outcome:'validation',status:400});
    assert.ok(recorded.durationMs>=0&&recorded.requestBytes>0&&recorded.responseBytes>0);
    assert.equal(new Set(lines.map(line=>line.requestId)).size,lines.length);
    assert.equal(f.app.diagnostics.snapshot().counts.save.validation,1);
  }finally{await f.close();}
});

test('erros reais de armazenamento não registram conteúdo, token, URL, nome livre ou mensagem da exceção',async()=>{
  const lines=[],f=await fixture(line=>lines.push(line));
  try{
    await f.call('/auth/register','POST',{username:'private-user',password:'senha-super-secreta'});
    f.app.db.exec("CREATE TEMP TRIGGER fail_room BEFORE INSERT ON rooms BEGIN SELECT RAISE(ABORT,'exception-secret-771'); END;");
    const failed=await f.call('/rooms?invite=token-secret-772','POST',{name:'room-secret-773',filename:'file-secret-774'});
    assert.equal(failed.status,500);
    assert.equal(failed.body.requestId,failed.requestId);
    const line=lines.find(line=>JSON.parse(line).requestId===failed.requestId);
    assert.equal(JSON.parse(line).outcome,'storage');
    for(const secret of ['exception-secret-771','token-secret-772','room-secret-773','file-secret-774','senha-super-secreta','grimorio_session='])assert.equal(lines.join('\n').includes(secret),false,secret);
    assert.deepEqual(Object.keys(JSON.parse(line)).sort(),['durationMs','event','operation','outcome','requestBytes','requestId','responseBytes','status'].sort());
  }finally{await f.close();}
});

test('destino de log indisponível e limite de eventos não impedem salvamentos válidos',async()=>{
  const f=await fixture(()=>{throw Error('log indisponível');});
  try{
    assert.equal((await f.call('/auth/register','POST',{username:'durable-user',password:'private-password'})).status,200);
    const room=await f.call('/rooms','POST',{name:'Persistida'});assert.equal(room.status,201);
    const saved=await f.call(`/rooms/${room.body.id}/state`,'PATCH',{sheetFont:'fell'});
    assert.equal(saved.status,200);
    assert.equal((await f.call(`/rooms/${room.body.id}`)).body.state.sheetFont,'fell');
    const bounded=createDiagnostics({logger:()=>{},maxEventsPerMinute:1});
    for(let index=0;index<20;index++)bounded.record({requestId:'fixed',operation:'save',outcome:'ok',status:200});
    assert.equal(bounded.snapshot().counts.save.ok,20);
    assert.equal(bounded.snapshot().suppressed,19);
  }finally{await f.close();}
});
