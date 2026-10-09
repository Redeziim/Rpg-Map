// Gera um MODELO de ficha (a lista de campos) a partir do que foi lido de um PDF, de uma imagem ou de um TXT. Não preenche valores:
// isso é o trabalho de sheetImport.js. Aqui o arquivo é lido como uma ficha em branco ou preenchida e cada rótulo vira um campo.
// O resultado é sempre uma proposta: a pessoa revisa campo a campo antes de guardar ou usar (ADR 037).
import {fold} from './sheetImport.js';
import {SHEET_SYSTEMS,baseLabel} from './sheetTemplates.js';
import {SHEET_MODEL_LIMITS} from './sheetModels.js';

const squash=text=>fold(String(text||'')).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words=text=>text.split(/\s+/).filter(Boolean);
const capitalize=text=>{const lower=String(text).trim().toLocaleLowerCase('pt-BR');return lower.charAt(0).toLocaleUpperCase('pt-BR')+lower.slice(1);};

// Palavras que, sozinhas numa linha, abrem uma categoria ("ATRIBUTOS", "Perícias", "Equipment").
const HEADINGS=new Set(['atributos','atributo','pericias','habilidades','combate','equipamento','equipamentos','inventario','magias','historia','identidade','recursos','salvaguardas','defesas','ataques','notas','anotacoes','aparencia','personalidade','caracteristicas','poderes','rituais','talentos','idiomas','tracos','vantagens','desvantagens','informacoes','dados do personagem','dados pessoais','basico','geral','resumo','detalhes','vitalidade','status','proficiencias','antecedente','disciplinas','magia','armas','armaduras','attributes','skills','abilities','combat','equipment','spells','background','features','notes','saving throws','personality','appearance','character','inventory','proficiencies']);
// Dicas escritas à mão num TXT: "Força [número]", "Biografia [longo]".
const HINTS=new Map([['numero','number'],['number','number'],['texto','text'],['text','text'],['longo','textarea'],['texto longo','textarea'],['area','textarea'],['lista','list'],['barra','status'],['status','status'],['recurso','status'],['imagem','image'],['foto','image'],['marcas','checklist'],['ataque','attack']]);
const STATUS_LABEL=/^(pontos? de (vida|mana|magia|esforco|sanidade|energia|vitalidade|poder|sorte|estresse|fe)|vida|pv|pm|pe|hp|mp|sanidade|esforco|mana|vitalidade|forca de vontade|fadiga|estresse|sorte|hit points|sanity|willpower|health)$/;
const LONG_LABEL=/(historia|descricao|anotac|notas|observac|aparencia|personalidade|ideais|vinculos|defeitos|tracos|talentos|poderes|habilidades|magias|truques|rituais|vantagens|desvantagens|aliados|organizac|backstory|background|features|traits|spells|disciplinas|convicc|tomos|encontros|fobias|ferimentos|pessoas importantes|locais significativos|biografia)/;
const LIST_LABEL=/(inventario|equipamento|itens|armas|ataques|mochila|pertences|armaduras|attacks|inventory|equipment|gear|weapons|posses)/;
const IMAGE_LABEL=/(retrato|foto|imagem|portrait|avatar|simbolo|brasao)/;
const NUMBER_LABEL=/^(nivel|level|xp|experiencia|pontos de experiencia|idade|ca|defesa|deslocamento|movimento|iniciativa|classe de armadura|bonus|base de ataque|percepcao|humanidade|fome|geracao|nex|sorte|forca|destreza|constituicao|inteligencia|sabedoria|carisma|agilidade|intelecto|presenca|vigor|poder|habilidade|resistencia|armadura|tamanho|educacao|aparencia)\b|(modificador|mod|bonus|salvaguarda|teste|jogada de protecao|cd |nex)/;
const SKILL_PARENS=/\((?:for|des|con|int|sab|car|agi|pre|vig|str|dex|wis|cha|%|[a-z]{3,10})\)\s*$/i;
const NOISE_PATTERN=/(https?:\/\/|www\.|@\w+\.|©|copyright|todos os direitos|all rights|pagina\s*\d|page\s*\d|^\W*\d+\W*$)/i;
const isNoise=text=>NOISE_PATTERN.test(fold(String(text||'')));

// Rótulos que os modelos prontos já conhecem: "Força", "Pontos de Vida"... guardam tipo e categoria certos.
let known;
function knownLabels(){
  if(known)return known;
  known=new Map();
  for(const system of SHEET_SYSTEMS)for(const field of system.fields()){
    for(const key of new Set([squash(field.label),squash(baseLabel(field.label))])){
      if(!key)continue;
      const list=known.get(key)||[];
      list.push({systemId:system.id,type:field.type,label:field.label,tab:field.tab,formula:field.formula});
      known.set(key,list);
    }
  }
  return known;
}

