import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleValues} from '../src/shared/sheetExample.js';
import {resolveFormulas} from '../src/shared/sheetFormulas.js';

const fields=[
  {id:'a',type:'text',label:'Personagem',tab:'Identidade'},
  {id:'b',type:'text',label:'Origem',tab:'Identidade'},
  {id:'c',type:'number',label:'Força',tab:'Atributos'},
  {id:'d',type:'number',label:'Defesa',tab:'Combate'},
  {id:'e',type:'textarea',label:'Habilidades',tab:'Habilidades'},
  {id:'f',type:'status',label:'Vida',tab:'Recursos'},
  {id:'g',type:'list',label:'Inventário',tab:'Equipamento'},
  {id:'h',type:'checklist',label:'Tarefas',tab:'Equipamento'},
  {id:'i',type:'attack',label:'Espada',tab:'Combate'},
  {id:'j',type:'image',label:'Retrato',tab:'Aparência'},
  {id:'k',type:'formula',label:'Modificador',tab:'Atributos',formula:'(Força-10)/2'},
];

test('example values fill every kind of field the player sheet edits, and only the fields of the model',()=>{
  const values=exampleValues(fields);
  assert.equal(values.a,'Aria Valdemar');
  assert.equal(values.b,'Exemplo');
  assert.match(values.c,/^\d+$/);
  assert.ok(Number(values.c)>=10&&Number(values.c)<=16,'attributes read like attribute scores');
  assert.ok(values.e.includes('\n'));
  assert.deepEqual(values.f,{current:7,max:10});
  assert.equal(values.g.length,2);
  assert.equal(values.h.length,2);
  assert.ok(values.h.every(item=>item.id&&typeof item.checked==='boolean'));
  assert.deepEqual(values.i,{bonus:3,damage:'1d8+2'});
  assert.equal('j' in values,false,'images and formulas are not filled');
  assert.equal('k' in values,false);
  assert.deepEqual(Object.keys(values).filter(id=>!fields.some(field=>field.id===id)),[]);
});

test('the example attribute lets a formula field show a number in the preview',()=>{
  const values=exampleValues(fields);
  assert.equal(typeof resolveFormulas(fields,values).get('k'),'number');
});

test('an empty model has no example values',()=>{
  assert.deepEqual(exampleValues([]),{});
});
