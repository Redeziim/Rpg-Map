import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {createApplication} from '../server/app.js';
import {createMapImageValidator} from '../server/mapImages.js';
import {mapImageHeader,validMapDimensions,fitMapImage,resizedMapPoints,MAP_IMAGE_BYTES,MAP_IMAGE_PIXELS} from '../src/shared/mapImages.js';
import {readMapImageFile} from '../src/components/mapImagePreparation.js';
import {testMapImage,secondTestMapImage} from './fixtures/mapImages.js';

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-images-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player','outsider'])await request(username,'/auth/register','POST',{username,password:'local-images-review-2026'});
  const root='/rooms/'+(await request('owner','/rooms','POST',{name:'Prévia cartográfica'})).body.id;
  for(const [username,role] of [['master','master'],['player','player']])await request('owner',root+'/members','POST',{username,role});
  return {request,root,cookies,get base(){return base;},view:who=>request(who,root).then(result=>result.body),restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}
const dataUrl=(type,bytes)=>`data:${type};base64,${bytes.toString('base64')}`;

test('image headers bound source allocation, resolutions preserve proportion and point resizing preserves identities',async()=>{
  const image=()=>sharp({create:{width:83,height:51,channels:4,background:'#c7ab76aa'}});
  const samples=[['image/png',await image().png().toBuffer()],['image/jpeg',await image().jpeg().toBuffer()],['image/webp',await image().webp().toBuffer()],['image/webp',await image().webp({lossless:true}).toBuffer()],['image/webp',await image().webp({lossless:true}).withMetadata().toBuffer()],['image/gif',await image().gif().toBuffer()]];
  for(const [type,bytes] of samples){assert.deepEqual(mapImageHeader(bytes),{type,width:83,height:51});assert.equal((await readMapImageFile(new Blob([bytes],{type}))).width,83);}
  assert.throws(()=>mapImageHeader(new Uint8Array([137,80,78,71])));
  await assert.rejects(readMapImageFile(new Blob([samples[0][1]],{type:'image/jpeg'})),/corresponde/);
  await assert.rejects(readMapImageFile({size:21*1024*1024,slice:()=>{throw Error('must not read');}}),/20 MB/);
  const oversized=Buffer.from(samples[0][1]);oversized.writeUInt32BE(20000,16);await assert.rejects(readMapImageFile(new Blob([oversized],{type:'image/png'})),/32 milhões/);
  for(const [width,height] of [[800,500],[10000,2000],[4096,4096],[200,16000]]){for(const side of [2048,4096]){const result=fitMapImage(width,height,side);assert.equal(validMapDimensions(result.width,result.height),true);assert.ok(result.width<=width&&result.height<=height);assert.ok(Math.abs(result.width/result.height-width/height)<.01);}}
  assert.equal(validMapDimensions(4096,4096),false);assert.equal(validMapDimensions(4097,1),false);assert.equal(validMapDimensions(0,100),false);
  const points=[{id:'port',x:400,y:250,name:'Porto',description:'Pistas'}],resized=resizedMapPoints(points,{width:800,height:500},{width:2048,height:1280});assert.deepEqual(resized,[{...points[0],x:1024,y:640}]);assert.equal(points[0].x,400);
  const validate=createMapImageValidator(),pending=Array.from({length:4},()=>validate(testMapImage));await assert.rejects(validate(testMapImage),reason=>reason.status===503);await Promise.all(pending);assert.equal((await validate(testMapImage)).width,80);
});

