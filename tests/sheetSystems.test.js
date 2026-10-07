import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFormula,resolveFormulas,toNumber} from '../src/shared/sheetFormulas.js';
import {FIELD_ALIASES,SHEET_SYSTEMS,baseLabel,buildSystemFields} from '../src/shared/sheetTemplates.js';

let counter=0;const makeId=()=>`f_${++counter}`;
const model=system=>buildSystemFields(system,makeId);
const idOf=(fields,label)=>fields.find(field=>field.label===label)?.id;
function compute(system,entries){
  const fields=model(system),values={};
  for(const [label,value] of Object.entries(entries)){const id=idOf(fields,label);assert.ok(id,`campo ausente: ${label}`);values[id]=value;}
  const results=resolveFormulas(fields,values);
  return label=>results.get(idOf(fields,label));
}

test('formulas: arithmetic by field name, empty values count as zero, longer labels win',()=>{
  assert.equal(evaluateFormula('Força+2',{Força:3}),5);
  assert.equal(evaluateFormula('Mod. Força*2',{Força:99,'Mod. Força':4}),8);
  assert.equal(evaluateFormula('piso((Força-10)/2)',{Força:'15'}),2);
  assert.equal(evaluateFormula('piso((Força-10)/2)',{Força:7}),-2);
  assert.equal(evaluateFormula('teto(Força/2)+min(Força,4)+max(Força,9)+abs(0-Força)',{Força:5}),3+4+9+5);
  assert.equal(evaluateFormula('Força+Agilidade',{Força:'',Agilidade:undefined}),0);
  assert.equal(evaluateFormula('',{}),null);
  assert.equal(toNumber({current:7,max:9}),7);assert.equal(toNumber('abc'),0);assert.equal(toNumber(false),0);
});

test('formulas never run anything but arithmetic',()=>{
  for(const formula of ['process.exit(1)','constructor.constructor("return 1")()','Força;1','1/0','Força(','alert(1)','piso(Força','Math.floor(2)','this','`1`','1+Dano'])assert.equal(evaluateFormula(formula,{Força:2}),'erro',formula);
  // A label cannot smuggle code in: it is replaced by a number before anything is checked.
  assert.equal(evaluateFormula('Força',{Força:'process.exit(1)'}),0);
  assert.equal(evaluateFormula('x',{'x':'1);process.exit(1);('}),0);
});

test('formula chains resolve in order, and a cycle or a broken link shows as an error',()=>{
  const fields=[{id:'a',type:'number',label:'Base'},{id:'b',type:'formula',label:'Dobro',formula:'Base*2'},{id:'c',type:'formula',label:'Dobro mais um',formula:'Dobro+1'},
    {id:'d',type:'formula',label:'Ciclo A',formula:'Ciclo B+1'},{id:'e',type:'formula',label:'Ciclo B',formula:'Ciclo A+1'},{id:'f',type:'formula',label:'Quebrada',formula:'Base+'},{id:'g',type:'formula',label:'Depende da quebrada',formula:'Quebrada+1'}];
  const results=resolveFormulas(fields,{a:'4'});
  assert.equal(results.get('b'),8);assert.equal(results.get('c'),9);
  assert.equal(results.get('d'),'erro');assert.equal(results.get('e'),'erro');assert.equal(results.get('f'),'erro');assert.equal(results.get('g'),'erro');
});

test('every template is well formed: unique labels, valid tabs and formulas that resolve',()=>{
  for(const system of SHEET_SYSTEMS){
    const fields=model(system.id);
    assert.equal(new Set(fields.map(field=>field.label)).size,fields.length,`${system.id}: rótulos repetidos`);
    assert.equal(new Set(fields.map(field=>field.id)).size,fields.length);
    for(const field of fields){assert.ok(['text','textarea','number','image','list','formula','status','attack','checklist'].includes(field.type));assert.ok(field.tab&&field.label.length<=60);}
    const ones=Object.fromEntries(fields.filter(field=>field.type==='number').map(field=>[field.id,1]));
    for(const [id,value] of resolveFormulas(fields,ones))assert.notEqual(value,'erro',`${system.id}: fórmula quebrada em ${fields.find(field=>field.id===id).label}`);
  }
  assert.throws(()=>buildSystemFields('inexistente',makeId));
});

