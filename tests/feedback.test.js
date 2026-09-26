import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('feedback is saved per room and visible only to its author and the table staff',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-feedback-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,cookies={};
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  try{
    for(const username of ['owner','alice','bob','outsider'])assert.equal((await call(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await call('owner','/rooms','POST',{name:'Mesa de teste'})).data.id,root=`/rooms/${room}`;
    for(const username of ['alice','bob'])assert.equal((await call('owner',root+'/members','POST',{username,role:'player'})).status,200);
    assert.equal((await call('outsider',root+'/feedback')).status,403);
    assert.equal((await call('alice',root+'/feedback','POST',{category:'issue',message:'curto'})).status,400);
    assert.equal((await call('alice',root+'/feedback','POST',{category:'invalid',message:'Mensagem de teste válida.'})).status,400);
    const posted=await call('alice',root+'/feedback','POST',{category:'suggestion',message:'Seria bom ampliar o mapa.'});
    assert.equal(posted.status,201);
    assert.equal(posted.data.username,'alice');
    assert.equal((await call('alice',root+'/feedback')).data.length,1);
    assert.deepEqual((await call('bob',root+'/feedback')).data,[]);
    assert.equal((await call('owner',root+'/feedback')).data[0].message,'Seria bom ampliar o mapa.');
    assert.equal((await call('bob',root+'/feedback','POST',{category:'issue',message:'A minha ficha abriu vazia.'})).status,201);
    assert.equal((await call('alice',root+'/feedback')).data.length,1);
    assert.equal((await call('owner',root+'/feedback')).data.length,2);
  }finally{app.close();rmSync(directory,{recursive:true,force:true});}
});
