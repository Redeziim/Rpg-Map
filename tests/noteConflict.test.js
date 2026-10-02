import test from 'node:test';
import assert from 'node:assert/strict';
import {boardDifference,editedNoteFields,resolveNoteConflict,sameRecipients} from '../src/components/noteConflict.js';

test('a revisão mantém o rascunho editado e incorpora campos novos da mesa',()=>{
  const base={title:'Portão',body:'Pista inicial',board:{nodes:[],edges:[],strokes:[]},version:2};
  const draft={...base,body:'Minha pista'};
  const latest={...base,title:'Portão norte',body:'Pista de outra pessoa',version:3};
  const edited=editedNoteFields(draft,base);
  assert.deepEqual(edited,{title:false,body:true,board:false});
  assert.deepEqual(resolveNoteConflict(draft,latest,edited,{body:'mine'}),{...latest,body:'Minha pista'});
  assert.deepEqual(resolveNoteConflict(draft,latest,edited,{body:'latest'}),latest);
});

test('o quadro é escolhido inteiro sem descartar mudanças de texto independentes',()=>{
  const original={nodes:[],edges:[],strokes:[],width:960,height:620};
  const mine={...original,nodes:[{id:'a',text:'Pista A'}]};
  const theirs={...original,nodes:[{id:'b',text:'Pista B'}],width:1440};
  const base={title:'Nota',body:'',board:original},draft={...base,board:mine},latest={...base,body:'Atualização',board:theirs,version:4};
  const edited=editedNoteFields(draft,base);
  assert.deepEqual(resolveNoteConflict(draft,latest,edited,{board:'mine'}),{...latest,board:mine});
  assert.deepEqual(resolveNoteConflict(draft,latest,edited,{board:'latest'}),latest);
  assert.deepEqual(boardDifference(mine,theirs),{nodes:{added:1,removed:1,changed:0},edges:{added:0,removed:0,changed:0},strokes:{added:0,removed:0,changed:0},resized:true});
});

test('a seleção de acesso detecta mudanças sem depender da ordem dos participantes',()=>{
  assert.equal(sameRecipients(['alice','bob'],['bob','alice']),true);
  assert.equal(sameRecipients(['alice'],['alice','bob']),false);
  assert.equal(sameRecipients([],[]),true);
});
