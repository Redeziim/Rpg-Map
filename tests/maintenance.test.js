import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createApplication} from '../server/app.js';

async function crashedExport({dbPath,exportRoot,cookie,roomId}){
  const moduleUrl=new URL('../server/app.js',import.meta.url).href;
  const worker=`import {createApplication} from ${JSON.stringify(moduleUrl)};
    const app=createApplication({dbPath:process.env.TEST_DB,exportRoot:process.env.TEST_ROOT,rateLimit:false});
    await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
    const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/rooms/'+process.env.TEST_ROOM+'/exports',{method:'POST',headers:{Cookie:process.env.TEST_COOKIE,'Content-Type':'application/json'},body:JSON.stringify({viewMode:'master'})});
    if(response.status!==201)throw Error('Exportação falhou: '+response.status);
    await response.json();process.stdout.write('ready');process.exit(0);`;
  return new Promise((done,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',worker],{env:{...process.env,TEST_DB:dbPath,TEST_ROOT:exportRoot,TEST_COOKIE:cookie,TEST_ROOM:roomId}});
    let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);
    child.on('error',reject);child.on('close',code=>code===0&&output==='ready'?done():reject(Error(error||`Processo encerrou com ${code}: ${output}`)));
  });
}

async function exportFixture({logger=()=>{},maxExportDirs=16}={}){
  const directory=mkdtempSync(join(tmpdir(),'grimorio-maintenance-export-')),dbPath=join(directory,'test.sqlite'),exportRoot=join(directory,'exports');
  const app=createApplication({dbPath,exportRoot,maintenanceIntervalMs:3600000,maintenanceMaxExportDirs:maxExportDirs,maintenanceLogger:logger,rateLimit:false});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const register=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'test-password-123'})});
  assert.equal(register.status,200);const cookie=register.headers.get('set-cookie').split(';')[0];
  const created=await fetch(base+'/rooms',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Mesa de teste'})});
  assert.equal(created.status,201);const roomId=(await created.json()).id;
  async function prepare(){const response=await fetch(base+`/rooms/${roomId}/exports`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({viewMode:'master'})});assert.equal(response.status,201);return response.json();}
  return {directory,dbPath,exportRoot,app,base,cookie,roomId,prepare,close(){app.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}};
}

test('manutenção remove sessões e convites vencidos em lotes sem tocar nos válidos',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-maintenance-'));
  const app=createApplication({dbPath:join(directory,'test.sqlite'),exportRoot:join(directory,'exports'),maintenanceBatchSize:2,maintenanceIntervalMs:3600000,rateLimit:false});
  try{
    await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
    const base=`http://127.0.0.1:${app.server.address().port}/api`;
    const register=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'test-password-123'})});
    assert.equal(register.status,200);
    const cookie=register.headers.get('set-cookie').split(';')[0],user=await register.json();
    const roomResponse=await fetch(base+'/rooms',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Mesa de teste'})});
    assert.equal(roomResponse.status,201);const room=await roomResponse.json();
    const validInvite=await fetch(base+`/rooms/${room.id}/invites`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({role:'player'})});
    assert.equal(validInvite.status,201);const validInviteId=(await validInvite.json()).id;
    assert.match(register.headers.get('set-cookie'),/Max-Age=604800/);
    const now=Date.now();
    for(let i=0;i<5;i++){
      app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`expired-${i}`,user.id,now-1000);
      app.db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?)').run(`expired-${i}`,room.id,`expired-hash-${i}`,'player',now-1000,user.id);
    }
    assert.deepEqual(app.maintenance.runOnce().database,{sessions:2,invites:2,imports:0,diceReceipts:0,combatOperations:0});
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM sessions WHERE expires<=?').get(now).n,3);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM invites WHERE expires<=?').get(now).n,3);
    app.maintenance.runOnce();app.maintenance.runOnce();
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM sessions WHERE expires<=?').get(now).n,0);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM invites WHERE expires<=?').get(now).n,0);
    assert.equal((await fetch(base+'/auth/me',{headers:{Cookie:cookie}})).status,200);
    const invites=await fetch(base+`/rooms/${room.id}/invites`,{headers:{Cookie:cookie}});
    assert.deepEqual((await invites.json()).map(entry=>entry.id),[validInviteId]);
    for(let i=0;i<29;i++)app.db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?)').run(`active-${i}`,room.id,`active-hash-${i}`,'player',now+86400000,user.id);
    const overLimit=await fetch(base+`/rooms/${room.id}/invites`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({role:'player'})});
    assert.equal(overLimit.status,400);
    for(const name of ['idx_sessions_expires','idx_invites_expires'])assert.ok(app.db.prepare("SELECT 1 FROM sqlite_schema WHERE type='index' AND name=?").get(name));
  }finally{
    app.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});
  }
});

