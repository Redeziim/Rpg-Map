import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer,request as httpRequest} from 'node:http';
import {createApplication} from '../server/app.js';
import {testMapImage,secondTestMapImage} from './fixtures/mapImages.js';

const password='local-reconnection-review-2026';
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-reconnection-')),dbPath=join(directory,'room.sqlite'),cookies={},users={},streams=[];
  let app,base,port=0;
  async function start(){app=createApplication({dbPath,rateLimit:false,heartbeatMs:50});await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));port=app.server.address().port;base=`http://127.0.0.1:${port}/api`;}
  async function stop(){const stopped=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await stopped;app=null;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',Connection:'close',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  await start();
  for(const username of ['owner','master','alice']){const result=await call(username,'/auth/register','POST',{username,password});assert.equal(result.status,200);users[username]=result.data.id;}
  const room=(await call('owner','/rooms','POST',{name:'Mesa de reconexão'})).data.id,root=`/rooms/${room}`;
  for(const [username,role] of [['master','master'],['alice','player']])assert.equal((await call('owner',root+'/members','POST',{username,role})).status,200);
  async function events(who='alice'){
    const abort=new AbortController(),response=await fetch(base+root+'/events',{headers:{Cookie:cookies[who]},signal:abort.signal});assert.equal(response.status,200);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const stream={abort,async next(){
      while(true){
        while(!buffer.includes('\n\n')){const chunk=await reader.read();if(chunk.done)return null;buffer+=decoder.decode(chunk.value,{stream:true});}
        const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const event=frame.split('\n').find(line=>line.startsWith('event: ')),data=frame.split('\n').find(line=>line.startsWith('data: '));
        if(event&&data)return {event:event.slice(7),data:JSON.parse(data.slice(6))};
      }
    }};streams.push(stream);return stream;
  }
  return {call,events,root,room,cookies,users,get app(){return app;},get base(){return base;},stop,start,
    async close(){for(const stream of streams)stream.abort.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});},
  };
}

test('sessão encerrada ou expirada e participação removida avisam o motivo; um novo login recebe somente o acesso atual',async()=>{
  const f=await fixture();
  try{
    const live=await f.events();assert.equal((await live.next()).event,'room');
    assert.equal((await f.call('alice','/auth/logout','POST')).status,200);
    const loggedOut=await live.next();assert.equal(loggedOut?.event,'revoked');assert.equal(loggedOut.data.status,401);
    assert.equal(await live.next(),null);assert.equal((await f.call('alice',f.root)).status,401);assert.equal((await f.call('alice',f.root+'/events')).status,401);
    assert.equal((await f.call('alice','/auth/login','POST',{username:'alice',password})).status,200);
    const expired=await f.events();assert.equal((await expired.next()).event,'room');
    f.app.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(f.users.alice);
    const expiry=await expired.next();assert.equal(expiry.event,'revoked');assert.equal(expiry.data.status,401);assert.equal(await expired.next(),null);
    assert.equal((await f.call('alice','/auth/me')).status,401);
    assert.equal((await f.call('alice','/auth/login','POST',{username:'alice',password})).status,200);
    const removed=await f.events();assert.equal((await removed.next()).event,'room');
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.alice,'DELETE')).status,200);
    const revocation=await removed.next();assert.equal(revocation.event,'revoked');assert.equal(revocation.data.status,403);assert.equal(await removed.next(),null);
    assert.equal((await f.call('alice','/auth/me')).status,200);assert.equal((await f.call('alice',f.root+'/events')).status,403);
    assert.equal((await f.call('master',f.root+'/notes/@master/secret','PATCH',{title:'Segredo',body:'Não revelar após mudar de papel'})).status,200);
    const changedRole=await f.events('master');assert.equal((await changedRole.next()).data.role,'master');
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.master,'PATCH',{role:'player'})).status,200);
    const updatedRole=await changedRole.next();assert.equal(updatedRole.event,'room');assert.equal(updatedRole.data.role,'player');assert.equal(JSON.stringify(updatedRole).includes('Não revelar após mudar de papel'),false);
    await f.stop();await f.start();
    assert.equal((await f.call('master','/auth/me')).status,200);
    const reconnect=await f.events('master'),current=await reconnect.next();assert.equal(current.data.role,'player');assert.equal(Object.hasOwn(current.data.state,'masterNotebooks'),false);
    assert.equal(JSON.stringify(current).includes('Não revelar após mudar de papel'),false);
  }finally{await f.close();}
});

