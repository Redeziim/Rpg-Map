import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server/app.js';

test('private rolls are readable only by their author and the ADM, in history, snapshot, live tray and export',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-private-roll-')),dbPath=join(directory,'review.sqlite'),cookies={};
  const app=createApplication({dbPath,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${app.server.address().port}/api`;
  async function call(who,path,method='GET',data){const response=await fetch(base+path,{method,headers:{Cookie:cookies[who]||'',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const set=response.headers.get('set-cookie');if(set)cookies[who]=set.split(';')[0];const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};}
  const roll=(extra={})=>({operationId:randomUUID(),requestedAt:Date.now(),terms:[{sides:20,qty:1,sign:1}],skinId:'carmesim',origin:'group',...extra});
  const clearLive=roomId=>app.db.prepare('DELETE FROM dice_live WHERE room_id=?').run(roomId);
  try{
    for(const username of ['owner','alice','bob','carol'])await call(username,'/auth/register','POST',{username,password:'local-roll-review'});
    const room=(await call('owner','/rooms','POST',{name:'Privadas'})).body,root='/rooms/'+room.id;
    await call('owner',root+'/members','POST',{username:'alice',role:'player'});
    await call('owner',root+'/members','POST',{username:'bob',role:'player'});
    await call('owner',root+'/members','POST',{username:'carol',role:'master'});

    assert.equal((await call('alice',root+'/tray-rolls','POST',roll({private:'sim'}))).status,400);

    const secret=roll({private:true});
    const made=await call('alice',root+'/tray-rolls','POST',secret);assert.equal(made.status,201);
    const id=made.body.rollReceipt.id;
    // author: sees the entry marked as private and the live tray
    const own=(await call('alice',root+'/dice-history')).body;assert.equal(own.entries.length,1);assert.equal(own.entries[0].visibility,'private');
    assert.equal(made.body.trayRoll.id,id);
    // ADM sees it too
    const admin=(await call('owner',root+'/dice-history')).body;assert.deepEqual(admin.entries.map(entry=>entry.id),[id]);
    assert.equal((await call('owner',root)).body.trayRoll.id,id);
    // other player and other master do not see history, snapshot history or live tray
    for(const who of ['bob','carol']){
      assert.deepEqual((await call(who,root+'/dice-history')).body.entries,[],who);
      const view=(await call(who,root)).body;assert.deepEqual(view.diceHistory,[],who);assert.equal(view.trayRoll,null,who);
    }
    // repeating the same private request returns the same receipt; changing the flag conflicts
    assert.equal((await call('alice',root+'/tray-rolls','POST',secret)).body.rollReceipt.id,id);
    assert.equal((await call('alice',root+'/tray-rolls','POST',{...secret,private:false})).status,409);

    // a public roll afterwards is visible to everyone, and bob keeps seeing only the public one
    clearLive(room.id);
    const open=await call('alice',root+'/tray-rolls','POST',roll());assert.equal(open.status,201);
    const publicId=open.body.rollReceipt.id;
    assert.deepEqual((await call('bob',root+'/dice-history')).body.entries.map(entry=>entry.id),[publicId]);
    assert.deepEqual((await call('carol',root+'/dice-history')).body.entries.map(entry=>entry.id),[publicId]);
    assert.deepEqual((await call('alice',root+'/dice-history')).body.entries.map(entry=>entry.id).sort(),[id,publicId].sort());
    assert.equal((await call('bob',root)).body.trayRoll.id,publicId);

    // pagination keeps filtering consistent
    assert.equal((await call('bob',root+'/dice-history?before='+publicId)).body.entries.length,0);

    // export: ADM includes the private roll, another master does not
    const adminExport=(await call('owner',root+'/exports','POST',{viewMode:'master'})).body;
    const adminFile=(await call('owner',adminExport.downloadUrl.replace(/^\/api/,''))).body;
    assert.deepEqual(adminFile.diceHistory.map(entry=>entry.id).sort(),[id,publicId].sort());
    const masterExport=(await call('carol',root+'/exports','POST',{viewMode:'master'})).body;
    const masterFile=(await call('carol',masterExport.downloadUrl.replace(/^\/api/,''))).body;
    assert.deepEqual(masterFile.diceHistory.map(entry=>entry.id),[publicId]);
    assert.equal(masterExport.counts.diceRolls,1);
  }finally{const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;}
});
