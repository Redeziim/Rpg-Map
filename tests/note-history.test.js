import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('note history persists, restores content as a new version and respects historical access',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-note-history-')),dbPath=join(directory,'test.sqlite');
  let app,base;const cookies={};
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:response.headers.get('content-type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};
  }
  try{
    await start();
    for(const username of ['owner','alice','bob','outsider'])await call(username,'/auth/register','POST',{username,password:'temporary-test-password'});
    const room=(await call('owner','/rooms','POST',{name:'Histórico'})).data.id,root=`/rooms/${room}`,note=root+'/notes/alice/diario',history=note+'/history';
    for(const username of ['alice','bob'])await call('owner',root+'/members','POST',{username,role:'player'});
    const board={nodes:[{id:'idea',kind:'text',x:100,y:80,text:'Portão'}],edges:[],strokes:[]};
    assert.equal((await call('alice',note,'PATCH',{title:'Segredo original',body:'Conteúdo privado antigo',board})).status,200);
    assert.equal((await call('bob',history)).status,403);
    assert.equal((await call('outsider',history)).status,403);
    assert.equal((await call('alice',note,'PATCH',{title:'Diário',body:'Texto liberado',board,version:1})).status,200);
    assert.equal((await call('alice',note+'/share','PATCH',{version:2,sharedWith:['bob']})).status,200);
    assert.deepEqual((await call('bob',history)).data.versions.map(row=>row.version),[3]);
    assert.equal((await call('bob',history+'/1')).status,404);
    assert.equal((await call('bob',history+'/2')).status,404);
    const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
    const asset=(await call('bob',root+'/note-assets','POST',{name:'Pista.png',src})).data.id;
    const imageBoard={...board,nodes:[...board.nodes,{id:'image',kind:'image',x:350,y:80,text:'Pista',assetId:asset}]};
    assert.equal((await call('bob',note,'PATCH',{title:'Diário em grupo',body:'Detalhe de Bob',board:imageBoard,version:3})).status,200);
    assert.deepEqual((await call('bob',history)).data.versions.map(row=>row.version),[4,3]);
    assert.equal((await call('alice',note,'PATCH',{title:'Diário atual',body:'Texto atual',board,version:4})).status,200);
    assert.equal((await call('alice',root+'/note-assets/'+asset)).status,200,'asset remains readable through authorized history');
    assert.equal((await call('alice',note+'/share','PATCH',{version:5,sharedWith:[]})).status,200);
    assert.equal((await call('bob',history)).status,403);
    const list=(await call('alice',history)).data;
    assert.equal(list.currentVersion,6);assert.equal(list.versions.length,6);
    assert.equal('body' in list.versions[0],false,'list does not transmit complete snapshots');
    const original=(await call('alice',history+'/1')).data;
    assert.equal(original.body,'Conteúdo privado antigo');
    assert.equal((await call('alice',note,'PATCH',{title:'Diário atual',body:original.body,board,version:6})).status,200);
    const restored=(await call('alice',root)).data.state.playerSheets.alice.notebooks[0];
    assert.equal(restored.version,7);assert.equal(restored.title,'Diário atual');assert.deepEqual(restored.board,{...board,width:960,height:620});assert.deepEqual(restored.sharedWith,[]);
    assert.equal((await call('alice',note,'PATCH',{title:'Cópia antiga',body:'',board,version:6})).status,409);
    assert.equal((await call('alice',history)).data.versions.length,7);
    app.close();await start();
    assert.equal((await call('alice',history+'/4')).data.board.nodes[1].assetId,asset);
    assert.equal((await call('alice',root+'/note-assets/'+asset)).status,200);
    for(let version=7;version<38;version++)assert.equal((await call('alice',note,'PATCH',{title:'Diário atual',body:`Edição ${version}`,board,version})).status,200);
    const retained=(await call('alice',history)).data;
    assert.equal(retained.versions.length,30);assert.equal(retained.currentVersion,38);assert.equal(retained.versions.at(-1).version,9);
    assert.equal((await call('alice',history+'/1')).status,404);
  }finally{app?.close();rmSync(directory,{recursive:true,force:true});}
});