test('reinício conserva sessões e entrega um estado completo; versões abertas antes da queda continuam protegidas',async()=>{
  const f=await fixture();
  try{
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{mapImage:testMapImage})).status,200);
    let view=(await f.call('owner',f.root)).data;
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{points:[{id:'port',name:'Porto',x:20,y:20}],pointsVersion:view.pointsVersion})).status,200);
    const note=f.root+'/notes/@master/shared';
    assert.equal((await f.call('master',note,'PATCH',{title:'Plano',body:'Texto inicial'})).status,200);
    assert.equal((await f.call('master',note+'/share','PATCH',{version:1,sharedWith:['alice']})).status,200);
    assert.equal((await f.call('master',f.root+'/notes/@master/private','PATCH',{title:'Privada',body:'Segredo que não deve atravessar a reconexão'})).status,200);
    const cached=(await f.call('master',f.root)).data,alice=(await f.call('alice',f.root)).data;
    const missed=await f.events();assert.equal((await missed.next()).data.state.mapImage,testMapImage);missed.abort.abort();
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{mapImage:secondTestMapImage})).status,200);
    view=(await f.call('owner',f.root)).data;
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{points:[{id:'port',name:'Porto leste',x:20,y:20}],pointsVersion:view.pointsVersion})).status,200);
    assert.equal((await f.call('master',note,'PATCH',{version:2,title:'Plano',body:'Texto salvo durante a queda'})).status,200);
    const committed=(await f.call('alice',f.root)).data;
    const beforeRestart=await f.events();await beforeRestart.next();await f.stop();assert.equal(await beforeRestart.next(),null);await f.start();
    assert.equal((await f.call('alice','/auth/me')).data.username,'alice');
    const resumed=await f.events(),full=(await resumed.next()).data;
    assert.equal(full.revision,committed.revision);assert.equal(full.state.mapImage,secondTestMapImage);assert.equal(full.mapImageUnchanged,undefined);
    assert.equal(full.state.points[0].name,'Porto leste');assert.equal(full.state.sharedNotebooks[0].body,'Texto salvo durante a queda');assert.equal(full.state.sharedNotebooks[0].version,3);
    assert.equal(JSON.stringify(full).includes('Segredo que não deve atravessar a reconexão'),false);
    assert.equal((await f.call('master',f.root+'/points/port','PATCH',{version:cached.pointVersions.port,name:'Meu rascunho anterior à queda'})).status,409);
    assert.equal((await f.call('alice',note,'PATCH',{version:alice.state.sharedNotebooks[0].version,title:'Plano',body:'Meu texto local'})).status,409);
    assert.equal((await f.call('alice',f.root)).data.state.sharedNotebooks[0].body,'Texto salvo durante a queda');
    assert.equal((await f.call('alice',note,'PATCH',{version:3,title:'Plano',body:'Meu texto local, revisado'})).status,200);
    assert.equal((await resumed.next()).data.state.sharedNotebooks[0].body,'Meu texto local, revisado');
    await f.stop();await f.start();assert.equal((await f.call('master',f.root)).data.state.masterNotebooks.find(item=>item.id==='shared').body,'Meu texto local, revisado');
  }finally{await f.close();}
});

test('resposta perdida após salvar não desfaz nem repete a nota; reconectar permite conferir conteúdo e histórico',async()=>{
  const f=await fixture();let proxy;
  try{
    const note=f.root+'/notes/alice/diary';
    assert.equal((await f.call('alice',note,'PATCH',{title:'Diário',body:'Versão aberta'})).status,200);
    const before=(await f.call('alice',f.root)).data,opened=before.state.playerSheets.alice.notebooks.find(item=>item.id==='diary');
    const live=await f.events();await live.next();
    // The upstream consumes the response after COMMIT; the browser-facing socket loses it.
    proxy=createServer((req,res)=>{
      const upstream=httpRequest(new URL('/api'+note,f.base),{method:req.method,headers:req.headers},response=>{response.resume();response.on('end',()=>res.destroy());});
      upstream.on('error',()=>res.destroy());req.pipe(upstream);
    });
    await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
    const payload={version:opened.version,title:'Diário',body:'Texto enviado, cuja resposta se perdeu'};
    await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}/lost`,{method:'PATCH',headers:{Cookie:f.cookies.alice,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)}),/fetch failed/);
    const confirmed=(await live.next()).data,noteSaved=confirmed.state.playerSheets.alice.notebooks.find(item=>item.id==='diary');
    assert.equal(confirmed.revision,before.revision+1);assert.equal(noteSaved.version,2);assert.equal(noteSaved.body,payload.body);
    assert.equal((await f.call('alice',note,'PATCH',payload)).status,409);
    const history=(await f.call('alice',note+'/history')).data;assert.deepEqual(history.versions.map(item=>item.version),[2,1]);
    assert.equal((await f.call('alice',f.root)).data.revision,confirmed.revision);
    await f.stop();await f.start();
    const full=(await (await f.events()).next()).data;assert.equal(full.state.playerSheets.alice.notebooks.find(item=>item.id==='diary').body,payload.body);
    assert.deepEqual((await f.call('alice',note+'/history')).data.versions.map(item=>item.version),[2,1]);
    assert.equal((await f.call('alice',note+'/history/2')).data.body,payload.body);
  }finally{if(proxy)await new Promise(resolve=>proxy.close(resolve));await f.close();}
});
