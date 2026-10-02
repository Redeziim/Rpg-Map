import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';
import sharp from 'sharp';
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-room-export-')),dbPath=join(directory,'test.sqlite'),cookies={},users={};
  let app,base,port=0;
  async function start(path=dbPath){
    app=createApplication({dbPath:path,rateLimit:false});
    for(let attempt=0;attempt<10;attempt++){
      await new Promise(done=>app.server.listen(port,'127.0.0.1',done));port=app.server.address().port;base=`http://127.0.0.1:${port}/api`;
      try{const response=await fetch(base+'/health',{headers:{Connection:'close'}});await response.body.cancel();break;}
      catch(error){await new Promise(done=>app.server.close(done));if(error.cause?.message!=='bad port'||attempt===9)throw error;port=0;}
    }
  }
  async function stop(){const stopped=new Promise(done=>app.server.once('close',done));app.close();app.server.closeAllConnections();await stopped;app=null;}
  async function call(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',Connection:'close',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(60000)});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  await start();
  for(const username of ['owner','master','alice','bob','outsider']){const result=await call(username,'/auth/register','POST',{username,password:'local-audit-test-password'});assert.equal(result.status,200);users[username]=result.data.id;}
  const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Livro de registros'})).data.id;
  return {directory,dbPath,users,cookies,root,call,start,stop,get base(){return base;},get app(){return app;},async close(){if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}


const board=nodes=>({width:960,height:620,nodes,edges:[],strokes:[]});
async function prepareRoom(f,who,viewMode='master'){
 const result=await f.call(who,f.root+'/exports','POST',{viewMode});
 assert.equal(result.status,201,JSON.stringify(result.data));return result.data;
}
async function exportRoom(f,who,viewMode='master'){
 const prepared={data:await prepareRoom(f,who,viewMode)};
 const file=await f.call(who,prepared.data.downloadUrl.replace('/api',''));
 assert.equal(file.status,200,JSON.stringify(file.data));
 return {file:file.data,prepared:prepared.data};
}

test('exportação portátil conserva estado, histórico, imagens e modelos autorizados sem alterar a mesa',async()=>{
 const f=await fixture();
 try{
  await f.call('owner',f.root+'/members','POST',{username:'alice'});
  const image=await f.call('owner',f.root+'/note-assets','POST',{name:'Selo',src:testMapImage});
  assert.equal(image.status,201);
  const model=await f.call('owner',f.root+'/map-assets','POST',{main:'cabana.obj',files:[{name:'cabana.obj',data:'data:text/plain;base64,diAwIDAgMFxu'},{name:'cabana.mtl',data:'data:text/plain;base64,bmV3bXRsIGNhYmFuYQ=='}]});
  assert.equal(model.status,201);
  // Existing valid bundles may have whitespace (for example a reviewed legacy record).
  const asset=model.data.state.mapObjects[0].assetId;
  const legacyBundle=JSON.parse(f.app.db.prepare('SELECT bundle FROM map_assets WHERE id=?').get(asset).bundle);
  f.app.db.prepare('UPDATE map_assets SET bundle=? WHERE id=?').run(' \n'+JSON.stringify(legacyBundle,null,2),asset);
  await f.call('owner',f.root+'/state','PATCH',{mapImage:testMapImage});
  await f.call('owner',f.root+'/notes/@master/plan','PATCH',{title:'Preparação',body:'Primeiro texto',board:board([{id:'seal',kind:'image',x:10,y:10,text:'Selo',assetId:image.data.id}])});
  await f.call('owner',f.root+'/notes/@master/plan','PATCH',{title:'Preparação',body:'Texto atual',version:1});
  await f.call('owner',f.root+'/notes/owner/own','PATCH',{title:'Diário',body:'Meu texto'});
  const before=(await f.call('owner',f.root)).data,auditBefore=(await f.call('owner',f.root+'/audit')).data;
  const {file,prepared}=await exportRoom(f,'owner');
  assert.equal(file.format,'grimorio-room');assert.equal(file.formatVersion,1);
  assert.equal(file.room.id,before.id);assert.equal(file.room.revision,before.revision);
  assert.deepEqual(file.state.mapObjects,before.state.mapObjects);assert.equal(file.state.mapImage,testMapImage);
  assert.equal(file.state.masterNotebooks[0].body,'Texto atual');
  assert.deepEqual(file.noteHistory.find(h=>h.scope==='@master').versions.map(v=>v.body),['Texto atual','Primeiro texto']);
  assert.equal(file.assets.notes[0].data,testMapImage);assert.equal(file.assets.notes[0].id,image.data.id);
  assert.deepEqual(file.assets.models[0].files.map(v=>v.name),['cabana.obj','cabana.mtl']);
  assert.equal(file.assets.models[0].files[0].data,'data:text/plain;base64,diAwIDAgMFxu');
  assert.equal(file.state.playerSheets.owner.notebooks[0].body,'Meu texto');
  assert.deepEqual(file.audit,auditBefore.entries);
  assert.equal(prepared.counts.notes,2);assert.equal(prepared.counts.noteImages,1);assert.equal(prepared.counts.models,1);
  assert.ok(prepared.bytes>0);assert.ok(prepared.expiresAt>Date.now());
  for(const secret of ['password_hash','token_hash','grimorio_session','salt'])assert.equal(JSON.stringify(file).includes(secret),false);
  const after=(await f.call('owner',f.root)).data;assert.deepEqual(after.state,before.state);assert.equal(after.revision,before.revision);
  assert.deepEqual((await f.call('owner',f.root+'/audit')).data,auditBefore);
  await f.stop();await f.start();
  assert.equal((await f.call('owner',prepared.downloadUrl.replace('/api',''))).status,404,'arquivos temporários não sobrevivem ao servidor');
  const restored=await exportRoom(f,'owner');assert.deepEqual(restored.file.state,file.state);assert.deepEqual(restored.file.noteHistory,file.noteHistory);
 }finally{await f.close();}
});



test('exportação aplica privacidade por nota, histórico compartilhado e cobertura real do mapa para jogador e ADM nesse modo',async()=>{
 const f=await fixture();
 try{
  for(const [username,role] of [['master','master'],['alice','player'],['bob','player']])assert.equal((await f.call('owner',f.root+'/members','POST',{username,role})).status,200);
  let view=(await f.call('owner',f.root)).data;
  view=(await f.call('owner',f.root+'/state','PATCH',{mapImage:testMapImage,pointsVersion:view.pointsVersion,points:[{id:'port',x:10,y:10,name:'Porto',description:'Conhecido'},{id:'hidden',x:60,y:40,name:'Local protegido',description:'SEGREDO DO MAPA'}],sheetFields:[{id:'hp',label:'Vida',type:'status'}]})).data;
  await f.call('owner',f.root+'/sheets/owner','PATCH',{values:{hp:{current:7,max:9}}});
  await f.call('owner',f.root+'/map-strokes','POST',{path:'M 10 10 L 20 20',color:'#abcdef',visibility:'table'});
  await f.call('owner',f.root+'/map-strokes','POST',{path:'M 10 10 L 70 40',color:'#123456',visibility:'table'});
  await f.call('owner',f.root+'/map-strokes','POST',{path:'M 10 10 L 15 15',color:'#223344',visibility:'master'});
  view=(await f.call('owner',f.root)).data;
  view=(await f.call('owner',f.root+'/map-fog','PATCH',{operation:'enable',version:view.fogVersion})).data;
  await f.call('owner',f.root+'/map-fog','PATCH',{operation:'reveal',version:view.fogVersion,area:{x:0,y:0,width:30,height:30}});
  const privateImage=await f.call('bob',f.root+'/note-assets','POST',{name:'Imagem privada',src:'data:image/png;base64,'+(await sharp({create:{width:4,height:4,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64')});
  await f.call('bob',f.root+'/notes/bob/private','PATCH',{title:'Segredo',body:'PRIVADO DE BOB',board:board([{id:'p',kind:'image',text:'Privado',x:0,y:0,assetId:privateImage.data.id}])});
  await f.call('owner',f.root+'/notes/@master/private','PATCH',{title:'Campanha',body:'SEGREDO DO MESTRE'});
  await f.call('alice',f.root+'/notes/alice/shared','PATCH',{title:'Pista',body:'HISTÓRICO PRIVADO',board:board([{id:'link',kind:'text',x:0,y:0,text:'Pista',pointId:'hidden'}])});
  await f.call('alice',f.root+'/notes/alice/shared','PATCH',{title:'Pista',body:'Pista pública',version:1});
  await f.call('alice',f.root+'/notes/alice/shared/share','PATCH',{sharedWith:['bob','master','owner'],version:2});
  const player=await exportRoom(f,'bob','master');
  assert.equal(player.prepared.viewMode,'player');
  assert.deepEqual(player.file.state.points.map(p=>p.id),['port']);assert.equal(player.file.state.mapStrokes.length,1);
  assert.equal(player.file.state.playerSheets.bob.notebooks[0].body,'PRIVADO DE BOB');
  assert.equal(player.file.state.sharedNotebooks[0].body,'Pista pública');assert.equal(player.file.state.sharedNotebooks[0].board.nodes[0].pointId,undefined);
  assert.deepEqual(player.file.noteHistory.find(h=>h.scope==='alice').versions.map(v=>v.version),[3]);
  assert.equal(player.file.audit.length,0);assert.equal(player.file.groupBars.owner.bars.find(b=>b.id==='hp').current,7);
  const decode=async data=>(await sharp(Buffer.from(data.split(',')[1],'base64')).removeAlpha().raw().toBuffer({resolveWithObject:true}));
  const pixels=await decode(player.file.state.mapImage),pixel=(x,y)=>[...pixels.data.subarray((y*pixels.info.width+x)*3,(y*pixels.info.width+x)*3+3)];
  assert.deepEqual(pixel(10,10),[199,171,118]);assert.deepEqual(pixel(60,40),[21,25,19]);
  for(const who of ['master','owner']){
   const result=await exportRoom(f,who),text=JSON.stringify(result.file);
   assert.ok(text.includes('SEGREDO DO MESTRE'));assert.equal(text.includes('PRIVADO DE BOB'),false);assert.equal(text.includes('Imagem privada'),false);assert.equal(text.includes('HISTÓRICO PRIVADO'),false);
   assert.equal(result.file.assets.notes.length,0);assert.equal(result.file.state.playerSheets.bob.observations,'');assert.equal(result.file.noteHistory.find(h=>h.scope==='alice').versions.length,1);
   await f.call(who,f.root+'/exports/'+result.prepared.id,'DELETE');
  }
  const adminPlayer=await exportRoom(f,'owner','player'),text=JSON.stringify(adminPlayer.file);
  for(const secret of ['SEGREDO DO MAPA','SEGREDO DO MESTRE','PRIVADO DE BOB','HISTÓRICO PRIVADO','M 10 10 L 70 40','hidden'])assert.equal(text.includes(secret),false,secret);
  assert.equal(adminPlayer.file.state.masterNotebooks,undefined);assert.deepEqual(adminPlayer.file.state.points.map(p=>p.id),['port']);
  assert.equal(adminPlayer.file.state.mapImage,player.file.state.mapImage);assert.equal(adminPlayer.file.audit.length,0);
  assert.equal((await f.call('outsider',f.root+'/exports','POST',{viewMode:'player'})).status,403);
  assert.equal((await f.call('',f.root+'/exports','POST',{viewMode:'master'})).status,401);
  assert.equal((await f.call('alice',player.prepared.downloadUrl.replace('/api',''))).status,404);
 }finally{await f.close();}
});


test('arquivos preparados expiram, podem ser cancelados e perdem acesso com alterações, logout ou remoção da mesa',async t=>{
 const f=await fixture();
 try{
  await f.call('owner',f.root+'/members','POST',{username:'alice'});
  assert.equal((await f.call('owner',f.root+'/exports','POST',{viewMode:'invalid'})).status,400);
  assert.equal((await f.call('owner',f.root+'/exports','POST',{viewMode:'master',private:true})).status,400);
  let prepared=await prepareRoom(f,'owner');
  assert.equal((await f.call('owner',f.root+'/exports','POST',{viewMode:'master'})).status,429);
  assert.equal((await f.call('alice',f.root+'/exports/'+prepared.id,'DELETE')).status,404);
  assert.equal((await f.call('owner',f.root+'/exports/'+prepared.id,'DELETE')).status,200);
  assert.equal((await f.call('owner',prepared.downloadUrl.replace('/api',''))).status,404);
  prepared=await prepareRoom(f,'owner');
  await f.call('owner',f.root+'/notes/@master/change','PATCH',{title:'Mudança',body:'Novo conteúdo'});
  assert.equal((await f.call('owner',f.root+'/exports/'+prepared.id)).status,409);
  assert.equal((await f.call('owner',prepared.downloadUrl.replace('/api',''))).status,404);
  prepared=await prepareRoom(f,'owner');
  const clock=Date.now;t.mock.method(Date,'now',()=>prepared.expiresAt+1);
  assert.equal((await f.call('owner',f.root+'/exports/'+prepared.id)).status,410);
  Date.now=clock;
  prepared=await prepareRoom(f,'owner');
  await f.call('owner','/auth/logout','POST');
  assert.equal((await f.call('owner',prepared.downloadUrl.replace('/api',''))).status,401);
  assert.equal((await f.call('owner','/auth/login','POST',{username:'owner',password:'local-audit-test-password'})).status,200);
  prepared=await prepareRoom(f,'owner');
  await f.call('owner',f.root+'/exports/'+prepared.id,'DELETE');
  const player=await prepareRoom(f,'alice','player');
  await f.call('owner',f.root+'/members/'+f.users.alice,'DELETE');
  assert.equal((await f.call('alice',player.downloadUrl.replace('/api',''))).status,403);
  await f.call('owner',f.root+'/members','POST',{username:'alice'});
  assert.equal((await f.call('alice',f.root+'/exports/'+player.id)).status,409);
  assert.equal((await f.call('alice',f.root+'/exports','POST',{viewMode:'player'})).status,201);
  // Cancel a real HTTP preparation while the large asset is being written to disk.
  const model=Buffer.alloc(6*1024*1024,0x61).toString('base64');
  assert.equal((await f.call('owner',f.root+'/map-assets','POST',{main:'large.obj',files:[{name:'large.obj',data:'data:text/plain;base64,'+model}]})).status,201);
  const controller=new AbortController();
  const aborted=fetch(f.base+f.root+'/exports',{method:'POST',headers:{Cookie:f.cookies.owner,'Content-Type':'application/json'},body:JSON.stringify({viewMode:'master'}),signal:controller.signal});
  const rejected=assert.rejects(aborted,{name:'AbortError'});setTimeout(()=>controller.abort(),10);await rejected;
  let result;
  for(let i=0;i<20;i++){
   result=await f.call('owner',f.root+'/exports','POST',{viewMode:'master'});
   if(result.status!==429)break;
   await new Promise(done=>setTimeout(done,10));
  }
  assert.equal(result.status,201,JSON.stringify(result.data));
  const file=await f.call('owner',result.data.downloadUrl.replace('/api',''));
  assert.equal(file.status,200);assert.equal((await f.call('owner',result.data.downloadUrl.replace('/api',''))).status,404,'arquivo temporário é consumido pelo download');assert.equal(file.data.assets.models[0].files[0].data.length,model.length+'data:text/plain;base64,'.length);
 }finally{t.mock.restoreAll();await f.close();}
});