test('D&D 5e: modifiers, proficiency, initiative and passive perception follow the 5e rules',()=>{
  const read=compute('dnd5e',{Força:16,Destreza:14,Constituição:8,Inteligência:10,Sabedoria:13,Carisma:9,Nível:5,'Percepção (Sab)':4});
  assert.equal(read('Mod. Força'),3);assert.equal(read('Mod. Destreza'),2);assert.equal(read('Mod. Constituição'),-1);assert.equal(read('Mod. Inteligência'),0);assert.equal(read('Mod. Sabedoria'),1);assert.equal(read('Mod. Carisma'),-1);
  assert.equal(read('Bônus de proficiência'),3);assert.equal(read('Iniciativa'),2);assert.equal(read('Percepção passiva'),14);
  for(const [level,bonus] of [[1,2],[4,2],[5,3],[8,3],[9,4],[13,5],[17,6],[20,6]])assert.equal(compute('dnd5e',{Nível:level})('Bônus de proficiência'),bonus,`nível ${level}`);
});

test('Ordem Paranormal: NEX level, defense and the class resources follow the rulebook formulas',()=>{
  const read=compute('ordem',{NEX:50,Agilidade:3,Vigor:2,Presença:3});
  assert.equal(read('Nível de NEX'),10);assert.equal(read('Defesa'),13);
  assert.equal(read('PV máximo · Combatente'),20+2+9*(4+2));
  assert.equal(read('PV máximo · Especialista'),16+2+9*(3+2));
  assert.equal(read('PV máximo · Ocultista'),12+2+9*(2+2));
  assert.equal(read('PE máximo · Combatente'),2+3+9*(2+3));
  assert.equal(read('PE máximo · Especialista'),3+3+9*(3+3));
  assert.equal(read('PE máximo · Ocultista'),4+3+9*(4+3));
  assert.equal(read('Sanidade máxima · Combatente'),12+9*3);assert.equal(read('Sanidade máxima · Especialista'),16+9*4);assert.equal(read('Sanidade máxima · Ocultista'),20+9*5);
  for(const [nex,level] of [[5,1],[10,2],[45,9],[95,19],[99,20]])assert.equal(compute('ordem',{NEX:nex})('Nível de NEX'),level,`NEX ${nex}%`);
  assert.equal(compute('ordem',{NEX:5,Vigor:1})('PV máximo · Combatente'),21);
});

test('Ordem Paranormal has the 5 attributes, 3 resources and 28 skills with the base attribute in the label',()=>{
  const fields=model('ordem'),skills=fields.filter(field=>field.tab==='Perícias');
  assert.equal(skills.length,28);assert.ok(skills.every(field=>/\((Agi|For|Int|Pre|Vig)\)$/.test(field.label)));
  assert.deepEqual(fields.filter(field=>field.tab==='Atributos').map(field=>field.label),['Agilidade','Força','Intelecto','Presença','Vigor']);
  assert.deepEqual(fields.filter(field=>field.tab==='Recursos').map(field=>field.type),['status','status','status']);
});

test('D&D 5e has six abilities, six saving throws and the 18 skills, each with its ability',()=>{
  const fields=model('dnd5e');
  assert.equal(fields.filter(field=>field.tab==='Perícias').length,18);assert.equal(fields.filter(field=>field.tab==='Salvaguardas').length,6);
  assert.equal(fields.filter(field=>field.tab==='Atributos'&&field.type==='number').length,6);
  assert.ok(fields.filter(field=>field.tab==='Perícias').every(field=>/\((For|Des|Con|Int|Sab|Car)\)$/.test(field.label)));
});

test('every alias belongs to a field that some template actually has',()=>{
  const labels=new Set(SHEET_SYSTEMS.flatMap(system=>model(system.id).map(field=>baseLabel(field.label))));
  for(const key of FIELD_ALIASES.keys())assert.ok(labels.has(key),`apelido sem campo: ${key}`);
});