test('map upload rejects corrupt, disguised and excessive images without changing the map and enforces roles',async()=>{
  const f=await fixture();
  try{
    let room=await f.view('master');assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:testMapImage,mapImageVersion:room.mapImageVersion})).status,200);
    await f.request('master',f.root+'/map-strokes','POST',{path:'M 10 10 L 20 20',color:'#abcdef'});
    room=await f.view('master');
    for(const [who,mode] of [['player','master'],['owner','player'],['outsider','master']])assert.equal((await f.request(who,f.root+'/state?mapViewMode='+mode,'PATCH',{mapImage:secondTestMapImage,mapImageVersion:room.mapImageVersion})).status,403);
    const oversized=await sharp({create:{width:4096,height:4096,channels:3,background:'#fff'}}).png().toBuffer();
    for(const [mapImage,status] of [['data:image/png;base64,iVBORw0KGgo=',400],[testMapImage.replace('image/png','image/jpeg'),400],[dataUrl('image/png',oversized),413],[dataUrl('image/png',Buffer.alloc(MAP_IMAGE_BYTES+1,1)),413]])assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage,mapImageVersion:room.mapImageVersion})).status,status);
    const bytes=Buffer.from(testMapImage.split(',')[1],'base64'),truncated=bytes.subarray(0,35);assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:dataUrl('image/png',truncated),mapImageVersion:room.mapImageVersion})).status,400);
    const unchanged=await f.view('master');assert.equal(unchanged.state.mapImage,testMapImage);assert.deepEqual(unchanged.state.mapStrokes,room.state.mapStrokes);assert.equal(unchanged.revision,room.revision);
    for(const [type,format] of [['image/jpeg','jpeg'],['image/webp','webp'],['image/gif','gif']]){const image=dataUrl(type,await sharp({create:{width:80,height:50,channels:3,background:'#405070'}})[format]().toBuffer());const current=await f.view('master');assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:image,mapImageVersion:current.mapImageVersion})).status,200);}
    assert.equal((await f.request('master',f.root+'/state','PATCH',{sheetFont:'fell',mapImageVersion:room.mapImageVersion})).status,400);
  }finally{f.close();}
});

test('replacement versions protect previews, concurrent point changes survive decoding, SSE and restart preserve the result',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    let room=await f.view('master');
    const competing=await Promise.all([testMapImage,secondTestMapImage].map(mapImage=>f.request('master',f.root+'/state','PATCH',{mapImage,mapImageVersion:room.mapImageVersion})));assert.deepEqual(competing.map(result=>result.status).sort(),[200,409]);
    room=await f.view('master');await f.request('master',f.root+'/state','PATCH',{points:[{id:'port',name:'Porto',x:40,y:25}],pointsVersion:room.pointsVersion});room=await f.view('master');
    const bytes=await sharp({create:{width:3000,height:2000,channels:3,background:'#789675'}}).png().toBuffer(),image=dataUrl('image/png',bytes);assert.ok(3000*2000<MAP_IMAGE_PIXELS);
    const changes=await Promise.all([f.request('master',f.root+'/state','PATCH',{mapImage:image,mapImageVersion:room.mapImageVersion}),f.request('master',f.root+'/points/port','PATCH',{description:'Mudança paralela',version:room.pointVersions.port})]);assert.deepEqual(changes.map(result=>result.status),[200,200]);
    room=await f.view('master');assert.equal(room.state.points[0].description,'Mudança paralela');
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapImage:testMapImage,mapImageVersion:competing.find(result=>result.status===200).body.mapImageVersion})).status,409);
    const response=await fetch(f.base+f.root+'/events',{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    assert.equal((await event()).state.mapImage,image);await f.request('master',f.root+'/state','PATCH',{sheetFont:'fell'});assert.equal((await event()).mapImageUnchanged,true);
    const result=await f.request('master',f.root+'/state','PATCH',{mapImage:testMapImage,mapImageVersion:room.mapImageVersion,points:resizedMapPoints(room.state.points,{width:3000,height:2000},{width:80,height:50}),pointsVersion:room.pointsVersion});assert.equal(result.status,200);assert.equal((await event()).state.mapImage,testMapImage);assert.equal(result.body.state.points[0].id,'port');assert.equal(result.body.state.points[0].x,40*80/3000);
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();const restored=await f.view('master');assert.equal(restored.state.mapImage,testMapImage);assert.deepEqual(restored.state.points,result.body.state.points);
  }finally{controller.abort();f.close();}
});
