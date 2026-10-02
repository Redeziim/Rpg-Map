import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage,secondTestMapImage} from './fixtures/mapImages.js';
import {defaultMapLegend,isMapLegend,isMapRouteFields,routePath,routePixels,routeDistanceLabel,visibleMapRoutes,mapExportGeometry} from '../src/shared/mapExploration.js';

const fields=(changes={})=>({name:'Caminho do porto',color:'#AbCdEf',status:'planned',visibility:'master',waypoints:[{x:10,y:10},{x:40,y:30}],...changes});
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-exploration-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player','outsider'])await request(username,'/auth/register','POST',{username,password:'local-route-review-2026'});
  const root='/rooms/'+(await request('owner','/rooms','POST',{name:'Caminhos e legenda'})).body.id;
  for(const [username,role] of [['master','master'],['player','player']])await request('owner',root+'/members','POST',{username,role});
  await request('master',root+'/state','PATCH',{mapImage:testMapImage});
  return {request,root,cookies,get base(){return base;},view:async(who='master')=>(await request(who,root)).body,restart:async()=>{app.close();await start();},close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('routes measure all segments, preserve literal names, bound export geometry and hide paths across unrevealed gaps',()=>{
  const route=fields({waypoints:[{x:0,y:0},{x:3,y:4},{x:6,y:8}]});assert.equal(isMapRouteFields(route),true);assert.equal(routePixels(route.waypoints),10);assert.equal(routeDistanceLabel(route.waypoints,{cellSize:5,cellDistance:2,unit:'km'}),'4 km');assert.equal(routePath(route.waypoints),'M 0 0 L 3 4 L 6 8');
  for(const bad of [{...route,name:' '},{...route,name:'bad\nname'},{...route,visibility:'anyone'},{...route,extra:true},{...route,waypoints:[{x:2,y:2},{x:2,y:2}]},{...route,waypoints:[{x:-1,y:3},{x:4,y:4}]},{...route,waypoints:[{x:1e-12,y:3},{x:4,y:4}]},{...route,waypoints:[{x:1.5,y:3},{x:4,y:4}]},{...route,waypoints:Array.from({length:101},(_,x)=>({x,y:1}))}])assert.equal(isMapRouteFields(bad),false);
  const legend=defaultMapLegend();assert.equal(isMapLegend(legend),true);assert.equal(isMapLegend([...legend].reverse()),false);assert.equal(isMapLegend(legend.map((entry,index)=>index?entry:{...entry,label:' '})),false);
  const fog={enabled:true,areas:[{x:0,y:0,width:20,height:20},{x:30,y:0,width:20,height:20}]},routes=[{...fields({visibility:'table',waypoints:[{x:10,y:10},{x:40,y:10}]}),id:'gap'},{...fields({visibility:'table',waypoints:[{x:1,y:1},{x:10,y:10}]}),id:'safe'},{...fields(),id:'secret'},{...fields({visibility:'table'}),id:'archive',archived:true}];
  assert.deepEqual(visibleMapRoutes(routes,false,fog).map(route=>route.id),['safe']);assert.equal(visibleMapRoutes(routes,true,fog).length,4);
  const view=mapExportGeometry({x:100,y:200,width:390,height:500},{x:-50,y:300,width:800,height:400});assert.deepEqual(view,{width:390,height:500,factor:1,x:-150,y:100,mapWidth:800,mapHeight:400});
  const big=mapExportGeometry({x:0,y:0,width:12000,height:10000},{x:20,y:-30,width:800,height:600});assert.ok(big.width*big.height<=8_000_000);assert.ok(big.width<=4096&&big.height<=4096);assert.equal(big.x,20*big.factor);assert.throws(()=>mapExportGeometry({width:0,height:0},{width:100,height:100}));
});

test('API enforces route and legend roles, rejects invalid paths, preserves concurrent drafts and limits saved routes',async()=>{
  const f=await fixture();
  try{
    let room=await f.view(),initialImage=room.mapImageVersion;
    for(const [who,query] of [['player','?mapViewMode=master'],['owner','?mapViewMode=player'],['outsider','']]){
      assert.equal((await f.request(who,f.root+'/map-routes'+query,'POST',{...fields(),id:'forbidden',imageVersion:initialImage})).status,403);
      assert.equal((await f.request(who,f.root+'/map-legend'+query,'PATCH',{legend:defaultMapLegend(),version:room.mapLegendVersion})).status,403);
    }
    for(const bad of [fields({waypoints:[{x:80,y:1},{x:20,y:2}]}),fields({waypoints:[{x:1,y:1},{x:20,y:50}]}),fields({waypoints:Array.from({length:101},(_,index)=>({x:index%79,y:1}))}),fields({color:'url(secret)'}),fields({waypoints:[{x:1.5,y:1},{x:20,y:2}]}),{...fields(),noteBody:'secret'}])assert.equal((await f.request('master',f.root+'/map-routes','POST',{...bad,id:'invalid',imageVersion:initialImage})).status,400);
    assert.equal((await f.view()).revision,room.revision);
    room=(await f.request('master',f.root+'/map-routes','POST',{...fields(),id:'private',imageVersion:initialImage})).body;
    room=(await f.request('master',f.root+'/map-routes','POST',{...fields({visibility:'table'}),id:'shared',imageVersion:initialImage})).body;
    assert.equal(room.state.mapRoutes[0].color,'#abcdef');assert.equal((await f.view('player')).state.mapRoutes.length,1);assert.equal(JSON.stringify(await f.view('player')).includes('"private"'),false);
    const competing=await Promise.all([
      f.request('master',f.root+'/map-routes/private','PATCH',{...fields({name:'Primeira revisão'}),version:room.mapRouteVersions.private,imageVersion:initialImage}),
      f.request('owner',f.root+'/map-routes/private','PATCH',{...fields({name:'Segunda revisão'}),version:room.mapRouteVersions.private,imageVersion:initialImage}),
      f.request('master',f.root+'/map-routes/shared','PATCH',{...fields({visibility:'table',status:'traveled'}),version:room.mapRouteVersions.shared,imageVersion:initialImage})
    ]);assert.deepEqual(competing.slice(0,2).map(result=>result.status).sort(),[200,409]);assert.equal(competing[2].status,200);
    room=await f.view();const oldLegend=room.mapLegendVersion,legend=defaultMapLegend().map((entry,index)=>index?entry:{...entry,label:'Portos & cidades',color:'#123456'});
    assert.equal((await f.request('master',f.root+'/map-legend','PATCH',{legend,version:oldLegend})).status,200);assert.equal((await f.request('owner',f.root+'/map-legend','PATCH',{legend:defaultMapLegend(),version:oldLegend})).status,409);assert.deepEqual((await f.view('player')).state.mapLegend,legend);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapRoutes:[]})).status,400);
    for(let index=2;index<100;index++)assert.equal((await f.request('master',f.root+'/map-routes','POST',{...fields(),id:'route-'+index,imageVersion:initialImage})).status,200);
    assert.equal((await f.request('master',f.root+'/map-routes','POST',{...fields(),id:'too-many',imageVersion:initialImage})).status,413);
  }finally{f.close();}
});

