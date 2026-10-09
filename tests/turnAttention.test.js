import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {opensTurnPanel,turnAttention,turnNeedsAttention} from '../src/shared/turnAttention.js';

const kind=(...args)=>turnAttention(...args).kind;

test('nothing pending, no notice and no error: the turns button stays quiet',()=>{
  assert.deepEqual(turnAttention({pending:null,phase:'idle',notice:''},''),{kind:'',key:''});
  assert.deepEqual(turnAttention(undefined),{kind:'',key:''});
});

test('a command being sent or checked only marks the button; one left unconfirmed asks for attention',()=>{
  for(const phase of ['sending','checking'])assert.equal(kind({pending:{action:'next'},phase,notice:''}),'checking');
  for(const phase of ['unconfirmed','expired','corrupt'])assert.equal(kind({pending:{action:'next'},phase,notice:''}),'pending');
});

test('a notice after the check, or an action error, is surfaced; a pending command wins over both',()=>{
  assert.deepEqual(turnAttention({pending:null,notice:'Comando confirmado.'}),{kind:'notice',key:'Comando confirmado.'});
  assert.deepEqual(turnAttention({pending:null,notice:''},'A alteração não foi confirmada.'),{kind:'notice',key:'A alteração não foi confirmada.'});
  assert.equal(kind({pending:{action:'end'},phase:'unconfirmed',notice:'x'},'y'),'pending');
});

test('only a pending command or a notice open the panel by themselves',()=>{
  assert.deepEqual(['','checking','pending','notice'].map(opensTurnPanel),[false,false,true,true]);
});

test('a notice marks the button only until it has been opened; a pending command keeps it marked',()=>{
  const notice={kind:'notice',key:'Comando confirmado.'};
  assert.equal(turnNeedsAttention(notice,''),true);
  assert.equal(turnNeedsAttention(notice,'Comando confirmado.'),false,'aviso já visto não marca de novo');
  assert.equal(turnNeedsAttention({kind:'notice',key:'Outro aviso.'},'Comando confirmado.'),true,'um aviso diferente volta a marcar');
  assert.equal(turnNeedsAttention({kind:'pending',key:'a'},'a'),true);
  assert.equal(turnNeedsAttention({kind:'checking',key:'a'},'a'),true);
  assert.equal(turnNeedsAttention({kind:'',key:''},''),false);
});

test('the turns button wires the rule: the tracker reports it and the panel opens on it',()=>{
  const tracker=readFileSync(new URL('../src/components/TurnTracker.jsx',import.meta.url),'utf8'),pill=readFileSync(new URL('../src/components/TurnsPill.jsx',import.meta.url),'utf8');
  assert.match(tracker,/turnAttention\(recovery,error\)/);assert.match(tracker,/onAttention\?\.\(\{kind:attention\.kind,key:attention\.key\}\)/);
  assert.match(tracker,/\[attention\.kind,attention\.key,onAttention\]/,'o efeito não pode depender do objeto inteiro (laço de atualizações)');
  assert.match(pill,/opensTurnPanel\(attention\.kind\)/);assert.match(pill,/onAttention=\{setAttention\}/);assert.match(pill,/turnNeedsAttention\(attention,seenKey\)/);
});
