import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {defaultMapScale,isMapScale,pixelDistance,measuredDistance,calibrateMapScale,gridStride,translateMeasurement,measurementLabel} from '../src/shared/mapMeasurement.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-measurement-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){
    const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};
  }
  for(const username of ['owner','master','player','outsider'])assert.equal((await request(username,'/auth/register','POST',{username,password:'local-ruler-review-2026'})).status,200);
  const room=(await request('owner','/rooms','POST',{name:'Escala da jornada'})).body.id,root=`/rooms/${room}`;
  for(const [username,role] of [['master','master'],['player','player']])assert.equal((await request('owner',root+'/members','POST',{username,role})).status,200);
  const image='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#c7ab76'}}).png().toBuffer()).toString('base64');
  await request('master',root+'/state','PATCH',{mapImage:image});
  return {request,root,image,cookies,get base(){return base;},restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('ruler calculates straight distance, calibrates from a known segment and keeps the grid readable',()=>{
  const measurement={from:{x:100,y:100},to:{x:400,y:500}},scale=defaultMapScale();
  assert.equal(pixelDistance(measurement),500);assert.equal(measuredDistance(measurement,scale),50);assert.equal(measuredDistance(measurement,null),500);
  const calibrated=calibrateMapScale({...scale,unit:'km'},measurement,250);
  assert.equal(calibrated.cellDistance,25);assert.equal(measuredDistance(measurement,calibrated),250);assert.equal(measurementLabel(measurement,calibrated),'250 km');
  assert.equal(calibrateMapScale(scale,{from:{x:1,y:1},to:{x:1,y:1}},10),null);assert.equal(calibrateMapScale(scale,measurement,-1),null);
  const moved=translateMeasurement(measurement,1000,-1000,800,600);
  assert.deepEqual(moved,{from:{x:500,y:0},to:{x:800,y:400}});assert.equal(pixelDistance(moved),500);
  for(const ratio of [.005,.02,.1,.5,1,3]){const stride=gridStride(scale,ratio);assert.equal(Math.log2(stride)%1,0);assert.ok(scale.cellSize*ratio*stride>=12);if(stride>1)assert.ok(scale.cellSize*ratio*stride/2<12);}
  for(const invalid of [{...scale,unit:' '},{...scale,cellDistance:0},{...scale,cellSize:2},{...scale,offsetX:50},{...scale,extra:true}])assert.equal(isMapScale(invalid),false);
  assert.equal(isMapScale({...scale,unit:'passos',offsetX:7,offsetY:9}),true);
});

test('scale changes enforce roles and mode, reject stale drafts and preserve unrelated map content',async()=>{
  const f=await fixture();
  try{
    let room=(await f.request('master',f.root)).body;
    for(const [who,query] of [['player','?mapViewMode=master'],['owner','?mapViewMode=player'],['outsider','']])assert.equal((await f.request(who,f.root+'/map-scale'+query,'PATCH',{scale:defaultMapScale(),version:room.mapScaleVersion})).status,403);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapScale:defaultMapScale()})).status,400);
    const stale=room.mapScaleVersion,scale={...defaultMapScale(),unit:'km',cellDistance:2.5,offsetX:7,offsetY:11};
    for(const bad of [{...scale,unit:'m\nprivate'},{...scale,cellSize:3},{...scale,cellDistance:-3},{...scale,cellDistance:Infinity},{...scale,offsetY:50}])assert.equal((await f.request('master',f.root+'/map-scale','PATCH',{scale:bad,version:stale})).status,400);
    room=(await f.request('master',f.root+'/map-scale','PATCH',{scale,version:stale})).body;
    assert.deepEqual(room.state.mapScale,scale);assert.equal(room.state.mapImage,f.image);assert.deepEqual(room.state.points,[]);
    assert.equal((await f.request('owner',f.root+'/map-scale','PATCH',{scale:defaultMapScale(),version:stale})).status,409);
    assert.deepEqual((await f.request('player',f.root)).body.state.mapScale,scale);
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:room.fogVersion})).body;
    const player=(await f.request('player',f.root)).body;
    assert.ok(player.state.mapImage.startsWith('/api/rooms/'));assert.equal(player.mapScaleVersion,room.mapScaleVersion);assert.deepEqual(player.state.mapScale,scale);
    assert.equal((await f.request('owner',f.root+'/map-scale','PATCH',{scale:null,version:room.mapScaleVersion})).status,200);
  }finally{f.close();}
});

test('scale is shared by SSE, persists after restart and is cleared on image replacement',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    const room=(await f.request('master',f.root)).body;
    const response=await fetch(f.base+f.root+'/events',{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    await event();
    const saved=(await f.request('master',f.root+'/map-scale','PATCH',{scale:defaultMapScale(),version:room.mapScaleVersion})).body;
    const changed=await event();assert.deepEqual(changed.state.mapScale,defaultMapScale());assert.equal(changed.mapImageVersion,room.mapImageVersion);assert.equal(changed.mapImageUnchanged,true);
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();
    assert.deepEqual((await f.request('player',f.root)).body.state.mapScale,defaultMapScale());
    const changedImage='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#405070'}}).png().toBuffer()).toString('base64');
    const replaced=(await f.request('master',f.root+'/state','PATCH',{mapImage:changedImage})).body;
    assert.equal(replaced.state.mapScale,null);assert.notEqual(replaced.mapScaleVersion,saved.mapScaleVersion);
    assert.equal((await f.request('master',f.root+'/map-scale','PATCH',{scale:defaultMapScale(),version:saved.mapScaleVersion})).status,409);
  }finally{controller.abort();f.close();}
});
