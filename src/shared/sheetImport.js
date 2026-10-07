// Interpreta o texto lido de uma ficha externa (camada de texto de um PDF, campos de formulário de PDF ou OCR de uma imagem)
// e propõe valores para os campos do modelo da mesa. Nada aqui grava: o resultado é uma sugestão que a pessoa revisa.
import {FIELD_ALIASES,baseLabel} from './sheetTemplates.js';

export const IMPORTABLE_TYPES=Object.freeze(['number','text','status']);
export const RANK={alta:3,media:2,baixa:1};
const CONFIDENCE_LABEL={alta:'Alta',media:'Média',baixa:'Baixa'};
export const confidenceLabel=confidence=>CONFIDENCE_LABEL[confidence]||confidence;

// Same length as the input, so an index found in the folded text is valid in the original.
export const foldChar=character=>{const folded=character.normalize('NFD').replace(/\p{M}/gu,'');return folded.length===1?folded:character;};
export const fold=text=>[...text].map(foldChar).join('');
const squash=text=>fold(String(text||'')).toLowerCase().replace(/[^a-z0-9]+/g,'');
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const NUMBER=/[+-]?\d{1,4}(?:[.,]\d{1,2})?/;
// "Mod. Força 3" and "Salvaguarda de Força 5" are other fields; the plain ability must not take their number.
export const OTHER_FIELD_PREFIX=/(?:mod(?:ificador(?:es)?)?\.?(?:\s+de)?|salvaguardas?(?:\s+de)?|saving\s+throws?|b[oô]nus(?:\s+de)?|passiv[ao]|teste(?:s)?(?:\s+de)?)\s*$/i;

