// Modelos de ficha por sistema. Um modelo é só uma lista de campos do mesmo tipo que o mestre já monta à mão;
// aplicar um modelo nunca fixa o sistema da mesa: dá para somar campos, trocar de modelo ou editar tudo depois.
// Só nomes de campos e fórmulas de regra entram aqui. Nenhum texto de livro foi copiado.
// D&D 5e: campos do SRD 5.1 (licença CC BY 4.0, Wizards of the Coast). Ordem Paranormal: mecânica de jogo da Jambô Editora.

// Rótulo sem o atributo entre parênteses: "Acrobacia (Des)" -> "Acrobacia".
import {MORE_SYSTEMS} from './sheetSystemsMore.js';

export const baseLabel=label=>String(label||'').replace(/\s*\([^)]*\)\s*$/,'').trim();

const DND_ABILITIES=[['Força','For','STR','Strength'],['Destreza','Des','DEX','Dexterity'],['Constituição','Con','CON','Constitution'],['Inteligência','Int','INT','Intelligence'],['Sabedoria','Sab','WIS','Wisdom'],['Carisma','Car','CHA','Charisma']];
// [rótulo, abreviação do atributo, nome em inglês]
const DND_SKILLS=[['Acrobacia','Des','Acrobatics'],['Adestrar Animais','Sab','Animal Handling'],['Arcanismo','Int','Arcana'],['Atletismo','For','Athletics'],['Atuação','Car','Performance'],['Enganação','Car','Deception'],['Furtividade','Des','Stealth'],['História','Int','History'],['Intimidação','Car','Intimidation'],['Intuição','Sab','Insight'],['Investigação','Int','Investigation'],['Medicina','Sab','Medicine'],['Natureza','Int','Nature'],['Percepção','Sab','Perception'],['Persuasão','Car','Persuasion'],['Prestidigitação','Des','Sleight of Hand'],['Religião','Int','Religion'],['Sobrevivência','Sab','Survival']];
const OP_ATTRIBUTES=['Agilidade','Força','Intelecto','Presença','Vigor'];
const OP_SKILLS=[['Acrobacia','Agi'],['Adestramento','Pre'],['Artes','Pre'],['Atletismo','For'],['Atualidades','Int'],['Ciências','Int'],['Crime','Agi'],['Diplomacia','Pre'],['Enganação','Pre'],['Fortitude','Vig'],['Furtividade','Agi'],['Iniciativa','Agi'],['Intimidação','Pre'],['Intuição','Pre'],['Investigação','Int'],['Luta','For'],['Medicina','Int'],['Ocultismo','Int'],['Percepção','Pre'],['Pilotagem','Agi'],['Pontaria','Agi'],['Profissão','Int'],['Reflexos','Agi'],['Religião','Pre'],['Sobrevivência','Int'],['Tática','Int'],['Tecnologia','Int'],['Vontade','Pre']];
// Por classe: [vida inicial, vida por nível, esforço inicial, esforço por nível, sanidade inicial, sanidade por nível]
const OP_CLASSES=[['Combatente',20,4,2,2,12,3],['Especialista',16,3,3,3,16,4],['Ocultista',12,2,4,4,20,5]];

const f=(type,label,tab,extra={})=>({type,label,tab,...extra});

function dndFields(){
  return [
    f('text','Personagem','Identidade'),f('text','Classe','Identidade'),f('text','Raça','Identidade'),f('text','Antecedente','Identidade'),f('text','Alinhamento','Identidade'),f('number','Nível','Identidade'),f('number','Pontos de experiência','Identidade'),
    ...DND_ABILITIES.map(([name])=>f('number',name,'Atributos')),
    ...DND_ABILITIES.map(([name])=>f('formula',`Mod. ${name}`,'Atributos',{formula:`piso((${name}-10)/2)`})),
    f('formula','Bônus de proficiência','Combate',{formula:'2+piso((Nível-1)/4)'}),
    f('number','Classe de Armadura','Combate'),f('formula','Iniciativa','Combate',{formula:'Mod. Destreza'}),f('number','Deslocamento','Combate'),f('status','Pontos de vida','Combate'),f('text','Dados de vida','Combate'),f('number','Inspiração','Combate'),
    f('formula','Percepção passiva','Combate',{formula:'10+Percepção (Sab)'}),
    ...DND_ABILITIES.map(([name])=>f('number',`Salvaguarda de ${name}`,'Salvaguardas')),
    ...DND_SKILLS.map(([name,attribute])=>f('number',`${name} (${attribute})`,'Perícias')),
    f('textarea','Características e talentos','Habilidades'),f('textarea','Proficiências e idiomas','Habilidades'),f('textarea','Magias e truques','Habilidades'),
    f('list','Ataques','Equipamento'),f('list','Equipamento','Equipamento'),f('text','Moedas','Equipamento'),
    f('image','Retrato','Aparência'),
    f('textarea','Traços de personalidade','Notas'),f('textarea','Ideais','Notas'),f('textarea','Vínculos','Notas'),f('textarea','Defeitos','Notas'),f('textarea','História do personagem','Notas'),
  ];
}

