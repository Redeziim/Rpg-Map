// Mais modelos de sistemas conhecidos, prontos na biblioteca para ninguém precisar subir a ficha deles toda vez (ADR 037).
// Só nomes de campos e contas de regra entram aqui; nenhum texto de livro foi copiado. Conferidos contra as regras publicadas de cada
// sistema, mas sem teste com fichas oficiais: o mestre pode editar tudo depois de aplicar o modelo.
const f=(type,label,tab,extra={})=>({type,label,tab,...extra});

// Tormenta20 (Jambô). Os atributos são os próprios modificadores, e a perícia vale o total já somado (metade do nível + atributo + treino).
const T20_SKILLS=[['Acrobacia','Des'],['Adestramento','Car'],['Atletismo','For'],['Atuação','Car'],['Cavalgar','Des'],['Conhecimento','Int'],['Cura','Sab'],['Diplomacia','Car'],['Enganação','Car'],['Fortitude','Con'],['Furtividade','Des'],['Guerra','Int'],['Iniciativa','Des'],['Intimidação','Car'],['Intuição','Sab'],['Investigação','Int'],['Jogatina','Car'],['Ladinagem','Des'],['Luta','For'],['Misticismo','Int'],['Nobreza','Int'],['Ofício','Int'],['Percepção','Sab'],['Pilotagem','Des'],['Pontaria','Des'],['Reflexos','Des'],['Religião','Sab'],['Sobrevivência','Sab'],['Vontade','Sab']];
const SIX=['Força','Destreza','Constituição','Inteligência','Sabedoria','Carisma'];
export function tormenta20Fields(){
  return [
    f('text','Personagem','Identidade'),f('text','Raça','Identidade'),f('text','Origem','Identidade'),f('text','Classe','Identidade'),f('text','Divindade','Identidade'),f('number','Nível','Identidade'),f('number','Pontos de experiência','Identidade'),
    ...SIX.map(name=>f('number',name,'Atributos')),
    f('number','Bônus de armadura','Combate'),f('number','Bônus de escudo','Combate'),f('formula','Defesa','Combate',{formula:'10+Destreza+Bônus de armadura+Bônus de escudo'}),f('number','Penalidade de armadura','Combate'),f('number','Deslocamento','Combate'),
    f('status','Pontos de Vida','Recursos'),f('status','Pontos de Mana','Recursos'),
    ...T20_SKILLS.map(([name,attribute])=>f('number',`${name} (${attribute})`,'Perícias')),
    f('textarea','Poderes e habilidades','Habilidades'),f('textarea','Magias','Habilidades'),
    f('list','Ataques','Equipamento'),f('list','Inventário','Equipamento'),f('text','Dinheiro','Equipamento'),
    f('textarea','Descrição e história','Notas'),
  ];
}

// Call of Cthulhu 7ª edição (Chaosium). Cada característica ganha o valor pela metade e pelo quinto, usados nos testes difíceis e extremos.
const COC_CHARACTERISTICS=['Força','Constituição','Tamanho','Destreza','Aparência','Inteligência','Poder','Educação'];
const COC_SKILLS=['Antropologia','Arqueologia','Armas de Fogo (Pistola)','Armas de Fogo (Rifle)','Arremessar','Arte e Ofício','Avaliação','Charme','Chaveiro','Ciência','Cavalgar','Contabilidade','Direito','Dirigir Automóvel','Disfarce','Eletricidade','Escalar','Escutar','Esquivar','Furtividade','História','Intimidação','Lábia','Língua Nativa','Lutar (Briga)','Mecânica','Medicina','Mitos de Cthulhu','Natação','Navegação','Nível de Crédito','Ocultismo','Persuasão','Pilotar','Prestidigitação','Primeiros Socorros','Procurar','Psicanálise','Psicologia','Rastrear','Saltar','Sobrevivência','Usar Bibliotecas'];
export function cthulhu7eFields(){
  return [
    f('text','Investigador','Identidade'),f('text','Ocupação','Identidade'),f('number','Idade','Identidade'),f('text','Sexo','Identidade'),f('text','Residência','Identidade'),f('text','Local de nascimento','Identidade'),
    ...COC_CHARACTERISTICS.map(name=>f('number',name,'Características')),f('number','Sorte','Características'),
    ...COC_CHARACTERISTICS.flatMap(name=>[f('formula',`${name} ½`,'Metade e quinto',{formula:`piso(${name}/2)`}),f('formula',`${name} ⅕`,'Metade e quinto',{formula:`piso(${name}/5)`})]),
    f('status','Pontos de Vida','Recursos'),f('status','Pontos de Magia','Recursos'),f('status','Sanidade','Recursos'),
    f('formula','PV máximo','Cálculos',{formula:'piso((Constituição+Tamanho)/10)'}),f('formula','PM máximo','Cálculos',{formula:'piso(Poder/5)'}),f('formula','Sanidade máxima','Cálculos',{formula:'99-Mitos de Cthulhu (%)'}),
    f('number','Movimento','Combate'),f('text','Bônus de dano','Combate'),f('text','Corpulência','Combate'),f('list','Ataques','Combate'),
    ...COC_SKILLS.map(name=>f('number',`${name} (%)`,'Perícias')),
    f('textarea','Descrição pessoal','História'),f('textarea','Ideologia e crenças','História'),f('textarea','Pessoas importantes','História'),f('textarea','Locais significativos','História'),f('textarea','Pertences queridos','História'),f('textarea','Características','História'),f('textarea','Ferimentos e cicatrizes','História'),f('textarea','Fobias e manias','História'),f('textarea','Tomos arcanos e magias','História'),f('textarea','Encontros com entidades estranhas','História'),
    f('list','Equipamento','Equipamento'),f('text','Dinheiro e bens','Equipamento'),
  ];
}