export function aliasesFor(field){
  const base=baseLabel(field.label),seen=new Set(),list=[];
  for(const alias of [{text:base,strict:false},...(FIELD_ALIASES.get(base)||[])]){
    const key=`${alias.strict}:${squash(alias.text)}`;
    if(alias.text.length<2||seen.has(key))continue;
    seen.add(key);list.push(alias);
  }
  return list.sort((a,b)=>b.text.length-a.text.length);
}
export const aliasPattern=alias=>new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(fold(alias.text)).replace(/\s+/g,'\\s+')}(?![\\p{L}\\p{N}])`,alias.strict?'gu':'giu');

export function toNumberText(raw){
  const value=String(raw).replace(',','.').replace(/^\+/,'');
  const number=Number(value);
  return Number.isFinite(number)&&Math.abs(number)<=9999?String(number):null;
}

function readAfter(field,rest,nextLine){
  if(field.type==='number'){
    const same=rest.match(new RegExp(`^\\s*(?:\\([^)]{1,12}\\)\\s*)?(?:[:=.·_\\s]|[-–—]\\s+)*(${NUMBER.source})(?![\\d])`));
    if(same){const value=toNumberText(same[1]);if(value!==null)return {value,confidence:'alta'};}
    if(/^\s*[:=\-–—.]?\s*$/.test(rest)&&nextLine){const next=nextLine.match(new RegExp(`^\\s*(${NUMBER.source})\\s*%?\\s*$`));const value=next&&toNumberText(next[1]);if(value)return {value,confidence:'media'};}
  }else if(field.type==='status'){
    const pair=rest.match(/^\s*[:=\-–—]?\s*(\d{1,4})\s*(?:\/|de|\\)\s*(\d{1,4})(?!\d)/i);
    if(pair)return {value:{current:Number(pair[1]),max:Number(pair[2])},confidence:'alta'};
    const single=rest.match(/^\s*[:=\-–—]?\s*(\d{1,4})(?!\d)/);
    if(single)return {value:{current:Number(single[1]),max:Number(single[1])},confidence:'media'};
    if(/^\s*[:=\-–—.]?\s*$/.test(rest)&&nextLine){const next=nextLine.match(/^\s*(\d{1,4})\s*(?:\/|de)\s*(\d{1,4})\s*$/i);if(next)return {value:{current:Number(next[1]),max:Number(next[2])},confidence:'media'};}
  }else if(field.type==='text'){
    const same=rest.match(/^\s*[:=\-–—]\s*(\S.{0,58}?)\s*(?:\s{3,}.*)?$/);
    if(same&&!/^[\d\s%+.,/-]*$/.test(same[1])||same&&field.label==='Nível')return {value:same[1].trim(),confidence:'alta'};
    if(/^\s*[:=\-–—.]?\s*$/.test(rest)&&nextLine&&/^\s*\S.{0,40}$/.test(nextLine)&&!/^[\d\s%+.,/-]*$/.test(nextLine))return {value:nextLine.trim(),confidence:'media'};
  }
  return null;
}
// Sheets that print a name under its value ("Aria Nightwind" above "Nome do personagem").
function readPreviousLine(field,previous){
  if(field.type!=='text'||!previous)return null;
  const text=previous.trim();
  return text.length>=2&&text.length<=40&&!/[:=]/.test(text)&&!/^[\d\s%+.,/-]*$/.test(text)?{value:text,confidence:'baixa'}:null;
}
function readBefore(field,before){
  // Sheets that print the value above or before the name (D&D 5e): "+5 Acrobatics".
  if(field.type!=='number')return null;
  const match=before.match(new RegExp(`(${NUMBER.source})\\s*[|:()\\[\\]]*\\s*$`));
  const value=match&&toNumberText(match[1]);
  return value?{value,confidence:'baixa'}:null;
}

// In two-column sheets, OCR often joins "Júlia Torres   Origem: Policial" with a single space. A text value ends where another
// known label followed by ":" begins.
export function labelCutter(fields){
  const names=new Set();
  for(const field of fields)for(const alias of aliasesFor(field))names.add(escapeRegex(fold(alias.text)).replace(/\s+/g,'\\s+'));
  if(!names.size)return value=>value;
  const pattern=new RegExp(`\\s+(?:${[...names].sort((a,b)=>b.length-a.length).join('|')})\\s*[:=]`,'iu');
  return value=>{const hit=fold(value).match(pattern);return hit?value.slice(0,hit.index).trim():value;};
}
// A form field of a PDF ("STR", "CharacterName", "HPMax") counts as an exact hit.
function fromFormFields(fields,formFields,claimed){
  const matches=[];
  for(const field of fields){
    const aliases=aliasesFor(field).map(alias=>squash(alias.text));
    for(const form of formFields){
      const name=squash(form.name),raw=String(form.value??'').trim();
      if(!raw||claimed.has(form.name))continue;
      let value=null;
      if(field.type==='status'){
        const part=/(?:current|atual|now)$/.test(name)?'current':/(?:max|maximo|maximum)$/.test(name)?'max':null;
        const stem=name.replace(/(?:current|atual|now|maximum|maximo|max)$/,'');
        if(part&&aliases.includes(stem)&&/^\d{1,4}$/.test(raw)){
          const existing=matches.find(item=>item.fieldId===field.id);
          const current=existing?.value||{current:0,max:0};
          const next={...current,[part]:Number(raw)};
          if(existing){existing.value=next;claimed.add(form.name);continue;}
          matches.push({fieldId:field.id,label:field.label,type:field.type,value:next,confidence:'alta',source:'campo do PDF',evidence:`${form.name} = ${raw}`});claimed.add(form.name);
        }
        continue;
      }
      if(!aliases.includes(name))continue;
      if(field.type==='number'){const number=toNumberText(raw.replace('%',''));if(number===null)continue;value=number;}
      else if(field.type==='text')value=raw.slice(0,200);
      if(value===null)continue;
      matches.push({fieldId:field.id,label:field.label,type:field.type,value,confidence:'alta',source:'campo do PDF',evidence:`${form.name} = ${raw}`});
      claimed.add(form.name);break;
    }
  }
  return matches;
}

export function interpretSheetText({text='',formFields=[],fields}){
  const importable=fields.filter(field=>IMPORTABLE_TYPES.includes(field.type));
  const claimedForms=new Set(),claimedSpots=new Set();
  const found=new Map();
  for(const match of fromFormFields(importable,formFields,claimedForms))found.set(match.fieldId,match);
  const cutAtLabel=labelCutter(importable);
  const lines=String(text).split(/\r?\n/).map(line=>line.replace(/\s+$/,'')).filter(line=>line.trim());
  const folded=lines.map(fold);
  for(const field of importable){
    if(found.has(field.id))continue;
    let best=null;
    for(const alias of aliasesFor(field)){
      const pattern=aliasPattern(alias);
      for(let index=0;index<lines.length;index++){
        pattern.lastIndex=0;
        for(const hit of folded[index].matchAll(pattern)){
          const start=hit.index,end=start+hit[0].length,spot=`${index}:${start}`;
          if(claimedSpots.has(spot))continue;
          const before=lines[index].slice(0,start);
          if(OTHER_FIELD_PREFIX.test(before)&&!OTHER_FIELD_PREFIX.test(baseLabel(field.label)))continue;
          const rest=lines[index].slice(end);
          const blank=/^\s*$/.test(rest),read=readAfter(field,rest,lines[index+1])||(index>0&&blank&&field.type==='number'?readBefore(field,lines[index-1]):null)||(index>0&&blank&&!before.trim()?readPreviousLine(field,lines[index-1]):null)||readBefore(field,before);
          if(!read)continue;
          if(field.type==='text'&&typeof read.value==='string'){read.value=cutAtLabel(read.value);if(!read.value)continue;}
          const candidate={fieldId:field.id,label:field.label,type:field.type,value:read.value,confidence:read.confidence,source:'texto',evidence:lines[index].trim().slice(0,120),spot};
          if(!best||RANK[candidate.confidence]>RANK[best.confidence])best=candidate;
          if(best.confidence==='alta')break;
        }
        if(best?.confidence==='alta')break;
      }
      if(best?.confidence==='alta')break;
    }
    if(best){claimedSpots.add(best.spot);const {spot,...clean}=best;found.set(field.id,clean);}
  }
  const matches=fields.filter(field=>found.has(field.id)).map(field=>found.get(field.id));
  const missing=importable.filter(field=>!found.has(field.id)).map(field=>({fieldId:field.id,label:field.label,type:field.type}));
  const manual=fields.filter(field=>!IMPORTABLE_TYPES.includes(field.type)&&field.type!=='formula').map(field=>({fieldId:field.id,label:field.label,type:field.type}));
  return {matches,missing,manual};
}

// Adds to `primary` only the fields it lacks. Used when the second reading is less trustworthy (OCR text in reading order),
// so a wrong "high" confidence there can never replace a position-based answer. `cap` limits the confidence it may claim.
export function fillGaps(primary,secondary,fields,cap='media'){
  const have=new Set(primary.matches.map(match=>match.fieldId)),extra=secondary.matches.filter(match=>!have.has(match.fieldId)).map(match=>RANK[match.confidence]>RANK[cap]?{...match,confidence:cap}:match);
  const ids=new Set([...have,...extra.map(match=>match.fieldId)]);
  return {matches:fields.filter(field=>ids.has(field.id)).map(field=>primary.matches.find(match=>match.fieldId===field.id)||extra.find(match=>match.fieldId===field.id)),
    missing:primary.missing.filter(item=>!ids.has(item.fieldId)),manual:primary.manual};
}

// Merges two readings of the same file. For each field the higher confidence wins; on a tie the first reading keeps it.
export function mergeInterpretations(first,second,fields){
  const chosen=new Map();
  for(const match of [...first.matches,...second.matches]){
    const current=chosen.get(match.fieldId);
    if(!current||RANK[match.confidence]>RANK[current.confidence])chosen.set(match.fieldId,match);
  }
  const matches=fields.filter(field=>chosen.has(field.id)).map(field=>chosen.get(field.id));
  const found=new Set(matches.map(match=>match.fieldId));
  return {matches,missing:first.missing.filter(item=>!found.has(item.fieldId)),manual:first.manual};
}