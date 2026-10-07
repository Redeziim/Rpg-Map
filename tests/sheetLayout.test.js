import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeLayout,interpretSheetWords} from '../src/shared/sheetLayout.js';
import {fillGaps,interpretSheetText,mergeInterpretations} from '../src/shared/sheetImport.js';
import {buildSystemFields} from '../src/shared/sheetTemplates.js';

let counter=0;const makeId=()=>`f_${++counter}`;
const model=system=>buildSystemFields(system,makeId);
const word=(text,x,y,width=Math.max(12,text.length*11),height=20,confidence=90)=>[text,x,y,x+width,y+height,confidence];
const valuesOf=result=>Object.fromEntries(result.matches.map(match=>[match.label,match.value]));
const confidenceOf=(result,label)=>result.matches.find(match=>match.label===label)?.confidence;
const fixture=JSON.parse(readFileSync(new URL('./fixtures/ocr-dnd-words.json',import.meta.url),'utf8'));

test('real OCR of a D&D sheet with boxes: each label gets the value above, below or beside it',()=>{
  const fields=model('dnd5e'),sparse=valuesOf(interpretSheetWords({words:fixture.psm12,fields}));
  assert.equal(sparse['Personagem'],'Aria Nightwind');assert.equal(sparse['Classe'],'Ladina 5');assert.equal(sparse['Raça'],'Meio-elfo');
  assert.equal(sparse['Força'],'10');assert.equal(sparse['Destreza'],'18');assert.equal(sparse['Constituição'],'12');assert.equal(sparse['Inteligência'],'13');assert.equal(sparse['Sabedoria'],'14');
  assert.equal(sparse['Classe de Armadura'],'15');assert.equal(sparse['Deslocamento'],'9');
  assert.equal(sparse['Acrobacia (Des)'],'7');assert.equal(sparse['Atletismo (For)'],'1');assert.equal(sparse['Furtividade (Des)'],'8');assert.equal(sparse['Percepção (Sab)'],'2');assert.equal(sparse['Persuasão (Car)'],'1');
});

test('a label printed over two lines is one label, and "Classe" does not take half of "Classe de Armadura"',()=>{
  const fields=model('dnd5e');
  for(const words of [fixture.psm12,fixture.psm6]){
    const values=valuesOf(interpretSheetWords({words,fields}));
    assert.notEqual(values['Classe'],'ARMADURA');assert.notEqual(values['Classe'],'INICIATIVA');
    assert.equal(values['Classe de Armadura'],'15');
  }
});

test('values printed above a label are read with low confidence, beside or below with medium, inline with high',()=>{
  const fields=model('dnd5e'),result=interpretSheetWords({words:fixture.psm12,fields});
  assert.equal(confidenceOf(result,'Força'),'media');assert.equal(confidenceOf(result,'Classe de Armadura'),'baixa');assert.equal(confidenceOf(result,'Raça'),'baixa');
});

test('two OCR readings complete each other and never contradict a field they both found',()=>{
  const fields=model('dnd5e'),a=interpretSheetWords({words:fixture.psm12,fields}),b=interpretSheetWords({words:fixture.psm6,fields}),merged=mergeInterpretations(a,b,fields);
  const values=valuesOf(merged);
  assert.ok(merged.matches.length>=a.matches.length&&merged.matches.length>=b.matches.length);
  for(const [label,value] of Object.entries(valuesOf(a)))if(label in valuesOf(b)&&['Força','Destreza','Inteligência','Classe de Armadura'].includes(label))assert.equal(values[label],value);
  assert.equal(values['Constituição'],'12');assert.equal(values['Força'],'10');
});

test('running text only fills the gaps the position reading left, and never above medium confidence',()=>{
  const fields=model('dnd5e'),byPosition=interpretSheetWords({words:fixture.psm12,fields});
  const byText=interpretSheetText({text:'Força 1 5 +4 9\nCarisma: 8\nPontos de vida: 38 / 45',fields});
  const filled=fillGaps(byPosition,byText,fields,'media'),values=valuesOf(filled);
  assert.equal(values['Força'],'10');
  assert.equal(values['Carisma'],'8');assert.equal(confidenceOf(filled,'Carisma'),'media');
  assert.deepEqual(values['Pontos de vida'],{current:38,max:45});
});

test('digits split by the OCR are glued back, including a slash between two numbers',()=>{
  const fields=model('dnd5e');
  const words=[word('FORÇA',100,100),word('1',100,130,14,40),word('0',120,130,14,40),word('PONTOS',300,100),word('DE',380,100),word('VIDA',420,100),word('38',300,130,28,40),word('/',335,130,10,40),word('45',350,130,28,40)];
  const result=interpretSheetWords({words,fields}),values=valuesOf(result);
  assert.equal(values['Força'],'10');assert.deepEqual(values['Pontos de vida'],{current:38,max:45});
  assert.ok(describeLayout(words).some(segment=>segment.text==='10'));
});

test('a value beside its label is read, and a value far away is not',()=>{
  const fields=model('ordem');
  const near=valuesOf(interpretSheetWords({words:[word('Defesa',50,50),word('13',160,50)],fields:[...fields,{id:'x',type:'number',label:'Defesa'}]}));
  assert.equal(near['Defesa'],'13');
  const far=interpretSheetWords({words:[word('Vigor',50,50),word('2',900,50)],fields});
  assert.equal(valuesOf(far)['Vigor'],undefined);
  const faraway=interpretSheetWords({words:[word('Vigor',50,50),word('2',50,400)],fields});
  assert.equal(valuesOf(faraway)['Vigor'],undefined);
});

test('one number never serves two labels: the closest label keeps it',()=>{
  const fields=model('ordem');
  const result=interpretSheetWords({words:[word('Agilidade',50,50),word('Presença',50,150),word('3',60,80,14,22)],fields});
  const values=valuesOf(result);
  assert.equal(values['Agilidade'],'3');assert.equal(values['Presença'],undefined);
});

test('low-confidence words and punctuation noise are ignored, and an empty page reads nothing',()=>{
  const fields=model('ordem');
  assert.equal(interpretSheetWords({words:[word('Vigor',50,50,60,20,10),word('2',130,50,14,20,95)],fields}).matches.length,0);
  assert.equal(interpretSheetWords({words:[['.',1,1,5,5,90],['—',9,1,20,5,90]],fields}).matches.length,0);
  assert.equal(interpretSheetWords({words:[],fields}).matches.length,0);
});