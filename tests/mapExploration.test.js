import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {testMapImage} from './fixtures/mapImages.js';
import {defaultMapLegend} from '../src/shared/mapExploration.js';

// Rotas de exploração, legenda editável e exportação de vista saíram do aplicativo (2026-10-08).
// O que se garante aqui: o servidor não as oferece mais e nenhum dado antigo delas chega a um cliente ou a uma exportação.
const secretRoute={id:'secret',name:'Segredo do mestre',color:'#abcdef',status:'planned',visibility:'master',archived:false,waypoints:[{x:10,y:10},{x:40,y:30}]};
async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-map-exploration-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base;
  async function start(){app=createApplication({dbPath,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player'])await request(username,'/auth/register','POST',{username,password:'local-route-review-2026'});
  const id=(await request('owner','/rooms','POST',{name:'Sem rotas'})).body.id,root='/rooms/'+id;
  for(const [username,role] of [['master','master'],['player','player']])await request('owner',root+'/members','POST',{username,role});
  await request('master',root+'/state','PATCH',{mapImage:testMapImage});
  const stored=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return JSON.parse(db.prepare('SELECT state FROM rooms WHERE id=?').get(id).state);}finally{db.close();}};
  const inject=()=>{app.close();const db=new DatabaseSync(dbPath);try{const state=JSON.parse(db.prepare('SELECT state FROM rooms WHERE id=?').get(id).state);state.mapRoutes=[secretRoute];state.mapLegend=defaultMapLegend().map(entry=>({...entry,label:'Legenda antiga'}));db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(state),id);}finally{db.close();}};
  const exported=async who=>{const job=(await request(who,root+'/exports','POST',{viewMode:who==='owner'?'master':'player'})).body;return (await request(who,job.downloadUrl.replace(/^\/api/,''))).body;};
  return {request,root,stored,inject,exported,view:async(who='master')=>(await request(who,root)).body,restart:start,close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('the five point types keep their default names and colors',()=>{
  const legend=defaultMapLegend();
  assert.deepEqual(legend.map(entry=>entry.type),['cidade','dungeon','taverna','floresta','evento']);
  for(const entry of legend){assert.match(entry.label,/^\S/);assert.match(entry.color,/^#[0-9a-f]{6}$/i);}
});

test('a new table has no routes or legend, and the removed endpoints are gone',async()=>{
  const f=await fixture();
  try{
    const room=await f.view();
    for(const key of ['mapRoutes','mapLegend'])assert.equal(key in room.state,false,key);
    for(const key of ['mapLegendVersion','mapRouteVersions'])assert.equal(key in room,false,key);
    assert.equal((await f.request('master',f.root+'/map-routes','POST',{id:'x',name:'Rota',color:'#abcdef',status:'planned',visibility:'master',waypoints:[{x:1,y:1},{x:5,y:5}],imageVersion:room.mapImageVersion})).status,404);
    assert.equal((await f.request('master',f.root+'/map-legend','PATCH',{legend:defaultMapLegend(),version:'x'})).status,404);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapRoutes:[]})).status,400);
  }finally{f.close();}
});

test('routes and legend stored by an older version never reach a client or an export, and the next save drops them',async()=>{
  const f=await fixture();
  try{
    f.inject();await f.restart();
    assert.ok('mapRoutes' in f.stored(),'a mesa guardada ainda tem o dado antigo antes de qualquer salvamento');
    for(const who of ['master','player','owner']){
      const room=await f.view(who);
      assert.equal(JSON.stringify(room).includes('Segredo do mestre'),false,who);
      for(const key of ['mapRoutes','mapLegend'])assert.equal(key in room.state,false,who+' '+key);
    }
    for(const who of ['owner','player']){
      const exported=JSON.stringify(await f.exported(who));
      assert.equal(exported.includes('Segredo do mestre'),false,'exportação de '+who);assert.equal(exported.includes('Legenda antiga'),false,'exportação de '+who);
    }
    // qualquer salvamento limpa o que sobrou
    assert.equal((await f.request('master',f.root+'/state','PATCH',{masterNotes:'qualquer alteração'})).status,200);
    const after=f.stored();assert.equal('mapRoutes' in after,false);assert.equal('mapLegend' in after,false);
  }finally{f.close();}
});
