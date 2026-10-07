import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('named notes preserve legacy content, enforce privacy, broadcast and survive restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'grimorio-notes-')),dbPath=join(dir,'db.sqlite');
  let app,base,abort;const cookies={};
  const start=async()=>{app=createApplication({dbPath,rateLimit:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}/api`;};
  const call=async(who,path,method='GET',data)=>{const res=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});if(res.headers.get('set-cookie'))cookies[who]=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};};
  try{
    await start();
    for(const username of ['owner','master','alice','bob','outsider'])await call(username,'/auth/register','POST',{username,password:'test-password-123'});
    const room=(await call('owner','/rooms','POST',{name:'Notas'})).data.id,root=`/rooms/${room}`;
    for(const [username,role] of [['master','master'],['alice','player'],['bob','player']])await call('owner',root+'/members','POST',{username,role});
    await call('master',root+'/state','PATCH',{masterNotes:'Segredo antigo'});
    await call('alice',root+'/sheets/alice','PATCH',{observations:'Diário antigo'});
    assert.equal((await call('master',root)).data.state.masterNotebooks[0].body,'Segredo antigo');
    assert.equal((await call('alice',root)).data.state.playerSheets.alice.notebooks[0].body,'Diário antigo');
    const note={title:'Encontro',body:'Segredo novo'};
    assert.equal((await call('master',root+'/notes/@master/one','PATCH',note)).status,200);
    assert.equal((await call('master',root+'/notes/@master/two','PATCH',{title:'Pistas',body:'Outra nota'})).status,200);
    const alice=(await call('alice',root)).data.state;
    assert.equal(alice.masterNotebooks,undefined);assert.equal(alice.masterNotes,undefined);
    assert.equal((await call('alice',root+'/notes/@master/one','PATCH',note)).status,403);
    assert.equal((await call('alice',root+'/notes/bob/one','PATCH',note)).status,403);
    assert.equal((await call('master',root+'/notes/alice/one','PATCH',note)).status,403);
    assert.equal((await call('outsider',root+'/notes/@master/one','PATCH',note)).status,403);
    assert.equal((await call('alice',root+'/notes/alice/one','PATCH',{title:'',body:''})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/one','PATCH',{title:'Nota',body:'x'.repeat(50001)})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/one','PATCH',{title:'Diário',body:'Texto pessoal'})).status,200);
    assert.equal((await call('bob',root)).data.state.playerSheets.alice,undefined);
    assert.deepEqual((await call('master',root)).data.state.playerSheets.alice.notebooks,[]);
    abort=new AbortController();const response=await fetch(base+root+'/events',{headers:{Cookie:cookies.owner},signal:abort.signal});
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    async function event(){while(!buffer.includes('\n\n')){const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:true});}const end=buffer.indexOf('\n\n'),value=buffer.slice(0,end);buffer=buffer.slice(end+2);return value;}
    await event();await call('master',root+'/notes/@master/one','PATCH',{title:'Encontro revisado',body:'Novo texto',version:1});
    assert.match(await event(),/Encontro revisado/);abort.abort();
    const other=(await call('owner','/rooms','POST',{name:'Outra mesa'})).data;
    assert.deepEqual(other.state.masterNotebooks,[]);
    app.close();await start();
    const restored=(await call('owner',root)).data.state;
    assert.equal(restored.masterNotebooks.length,3);
    assert.equal(restored.masterNotebooks.find(n=>n.id==='one').title,'Encontro revisado');
    assert.equal(restored.masterNotebooks.find(n=>n.id==='legacy').body,'Segredo antigo');
    assert.deepEqual(restored.playerSheets.alice.notebooks,[]); assert.equal((await call('alice',root)).data.state.playerSheets.alice.notebooks.find(n=>n.id==='one').body,'Texto pessoal');
  }finally{abort?.abort();app?.close();rmSync(dir,{recursive:true,force:true});}
});
