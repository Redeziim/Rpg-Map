import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {createBackup,restoreBackup} from '../scripts/databaseRecovery.js';

test('master presents saved media live, controls later access, and media survives restart and backup',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-scene-media-')),dbPath=join(directory,'review.sqlite'),cookies={};let app,base,controller;
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
  async function start(path=dbPath){app=createApplication({dbPath:path,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  async function stop(){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;app=null;}
  async function call(who,path,method='GET',data,headers={}){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data&&!Buffer.isBuffer(data)?{'Content-Type':'application/json'}:{}),...headers},body:Buffer.isBuffer(data)?data:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,headers:response.headers,body:response.headers.get('content-type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())};}
  try{
    await start();for(const username of ['owner','master','alice','outsider'])await call(username,'/auth/register','POST',{username,password:'local-scene-media-review'});
    const room=(await call('owner','/rooms','POST',{name:'Sala de projeção'})).body,root='/rooms/'+room.id;
    for(const [username,role]of [['master','master'],['alice','player']]){const joined=await call('owner',root+'/members','POST',{username,role});assert.equal(joined.status,200,JSON.stringify(joined.body));}
    const upload=who=>call(who,root+'/scene-media?name=animacao.gif','POST',gif,{'Content-Type':'image/gif'});
    assert.equal((await upload('alice')).status,403);
    const uploaded=await upload('master');assert.equal(uploaded.status,201,JSON.stringify(uploaded.body));const asset=uploaded.body;
    assert.equal((await upload('master')).body.id,asset.id);
    assert.equal((await call('master',root+'/scene-media?name=falso.mp4','POST',gif,{'Content-Type':'video/mp4'})).status,400);
    assert.equal((await call('owner',root+'/scene-media?mapViewMode=player')).status,403);
    const video=readFileSync(new URL('./fixtures/scene-sample.mp4',import.meta.url));
    const videoUpload=await call('master',root+'/scene-media?name=amostra.mp4','POST',video,{'Content-Type':'video/mp4'});assert.equal(videoUpload.status,201,JSON.stringify(videoUpload.body));
    const videoScene=await call('master',root+'/campaign-scenes','POST',{id:'video',title:'Vídeo privado',body:'Descrição acessível.',pointIds:[],mediaId:videoUpload.body.id});assert.equal(videoScene.status,201);
    let videoView=videoScene.body;const videoRecord=videoView.state.campaignScenes.find(scene=>scene.id==='video');
    videoView=(await call('master',root+'/scene-presentation','POST',{action:'play',sceneId:'video',sceneVersion:videoRecord.version,position:0,version:videoView.state.scenePresentation.version})).body;
    assert.equal((await call('alice',root+'/scene-media/'+videoUpload.body.id,'HEAD')).headers.get('content-length'),String(video.length));
    videoView=(await call('master',root+'/scene-presentation','POST',{action:'pause',sceneId:'video',sceneVersion:videoRecord.version,position:1,version:videoView.state.scenePresentation.version})).body;assert.equal(videoView.state.scenePresentation.status,'paused');assert.equal(videoView.state.scenePresentation.position,1);
    await call('master',root+'/scene-presentation','POST',{action:'stop',version:videoView.state.scenePresentation.version});
    let saved=await call('master',root+'/campaign-scenes','POST',{id:'opening',title:'Abertura reservada',body:'Descrição da apresentação.',pointIds:[],mediaId:asset.id});
    assert.equal(saved.status,201,JSON.stringify(saved.body));let scene=saved.body.state.campaignScenes.find(scene=>scene.id==='opening'),view=saved.body;
    assert.equal(scene.media.name,'animacao.gif');assert.equal((await call('alice',root)).body.state.campaignScenes.length,0);
    assert.equal((await call('alice',root+'/scene-media/'+asset.id)).status,404);
    const combat=view.state.combat;
    const response=await fetch(base+root+'/events',{headers:{Cookie:cookies.alice},signal:(controller=new AbortController()).signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    await event();
    const command={action:'play',sceneId:scene.id,sceneVersion:scene.version,position:0,version:view.state.scenePresentation.version};
    for(const [who,query]of [['alice',''],['owner','?mapViewMode=player'],['outsider','']])assert.equal((await call(who,root+'/scene-presentation'+query,'POST',command)).status,403);
    view=(await call('master',root+'/scene-presentation','POST',command)).body;
    const live=await event();assert.equal(live.state.scenePresentation.sceneId,'opening');assert.equal(live.state.campaignScenes[0].title,'Abertura reservada');assert.deepEqual(live.state.combat,combat);
    assert.deepEqual((await call('alice',root+'/scene-media/'+asset.id)).body,gif);
    const range=await call('alice',root+'/scene-media/'+asset.id,'GET',null,{Range:'bytes=0-5'});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 0-5/${gif.length}`);assert.deepEqual(range.body,gif.subarray(0,6));
    assert.equal((await call('alice',root+'/scene-media/'+asset.id,'GET',null,{Range:'bytes=999999-'})).status,416);
    assert.equal((await call('master',root+'/scene-presentation','POST',command)).status,409);
    view=(await call('master',root+'/scene-presentation','POST',{action:'stop',version:view.state.scenePresentation.version})).body;
    const ended=await event();assert.equal(ended.state.scenePresentation.sceneId,null);assert.equal(ended.state.campaignScenes.length,0);
    assert.equal((await call('alice',root+'/scene-media/'+asset.id,'GET',null,{'If-None-Match':range.headers.get('etag')})).status,404);
    saved=await call('master',root+'/campaign-scenes/opening','PATCH',{visibility:'table',version:scene.version});assert.equal(saved.status,200);scene=saved.body.state.campaignScenes.find(scene=>scene.id==='opening');await event();
    const exported=await call('alice',root+'/exports','POST',{viewMode:'player'});assert.equal(exported.status,201);const copy=await call('alice',exported.body.downloadUrl.replace('/api',''));assert.deepEqual(copy.body.assets.sceneMedia.map(asset=>asset.id),[asset.id]);assert.equal(JSON.stringify(copy.body).includes('Vídeo privado'),false);
    assert.deepEqual((await call('alice',root+'/scene-media/'+asset.id)).body,gif);
    controller.abort();await reader.cancel().catch(()=>{});await stop();await start();
    assert.equal((await call('alice',root)).body.state.campaignScenes[0].mediaId,asset.id);
    assert.deepEqual((await call('alice',root+'/scene-media/'+asset.id)).body,gif);
    await stop();const backup=join(directory,'backup.sqlite');await createBackup(dbPath,backup);const restored=join(directory,'restored.sqlite');await restoreBackup(backup,restored);await start(restored);
    assert.deepEqual((await call('master',root)).body.state.combat,combat);assert.deepEqual((await call('alice',root+'/scene-media/'+asset.id)).body,gif);
    saved=await call('master',root+'/campaign-scenes/opening','PATCH',{visibility:'master',version:scene.version});assert.equal(saved.status,200);scene=saved.body.state.campaignScenes.find(scene=>scene.id==='opening');
    assert.equal((await call('alice',root+'/campaign-scenes/opening')).status,404);assert.equal((await call('alice',root+'/scene-media/'+asset.id)).status,404);
    assert.equal((await call('master',root+'/scene-media/'+asset.id,'DELETE')).status,409);
    view=saved.body;view=(await call('master',root+'/scene-presentation','POST',{action:'play',sceneId:'opening',sceneVersion:scene.version,position:0,version:view.state.scenePresentation.version})).body;
    saved=await call('master',root+'/campaign-scenes/opening','PATCH',{archived:true,version:scene.version});assert.equal(saved.body.state.scenePresentation.sceneId,null);assert.equal((await call('alice',root+'/scene-media/'+asset.id)).status,404);
  }finally{controller?.abort();if(app)await stop();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
