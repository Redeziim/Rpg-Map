import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';

test('note image library reuses bytes and follows note permissions',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-note-assets-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,cookies={};
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:response.headers.get('content-type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};
  }
  try{
    for(const username of ['owner','alice','bob'])assert.equal((await call(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await call('owner','/rooms','POST',{name:'Biblioteca de imagens'})).data.id,root=`/rooms/${room}`;
    for(const username of ['alice','bob'])assert.equal((await call('owner',root+'/members','POST',{username,role:'player'})).status,200);
    assert.equal((await call('alice',root+'/note-assets','POST',{name:'Falso.png',src:'data:image/png;base64,PGh0bWw+'})).status,400);
    const uploaded=await call('alice',root+'/note-assets','POST',{name:'Brasão.png',src:png});
    assert.equal(uploaded.status,201);
    const assetId=uploaded.data.id;
    assert.equal((await call('alice',root+'/note-assets','POST',{name:'Cópia.png',src:png})).data.id,assetId);
    assert.deepEqual((await call('alice',root+'/note-assets')).data.map(item=>item.id),[assetId]);
    assert.deepEqual((await call('bob',root+'/note-assets')).data,[]);
    assert.equal((await call('bob',root+'/note-assets/'+assetId)).status,404);
    assert.equal((await call('alice',root+'/note-assets/'+assetId)).data.length,Buffer.from(png.split(',')[1],'base64').length);
    const board={nodes:[{id:'image',kind:'image',x:80,y:70,text:'Brasão',assetId}],edges:[],strokes:[]};
    const note=root+'/notes/alice/brasao';
    assert.equal((await call('bob',root+'/notes/bob/attempt','PATCH',{title:'Tentativa',body:'',board})).status,400);
    assert.equal((await call('alice',note,'PATCH',{title:'Brasão secreto',body:'',board})).status,200);
    assert.equal((await call('bob',root+'/note-assets/'+assetId)).status,404);
    assert.equal((await call('alice',note+'/share','PATCH',{version:1,sharedWith:['bob']})).status,200);
    assert.equal((await call('bob',root+'/note-assets/'+assetId)).status,200);
    assert.deepEqual((await call('bob',root+'/note-assets')).data.map(item=>item.id),[assetId]);
    assert.equal((await call('alice',note+'/share','PATCH',{version:2,sharedWith:[]})).status,200);
    assert.equal((await call('bob',root+'/note-assets/'+assetId)).status,404);
    assert.deepEqual((await call('bob',root+'/note-assets')).data,[]);
    assert.equal((await call('alice',note+'/share','PATCH',{version:3,sharedWith:['bob']})).status,200);
    assert.equal((await call('bob',root+'/notes/bob/referencia','PATCH',{title:'Referência',body:'',board})).status,200);
    assert.equal((await call('alice',note+'/share','PATCH',{version:4,sharedWith:[]})).status,200);
    assert.equal((await call('bob',root+'/note-assets/'+assetId)).status,200);
    const other=(await call('owner','/rooms','POST',{name:'Outra mesa'})).data.id;
    assert.equal((await call('owner',`/rooms/${other}/note-assets/${assetId}`)).status,404);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});
