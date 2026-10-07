import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';

test('players save private notes; object links respect sharing, versions, removal and restart',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-references-')),dbPath=join(directory,'review.sqlite'),cookies={},streams=[];let app,base;
  async function start(){app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  async function subscribe(who,path){
    const controller=new AbortController();streams.push(controller);
    const response=await fetch(base+path,{headers:{Cookie:cookies[who]},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}),reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    return async(revision=0)=>{while(true){while(!buffer.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value,{stream:true});}const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const room=JSON.parse(frame.split('data: ')[1]);if(room.revision>=revision)return room;}};
  }
  try{
    await start();for(const username of ['owner','master','alice','bob'])assert.equal((await call(username,'/auth/register','POST',{username,password:'local-reference-review'})).status,200);
    const root='/rooms/'+(await call('owner','/rooms','POST',{name:'Vínculos descartáveis'})).body.id;
    for(const [username,role]of [['master','master'],['alice','player'],['bob','player']])assert.equal((await call('owner',root+'/members','POST',{username,role})).status,200);
    const note=root+'/notes/alice/legacy';
    assert.equal((await call('alice',note,'PATCH',{title:'Diário privado de Alice',body:'Texto que não deve sair do caderno',board:{nodes:[{id:'card',kind:'text',x:50,y:50,text:'Local visitado',pointId:'port'}],edges:[],strokes:[]}})).status,200);
    for(const who of ['owner','master','bob']){
      assert.equal(JSON.stringify((await call(who,root)).body).includes('Diário privado de Alice'),false,`${who} must not receive private notes`);
      assert.equal((await call(who,note+'/history')).status,403);
      assert.equal((await call(who,note,'PATCH',{title:'Invadir',body:'Sobrescrito',version:1})).status,403);
    }
    assert.equal((await call('owner',root+'/sheets/alice','PATCH',{observations:'Sobrescrever diário'})).status,403);
    assert.equal((await call('alice',root)).body.state.playerSheets.alice.notebooks[0].body,'Texto que não deve sair do caderno');
    const bundle={main:'gate.obj',kind:'structure',files:[{name:'gate.obj',data:'data:text/plain;base64,'+Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n').toString('base64')}]};
    let view=(await call('master',root+'/map-assets','POST',bundle)).body;
    const objectId=view.state.mapObjects[0].id;
    const mapImage='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#c7ab76'}}).png().toBuffer()).toString('base64');
    view=(await call('master',root+'/state','PATCH',{mapImage,pointsVersion:view.pointsVersion,points:[{id:'port',name:'Porto',description:'Abrigo',type:'cidade',x:5,y:5},{id:'tower',name:'Torre',description:'Vigia',type:'dungeon',x:10,y:10}]})).body;
    view=(await call('master',root+'/campaign-scenes','POST',{id:'arrival',title:'Chegada',body:'Ao cair da noite',pointIds:['port'],visibility:'table'})).body;
    const action=async(who,action,extra={},version=view.mapObjectsVersion)=>call(who,root+'/map-object-actions','POST',{version,action,ids:[objectId],...extra});
    const point={kind:'point',targetId:'port'},secondPoint={kind:'point',targetId:'tower'},scene={kind:'scene',targetId:'arrival'},personal={kind:'note',scope:'alice',targetId:'legacy'};
    let linked=await action('master','link',{reference:point});assert.equal(linked.status,200,JSON.stringify(linked.body));view=linked.body;
    for(const reference of [secondPoint,scene]){linked=await action('master','link',{reference});assert.equal(linked.status,200);view=linked.body;}
    assert.equal(view.state.mapObjects[0].references.length,3);
    assert.equal((await action('master','link',{reference:point})).status,409);
    assert.equal((await action('master','link',{reference:personal})).status,404);
    assert.equal((await action('alice','link',{reference:point})).status,403);
    assert.equal((await call('owner',root+'/map-object-actions?mapViewMode=player','POST',{version:view.mapObjectsVersion,action:'link',ids:[objectId],reference:point})).status,403);
    assert.equal((await call('alice',note+'/share','PATCH',{version:1,sharedWith:['master']})).status,200);
    linked=await action('master','link',{reference:personal});assert.equal(linked.status,200);view=linked.body;
    const noteLink=view.state.mapObjects[0].references.find(ref=>ref.kind==='note'),pointLink=view.state.mapObjects[0].references.find(ref=>ref.targetId==='port');
    const resolveLink=(who,ref,query='')=>call(who,root+`/map-objects/${objectId}/references/${ref.id}`+query);
    assert.equal((await resolveLink('master',noteLink)).body.referenceTarget.target.title,'Diário privado de Alice');
    assert.equal(JSON.stringify((await call('bob',root)).body).includes(noteLink.targetId),false);
    assert.equal((await resolveLink('bob',noteLink)).status,404);
    const masterEvent=await subscribe('master',root+'/events'),playerEvent=await subscribe('owner',root+'/events?mapViewMode=player');
    assert.equal(JSON.stringify(await masterEvent()).includes('Diário privado de Alice'),true);
    assert.equal(JSON.stringify(await playerEvent()).includes('Diário privado de Alice'),false);
    view=(await call('master',root+'/points/port','PATCH',{name:'Porto revisado',version:view.pointVersions.port})).body;
    assert.equal((await resolveLink('alice',pointLink)).body.referenceTarget.target.name,'Porto revisado');
    const stale=view.mapObjectsVersion;view=(await action('master','lock',{locked:true})).body;
    assert.equal((await action('master','unlink',{referenceId:pointLink.id},stale)).status,409);
    const revoked=await call('alice',note+'/share','PATCH',{version:2,sharedWith:[]});assert.equal(revoked.status,200);
    assert.equal(JSON.stringify(await masterEvent(revoked.body.revision)).includes('Diário privado de Alice'),false);
    view=(await call('master',root+'/map-fog','PATCH',{operation:'enable',version:revoked.body.fogVersion})).body;
    const hidden=await playerEvent(view.revision);assert.deepEqual(hidden.state.mapObjects[0].references,[]);assert.deepEqual(hidden.state.points,[]);assert.deepEqual(hidden.state.campaignScenes,[]);
    assert.equal((await resolveLink('owner',pointLink,'?mapViewMode=player')).status,404);
    const projectedNote=(await call('alice',root)).body.state.playerSheets.alice.notebooks[0];assert.equal(projectedNote.board.nodes[0].pointId,undefined);
    assert.equal((await call('alice',note+'/history/1')).body.board.nodes[0].pointId,undefined);
    assert.equal((await call('alice',note,'PATCH',{title:projectedNote.title,body:'Texto editado com ponto coberto',board:projectedNote.board,version:projectedNote.version})).status,200);
    view=(await call('master',root+'/map-fog','PATCH',{operation:'disable',version:view.fogVersion})).body;
    assert.equal((await call('alice',root)).body.state.playerSheets.alice.notebooks[0].board.nodes[0].pointId,'port');
    const sceneVersion=view.state.campaignScenes.find(scene=>scene.id==='arrival').version;
    view=(await call('master',root+'/campaign-scenes/arrival','PATCH',{archived:true,version:sceneVersion})).body;
    assert.equal(view.state.mapObjects[0].references.find(ref=>ref.kind==='scene').unavailable,true);
    view=(await call('master',root+'/campaign-scenes/arrival','PATCH',{archived:false,version:sceneVersion+1})).body;
    assert.equal((await resolveLink('master',noteLink)).status,404);
    view=(await call('master',root)).body;
    const unavailable=view.state.mapObjects[0].references.find(ref=>ref.id===noteLink.id);assert.deepEqual(unavailable,{id:noteLink.id,kind:'note',unavailable:true});
    const copy=await action('master','duplicate');assert.equal(copy.status,200);view=copy.body;
    assert.equal(view.state.mapObjects.length,2);assert.notEqual(view.state.mapObjects[0].references[0].id,view.state.mapObjects[1].references[0].id);
    view=(await call('master',root+'/state','PATCH',{pointsVersion:view.pointsVersion,points:view.state.points.filter(point=>point.id!=='port')})).body;
    assert.equal((await resolveLink('alice',pointLink)).status,404);
    for(const controller of streams)controller.abort();await stop();await start();view=(await call('master',root)).body;assert.equal(view.state.mapObjects[0].locked,true);assert.equal(view.state.mapObjects[0].references.find(ref=>ref.id===pointLink.id).unavailable,true);
    const exported=(await call('owner',root+'/exports','POST',{viewMode:'master'})).body;
    const portable=(await call('owner',exported.downloadUrl.replace(/^\/api/,''))).body;
    assert.ok(portable.state.mapObjects.every(object=>object.references.every(ref=>!ref.unavailable&&ref.kind!=='note'&&ref.targetId!=='port')));
    linked=await action('master','unlink',{referenceId:pointLink.id});assert.equal(linked.status,200);assert.equal(linked.body.state.mapObjects[0].references.some(ref=>ref.id===pointLink.id),false);
  }finally{for(const controller of streams)controller.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