// Pathfinder 2ª edição (Paizo, licença ORC). Atributo com modificador calculado, como em D&D.
const PF_SKILLS=[['Acrobacia','Des'],['Arcanismo','Int'],['Atletismo','For'],['Atuação','Car'],['Diplomacia','Car'],['Enganação','Car'],['Furtividade','Des'],['Intimidação','Car'],['Ladroagem','Des'],['Medicina','Sab'],['Natureza','Sab'],['Ocultismo','Int'],['Ofícios','Int'],['Religião','Sab'],['Sobrevivência','Sab'],['Sociedade','Int']];
export function pathfinder2eFields(){
  return [
    f('text','Personagem','Identidade'),f('text','Ancestralidade','Identidade'),f('text','Herança','Identidade'),f('text','Antecedente','Identidade'),f('text','Classe','Identidade'),f('text','Divindade','Identidade'),f('text','Tendência','Identidade'),f('number','Nível','Identidade'),f('number','Pontos de experiência','Identidade'),
    ...SIX.map(name=>f('number',name,'Atributos')),...SIX.map(name=>f('formula',`Mod. ${name}`,'Atributos',{formula:`piso((${name}-10)/2)`})),
    f('number','Classe de Armadura','Combate'),f('status','Pontos de vida','Combate'),f('number','Percepção','Combate'),f('number','Deslocamento','Combate'),f('number','CD de classe','Combate'),f('text','Resistências e fraquezas','Combate'),f('number','Pontos de herói','Combate'),
    f('number','Fortitude','Salvaguardas'),f('number','Reflexos','Salvaguardas'),f('number','Vontade','Salvaguardas'),
    ...PF_SKILLS.map(([name,attribute])=>f('number',`${name} (${attribute})`,'Perícias')),f('text','Saber','Perícias'),
    f('textarea','Talentos de classe','Habilidades'),f('textarea','Talentos de ancestralidade','Habilidades'),f('textarea','Talentos gerais e de perícia','Habilidades'),f('textarea','Magias e truques','Habilidades'),
    f('list','Ataques','Equipamento'),f('list','Equipamento','Equipamento'),f('text','Moedas','Equipamento'),
    f('textarea','História do personagem','Notas'),
  ];
}

// Vampiro: A Máscara, 5ª edição (Paradox). Atributos e habilidades vão de 0 a 5; Vitalidade e Força de Vontade têm máximo calculado.
const V5_ATTRIBUTES=[['Força','Físicos'],['Destreza','Físicos'],['Vigor','Físicos'],['Carisma','Sociais'],['Manipulação','Sociais'],['Autocontrole','Sociais'],['Inteligência','Mentais'],['Raciocínio','Mentais'],['Perseverança','Mentais']];
const V5_SKILLS=[['Armas Brancas','Físicas'],['Armas de Fogo','Físicas'],['Atletismo','Físicas'],['Briga','Físicas'],['Condução','Físicas'],['Furtividade','Físicas'],['Furto','Físicas'],['Ofícios','Físicas'],['Sobrevivência','Físicas'],['Empatia','Sociais'],['Etiqueta','Sociais'],['Intimidação','Sociais'],['Liderança','Sociais'],['Manha','Sociais'],['Persuasão','Sociais'],['Performance','Sociais'],['Subterfúgio','Sociais'],['Trato com Animais','Sociais'],['Academicismo','Mentais'],['Ciência','Mentais'],['Finanças','Mentais'],['Investigação','Mentais'],['Medicina','Mentais'],['Ocultismo','Mentais'],['Política','Mentais'],['Prontidão','Mentais'],['Tecnologia','Mentais']];
export function vampiro5eFields(){
  return [
    f('text','Personagem','Identidade'),f('text','Conceito','Identidade'),f('text','Crônica','Identidade'),f('text','Clã','Identidade'),f('text','Predador','Identidade'),f('number','Geração','Identidade'),f('text','Senhor','Identidade'),f('text','Ambição','Identidade'),f('text','Desejo','Identidade'),
    ...V5_ATTRIBUTES.map(([name,group])=>f('number',`${name} (${group})`,'Atributos')),
    ...V5_SKILLS.map(([name,group])=>f('number',`${name} (${group})`,'Habilidades')),
    f('status','Vitalidade','Recursos'),f('status','Força de Vontade','Recursos'),f('number','Humanidade','Recursos'),f('number','Fome','Recursos'),f('number','Potência de Sangue','Recursos'),f('number','Manchas','Recursos'),
    f('formula','Vitalidade máxima','Cálculos',{formula:'3+Vigor (Físicos)'}),f('formula','Força de Vontade máxima','Cálculos',{formula:'Autocontrole (Sociais)+Perseverança (Mentais)'}),
    f('textarea','Disciplinas e poderes','Poderes'),f('textarea','Vantagens e defeitos','Poderes'),f('textarea','Convicções e âncoras','Poderes'),
    f('list','Equipamento','Equipamento'),f('text','Recursos e posses','Equipamento'),f('number','Pontos de experiência','Notas'),f('textarea','História do personagem','Notas'),
  ];
}

