import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {createRoomMediaCache} from '../src/roomMediaCache.js';
import {testMapImage,secondTestMapImage} from './fixtures/mapImages.js';

const pixels=Buffer.alloc(384*256*3);let random=712367;
for(let i=0;i<pixels.length;i++){random^=random<<13;random^=random>>>17;random^=random<<5;pixels[i]=random&255;}
const picture='data:image/png;base64,'+(await sharp(pixels,{raw:{width:384,height:256,channels:3}}).png().toBuffer()).toString('base64');
const board=src=>({width:960,height:620,nodes:[{id:'seal',kind:'image',x:50,y:50,text:'Selo',src}],edges:[],strokes:[]});

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-room-media-')),cookies={},users={},streams=[];
  let app,base,port=0;
  async function start(){
    app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
    for(let attempt=0;attempt<10;attempt++){
      await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
      port=app.server.address().port;base=`http://127.0.0.1:${port}/api`;
      try{const probe=await fetch(base+'/health',{headers:{Connection:'close'}});await probe.body.cancel();break;}
      catch(error){await new Promise(resolve=>app.server.close(resolve));if(error.cause?.message!=='bad port'||attempt===9)throw error;port=0;}
    }
  }
  async function stop(){const closed=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await closed;app=null;}
  async function call(who,path,method='GET',data,headers={}){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',Connection:'close',...headers,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    const text=await response.text();return {status:response.status,data:JSON.parse(text),bytes:Buffer.byteLength(text),text};
  }
  async function asset(who,path,headers={}){
    const response=await fetch(base+path,{headers:{Cookie:cookies[who]||'',Connection:'close',...headers},signal:AbortSignal.timeout(10000)});
    return {status:response.status,etag:response.headers.get('etag'),cache:response.headers.get('cache-control'),bytes:Buffer.from(await response.arrayBuffer())};
  }
  await start();
  for(const username of ['owner','alice','bob']){const result=await call(username,'/auth/register','POST',{username,password:'a-local-media-test-password'});assert.equal(result.status,200);users[username]=result.data.id;}
  const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Mídia da mesa'})).data.id;
  for(const username of ['alice','bob'])assert.equal((await call('owner',root+'/members','POST',{username,role:'player'})).status,200);
  async function events(who='owner',format=true){
    const controller=new AbortController(),response=await fetch(base+root+'/events'+(format?'?media=1':''),{headers:{Cookie:cookies[who]},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});assert.equal(response.status,200);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const stream={controller,async next(){
      while(true){
        while(!buffer.includes('\n\n')){const chunk=await reader.read();if(chunk.done)return null;buffer+=decoder.decode(chunk.value,{stream:true});}
        const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const event=frame.split('\n').find(line=>line.startsWith('event: ')),data=frame.split('\n').find(line=>line.startsWith('data: '));
        if(event&&data)return {event:event.slice(7),data:JSON.parse(data.slice(6)),bytes:Buffer.byteLength(frame)};
      }
    }};streams.push(stream);return stream;
  }
  return {call,asset,events,root,users,stop,start,async close(){for(const stream of streams)stream.controller.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}
const optimized=version=>({'X-Grimorio-Media':'1',...(version?{'X-Grimorio-Media-Cache':version}:{})});

test('HTTP e SSE enviam cada imagem nova uma vez no snapshot e omitem bytes em alterações que não a afetam',async()=>{
  const f=await fixture();
  try{
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{mapImage:picture})).status,200);
    assert.equal((await f.call('owner',f.root+'/notes/@master/seal','PATCH',{title:'Selo',body:'Texto inicial',board:board(picture)})).status,200);
    assert.equal((await f.call('owner',f.root+'/profiles/owner','PATCH',{avatar:picture})).status,200);
    const bundle={main:'farol.obj',kind:'terrain',files:[{name:'farol.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3').toString('base64')}]};
    const model=(await f.call('owner',f.root+'/map-assets','POST',bundle)).data.state.mapObjects[0];
    const legacy=await f.call('owner',f.root),initial=await f.call('owner',f.root,'GET',undefined,optimized());
    assert.equal(initial.status,200);
    assert.equal(typeof initial.data.state.mapImage,'object');
    assert.deepEqual(Object.values(initial.data.roomMedia.images),[picture]);
    assert.ok(initial.bytes<legacy.bytes/2);
    assert.equal(initial.text.includes(bundle.files[0].data),false);
    const modelFile=await f.asset('alice',f.root+'/map-assets/'+model.assetId);assert.equal(modelFile.status,200);assert.ok(modelFile.etag);assert.match(modelFile.cache,/private/);assert.match(modelFile.cache,/no-cache/);
    const sameModel=await f.asset('alice',f.root+'/map-assets/'+model.assetId,{'If-None-Match':modelFile.etag});assert.equal(sameModel.status,304);assert.equal(sameModel.bytes.length,0);
    const live=await f.events(),first=await live.next();assert.deepEqual(Object.values(first.data.roomMedia.images),[picture]);
    const unchanged=await f.call('owner',f.root+'/state','PATCH',{sheetFont:'fell'},optimized(initial.data.roomMedia.version));
    assert.equal(unchanged.status,200);assert.deepEqual(unchanged.data.roomMedia.images,{});assert.equal(unchanged.text.includes(picture.slice(50,100)),false);assert.ok(unchanged.bytes<legacy.bytes/50);
    const second=await live.next();assert.deepEqual(second.data.roomMedia.images,{});assert.equal(second.data.mapImageUnchanged,true);
    const moved=board(picture);moved.nodes[0].x=130;
    const movement=await f.call('owner',f.root+'/notes/@master/seal','PATCH',{title:'Selo',body:'Texto alterado',board:moved,version:1},optimized(initial.data.roomMedia.version));
    assert.equal(movement.status,200);assert.deepEqual(movement.data.roomMedia.images,{});assert.equal(movement.data.state.masterNotebooks[0].board.nodes[0].x,130);assert.deepEqual((await live.next()).data.roomMedia.images,{});
    const changed=await f.call('owner',f.root+'/profiles/owner','PATCH',{avatar:secondTestMapImage},optimized(initial.data.roomMedia.version));
    assert.equal(changed.status,200);assert.deepEqual(Object.values(changed.data.roomMedia.images),[secondTestMapImage]);assert.equal(changed.text.includes(picture.slice(50,100)),false);
    assert.deepEqual(Object.values((await live.next()).data.roomMedia.images),[secondTestMapImage]);
    const oldClient=await f.call('owner',f.root);assert.equal(oldClient.data.state.mapImage,picture);assert.equal(oldClient.data.state.masterNotebooks[0].board.nodes[0].src,picture);assert.equal(oldClient.data.roomMedia,undefined);
    assert.equal((await f.call('owner',f.root+'/map-objects/'+model.id,'DELETE')).status,200);
    assert.equal((await f.asset('alice',f.root+'/map-assets/'+model.assetId,{'If-None-Match':modelFile.etag})).status,404);
  }finally{await f.close();}
});

