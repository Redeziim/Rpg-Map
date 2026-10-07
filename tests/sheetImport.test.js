import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretSheetText} from '../src/shared/sheetImport.js';
import {buildSystemFields} from '../src/shared/sheetTemplates.js';

let counter=0;const makeId=()=>`f_${++counter}`;
const model=system=>buildSystemFields(system,makeId);
const read=(system,input)=>{const fields=model(system),result=interpretSheetText({...input,fields}),by=new Map(result.matches.map(match=>[match.label,match]));return {fields,result,get:label=>by.get(label)?.value,confidence:label=>by.get(label)?.confidence};};

test('D&D 5e sheet in Portuguese: label and value on one line, with the usual separators',()=>{
  const sheet=['Nome do personagem: Aria Nightwind','Classe: Ladina      Raça: Meio-elfo','Alinhamento - Caótico Neutro','Nível: 5','Força 10   Destreza: 18','Constituição - 12','Inteligência 13','Sabedoria 14','Carisma 8','Classe de Armadura 15','Deslocamento 9','Pontos de vida: 38 / 45','Inspiração 1'].join('\n');
  const {get,confidence}=read('dnd5e',{text:sheet});
  assert.equal(get('Personagem'),'Aria Nightwind');assert.equal(get('Classe'),'Ladina');assert.equal(get('Raça'),'Meio-elfo');assert.equal(get('Alinhamento'),'Caótico Neutro');
  assert.equal(get('Nível'),'5');assert.equal(get('Força'),'10');assert.equal(get('Destreza'),'18');assert.equal(get('Constituição'),'12');assert.equal(get('Inteligência'),'13');assert.equal(get('Sabedoria'),'14');assert.equal(get('Carisma'),'8');
  assert.equal(get('Classe de Armadura'),'15');assert.equal(get('Deslocamento'),'9');assert.deepEqual(get('Pontos de vida'),{current:38,max:45});
  assert.equal(confidence('Força'),'alta');
});

test('skills read with the attribute in parentheses, signs and English names',()=>{
  const {get}=read('dnd5e',{text:'Acrobacia (Des) +6\nAtletismo (For): -1\nStealth +4\nSleight of Hand ..... 7\nPercepção 3'});
  assert.equal(get('Acrobacia (Des)'),'6');assert.equal(get('Atletismo (For)'),'-1');assert.equal(get('Furtividade (Des)'),'4');assert.equal(get('Prestidigitação (Des)'),'7');assert.equal(get('Percepção (Sab)'),'3');
});

test('Ordem Paranormal sheet: attribute initials, resources as current/max, NEX with percent',()=>{
  const sheet=['Personagem: Júlia Torres','Origem: Policial','Classe: Combatente','Trilha: Aniquilador','NEX 50%','AGI 3   FOR 2   INT 1   PRE 3   VIG 2','PV 24/30','PE 12 de 18','SAN 30/45','Deslocamento 9','Luta +10','Pontaria 5'].join('\n');
  const {get}=read('ordem',{text:sheet});
  assert.equal(get('Personagem'),'Júlia Torres');assert.equal(get('Origem'),'Policial');assert.equal(get('Classe'),'Combatente');assert.equal(get('Trilha'),'Aniquilador');
  assert.equal(get('NEX'),'50');assert.equal(get('Agilidade'),'3');assert.equal(get('Força'),'2');assert.equal(get('Intelecto'),'1');assert.equal(get('Presença'),'3');assert.equal(get('Vigor'),'2');
  assert.deepEqual(get('Pontos de Vida'),{current:24,max:30});assert.deepEqual(get('Pontos de Esforço'),{current:12,max:18});assert.deepEqual(get('Sanidade'),{current:30,max:45});
  assert.equal(get('Deslocamento'),'9');assert.equal(get('Luta (For)'),'10');assert.equal(get('Pontaria (Agi)'),'5');
});

test('accents lost by OCR and different casing still match, and the original spelling is kept in the value',()=>{
  const {get}=read('dnd5e',{text:'FORCA 16\nconstituicao: 14\nPersonagem: João da Silva'});
  assert.equal(get('Força'),'16');assert.equal(get('Constituição'),'14');assert.equal(get('Personagem'),'João da Silva');
});