// 3D&T Alpha. Cinco características; vida e magia saem da Resistência, e a Força de Ataque e de Defesa já vêm somadas (sem o dado).
export function tresDTFields(){
  return [
    f('text','Personagem','Identidade'),f('text','Arquétipo','Identidade'),f('text','Kit','Identidade'),f('number','Pontos de personagem','Identidade'),f('number','Experiência','Identidade'),
    f('number','Poder','Características'),f('number','Habilidade','Características'),f('number','Resistência','Características'),f('number','Armadura','Características'),f('number','Poder de Fogo','Características'),
    f('formula','Força de Ataque (corpo a corpo)','Combate',{formula:'Poder+Habilidade'}),f('formula','Força de Ataque (à distância)','Combate',{formula:'Poder de Fogo+Habilidade'}),f('formula','Força de Defesa','Combate',{formula:'Armadura+Habilidade'}),
    f('status','Pontos de Vida','Recursos'),f('status','Pontos de Magia','Recursos'),
    f('formula','Pontos de Vida máximos','Cálculos',{formula:'Resistência*5'}),f('formula','Pontos de Magia máximos','Cálculos',{formula:'Resistência*5'}),
    f('textarea','Vantagens','Habilidades'),f('textarea','Desvantagens','Habilidades'),f('textarea','Perícias','Habilidades'),f('textarea','Magias e poderes','Habilidades'),
    f('list','Equipamento','Equipamento'),f('textarea','História do personagem','Notas'),
  ];
}

// Old Dragon. Os modificadores vêm da tabela do livro e por isso são digitados; a ficha não adivinha a tabela.
export function oldDragonFields(){
  return [
    f('text','Personagem','Identidade'),f('text','Raça','Identidade'),f('text','Classe','Identidade'),f('text','Alinhamento','Identidade'),f('number','Nível','Identidade'),f('number','Pontos de experiência','Identidade'),
    ...SIX.map(name=>f('number',name,'Atributos')),
    ...SIX.map(name=>f('number',`Modificador de ${name}`,'Modificadores')),
    f('status','Pontos de vida','Combate'),f('number','Classe de Armadura','Combate'),f('number','Base de ataque','Combate'),f('number','Movimento','Combate'),f('number','Iniciativa','Combate'),
    f('number','Jogada de Proteção (Destreza)','Proteção'),f('number','Jogada de Proteção (Constituição)','Proteção'),f('number','Jogada de Proteção (Sabedoria)','Proteção'),
    f('textarea','Habilidades de classe','Habilidades'),f('textarea','Magias','Habilidades'),
    f('list','Ataques','Equipamento'),f('list','Equipamento','Equipamento'),f('text','Moedas','Equipamento'),
    f('textarea','História do personagem','Notas'),
  ];
}

export const MORE_SYSTEMS=Object.freeze([
  {id:'tormenta20',name:'Tormenta20',summary:'Seis atributos, Defesa calculada, Vida e Mana, 29 perícias e poderes.',fields:tormenta20Fields},
  {id:'cthulhu7e',name:'Chamado de Cthulhu 7ª edição',summary:'Oito características com metade e quinto, Sorte, Vida, Magia e Sanidade com máximos calculados e 43 perícias em %.',fields:cthulhu7eFields},
  {id:'pathfinder2e',name:'Pathfinder 2ª edição',summary:'Seis atributos com modificadores, salvaguardas, Percepção, CD de classe e 16 perícias.',fields:pathfinder2eFields},
  {id:'vampiro5e',name:'Vampiro: A Máscara 5ª edição',summary:'Nove atributos, 27 habilidades, Vitalidade e Força de Vontade com máximos calculados, Humanidade e Fome.',fields:vampiro5eFields},
  {id:'3dt',name:'3D&T Alpha',summary:'Poder, Habilidade, Resistência, Armadura e Poder de Fogo, com Força de Ataque, Defesa, Vida e Magia calculadas.',fields:tresDTFields},
  {id:'olddragon',name:'Old Dragon',summary:'Seis atributos com modificadores, vida, armadura, base de ataque e jogadas de proteção.',fields:oldDragonFields},
]);