function opFields(){
  const resource=(name,initial,perLevel,attribute)=>`${initial}${attribute?`+${attribute}`:''}+(Nível de NEX-1)*(${perLevel}${attribute?`+${attribute}`:''})`;
  return [
    f('text','Personagem','Identidade'),f('text','Origem','Identidade'),f('text','Classe','Identidade'),f('text','Trilha','Identidade'),f('text','Patente','Identidade'),f('number','NEX','Identidade'),
    f('formula','Nível de NEX','Identidade',{formula:'piso(NEX/5)+piso(NEX/99)'}),
    ...OP_ATTRIBUTES.map(name=>f('number',name,'Atributos')),
    f('status','Pontos de Vida','Recursos'),f('status','Pontos de Esforço','Recursos'),f('status','Sanidade','Recursos'),
    f('formula','Defesa','Combate',{formula:'10+Agilidade'}),f('number','Deslocamento','Combate'),f('text','Proteção','Combate'),f('text','Resistências','Combate'),
    ...OP_SKILLS.map(([name,attribute])=>f('number',`${name} (${attribute})`,'Perícias')),
    ...OP_CLASSES.flatMap(([name,hp,hpLevel,pe,peLevel,san,sanLevel])=>[
      f('formula',`PV máximo · ${name}`,'Cálculo de recursos',{formula:resource('PV',`${hp}`,`${hpLevel}`,'Vigor')}),
      f('formula',`PE máximo · ${name}`,'Cálculo de recursos',{formula:resource('PE',`${pe}`,`${peLevel}`,'Presença')}),
      f('formula',`Sanidade máxima · ${name}`,'Cálculo de recursos',{formula:resource('SAN',`${san}`,`${sanLevel}`,'')}),
    ]),
    f('textarea','Poderes e habilidades','Habilidades'),f('textarea','Rituais','Habilidades'),
    f('list','Inventário','Equipamento'),f('list','Ataques','Equipamento'),
    f('textarea','Descrição e história','Notas'),
  ];
}

export const SHEET_SYSTEMS=Object.freeze([
  {id:'dnd5e',name:'D&D 5ª edição',summary:'Seis atributos com modificadores, bônus de proficiência, salvaguardas, 18 perícias e vida.',fields:dndFields},
  {id:'ordem',name:'Ordem Paranormal',summary:'Cinco atributos, NEX, Vida, Esforço e Sanidade, Defesa, 28 perícias e o cálculo de recursos por classe.',fields:opFields},
  ...MORE_SYSTEMS,
]);

// Cria os campos de um modelo. `makeId` entrega um identificador novo por campo.
export function buildSystemFields(systemId,makeId){
  const system=SHEET_SYSTEMS.find(item=>item.id===systemId);
  if(!system)throw Error('Sistema de ficha desconhecido.');
  return system.fields().map(field=>({id:makeId(),...field}));
}

// Apelidos para reconhecer a ficha de outra fonte (PDF oficial, ficha de outro app, print).
// A chave é o rótulo sem parênteses; "strict" exige as maiúsculas, para siglas curtas não casarem com palavras comuns.
const alias=(text,strict=false)=>({text,strict});
export const FIELD_ALIASES=(()=>{
  const map=new Map(),add=(label,...items)=>map.set(label,[...(map.get(label)||[]),...items]);
  for(const [name,short,english,englishName] of DND_ABILITIES)add(name,alias(english,true),alias(englishName),alias(short.toUpperCase(),true));
  for(const [name,,english] of DND_SKILLS)add(name,alias(english));
  add('Personagem',alias('Character Name'),alias('CharacterName'),alias('Nome do personagem'),alias('Nome'));
  add('Classe',alias('Class'),alias('Class & Level'),alias('ClassLevel'),alias('Classe e nível'));
  add('Raça',alias('Race'),alias('Raça e Subraça'));
  add('Antecedente',alias('Background'),alias('Antecedentes'));
  add('Alinhamento',alias('Alignment'));
  add('Nível',alias('Level'),alias('Nivel'));
  add('Pontos de experiência',alias('Experience Points'),alias('XP',true),alias('PX',true));
  add('Classe de Armadura',alias('Armor Class'),alias('AC',true),alias('CA',true));
  add('Deslocamento',alias('Speed'),alias('Movimento'));
  add('Pontos de vida',alias('Hit Points'),alias('HP',true),alias('PV',true),alias('Vida'));
  add('Dados de vida',alias('Hit Dice'));
  add('Inspiração',alias('Inspiration'));
  add('Bônus de proficiência',alias('Proficiency Bonus'),alias('ProfBonus'));
  add('Iniciativa',alias('Initiative'));
  add('Percepção passiva',alias('Passive Perception'),alias('Passive Wisdom (Perception)'));
  add('Moedas',alias('Moedas'),alias('Coins'));
  add('Ataques',alias('Attacks & Spellcasting'),alias('Ataques e magias'));
  add('Equipamento',alias('Equipment'),alias('Equipamentos'));
  for(const [name,short,english] of DND_ABILITIES){add(`Salvaguarda de ${name}`,alias(`${english} saving throw`),alias(`${name} saving throw`));}
  add('Agilidade',alias('AGI',true),alias('Agility'));add('Força',alias('FOR',true));add('Intelecto',alias('INT',true));add('Presença',alias('PRE',true),alias('Presenca'));add('Vigor',alias('VIG',true));
  add('Origem',alias('Origin'));add('Trilha',alias('Trilha de classe'));add('Patente',alias('Patente de Ordem'));
  add('NEX',alias('Nível de Exposição'),alias('Exposição'));
  add('Pontos de Vida',alias('PV',true),alias('Vida'),alias('Hit Points'));
  add('Pontos de Esforço',alias('PE',true),alias('Esforço'),alias('Esforco'));
  add('Sanidade',alias('SAN',true),alias('Sanity'));
  add('Defesa',alias('DEF',true),alias('Defense'));
  add('Proteção',alias('Protecao'));add('Resistências',alias('Resistencias'));
  add('Inventário',alias('Inventario'),alias('Itens'));
  add('Poderes e habilidades',alias('Poderes'),alias('Habilidades'));add('Rituais',alias('Rituals'));
  for(const [name] of OP_SKILLS)add(name,alias(name));
  return map;
})();
