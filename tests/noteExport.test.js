import test from 'node:test';
import assert from 'node:assert/strict';
import {noteFileName,noteToJSON,noteToText} from '../src/components/noteExport.js';

const board={width:960,height:620,strokes:[],nodes:[{id:'a',kind:'text',x:0,y:0,text:'Torvin',category:'person',tags:['vilão','ponte'],pointId:'p1'},{id:'b',kind:'text',x:300,y:0,text:'Ponte velha',category:'place'},{id:'c',kind:'image',x:0,y:300,text:'',assetId:'img1'}],edges:[{id:'e',from:'a',to:'b',label:'controla'},{id:'f',from:'b',to:'c'}]};

test('text export lists the body, every card with its type, tags and linked point, and every connection',()=>{
  const text=noteToText({title:'Emboscada na ponte',body:'Linha 1\r\nLinha 2',board},{points:[{id:'p1',name:'Porto antigo'}]});
  assert.match(text,/^Emboscada na ponte\n={18}\n/);
  assert.match(text,/Linha 1\nLinha 2/);assert.doesNotMatch(text,/\r/);
  assert.match(text,/1\. Torvin · tipo: Pessoa · etiquetas: vilão, ponte · ponto do mapa: Porto antigo/);
  assert.match(text,/2\. Ponte velha · tipo: Local/);
  assert.match(text,/3\. Imagem: sem legenda/);
  assert.match(text,/- Torvin → Ponte velha \(controla\)/);
  assert.match(text,/- Ponte velha → Imagem 3\n/);
});

test('text export of a plain note has no mind map section, and an unavailable point is named as such',()=>{
  assert.doesNotMatch(noteToText({title:'Só texto',body:'abc',board:{nodes:[],edges:[],strokes:[]}}),/Mapa mental/);
  assert.match(noteToText({title:'x',body:'',board:{nodes:[{id:'a',kind:'text',text:'t',pointId:'sumiu'}],edges:[],strokes:[]}}),/ponto do mapa: indisponível/);
  assert.match(noteToText({title:'Sem corpo',body:'',board:{nodes:[],edges:[],strokes:[]}}),/\(sem texto\)/);
});

test('json export carries only the note and states its format',()=>{
  const data=JSON.parse(noteToJSON({title:'T',body:'B',board,sharedWith:['alice'],owner:'x'}));
  assert.deepEqual(Object.keys(data).sort(),['board','body','exportedAt','format','formatVersion','title']);
  assert.equal(data.format,'grimorio-note');assert.equal(data.formatVersion,1);assert.equal(data.board.nodes.length,3);
});

test('file names are safe, accent-free and never empty',()=>{
  assert.equal(noteFileName('Emboscada na Ponte!','txt'),'emboscada-na-ponte.txt');
  assert.equal(noteFileName('  ../../Ação: «Nº 1»  ','png'),'acao-n-1.png');
  assert.equal(noteFileName('','json'),'nota.json');assert.equal(noteFileName('???','json'),'nota.json');
  assert.ok(noteFileName('a'.repeat(300),'txt').length<=64);
});