// "Força Destreza Constituição" numa linha só (o OCR e alguns PDFs juntam as colunas): se a linha inteira são rótulos conhecidos, separa.
function splitKnown(cell){
  const registry=knownLabels(),tokens=squash(cell).split(' ').filter(Boolean);
  if(tokens.length<2)return [cell];
  const parts=[];
  for(let index=0;index<tokens.length;){
    let size=0;
    for(let length=Math.min(4,tokens.length-index);length>=1;length--)if(registry.has(tokens.slice(index,index+length).join(' '))){size=length;break;}
    if(!size)return [cell];
    parts.push(registry.get(tokens.slice(index,index+size).join(' '))[0].label);index+=size;
  }
  return parts.length>=2?parts:[cell];
}

function parseCell(raw){
  let text=raw.trim();
  if(!text)return null;
  let hint=null;
  const tag=/\s*\[([^\]]{2,20})\]\s*$/.exec(text);
  if(tag&&HINTS.has(squash(tag[1]))){hint=HINTS.get(squash(tag[1]));text=text.slice(0,tag.index).trim();}
  const equation=/^([^=:]{2,60}?)\s*=\s*(.{2,300})$/.exec(text);
  if(equation&&/[+\-*/()]/.test(equation[2])&&/[\p{L}\d]/u.test(equation[2]))return {label:equation[1].trim(),formula:equation[2].trim(),value:'',hint:'formula'};
  text=text.replace(/[._\-–—·•]{3,}/g,'  ').replace(/_+/g,' ').trim();
  let label=text,value='';
  const colon=/^([^:]{2,60}?)\s*:\s*(.*)$/.exec(text);
  if(colon){label=colon[1].trim();value=colon[2].trim();}
  else{
    const tail=/^(.*?[\p{L})])\s+([+\-−]?\d{1,4}(?:[.,]\d+)?(?:\s*(?:\/|de)\s*\d{1,4})?\s*%?)$/u.exec(text);
    if(tail){label=tail[1].trim();value=tail[2].trim();}
  }
  label=label.replace(/^[\s•·\-*>]+/,'').replace(/^\d{1,2}[.)]\s+/,'').replace(/\s+/g,' ').trim();
  return {label,value,hint};
}

function plausibleLabel(label){
  if(label.length<2||label.length>60||!/\p{L}.*\p{L}/u.test(label)||isNoise(label))return false;
  if(/[.!?;,]$/.test(label)||/\.\s+\p{Ll}/u.test(label))return false;
  const count=words(label).length;
  if(count>6)return false;
  if(count>4&&!knownLabels().has(squash(label)))return false;
  return true;
}