test('o cliente conserva imagens completas no rascunho, reduz os envios e recupera cache ausente ou reiniciado',async()=>{
  const f=await fixture();
  try{
    assert.equal((await f.call('owner',f.root+'/state','PATCH',{mapImage:picture})).status,200);
    const note=f.root+'/notes/@master/seal';
    assert.equal((await f.call('owner',note,'PATCH',{title:'Selo',body:'Texto',board:board(picture)})).status,200);
    const cache=createRoomMediaCache(),raw=(await f.call('owner',f.root,'GET',undefined,cache.headers())).data;
    const view=cache.decode(raw);assert.equal(view.state.mapImage,picture);assert.equal(view.state.masterNotebooks[0].board.nodes[0].src,picture);assert.equal(view.roomMedia,undefined);
    const moved=board(picture);moved.nodes[0].x=210;
    const payload=cache.encode({title:'Selo',body:'Texto novo',board:moved,version:1});
    assert.equal(typeof payload.board.nodes[0].src,'object');assert.ok(Buffer.byteLength(JSON.stringify(payload))<1000);assert.equal(moved.nodes[0].src,picture);
    assert.equal(cache.encode({body:picture,title:picture,board:moved}).body,picture);assert.equal(cache.encode({body:picture,title:picture,board:moved}).title,picture);
    const changed=await f.call('owner',note,'PATCH',payload,cache.headers());assert.equal(changed.status,200);assert.deepEqual(changed.data.roomMedia.images,{});
    const updated=cache.decode(changed.data);assert.equal(updated.state.masterNotebooks[0].board.nodes[0].src,picture);assert.equal(updated.state.masterNotebooks[0].board.nodes[0].x,210);
    const live=await f.events();cache.decode((await live.next()).data);
    const replace=await f.call('owner',f.root+'/state','PATCH',{mapImage:secondTestMapImage,mapImageVersion:updated.mapImageVersion},cache.headers());assert.equal(replace.status,200);cache.decode(replace.data);
    const imageChange=await live.next();cache.decode(imageChange.data);
    cache.decode(raw); // An older HTTP result can follow a newer event; it must not discard its images.
    const text=await f.call('owner',note,'PATCH',cache.encode({title:'Selo',body:'Depois da troca',board:moved,version:2}),cache.headers());assert.equal(text.status,200);cache.decode(text.data);
    const delta=await live.next();assert.deepEqual(delta.data.roomMedia.images,{});assert.equal(cache.decode(delta.data).state.masterNotebooks[0].board.nodes[0].src,picture);
    const empty=createRoomMediaCache();assert.throws(()=>empty.decode(delta.data),/imagem/i);assert.equal(empty.headers()['X-Grimorio-Media-Cache'],undefined);
    const recovered=empty.decode((await f.call('owner',f.root,'GET',undefined,empty.headers())).data);assert.equal(recovered.state.mapImage,secondTestMapImage);assert.equal(recovered.state.masterNotebooks[0].board.nodes[0].src,picture);
    const foreign=await f.call('alice',f.root,'GET',undefined,cache.headers());assert.equal(foreign.status,200);assert.equal(JSON.stringify(foreign.data).includes('Depois da troca'),false);
    const before=cache.headers();await f.stop();await f.start();
    const restored=await f.call('owner',f.root,'GET',undefined,before);assert.equal(restored.status,200);assert.deepEqual(new Set(Object.values(restored.data.roomMedia.images)),new Set([picture,secondTestMapImage]));
    assert.equal(cache.decode(restored.data).state.masterNotebooks[0].board.nodes[0].src,picture);
    const resumed=await f.events(),complete=(await resumed.next()).data;assert.equal(complete.mapImageUnchanged,undefined);assert.equal(cache.decode(complete).state.mapImage,secondTestMapImage);
    const literal=(await f.call('owner',f.root)).data;assert.equal(literal.state.masterNotebooks[0].board.nodes[0].src,picture);
    cache.decode(literal);assert.equal(cache.headers()['X-Grimorio-Media-Cache'],undefined);assert.equal(cache.encode({board:moved}).board.nodes[0].src,picture);
    const history=(await f.call('owner',note+'/history/3')).data;assert.equal(history.board.nodes[0].src,picture);
    assert.equal((await f.call('owner',note,'PATCH',payload,cache.headers())).status,409);
  }finally{await f.close();}
});

