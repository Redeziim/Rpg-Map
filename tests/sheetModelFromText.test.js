import test from 'node:test';
import assert from 'node:assert/strict';
import {inferSheetModel} from '../src/shared/sheetModelFromText.js';
import {cleanSheetFields} from '../src/shared/sheetModels.js';

const byLabel=(model,label)=>model.fields.find(field=>field.label===label);

test('a TXT written by hand: headings, types by hint, formulas and plain labels',()=>{
  const model=inferSheetModel({fileName:'minha-ficha.txt',text:[
    '# Identidade','Personagem','Classe','Nível [número]',
    '## Atributos','Força','Destreza','Mod. Força = piso((Força-10)/2)',
    '[Recursos]','Pontos de vida [barra]','Mana: 10/20',
    'Biografia [longo]','Retrato [imagem]'].join('\n')});
  assert.equal(byLabel(model,'Personagem').tab,'Identidade');assert.equal(byLabel(model,'Personagem').type,'text');
  assert.equal(byLabel(model,'Nível').type,'number');
  assert.equal(byLabel(model,'Força').tab,'Atributos');assert.equal(byLabel(model,'Força').type,'number');
  assert.deepEqual([byLabel(model,'Mod. Força').type,byLabel(model,'Mod. Força').formula],['formula','piso((Força-10)/2)']);
  assert.equal(byLabel(model,'Pontos de vida').type,'status');assert.equal(byLabel(model,'Pontos de vida').tab,'Recursos');
  assert.equal(byLabel(model,'Mana').type,'status');
  assert.equal(byLabel(model,'Biografia').type,'textarea');assert.equal(byLabel(model,'Retrato').type,'image');
  assert.equal(model.title,'minha ficha');
  assert.ok(model.readings.length===1&&model.readings[0].startsWith('# Identidade'),'a revisão pode mostrar o que foi lido');
  assert.equal(model.system,null,'uma ficha própria não é tomada por um sistema conhecido');
});

test('a filled sheet read from a PDF: label and value on the same line, columns split by wide gaps',()=>{
  const model=inferSheetModel({text:['Ficha do Investigador','Nome: Arthur Pym   Idade: 34','FORÇA   65   CONSTITUIÇÃO   60','Pontos de Vida   10 / 12','Ocupação: Jornalista'].join('\n')});
  assert.equal(byLabel(model,'Nome').type,'text');assert.equal(byLabel(model,'Idade').type,'number');
  assert.equal(byLabel(model,'Pontos de Vida').type,'status');assert.equal(byLabel(model,'Ocupação').type,'text');
  assert.ok(model.fields.every(field=>!/Arthur|Jornalista/.test(field.label)),'o valor lido nunca vira nome de campo');
});

test('columns glued into one line are split when every word is a label the library knows',()=>{
  const model=inferSheetModel({text:['ATRIBUTOS','Força Destreza Constituição','Inteligência Sabedoria Carisma','Nome do herói'].join('\n')});
  assert.deepEqual(model.fields.map(field=>field.label),['Força','Destreza','Constituição','Inteligência','Sabedoria','Carisma','Nome do herói']);
});

test('a picture: words placed side by side become separate fields, and the sheet title is not a field',()=>{
  // [texto,x0,y0,x1,y1,confiança] como o OCR devolve
  const word=(text,x,y)=>[text,x,y,x+text.length*10,y+16,90];
  const words=[word('FICHA',10,10),word('DE',70,10),word('PERSONAGEM',100,10),
    word('PERÍCIAS'.replace('Í','I'),10,60),
    word('NOME',10,110),word('DO',60,110),word('PERSONAGEM',90,110),word('CLASSE',420,110),word('NÍVEL',700,110),
    word('PONTOS',10,160),word('DE',80,160),word('VIDA',110,160),word('INICIATIVA',420,160)];
  const model=inferSheetModel({wordSets:[words]});
  const labels=model.fields.map(field=>field.label);
  assert.ok(!labels.some(label=>/ficha/i.test(label)));
  for(const expected of ['Nome do personagem','Classe','Nível','Iniciativa','Pontos de vida'])assert.ok(labels.includes(expected),expected+' em '+labels.join(', '));
});