test('a value printed on the next line or above the label is read, with a lower confidence',()=>{
  const {get,confidence}=read('dnd5e',{text:'Força\n16\n\nAria Nightwind\nNome do personagem\n+5\nAcrobacia'});
  assert.equal(get('Força'),'16');assert.equal(confidence('Força'),'media');
  assert.equal(get('Personagem'),'Aria Nightwind');assert.equal(confidence('Personagem'),'baixa');
  assert.equal(get('Acrobacia (Des)'),'5');assert.equal(confidence('Acrobacia (Des)'),'baixa');
});

test('a modifier or a saving throw never fills the plain ability',()=>{
  const {get,result}=read('dnd5e',{text:'Mod. Força +3\nSalvaguarda de Destreza +5\nModificador de Constituição 2'});
  assert.equal(get('Força'),undefined);assert.equal(get('Constituição'),undefined);
  assert.equal(get('Salvaguarda de Destreza'),'5');
  assert.ok(result.missing.some(item=>item.label==='Força'));
});

test('short initials only match in capitals, so common words do not become attributes',()=>{
  const {get}=read('ordem',{text:'Preparado para o combate for 3 horas\nVigor 2'});
  assert.equal(get('Força'),undefined);assert.equal(get('Vigor'),'2');
});

test('PDF form fields are exact hits, including current and maximum hit points',()=>{
  const formFields=[{name:'STR',value:'16'},{name:'DEX',value:'14'},{name:'CharacterName',value:'Aria Nightwind'},{name:'ClassLevel',value:'Rogue 5'},{name:'HPMax',value:'45'},{name:'HPCurrent',value:'38'},{name:'Acrobatics',value:'+5'},{name:'SleightofHand',value:'7'},{name:'Race ',value:'Half-elf'},{name:'Vazio',value:''}];
  const {get,confidence,result}=read('dnd5e',{formFields});
  assert.equal(get('Força'),'16');assert.equal(get('Destreza'),'14');assert.equal(get('Personagem'),'Aria Nightwind');assert.equal(get('Classe'),'Rogue 5');
  assert.deepEqual(get('Pontos de vida'),{current:38,max:45});assert.equal(get('Acrobacia (Des)'),'5');assert.equal(get('Prestidigitação (Des)'),'7');assert.equal(get('Raça'),'Half-elf');
  assert.equal(confidence('Força'),'alta');assert.ok(result.matches.every(match=>match.source==='campo do PDF'));
});

test('formulas, images, lists and long texts are never filled, and are reported for manual entry',()=>{
  const {result}=read('dnd5e',{text:'Mod. Força 3\nBônus de proficiência 3\nIniciativa +2'});
  assert.ok(!result.matches.some(match=>['Mod. Força','Bônus de proficiência','Iniciativa'].includes(match.label)));
  assert.ok(result.manual.some(item=>item.label==='Retrato'&&item.type==='image'));assert.ok(result.manual.some(item=>item.label==='Equipamento'&&item.type==='list'));
});

test('nothing recognizable gives an empty result instead of an error; absurd numbers are refused',()=>{
  const empty=read('ordem',{text:'Receita de bolo\n2 xícaras de farinha'});
  assert.equal(empty.result.matches.length,0);assert.ok(empty.result.missing.length>10);
  assert.equal(read('dnd5e',{text:'Força 123456'}).get('Força'),undefined);
  assert.equal(read('dnd5e',{text:''}).result.matches.length,0);
});

test('a number is never given to two fields',()=>{
  const {result}=read('ordem',{text:'Agilidade 3 Força 2'});
  assert.equal(new Set(result.matches.map(match=>match.evidence+match.value)).size,result.matches.length);
  assert.equal(result.matches.find(match=>match.label==='Agilidade').value,'3');assert.equal(result.matches.find(match=>match.label==='Força').value,'2');
});
test('two columns joined by OCR with a single space are split at the next label',()=>{
  const {get}=read('ordem',{text:'Personagem: Júlia Torres Origem: Policial\nClasse: Combatente Trilha: Aniquilador Patente: Operador'});
  assert.equal(get('Personagem'),'Júlia Torres');assert.equal(get('Origem'),'Policial');
  assert.equal(get('Classe'),'Combatente');assert.equal(get('Trilha'),'Aniquilador');assert.equal(get('Patente'),'Operador');
  // A value that merely contains a word that is also a label (without a colon) stays whole.
  assert.equal(read('dnd5e',{text:'Personagem: Força de Vontade'}).get('Personagem'),'Força de Vontade');
});