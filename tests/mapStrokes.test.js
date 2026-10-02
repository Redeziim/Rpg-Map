import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';

test('players share map drawings and can remove only their own strokes',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-strokes-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,cookies={};
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  try{
    for(const username of ['owner','master','player1','player2','outsider'])assert.equal((await request(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await request('owner','/rooms','POST',{name:'Mapa desenhado'})).body.id;
    for(const username of ['player1','player2'])assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username,role:'player'})).status,200);
    assert.equal((await request('owner',`/rooms/${room}/members`,'POST',{username:'master',role:'master'})).status,200);
    const stroke={path:'M 10 20 L 30 40',color:'#d9b777'};
    assert.equal((await request('player1',`/rooms/${room}/map-strokes`,'POST',stroke)).status,400);
    const image=testMapImage;
    const before=(await request('owner',`/rooms/${room}`)).body;
    assert.equal((await request('owner',`/rooms/${room}/state`,'PATCH',{mapImage:image})).status,200);
    assert.equal((await request('player1',`/rooms/${room}/map-strokes`,'POST',{path:'M 1 2 L 3 4',color:'javascript:alert(1)'})).status,400);
    for(const color of ['#abc','#12345','#1234567','#gggggg','red','url(https://example.com)','']){
      assert.equal((await request('player1',`/rooms/${room}/map-strokes`,'POST',{...stroke,color})).status,400);
    }
    const created=await request('player1',`/rooms/${room}/map-strokes`,'POST',stroke);
    assert.equal(created.status,201);
    const id=created.body.state.mapStrokes[0].id;
    assert.equal(created.body.state.mapStrokes[0].author,'player1');
    assert.deepEqual((await request('player2',`/rooms/${room}`)).body.state.mapStrokes,created.body.state.mapStrokes);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes/${id}?mapViewMode=player`,'DELETE')).status,403);
    assert.equal((await request('player2',`/rooms/${room}/map-strokes/${id}?mapViewMode=master`,'DELETE')).status,403);
    assert.equal((await request('outsider',`/rooms/${room}/map-strokes/${id}`,'DELETE')).status,403);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes/${id}?mapViewMode=invalid`,'DELETE')).status,400);
    assert.deepEqual((await request('owner',`/rooms/${room}`)).body.state.mapStrokes,created.body.state.mapStrokes);
    assert.equal((await request('player2',`/rooms/${room}/map-strokes/${id}`,'DELETE')).status,403);
    assert.equal((await request('player1',`/rooms/${room}/map-strokes/${id}`,'DELETE')).status,200);
    assert.deepEqual((await request('player2',`/rooms/${room}`)).body.state.mapStrokes,[]);
    assert.equal((await request('player2',`/rooms/${room}/map-strokes`,'POST',{...stroke,id,author:'player1'})).status,403);
    assert.equal((await request('player2',`/rooms/${room}/map-strokes?mapViewMode=master`,'POST',{...stroke,id,author:'player1'})).status,403);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes?mapViewMode=player`,'POST',{...stroke,id,author:'player1'})).status,403);
    assert.equal((await request('outsider',`/rooms/${room}/map-strokes`,'POST',stroke)).status,403);
    assert.equal((await request('master',`/rooms/${room}/map-strokes?mapViewMode=master`,'POST',{...stroke,id,author:'player1'})).status,201);
    assert.equal((await request('master',`/rooms/${room}/map-strokes/${id}?mapViewMode=master`,'DELETE')).status,200);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes`,'POST',{...stroke,id,author:'player1'})).status,201);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes`,'POST',{...stroke,id,author:'player1'})).status,409);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes/${id}`,'DELETE')).status,200);
    assert.equal((await request('player1',`/rooms/${room}/map-strokes`,'POST',{...stroke,id})).status,201);
    assert.equal((await request('player1',`/rooms/${room}/map-strokes`,'POST',stroke)).status,201);
    assert.equal((await request('owner',`/rooms/${room}/state`,'PATCH',{mapImage:image})).body.state.mapStrokes.length,0);
    assert.equal((await request('player1',`/rooms/${room}/state`,'PATCH',{points:[],pointsVersion:before.pointsVersion})).status,403);
    const own=await request('owner',`/rooms/${room}/map-strokes?mapViewMode=player`,'POST',stroke);
    assert.equal(own.status,201);
    assert.equal((await request('owner',`/rooms/${room}/map-strokes/${own.body.state.mapStrokes[0].id}?mapViewMode=player`,'DELETE')).status,200);
    const ownMaster=await request('master',`/rooms/${room}/map-strokes`,'POST',stroke);
    assert.equal(ownMaster.status,201);
    assert.equal(ownMaster.body.state.mapStrokes[0].author,'master');
    assert.equal((await request('owner',`/rooms/${room}/map-strokes/${ownMaster.body.state.mapStrokes[0].id}?mapViewMode=master`,'DELETE')).status,200);
    for(const color of ['#1A7BD1','#000000','#ffffff']){
      const custom=await request('player1',`/rooms/${room}/map-strokes`,'POST',{...stroke,color});
      assert.equal(custom.status,201);
      const saved=custom.body.state.mapStrokes.at(-1);
      assert.equal(saved.color,color.toLowerCase());
      assert.equal((await request('player2',`/rooms/${room}`)).body.state.mapStrokes.at(-1).color,color.toLowerCase());
      assert.equal((await request('player1',`/rooms/${room}/map-strokes/${saved.id}`,'DELETE')).status,200);
      const restored=await request('player1',`/rooms/${room}/map-strokes`,'POST',saved);
      assert.equal(restored.status,201);
      assert.deepEqual(restored.body.state.mapStrokes.at(-1),saved);
    }
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});
