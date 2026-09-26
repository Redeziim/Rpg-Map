import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('concurrent point edits reject a stale copy without losing the first edit',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-points-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const cookies={};
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  let controller;
  try{
    for(const username of ['owner','master','player'])assert.equal((await request(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await request('owner','/rooms','POST',{name:'Mapa concorrente'})).body.id;
    assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username:'master',role:'master'})).status,200);
    assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username:'player',role:'player'})).status,200);

    const ownerView=(await request('owner',`/rooms/${room}`)).body;
    const masterView=(await request('master',`/rooms/${room}`)).body;
    assert.equal(ownerView.pointsVersion,masterView.pointsVersion);
    const first={id:'first',name:'Torre',x:10,y:20};
    const second={id:'second',name:'Portão',x:30,y:40};
    controller=new AbortController();
    const stream=await fetch(`${base}/rooms/${room}/events`,{headers:{Cookie:cookies.player},signal:controller.signal});
    const reader=stream.body.getReader();
    async function nextEvent(){
      let value='';
      while(!value.includes('\n\n')){const chunk=await reader.read();if(chunk.done)throw Error('SSE closed');value+=new TextDecoder().decode(chunk.value);}
      return JSON.parse(value.split('data: ')[1].split('\n')[0]);
    }
    assert.deepEqual((await nextEvent()).state.points,[]);
    const saved=await request('owner',`/rooms/${room}/state`,'PATCH',{points:[first],pointsVersion:ownerView.pointsVersion});
    assert.equal(saved.status,200);
    assert.deepEqual((await nextEvent()).state.points,[first]);
    assert.notEqual(saved.body.pointsVersion,ownerView.pointsVersion);

    const stale=await request('master',`/rooms/${room}/state`,'PATCH',{points:[second],pointsVersion:masterView.pointsVersion});
    assert.equal(stale.status,409);
    assert.match(stale.body.error,/pontos mudaram/);
    assert.deepEqual((await request('player',`/rooms/${room}`)).body.state.points,[first]);
    assert.equal((await request('master',`/rooms/${room}/state`,'PATCH',{points:[second]})).status,409);
    assert.equal((await request('player',`/rooms/${room}/state`,'PATCH',{points:[second],pointsVersion:saved.body.pointsVersion})).status,403);

    const unrelated=await request('owner',`/rooms/${room}/state`,'PATCH',{sheetFont:'fell'});
    assert.equal(unrelated.status,200);
    assert.equal(unrelated.body.pointsVersion,saved.body.pointsVersion);
    const retried=await request('master',`/rooms/${room}/state`,'PATCH',{points:[first,second],pointsVersion:saved.body.pointsVersion});
    assert.equal(retried.status,200);
    assert.deepEqual((await request('player',`/rooms/${room}`)).body.state.points,[first,second]);
  }finally{
    controller?.abort();app.close();rmSync(directory,{recursive:true,force:true});
  }
});
