import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {sceneFields,mergeSceneFields,indexPointLinks,pointLinkLabel,visibleCampaignScenes} from '../src/shared/campaignScenes.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-campaign-scenes-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player','outsider'])assert.equal((await request(username,'/auth/register','POST',{username,password:'local-scenes-review-2026'})).status,200);
  const root='/rooms/'+(await request('owner','/rooms','POST',{name:'Arquivo da campanha'})).body.id;
  for(const [username,role] of [['master','master'],['player','player']])await request('owner',root+'/members','POST',{username,role});
  const image='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#c7ab76'}}).png().toBuffer()).toString('base64');
  const initial=(await request('master',root)).body;
  await request('master',root+'/state','PATCH',{mapImage:image,points:[{id:'port',name:'Porto',x:30,y:20},{id:'secret',name:'Local secreto',x:60,y:40}],pointsVersion:initial.pointsVersion});
  const view=who=>request(who,root).then(result=>result.body);
  const create=(id,patch={})=>request('master',root+'/campaign-scenes','POST',{id,title:'Chegada ao porto',body:'O sino toca.',pointIds:['port'],...patch});
  return {request,root,image,cookies,view,create,get base(){return base;},restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('campaign scenes start private, enforce roles and room links and preserve drafts during concurrent edits',async()=>{
  const f=await fixture();
  try{
    const payload={id:'first',title:'Chegada ao porto',body:'O sino toca.',pointIds:['port']};
    for(const [who,query] of [['player','?mapViewMode=master'],['owner','?mapViewMode=player'],['outsider','']])assert.equal((await f.request(who,f.root+'/campaign-scenes'+query,'POST',payload)).status,403);
    for(const patch of [{title:' '},{body:123},{visibility:'public'},{pointIds:['elsewhere']},{pointIds:['port','port']},{unknown:true}])assert.equal((await f.create('bad',patch)).status,400);
    let saved=await f.create('first');assert.equal(saved.status,201);let scene=saved.body.state.campaignScenes[0];assert.equal(scene.visibility,'master');assert.equal(scene.version,1);
    assert.equal((await f.request('player',f.root+'/campaign-scenes/first')).status,404);assert.deepEqual((await f.view('player')).state.campaignScenes,[]);
    assert.equal((await f.create('first')).status,200);assert.equal((await f.view('master')).state.campaignScenes.length,1);assert.equal((await f.view('master')).state.campaignScenes[0].version,1);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{campaignScenes:[]})).status,400);
    const base=sceneFields(scene),draft={...base,body:'Meu texto local.'};
    const concurrent=await Promise.all([f.request('owner',f.root+'/campaign-scenes/first','PATCH',{title:'Título atualizado',version:1}),f.request('master',f.root+'/campaign-scenes/first','PATCH',{title:'Outra versão',version:1})]);assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
    scene=(await f.view('master')).state.campaignScenes[0];const merged=mergeSceneFields(base,draft,sceneFields(scene),{});assert.equal(merged.body,'Meu texto local.');assert.equal(merged.title,scene.title);
    assert.equal((await f.request('master',f.root+'/campaign-scenes/first','PATCH',{...merged,version:1})).status,409);
    assert.equal((await f.request('master',f.root+'/campaign-scenes/first','PATCH',{...merged,version:scene.version})).status,200);
    const changed=mergeSceneFields(base,{...draft,pointIds:['secret'],visibility:'table'},{...base,pointIds:['port','secret'],visibility:'master'},{pointIds:'latest'});assert.deepEqual(changed.pointIds,['port','secret']);assert.equal(changed.visibility,'table');
    assert.equal((await f.view('master')).state.points.length,2);assert.equal((await f.view('master')).state.mapImage,f.image);
  }finally{f.close();}
});

