import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('SSE sends the map image once and repeats it only after an image change',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-image-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  let cookie,controller;
  async function request(path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    assert.ok(response.ok,`${method} ${path}: ${response.status}`);
    return response.json();
  }
  try{
    await request('/auth/register','POST',{username:'owner',password:'a-test-password-123'});
    const room=(await request('/rooms','POST',{name:'Imagem no SSE'})).id;
    const firstImage='data:image/png;base64,iVBORw0KGgo=';
    const secondImage='data:image/png;base64,iVBORw0KGgoAAA=';
    await request(`/rooms/${room}/state`,'PATCH',{mapImage:firstImage});
    controller=new AbortController();
    const response=await fetch(`${base}/rooms/${room}/events`,{headers:{Cookie:cookie},signal:controller.signal});
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    async function nextRoom(){
      while(true){
        while(!buffer.includes('\n\n')){const chunk=await reader.read();if(chunk.done)throw Error('SSE closed');buffer+=decoder.decode(chunk.value,{stream:true});}
        const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
        if(frame.startsWith('event: room'))return JSON.parse(frame.split('data: ')[1]);
      }
    }
    assert.equal((await nextRoom()).state.mapImage,firstImage);
    await request(`/rooms/${room}/state`,'PATCH',{sheetFont:'fell'});
    const repeat=await nextRoom();
    assert.equal(repeat.mapImageUnchanged,true);
    assert.equal(Object.hasOwn(repeat.state,'mapImage'),false);
    await request(`/rooms/${room}/state`,'PATCH',{mapImage:secondImage});
    const changed=await nextRoom();
    assert.equal(changed.state.mapImage,secondImage);
    assert.equal(changed.mapImageUnchanged,undefined);
  }finally{
    controller?.abort();app.close();rmSync(directory,{recursive:true,force:true});
  }
});
