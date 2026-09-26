import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('SSE heartbeat omits room state and still revokes lost access and expired sessions',{timeout:3000},async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-heartbeat-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false,heartbeatMs:30});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const cookies={};
  const controllers=[];
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  async function openStream(who,room){
    const controller=new AbortController();controllers.push(controller);
    const response=await fetch(`${base}/rooms/${room}/events`,{headers:{Cookie:cookies[who]},signal:controller.signal});
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    return async()=>{
      while(!buffer.includes('\n\n')){const chunk=await reader.read();if(chunk.done)throw Error('SSE closed');buffer+=decoder.decode(chunk.value,{stream:true});}
      const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);return frame;
    };
  }
  async function nextRevoked(next){for(let i=0;i<20;i++){const frame=await next();if(frame.startsWith('event: revoked'))return frame;}throw Error('No revoked event');}
  try{
    for(const username of ['owner','player'])assert.equal((await request(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await request('owner','/rooms','POST',{name:'Mesa SSE'})).body.id;
    assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username:'player',role:'player'})).status,200);

    const playerEvent=await openStream('player',room);
    assert.match(await playerEvent(),/^event: room\ndata: /);
    assert.equal(await playerEvent(),': heartbeat');
    app.db.prepare("DELETE FROM members WHERE user_id=(SELECT id FROM users WHERE username='player')").run();
    assert.match(await nextRevoked(playerEvent),/^event: revoked/);

    const ownerEvent=await openStream('owner',room);
    assert.match(await ownerEvent(),/^event: room\ndata: /);
    assert.equal(await ownerEvent(),': heartbeat');
    app.db.prepare("UPDATE sessions SET expires=0 WHERE user_id=(SELECT id FROM users WHERE username='owner')").run();
    assert.match(await nextRevoked(ownerEvent),/^event: revoked/);
  }finally{
    controllers.forEach(controller=>controller.abort());app.close();rmSync(directory,{recursive:true,force:true});
  }
});
