import test from 'node:test';
import assert from 'node:assert/strict';
import {mergePointFields,pointFields} from '../src/components/pointConflict.js';

test('point review keeps local edits and takes remote fields the user did not edit',()=>{
  const base={name:'Porto',description:'Atracadouro',type:'cidade'};
  const draft={...base,description:'Meu relato da travessia'};
  const latest={name:'Porto velho',description:'Relato de outro mestre',type:'evento'};
  assert.deepEqual(mergePointFields(base,draft,latest,{}),{name:'Porto velho',description:'Meu relato da travessia',type:'evento'});
});

test('point review can choose a different version for each edited field',()=>{
  const base={name:'Porto',description:'Atracadouro',type:'cidade'};
  const draft={name:'Meu porto',description:'Meu relato',type:'floresta'};
  const latest={name:'Porto velho',description:'Relato da mesa',type:'evento'};
  assert.deepEqual(mergePointFields(base,draft,latest,{name:'latest',description:'mine',type:'latest'}),{name:'Porto velho',description:'Meu relato',type:'evento'});
  assert.deepEqual(pointFields({name:'Ponto antigo'}),{name:'Ponto antigo',description:'',type:'cidade'});
});