test('matching a known system never leaves a duplicate field or a formula that points at fields the model does not have',()=>{
  const model=inferSheetModel({text:['Nome do personagem','Personagem','Classe','Raça','Nível','Classe de Armadura','Iniciativa','Deslocamento','Pontos de vida','ATRIBUTOS','Força','Destreza','Constituição'].join('\n')});
  assert.equal(model.fields.filter(field=>field.label==='Personagem').length,1);
  assert.notEqual(byLabel(model,'Iniciativa').type,'formula');
  assert.ok(model.fields.every(field=>field.type!=='formula'||field.formula));
});

test('a heading read without its accent still gets the accented name',()=>{
  const model=inferSheetModel({text:['PERICIAS','Acrobacia (Des)','Atletismo (For)'].join('\n')});
  assert.equal(byLabel(model,'Acrobacia (Des)').tab,'Perícias');
});

test('noise is ignored: page numbers, links, copyright, sentences and bare numbers',()=>{
  const model=inferSheetModel({text:['www.exemplo.com.br','Página 2 de 4','© 2024 Editora Exemplo. Todos os direitos reservados.','12','Role dois dados e some o resultado para saber se o personagem acerta o alvo com sucesso.','Defesa','Percepção (Sab)'].join('\n')});
  assert.deepEqual(model.fields.map(field=>field.label),['Defesa','Percepção (Sab)']);
  assert.equal(byLabel(model,'Percepção (Sab)').type,'number');
});

test('repeated labels are kept once and the model never passes the 200 field limit',()=>{
  const many=Array.from({length:260},(_,index)=>`Campo número ${String.fromCharCode(65+index%26)}${String.fromCharCode(97+Math.floor(index/26))}`).join('\n');
  const model=inferSheetModel({text:['Força','Força','FORÇA',many].join('\n')});
  assert.equal(model.fields.filter(field=>field.label.toLowerCase()==='força').length,1);
  assert.ok(model.fields.length<=200);assert.ok(model.notes.some(note=>/200/.test(note)));
});

test('a blank sheet of a known system is recognised and takes its types, categories and formulas',()=>{
  const text=['Nível','Classe de Armadura','ATRIBUTOS','Força','Destreza','Constituição','Inteligência','Sabedoria','Carisma','PERÍCIAS','Acrobacia (Des)','Atletismo (For)','Furtividade (Des)','Percepção (Sab)','Persuasão (Car)'].join('\n');
  const model=inferSheetModel({text});
  assert.equal(model.system?.id,'dnd5e');assert.match(model.notes.join(' '),/D&D 5ª edição/);
  assert.equal(byLabel(model,'Nível').tab,'Identidade');assert.equal(byLabel(model,'Classe de Armadura').tab,'Combate');
});

test('a fillable PDF with named form fields becomes a model from those names, ignoring generic ones',()=>{
  const model=inferSheetModel({text:'',formFieldNames:['CharacterName','ClassLevel','Text Box 12','Check Box 3','STR','DEX','HP Current','Backstory_Notes','Gold 1']});
  const labels=model.fields.map(field=>field.label);
  assert.ok(labels.includes('Character Name')&&labels.includes('Class Level')&&labels.includes('HP Current'));
  assert.ok(!labels.some(label=>/Text Box|Check Box/i.test(label)));
});

test('what comes out is always accepted by the same rules the server applies',()=>{
  const model=inferSheetModel({text:['# Atributos','Força','Mod. Força = piso((Força-10)/2)','Vida [barra]','Notas [longo]','Lista de itens [lista]'].join('\n')});
  const clean=cleanSheetFields(model.fields);
  assert.equal(clean.length,model.fields.length);
  assert.ok(clean.every(field=>!('evidence' in field)&&!('from' in field)));
});

test('a nearly empty file says so instead of inventing a model',()=>{
  const model=inferSheetModel({text:'12\n\n   \n',fileName:'vazio.txt'});
  assert.equal(model.fields.length,0);assert.ok(model.notes.some(note=>/poucos campos/i.test(note)));
});