const validTitle=title=>{const clean=String(title||'').trim();return clean&&clean.length<=40&&!/\d{3,}/.test(clean)?capitalize(clean):null;};
// Linha que abre uma categoria: "# Atributos", "== Atributos ==", "[Atributos]", "Atributos:" ou só a palavra conhecida ("PERÍCIAS").
function isHeading(line){
  const text=line.trim();
  let match;
  if((match=/^#{1,4}\s+(.+?)\s*#*$/.exec(text))||(match=/^={2,}\s*(.+?)\s*={2,}$/.exec(text))||(match=/^-{2,}\s*(.+?)\s*-{2,}$/.exec(text))||(match=/^\[([^\]]{2,40})\]$/.exec(text)))return validTitle(match[1]);
  if((match=/^([^:]{2,40}):$/.exec(text))&&HEADINGS.has(squash(match[1])))return validTitle(match[1]);
  if(HEADINGS.has(squash(text))&&words(text).length<=3)return validTitle(text);
  return null;
}

function typeFor(label,value,hint){
  if(hint&&hint!=='formula')return hint;
  const key=squash(label),base=squash(baseLabel(label));
  if(STATUS_LABEL.test(base)||STATUS_LABEL.test(key)){return 'status';}
  if(/^\d+\s*(?:\/|de)\s*\d+$/.test(value))return 'status';
  if(IMAGE_LABEL.test(key))return 'image';
  if(LIST_LABEL.test(key)&&words(label).length<=3)return 'list';
  if(LONG_LABEL.test(key)&&words(label).length<=4)return 'textarea';
  if(/^[+\-−]?\d{1,4}(?:[.,]\d+)?%?$/.test(value))return 'number';
  if(SKILL_PARENS.test(label)||NUMBER_LABEL.test(key))return 'number';
  if(value.length>70)return 'textarea';
  return 'text';
}

const cleanFormName=name=>String(name||'')
  .replace(/([a-zà-ú])([A-ZÀ-Ú])/g,'$1 $2').replace(/[_\-.\[\]]+/g,' ').replace(/\s+\d+$/,'').replace(/\s+/g,' ').trim();
const GENERIC_FORM=/^(text|check|button|field|campo|caixa|box|undefined|untitled|combo|list|radio|group|form|page|p\d+)(\s*(box|field|\d+))*$/i;

// Procura qual dos modelos prontos o arquivo mais lembra. Só avisa quando é quase a mesma ficha: pelo menos 10 campos e 70% deles.
function detectSystem(fields){
  let best=null;
  for(const system of SHEET_SYSTEMS){
    const own=new Set(system.fields().flatMap(field=>[squash(field.label),squash(baseLabel(field.label))]));
    const matched=fields.filter(field=>own.has(squash(field.label))||own.has(squash(baseLabel(field.label)))).length;
    if(matched>=10&&matched>=fields.length*0.7&&(!best||matched>best.matched))best={id:system.id,name:system.name,matched};
  }
  return best;
}

export function inferSheetModel({text='',formFieldNames=[],fileName=''}={}){
  const fields=[],seen=new Set(),notes=[];
  let tab='Geral',title='';
  const add=(field,evidence,from)=>{
    const key=squash(field.label);
    if(!key||seen.has(key)||fields.length>=SHEET_MODEL_LIMITS.fields)return;
    seen.add(key);fields.push({...field,evidence,from});
  };
  const lines=String(text).split(/\r?\n/).map(line=>line.replace(/[ \t]/g,'   ').replace(/\s+$/,''));
  for(const line of lines){
    if(!line.trim())continue;
    if(!title&&line.trim().length<=50&&words(line).length>=2&&!isNoise(line)&&!/[:=]/.test(line)&&!isHeading(line)&&!knownLabels().has(squash(line)))title=line.trim();
    const heading=isHeading(line);
    if(heading){tab=heading;continue;}
    if(isNoise(line))continue;
    for(const cell of line.split(/\s{3,}|\s*\|\s*/).flatMap(splitKnown)){
      const parsed=parseCell(cell);
      if(!parsed||!plausibleLabel(parsed.label))continue;
      if(parsed.formula){add({type:'formula',label:parsed.label,tab,formula:parsed.formula},cell.trim(),'texto');continue;}
      add({type:typeFor(parsed.label,parsed.value,parsed.hint),label:parsed.label,tab},cell.trim(),'texto');
    }
  }
  // Campos de formulário de um PDF preenchível: o nome do campo é o melhor rótulo que existe.
  const named=formFieldNames.map(item=>cleanFormName(typeof item==='string'?item:item?.name)).filter(name=>name&&!GENERIC_FORM.test(name)&&plausibleLabel(name));
  if(named.length>=Math.max(5,fields.length*0.5)){
    for(const name of named)add({type:typeFor(name,'',null),label:name,tab:'Geral'},`campo do formulário: ${name}`,'formulário');
  }
  const system=detectSystem(fields);
  // Rótulos que um modelo pronto conhece ganham o tipo e a categoria dele; o resto fica como foi lido.
  const registry=knownLabels();
  for(const field of fields){
    const options=registry.get(squash(field.label))||registry.get(squash(baseLabel(field.label)));
    if(!options)continue;
    const own=system&&options.find(option=>option.systemId===system.id),pick=own||(field.type==='text'?options[0]:null);
    if(own){field.type=own.type;field.label=own.label;if(field.tab==='Geral')field.tab=own.tab;if(own.formula)field.formula=own.formula;}
    else if(pick&&['number','status'].includes(pick.type)&&field.type==='text')field.type=pick.type;
  }
  const fromFile=String(fileName).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
  if(fromFile)title=fromFile;
  if(fields.length<5)notes.push('Reconheci poucos campos. Prefira o PDF original, uma imagem nítida, ou escreva um TXT com um campo por linha e as categorias em linhas como "## Atributos".');
  if(system)notes.push(`Esta ficha lembra o modelo pronto ${system.name} (${system.matched} campos em comum). Se for esse sistema, o modelo da biblioteca já está completo e com as fórmulas.`);
  if(fields.length>=SHEET_MODEL_LIMITS.fields)notes.push(`O modelo foi cortado em ${SHEET_MODEL_LIMITS.fields} campos, o limite da mesa.`);
  return {title:title.slice(0,SHEET_MODEL_LIMITS.name),fields,system,notes};
}