test('SSE withholds private, archived and partly covered routes; restore, restart and image replacement preserve the policy',async()=>{
  const f=await fixture(),controller=new AbortController();
  try{
    let room=await f.view();const imageVersion=room.mapImageVersion;
    await f.request('master',f.root+'/map-routes','POST',{...fields({name:'Segredo do mestre'}),id:'secret-route',imageVersion});
    room=(await f.request('master',f.root+'/map-routes','POST',{...fields({visibility:'table'}),id:'route',imageVersion})).body;
    const response=await fetch(f.base+f.root+'/events',{headers:{Cookie:f.cookies.player},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    async function event(){while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}const index=pending.indexOf('\n\n'),frame=pending.slice(0,index);pending=pending.slice(index+2);return JSON.parse(frame.split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    const first=await event();assert.deepEqual(first.state.mapRoutes.map(route=>route.id),['route']);assert.equal(JSON.stringify(first).includes('Segredo do mestre'),false);assert.equal('secret-route' in first.mapRouteVersions,false);
    room=(await f.request('master',f.root+'/map-routes/route/archive','PATCH',{archived:true,version:room.mapRouteVersions.route,imageVersion})).body;assert.deepEqual((await event()).state.mapRoutes,[]);
    assert.equal((await f.request('master',f.root+'/map-routes/route','PATCH',{...fields(),version:room.mapRouteVersions.route,imageVersion})).status,409);
    room=(await f.request('master',f.root+'/map-routes/route/archive','PATCH',{archived:false,version:room.mapRouteVersions.route,imageVersion})).body;assert.equal((await event()).state.mapRoutes[0].id,'route');
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'enable',version:room.fogVersion})).body;assert.deepEqual((await event()).state.mapRoutes,[]);
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',area:{x:0,y:0,width:20,height:20},version:room.fogVersion})).body;assert.deepEqual((await event()).state.mapRoutes,[]);
    room=(await f.request('master',f.root+'/map-fog','PATCH',{operation:'reveal',area:{x:0,y:0,width:70,height:45},version:room.fogVersion})).body;assert.equal((await event()).state.mapRoutes[0].id,'route');
    const legend=defaultMapLegend().map((entry,index)=>index?entry:{...entry,label:'Porto seguro'});await f.request('master',f.root+'/map-legend','PATCH',{legend,version:room.mapLegendVersion});assert.deepEqual((await event()).state.mapLegend,legend);
    controller.abort();await reader.cancel().catch(()=>{});await f.restart();room=await f.view();assert.equal(room.state.mapRoutes.length,2);assert.deepEqual(room.state.mapLegend,legend);
    const oldVersion=room.mapRouteVersions.route;room=(await f.request('master',f.root+'/state','PATCH',{mapImage:secondTestMapImage,mapImageVersion:imageVersion})).body;assert.deepEqual(room.state.mapRoutes,[]);assert.deepEqual(room.state.mapLegend,legend);
    assert.equal((await f.request('master',f.root+'/map-routes/route','PATCH',{...fields(),version:oldVersion,imageVersion})).status,409);
    assert.equal((await f.request('master',f.root+'/map-routes/route','PATCH',{...fields(),version:oldVersion,imageVersion:room.mapImageVersion})).status,404);
  }finally{controller.abort();f.close();}
});