test('visible point indicators deduplicate notes and scenes obey sharing, fog, archives and missing points',async()=>{
  const f=await fixture();
  try{
    await f.create('private');await f.create('public',{visibility:'table',pointIds:['port','secret']});await f.create('hidden',{visibility:'table',pointIds:['secret']});await f.create('global',{visibility:'table',pointIds:[]});
    const privateNote={title:'Nota privada',body:'Texto confidencial.',board:{nodes:[{id:'a',kind:'text',text:'Local',x:0,y:0,pointId:'port'},{id:'b',kind:'text',text:'Outro cartão',x:240,y:0,pointId:'port'}],edges:[],strokes:[]}};
    await f.request('master',f.root+'/notes/@master/reference','PATCH',privateNote);
    let room=await f.view('master');room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:room.fogVersion})).body;
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',area:{x:20,y:10,width:30,height:20},version:room.fogVersion})).body;
    const player=await f.view('player');assert.deepEqual(player.state.campaignScenes.map(scene=>scene.id),['public','global']);assert.deepEqual(player.state.campaignScenes[0].pointIds,['port']);
    assert.equal(JSON.stringify(player).includes('Texto confidencial.'),false);assert.equal((await f.request('player',f.root+'/campaign-scenes/hidden')).status,404);
    const masterIndex=indexPointLinks(room.state.masterNotebooks.map(note=>({...note,scope:'@master'})),room.state.campaignScenes);assert.equal(masterIndex.get('port').notes.length,1);assert.equal(masterIndex.get('port').scenes.length,2);assert.equal(pointLinkLabel(masterIndex.get('port')),'1 nota · 2 cenas');
    const playerIndex=indexPointLinks([],player.state.campaignScenes);assert.equal(pointLinkLabel(playerIndex.get('port')),'1 cena');assert.equal(playerIndex.has('secret'),false);
    assert.equal(visibleCampaignScenes(room.state.campaignScenes,player.state.points,false).length,2); // ADM player mode applies the same scope.
    let publicScene=room.state.campaignScenes.find(scene=>scene.id==='public');await f.request('master',f.root+'/campaign-scenes/public','PATCH',{archived:true,version:publicScene.version});assert.deepEqual((await f.view('player')).state.campaignScenes.map(scene=>scene.id),['global']);
    publicScene=(await f.view('master')).state.campaignScenes.find(scene=>scene.id==='public');await f.request('master',f.root+'/campaign-scenes/public','PATCH',{archived:false,version:publicScene.version});assert.equal((await f.view('player')).state.campaignScenes.length,2);
    const current=await f.view('master');await f.request('master',f.root+'/state','PATCH',{points:[],pointsVersion:current.pointsVersion});assert.deepEqual((await f.view('player')).state.campaignScenes.map(scene=>scene.id),['global']);assert.deepEqual((await f.view('master')).state.campaignScenes.find(scene=>scene.id==='public').pointIds,['port','secret']);
  }finally{f.close();}
});

test('SSE filters shared scenes as fog and sharing change and the archive survives restart',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    const response=await fetch(f.base+f.root+'/events',{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    await event();await f.create('private',{body:'Conteúdo reservado.'});const privateEvent=await event();assert.deepEqual(privateEvent.state.campaignScenes,[]);assert.equal(JSON.stringify(privateEvent).includes('Conteúdo reservado.'),false);
    await f.create('public',{visibility:'table'});const shared=await event();assert.equal(shared.state.campaignScenes[0].id,'public');assert.equal(shared.mapImageUnchanged,true);
    let room=await f.view('master');await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:room.fogVersion});assert.deepEqual((await event()).state.campaignScenes,[]);
    room=await f.view('master');await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',area:{x:20,y:10,width:30,height:20},version:room.fogVersion});assert.equal((await event()).state.campaignScenes[0].id,'public');
    let scene=(await f.view('master')).state.campaignScenes.find(scene=>scene.id==='public');await f.request('master',f.root+'/campaign-scenes/public','PATCH',{visibility:'master',version:scene.version});assert.deepEqual((await event()).state.campaignScenes,[]);
    scene=(await f.view('master')).state.campaignScenes.find(scene=>scene.id==='public');await f.request('master',f.root+'/campaign-scenes/public','PATCH',{archived:true,version:scene.version});await event();
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();assert.equal((await f.view('master')).state.campaignScenes.find(scene=>scene.id==='public').archived,true);assert.deepEqual((await f.view('player')).state.campaignScenes,[]);
  }finally{controller.abort();f.close();}
});
