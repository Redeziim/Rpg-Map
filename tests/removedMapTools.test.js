import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApplication} from '../server/app.js';
import {REMOVED_STATE_FIELDS,stripRemovedFields} from '../server/roomState.js';
import {testMapImage} from './fixtures/mapImages.js';
import {defaultPointTypes} from '../src/shared/pointTypes.js';

// Rotas de exploração, legenda editável e exportação de vista saíram do aplicativo (2026-10-08, ADR 036).
// O que se garante aqui: o servidor não as oferece mais e nenhum dado antigo delas chega a um cliente (visão, SSE), a uma exportação ou
// volta de um backup; o próximo salvamento da mesa apaga o que sobrou.
const SECRET='Segredo do mestre',secretRoute={id:'secret',name:SECRET,color:'#abcdef',status:'planned',visibility:'master',archived:false,waypoints:[{x:10,y:10},{x:40,y:30}]};
const cli=(script,args,env={})=>spawnSync(process.execPath,[`scripts/${script}.js`,...args],{cwd:process.cwd(),env:{...process.env,...env},encoding:'utf8'});

async function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-removed-')),dbPath=join(directory,'room.sqlite'),cookies={};let app,base,currentPath=dbPath;
  async function start(path=dbPath){currentPath=path;app=createApplication({dbPath:path,rateLimit:false});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${app.server.address().port}/api`;}
  await start();
  async function request(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  for(const username of ['owner','master','player'])await request(username,'/auth/register','POST',{username,password:'local-route-review-2026'});
  const id=(await request('owner','/rooms','POST',{name:'Sem rotas'})).body.id,root='/rooms/'+id;
  for(const [username,role] of [['master','master'],['player','player']])await request('owner',root+'/members','POST',{username,role});
  await request('master',root+'/state','PATCH',{mapImage:testMapImage});
  const stored=(path=currentPath)=>{const db=new DatabaseSync(path,{readOnly:true});try{return JSON.parse(db.prepare('SELECT state FROM rooms WHERE id=?').get(id).state);}finally{db.close();}};
  // simula uma mesa guardada por uma versão antiga: rotas privadas do mestre e uma legenda editada
  const inject=()=>{app.close();const db=new DatabaseSync(dbPath);try{const state=JSON.parse(db.prepare('SELECT state FROM rooms WHERE id=?').get(id).state);state.mapRoutes=[secretRoute];state.mapLegend=defaultPointTypes().map(entry=>({...entry,label:'Legenda antiga'}));db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify(state),id);}finally{db.close();}};
  const exported=async who=>{const job=(await request(who,root+'/exports','POST',{viewMode:who==='owner'?'master':'player'})).body;return (await request(who,job.downloadUrl.replace(/^\/api/,''))).body;};
  // primeiro evento SSE que a pessoa recebe ao abrir a mesa
  const firstEvent=async who=>{
    const controller=new AbortController(),response=await fetch(base+root+'/events',{headers:{Cookie:cookies[who]},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    try{while(!pending.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);pending+=decoder.decode(chunk.value,{stream:true});}
      return JSON.parse(pending.slice(0,pending.indexOf('\n\n')).split('\n').find(line=>line.startsWith('data: ')).slice(6));}
    finally{controller.abort();}
  };
  return {request,root,directory,dbPath,stored,inject,exported,firstEvent,view:async(who='master')=>(await request(who,root)).body,restart:start,close:()=>{app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}
const clean=(value,label)=>{const text=JSON.stringify(value);assert.equal(text.includes(SECRET),false,label+': rota privada');assert.equal(text.includes('Legenda antiga'),false,label+': legenda antiga');};

test('the five point types keep their default names and colors',()=>{
  const types=defaultPointTypes();
  assert.deepEqual(types.map(entry=>entry.type),['cidade','dungeon','taverna','floresta','evento']);
  for(const entry of types){assert.match(entry.label,/^\S/);assert.match(entry.color,/^#[0-9a-f]{6}$/i);}
});

test('the removed fields are listed in one place and stripped in place',()=>{
  assert.deepEqual([...REMOVED_STATE_FIELDS],['mapRoutes','mapLegend']);
  const state={points:[],mapRoutes:[secretRoute],mapLegend:[]};
  assert.equal(stripRemovedFields(state),state);assert.deepEqual(Object.keys(state),['points']);
});

test('a new table has no routes or legend, and the removed endpoints are gone',async()=>{
  const f=await fixture();
  try{
    const room=await f.view();
    for(const key of REMOVED_STATE_FIELDS)assert.equal(key in room.state,false,key);
    for(const key of ['mapLegendVersion','mapRouteVersions'])assert.equal(key in room,false,key);
    assert.equal((await f.request('master',f.root+'/map-routes','POST',{id:'x',name:'Rota',color:'#abcdef',status:'planned',visibility:'master',waypoints:[{x:1,y:1},{x:5,y:5}],imageVersion:room.mapImageVersion})).status,404);
    assert.equal((await f.request('master',f.root+'/map-legend','PATCH',{legend:defaultPointTypes(),version:'x'})).status,404);
    assert.equal((await f.request('master',f.root+'/state','PATCH',{mapRoutes:[]})).status,400);
  }finally{f.close();}
});

test('routes and legend stored by an older version never reach a client or an export, and the next save drops them',async()=>{
  const f=await fixture();
  try{
    f.inject();await f.restart();
    assert.ok('mapRoutes' in f.stored(),'a mesa guardada ainda tem o dado antigo antes de qualquer salvamento');
    for(const who of ['master','player','owner']){
      const room=await f.view(who);clean(room,'visão de '+who);
      for(const key of REMOVED_STATE_FIELDS)assert.equal(key in room.state,false,who+' '+key);
    }
    for(const who of ['owner','player'])clean(await f.exported(who),'exportação de '+who);
    // qualquer salvamento limpa o que sobrou
    assert.equal((await f.request('master',f.root+'/state','PATCH',{masterNotes:'qualquer alteração'})).status,200);
    const after=f.stored();for(const key of REMOVED_STATE_FIELDS)assert.equal(key in after,false,key);
  }finally{f.close();}
});

test('the live event stream (SSE) carries neither field, for the master or for a player',async()=>{
  const f=await fixture();
  try{
    f.inject();await f.restart();
    for(const who of ['master','player']){
      const event=await f.firstEvent(who);
      assert.ok(event.state,'o primeiro evento traz o estado da mesa');
      clean(event,'SSE de '+who);for(const key of REMOVED_STATE_FIELDS)assert.equal(key in event.state,false,who+' '+key);
    }
  }finally{f.close();}
});

test('a backup that still has the old fields verifies, restores and opens without leaking them',async()=>{
  const f=await fixture();
  try{
    f.inject();
    const backup=join(f.directory,'backup.sqlite'),made=cli('backup',[backup],{DB_PATH:f.dbPath});
    assert.equal(made.status,0,made.stderr);
    assert.equal(cli('restore',['--verify',backup]).status,0,'a verificação aceita o backup com campos antigos');
    const restored=join(f.directory,'restored.sqlite'),done=cli('restore',[backup,restored],{DB_PATH:f.dbPath});
    assert.equal(done.status,0,done.stderr);
    await f.restart(restored);
    assert.ok('mapRoutes' in f.stored(restored),'a cópia restaurada ainda traz o dado antigo');
    for(const who of ['master','player'])clean(await f.view(who),'mesa restaurada, visão de '+who);
    clean(await f.firstEvent('player'),'mesa restaurada, SSE do jogador');
  }finally{f.close();}
});
