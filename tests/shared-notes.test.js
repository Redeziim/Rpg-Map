import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';

test('shared notes permit invited editors, stream changes, protect drafts and keep boards private',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-shared-note-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),rateLimit:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,cookies={};
  let controller;
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  try{
    for(const username of ['owner','alice','bob','charlie'])assert.equal((await call(username,'/auth/register','POST',{username,password:'a-test-password-123'})).status,200);
    const room=(await call('owner','/rooms','POST',{name:'Notas partilhadas'})).data.id,root=`/rooms/${room}`;
    for(const username of ['alice','bob','charlie'])assert.equal((await call('owner',root+'/members','POST',{username,role:'player'})).status,200);
    const path=root+'/notes/alice/plan';
    const board={nodes:[{id:'n1',kind:'text',x:100,y:90,text:'Entrada'},{id:'n2',kind:'image',x:300,y:160,text:'Mapa',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='}],edges:[{id:'e1',from:'n1',to:'n2',label:'Revela'}],strokes:[{id:'s1',path:'M 10 20 L 30 40'}]};
    const expandedBoard={nodes:[{id:'idea',kind:'text',x:1000,y:600,text:'Portão',pointId:'point-1',category:'place',tags:['Mistério','Sessão 2']}],edges:[],strokes:[],width:1440,height:930};
    assert.equal((await call('alice',root+'/notes/alice/invalid-size','PATCH',{title:'Inválido',body:'',board:{...expandedBoard,width:5000}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/invalid-point','PATCH',{title:'Inválido',body:'',board:{...expandedBoard,nodes:[{...expandedBoard.nodes[0],pointId:'?'}]}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/invalid-category','PATCH',{title:'Inválido',body:'',board:{...expandedBoard,nodes:[{...expandedBoard.nodes[0],category:'monster'}]}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/invalid-tags','PATCH',{title:'Inválido',body:'',board:{...expandedBoard,nodes:[{...expandedBoard.nodes[0],tags:['Pista','pista']}]}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/expanded','PATCH',{title:'Quadro amplo',body:'',board:expandedBoard})).status,200);
    const {pointId:missingPoint,...visibleNode}=expandedBoard.nodes[0];
    assert.deepEqual((await call('alice',root)).data.state.playerSheets.alice.notebooks.find(note=>note.id==='expanded').board,{...expandedBoard,nodes:[visibleNode]});
    assert.equal((await call('alice',root+'/notes/alice/private-point','PATCH',{title:'Segredo privado do portão',body:'Só Alice vê',board:expandedBoard})).status,200);
    assert.equal((await call('alice',root+'/notes/alice/invalid','PATCH',{title:'Inválido',body:'',board:{...board,edges:[{id:'e1',from:'n1',to:'ausente'}]}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/invalid-label','PATCH',{title:'Inválido',body:'',board:{...board,edges:[{...board.edges[0],label:'A'.repeat(81)}]}})).status,400);
    assert.equal((await call('alice',root+'/notes/alice/invalid-image','PATCH',{title:'Imagem inválida',body:'',board:{...board,nodes:board.nodes.map(node=>node.kind==='image'?{...node,src:'data:image/png;base64,PGh0bWw+'}:node)}})).status,400);
    const created=await call('alice',path,'PATCH',{title:'Plano',body:'Primeiro rascunho',board});
    assert.equal(created.status,200);
    assert.equal(created.data.state.playerSheets.alice.notebooks.find(note=>note.id==='plan').version,1);
    assert.equal((await call('alice',path,'PATCH',{title:'Plano',body:'Sem versão',board})).status,409);
    assert.deepEqual((await call('bob',root)).data.state.sharedNotebooks,[]);
    assert.equal((await call('bob',path,'PATCH',{title:'Invadir',body:'Sem acesso',version:1})).status,403);
    assert.equal((await call('alice',path+'/share','PATCH',{version:1,sharedWith:['fora-da-mesa']})).status,400);
    assert.equal((await call('alice',path+'/share','PATCH',{version:1,sharedWith:['bob']})).status,200);
    const bobView=(await call('bob',root)).data.state;
    assert.equal(bobView.playerSheets.alice,undefined);
    assert.equal(bobView.sharedNotebooks[0].title,'Plano');
    assert.equal(bobView.sharedNotebooks[0].scope,'alice');
    assert.deepEqual(bobView.sharedNotebooks[0].board,{...board,width:960,height:620});
    assert.equal(JSON.stringify(bobView).includes('Segredo privado do portão'),false);
    assert.equal(JSON.stringify(bobView).includes('point-1'),false);
    assert.deepEqual((await call('charlie',root)).data.state.sharedNotebooks,[]);
    assert.equal((await call('bob',path+'/share','PATCH',{version:2,sharedWith:['charlie']})).status,403);
    controller=new AbortController();
    const stream=await fetch(base+root+'/events',{headers:{Cookie:cookies.alice},signal:controller.signal});
    const reader=stream.body.getReader(),decoder=new TextDecoder();let buffer='';
    async function nextEvent(){while(!buffer.includes('\n\n')){const chunk=await reader.read();if(chunk.done)throw Error('SSE closed');buffer+=decoder.decode(chunk.value,{stream:true});}const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(frame.split('data: ')[1]);}
    await nextEvent();
    const edited=await call('bob',path,'PATCH',{title:'Plano',body:'Texto de Bob',board,version:2});
    assert.equal(edited.status,200);
    assert.equal((await nextEvent()).state.playerSheets.alice.notebooks.find(note=>note.id==='plan').body,'Texto de Bob');
    assert.equal((await call('alice',path,'PATCH',{title:'Plano',body:'Versão antiga',board,version:2})).status,409);
    assert.equal((await call('alice',root)).data.state.playerSheets.alice.notebooks.find(note=>note.id==='plan').body,'Texto de Bob');
    assert.equal((await call('alice',path+'/share','PATCH',{version:3,sharedWith:[]})).status,200);
    assert.deepEqual((await call('bob',root)).data.state.sharedNotebooks,[]);
    assert.equal((await call('bob',path,'PATCH',{title:'Plano',body:'Sem acesso',board,version:4})).status,403);
    const masterPath=root+'/notes/@master/lore';
    assert.equal((await call('owner',masterPath,'PATCH',{title:'Lore',body:'Segredo'})).status,200);
    assert.equal((await call('owner',masterPath+'/share','PATCH',{version:1,sharedWith:['bob']})).status,200);
    const masterView=(await call('bob',root)).data.state;
    assert.equal(masterView.masterNotebooks,undefined);
    assert.equal(masterView.sharedNotebooks[0].scope,'@master');
    assert.equal(masterView.sharedNotebooks[0].title,'Lore');
    assert.equal((await call('bob',masterPath,'PATCH',{title:'Lore',body:'Novo detalhe',version:2})).status,200);
    assert.equal((await call('owner',root)).data.state.masterNotebooks[0].body,'Novo detalhe');
  }finally{controller?.abort();app.close();rmSync(directory,{recursive:true,force:true});}
});