test('referências de imagem obedecem notas compartilhadas, névoa, contas e mesas sem ampliar o acesso',async()=>{
  const f=await fixture();
  try{
    let owner=(await f.call('owner',f.root+'/state','PATCH',{mapImage:picture})).data;
    owner=(await f.call('owner',f.root+'/map-fog','PATCH',{operation:'enable',version:owner.fogVersion})).data;
    const note=f.root+'/notes/@master/private';
    const assetId=(await f.call('owner',f.root+'/note-assets','POST',{name:'Selo privado',src:secondTestMapImage})).data.id;
    const privateBoard=board(secondTestMapImage);privateBoard.nodes.push({id:'collection',kind:'image',assetId,text:'Coleção privada',x:400,y:50});
    assert.equal((await f.call('owner',note,'PATCH',{title:'Nota reservada',body:'Conteúdo reservado',board:privateBoard})).status,200);
    const privateView=(await f.call('owner',f.root,'GET',undefined,optimized())).data;
    const secret=privateView.state.masterNotebooks[0].board.nodes[0].src;
    const aliceView=(await f.call('alice',f.root,'GET',undefined,optimized(privateView.roomMedia.version))).data;
    assert.equal(typeof aliceView.state.mapImage,'string');assert.ok(aliceView.state.mapImage.startsWith('/api/rooms/'));
    assert.deepEqual(aliceView.roomMedia.images,{});assert.equal(JSON.stringify(aliceView).includes('Conteúdo reservado'),false);
    const forged=await f.call('alice',f.root+'/notes/alice/forged','PATCH',{title:'Tentativa',body:'',board:board(secret)},optimized());assert.equal(forged.status,400);
    const live=await f.events('bob'),before=await live.next();assert.deepEqual(before.data.roomMedia.images,{});
    assert.equal((await f.call('owner',note+'/share','PATCH',{version:1,sharedWith:['alice','bob']})).status,200);
    const shared=await live.next();assert.deepEqual(Object.values(shared.data.roomMedia.images),[secondTestMapImage]);assert.equal(JSON.stringify(shared).includes(picture.slice(50,100)),false);
    const attachment=await f.asset('bob',f.root+'/note-assets/'+assetId);assert.equal(attachment.status,200);assert.ok(attachment.etag);assert.match(attachment.cache,/private/);assert.match(attachment.cache,/no-cache/);
    assert.equal((await f.asset('bob',f.root+'/note-assets/'+assetId,{'If-None-Match':attachment.etag})).status,304);
    assert.equal((await f.asset('bob',f.root+'/note-assets/'+assetId,{'If-None-Match':'W/'+attachment.etag})).status,304);
    assert.equal((await f.asset('bob',f.root+'/note-assets/'+assetId,{'If-None-Match':'"different"'})).status,200);
    const copied=await f.call('alice',f.root+'/notes/alice/copy','PATCH',{title:'Referência visível',body:'Texto próprio',board:board(secret)},optimized());
    assert.equal(copied.status,200);
    assert.equal((await f.call('alice',f.root)).data.state.playerSheets.alice.notebooks[0].board.nodes[0].src,secondTestMapImage);
    await live.next();
    assert.equal((await f.call('owner',note+'/share','PATCH',{version:2,sharedWith:['alice']})).status,200);
    const revoked=await live.next();assert.deepEqual(revoked.data.state.sharedNotebooks,[]);assert.deepEqual(revoked.data.roomMedia.hashes,[]);assert.deepEqual(revoked.data.roomMedia.images,{});
    assert.equal((await f.asset('bob',f.root+'/note-assets/'+assetId,{'If-None-Match':attachment.etag})).status,404);
    assert.equal((await f.call('bob',f.root+'/notes/bob/forged','PATCH',{title:'Tentativa após retirada',body:'',board:board(secret)},optimized(shared.data.roomMedia.version))).status,400);
    const other=(await f.call('owner','/rooms','POST',{name:'Outra mesa'})).data.id;
    assert.equal((await f.call('owner',`/rooms/${other}/notes/@master/forged`,'PATCH',{title:'Outra mesa',body:'',board:board(secret)},optimized(privateView.roomMedia.version))).status,400);
    assert.equal((await f.call('alice',f.root+'/profiles/alice','PATCH',{avatar:testMapImage},optimized(privateView.roomMedia.version))).status,200);
    const allowed=(await f.call('alice',f.root,'GET',undefined,optimized(privateView.roomMedia.version))).data;
    assert.deepEqual(new Set(Object.values(allowed.roomMedia.images)),new Set([testMapImage,secondTestMapImage]));
    assert.equal(JSON.stringify(allowed).includes(picture.slice(50,100)),false);
    const unknown=board({_roomImage:'0'.repeat(64)});
    assert.equal((await f.call('alice',f.root+'/notes/alice/unknown','PATCH',{title:'Referência inválida',body:'',board:unknown},optimized())).status,400);
    assert.equal((await f.call('alice',f.root+'/notes/alice/invalid','PATCH',{title:'Quadro inválido',body:'',board:{nodes:42,edges:[],strokes:[]}},optimized())).status,400);
    assert.equal((await f.call('owner',f.root+'/members/'+f.users.bob,'DELETE')).status,200);
    assert.equal((await f.asset('bob',f.root+'/note-assets/'+assetId,{'If-None-Match':attachment.etag})).status,403);
    assert.equal((await f.call('owner','/auth/logout','POST')).status,200);
    assert.equal((await f.asset('owner',f.root+'/note-assets/'+assetId,{'If-None-Match':attachment.etag})).status,401);
  }finally{await f.close();}
});
