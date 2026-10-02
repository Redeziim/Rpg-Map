import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/app.js';
import {createRoomState,newPlayerSheet,newStatusProfile} from '../server/roomState.js';

test('backup cria uma cópia íntegra sem alterar o banco ativo',()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-backup-'));
  const source=join(directory,'source.sqlite'),destination=join(directory,'copy.sqlite');
  let app,copy;
  try{
    app=createApplication({dbPath:source});
    const original=app.db;
    original.prepare('INSERT INTO users VALUES(?,?,?,?)').run('owner','owner','hash','salt');
    const state={...createRoomState(),masterNotes:'campanha',playerSheets:{owner:newPlayerSheet()},statusBarsData:{owner:newStatusProfile()}};
    original.prepare('INSERT INTO rooms VALUES(?,?,?,?,?)').run('room','Campanha','owner',JSON.stringify(state),2);
    original.prepare('INSERT INTO members VALUES(?,?,?)').run('room','owner','admin');
    const result=spawnSync(process.execPath,['scripts/backup.js',destination],{cwd:process.cwd(),env:{...process.env,DB_PATH:source},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    copy=new DatabaseSync(destination,{readOnly:true});
    assert.equal(JSON.parse(copy.prepare('SELECT state FROM rooms').get().state).masterNotes,'campanha');
    assert.equal(copy.prepare('PRAGMA quick_check').get().quick_check,'ok');
    assert.equal(readFileSync(destination+'.json','utf8').includes('campanha'),false);
    assert.equal(JSON.parse(readFileSync(destination+'.json','utf8')).database.counts.rooms,1);
    assert.equal(original.prepare('SELECT revision FROM rooms').get().revision,2);
  }finally{copy?.close();app?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