test('exportação de outro processo ativo permanece; reinício remove apenas a cópia deixada por processo encerrado',async()=>{
  const f=await exportFixture({maxExportDirs:1});
  try{
    const active=await f.prepare();
    const activeDirectory=join(f.exportRoot,readdirSync(f.exportRoot)[0]);
    const activePath=join(activeDirectory,active.id+'.json');assert.ok(existsSync(activePath));
    await crashedExport(f);
    const directories=readdirSync(f.exportRoot);assert.equal(directories.length,2);
    const orphan=directories.find(name=>join(f.exportRoot,name)!==activeDirectory);
    assert.ok(orphan);
    const first=f.app.maintenance.runOnce(),second=f.app.maintenance.runOnce();
    assert.equal(first.exports.examined,1);assert.equal(second.exports.examined,1);
    assert.equal(first.exports.removed+second.exports.removed,1);assert.ok(existsSync(activePath));assert.equal(existsSync(join(f.exportRoot,orphan)),false);
    assert.equal((await fetch(f.base+active.downloadUrl.replace('/api',''),{headers:{Cookie:f.cookie}})).status,200);
  }finally{f.close();}
});

test('entradas inesperadas e links preservam o temporário; falha do aviso não interrompe a API',async()=>{
  const issues=[],f=await exportFixture({logger:(code,reason)=>{issues.push([code,reason]);throw Error('destino de avisos indisponível');}});
  try{
    await crashedExport(f);
    const orphan=join(f.exportRoot,readdirSync(f.exportRoot)[0]),unexpected=join(orphan,'unexpected.txt');
    writeFileSync(unexpected,'não apagar');
    const outside=join(f.directory,'outside.json');writeFileSync(outside,'preservar');
    const link=join(orphan,'linked.json');if(process.platform!=='win32')symlinkSync(outside,link);
    const result=f.app.maintenance.runOnce();assert.equal(result.exports.removed,0);assert.ok(existsSync(orphan));assert.ok(existsSync(outside));
    assert.ok(issues.some(([code])=>code==='export-preserved'));
    const invite=await fetch(f.base+`/rooms/${f.roomId}/invites`,{method:'POST',headers:{Cookie:f.cookie,'Content-Type':'application/json'},body:JSON.stringify({role:'player'})});assert.equal(invite.status,201);
    unlinkSync(unexpected);if(process.platform!=='win32')unlinkSync(link);
    const marker=join(orphan,'owner.json'),owner=readFileSync(marker);
    writeFileSync(marker,'{"private":"SEGREDO-NAO-LOGAR",');
    assert.equal(f.app.maintenance.runOnce().exports.removed,0);
    assert.equal(JSON.stringify(issues).includes('SEGREDO-NAO-LOGAR'),false);
    writeFileSync(marker,owner);
    assert.equal(f.app.maintenance.runOnce().exports.removed,1);assert.equal(existsSync(orphan),false);assert.ok(existsSync(outside));
  }finally{f.close();}
});
