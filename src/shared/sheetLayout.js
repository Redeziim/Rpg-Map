// Lê uma ficha pela POSIÇÃO das palavras (saída do OCR com caixas), não pela ordem do texto. Fichas de caixas põem o valor
// acima, abaixo ou ao lado do rótulo; o OCR de texto corrido embaralha isso. Aqui cada rótulo recebe o valor mais próximo,
// e um valor nunca serve a dois rótulos.
import {IMPORTABLE_TYPES,OTHER_FIELD_PREFIX,aliasPattern,aliasesFor,fold,labelCutter,toNumberText} from './sheetImport.js';

const NUMERIC=/^[+-]?\d{1,4}(?:[.,]\d{1,2})?%?$/;
const PAIR=/^(\d{1,4})\s*[/\\]\s*(\d{1,4})$/;
const squash=text=>fold(String(text)).toLowerCase().replace(/[^a-z0-9]+/g,'');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]||10;};
const center=box=>(box.y0+box.y1)/2;
const overlapX=(a,b)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))/Math.max(1,Math.min(a.x1-a.x0,b.x1-b.x0));

function clean(words){
  return words.map(([text,x0,y0,x1,y1,conf])=>({text:String(text).trim(),x0,y0,x1,y1,conf}))
    .filter(word=>word.text&&word.conf>=25&&word.x1>word.x0&&word.y1>word.y0&&/[\p{L}\p{N}+\-/\\]/u.test(word.text));
}

const overlapY=(a,b)=>Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0))/Math.max(1,Math.min(a.y1-a.y0,b.y1-b.y0));

// Large numbers come back as "1 0" or "3 8 / 4 5": glue digits and slashes that sit right next to each other on a row.
function glue(words,height){
  const result=[];
  for(const word of [...words].sort((a,b)=>a.x0-b.x0||a.y0-b.y0)){
    let previous=null;
    for(let index=result.length-1;index>=0;index--){const candidate=result[index];if(overlapY(candidate,word)>=0.5&&word.x0>=candidate.x0){previous=candidate;break;}}
    const near=previous&&word.x0-previous.x1<=Math.max(height*0.55,(word.y1-word.y0)*0.6);
    const digitRun=near&&/^[+-]?\d+$/.test(previous.text)&&/^\d+$/.test(word.text);
    const slashRun=near&&(/\d$/.test(previous.text)&&/^[/\\]$/.test(word.text)||/[/\\]$/.test(previous.text)&&/^\d+$/.test(word.text));
    if(digitRun||slashRun){previous.text+=word.text;previous.x1=Math.max(previous.x1,word.x1);previous.y0=Math.min(previous.y0,word.y0);previous.y1=Math.max(previous.y1,word.y1);}
    else result.push({...word});
  }
  return result;
}

// Words that share a vertical band and sit close together form a segment (a label, a value, a short phrase).
// A wide gap, or another band, starts a new one: that is how columns and boxes stay apart.
function segmentsOf(words,height){
  const parent=words.map((_,index)=>index),find=index=>{while(parent[index]!==index){parent[index]=parent[parent[index]];index=parent[index];}return index;};
  for(let i=0;i<words.length;i++)for(let j=0;j<words.length;j++){
    if(i===j||words[i].x0>words[j].x0)continue;
    const gap=words[j].x0-words[i].x1;
    if(gap>=-height*0.3&&gap<=height*1.6&&overlapY(words[i],words[j])>=0.5)parent[find(i)]=find(j);
  }
  const groups=new Map();
  words.forEach((word,index)=>{const root=find(index);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(word);});
  const segments=[...groups.values()].map(tokens=>{
    tokens.sort((a,b)=>a.x0-b.x0);
    const box={x0:Math.min(...tokens.map(t=>t.x0)),y0:Math.min(...tokens.map(t=>t.y0)),x1:Math.max(...tokens.map(t=>t.x1)),y1:Math.max(...tokens.map(t=>t.y1))};
    return {tokens,...box,text:tokens.map(token=>token.text).join(' '),cx:(box.x0+box.x1)/2,cy:center(box),h:box.y1-box.y0,stacked:false};
  });
  return segments.sort((a,b)=>a.cy-b.cy||a.x0-b.x0);
}
// A label printed over two lines ("CLASSE DE" over "ARMADURA") is one label, but only when the two lines together are a known label.
function stackedLabels(segments,height,known){
  const result=[];
  for(const top of segments)for(const bottom of segments){
    if(top===bottom)continue;
    const gap=bottom.y0-top.y1;
    if(gap<-height*0.2||gap>height*0.9||overlapX(top,bottom)<0.4||!known.has(squash(`${top.text} ${bottom.text}`)))continue;
    const box={x0:Math.min(top.x0,bottom.x0),y0:Math.min(top.y0,bottom.y0),x1:Math.max(top.x1,bottom.x1),y1:Math.max(top.y1,bottom.y1)};
    result.push({...box,text:`${top.text} ${bottom.text}`,cx:(box.x0+box.x1)/2,cy:center(box),h:box.y1-box.y0,stacked:true,members:[top,bottom],tokens:[...top.tokens,...bottom.tokens]});
  }
  return result;
}

function valueFor(field,text){
  const value=text.trim();
  if(field.type==='number'){if(!NUMERIC.test(value))return null;return toNumberText(value.replace('%',''));}
  if(field.type==='status'){const pair=value.match(PAIR);return pair?{current:Number(pair[1]),max:Number(pair[2])}:null;}
  if(field.type==='text')return !NUMERIC.test(value)&&!PAIR.test(value)&&value.length>=2&&value.length<=60?value:null;
  return null;
}

// Segments the reader sees, for tests and for explaining a reading to a person.
export function describeLayout(words){
  const usable=clean(words),height=median(usable.map(word=>word.y1-word.y0));
  return segmentsOf(glue(usable,height),height).map(segment=>({text:segment.text,box:[segment.x0,segment.y0,segment.x1,segment.y1]}));
}

export function interpretSheetWords({words=[],fields}){
  const importable=fields.filter(field=>IMPORTABLE_TYPES.includes(field.type));
  const cut=labelCutter(importable),usable=clean(words),height=median(usable.map(word=>word.y1-word.y0));
  const base=segmentsOf(glue(usable,height),height);
  const known=new Set(importable.flatMap(field=>aliasesFor(field).map(alias=>squash(alias.text))));
  const stacks=stackedLabels(base,height,known),parts=new Set(stacks.flatMap(stack=>stack.members));
  const segments=[...base,...stacks];
  // 1. Where is each field's label?
  const hits=[];
  for(const field of importable){
    for(const alias of aliasesFor(field)){
      const pattern=aliasPattern(alias);
      for(const segment of segments){
        pattern.lastIndex=0;
        for(const found of fold(segment.text).matchAll(pattern)){
          // "CLASSE DE" is half of "Classe de Armadura", not the label "Classe".
          if(OTHER_FIELD_PREFIX.test(segment.text.slice(0,found.index))||parts.has(segment))continue;
          // A stacked candidate only counts as a whole label ("Classe de Armadura"), never as a piece of one.
          if(segment.stacked&&squash(found[0])!==squash(segment.text))continue;
          // The label's own box: the whole segment when the label fills it, otherwise its share of the width.
          const length=Math.max(1,segment.text.length),from=found.index/length,to=(found.index+found[0].length)/length,width=segment.x1-segment.x0;
          hits.push({field,segment,before:segment.text.slice(0,found.index),rest:segment.text.slice(found.index+found[0].length),length:found[0].length,
            box:{x0:segment.x0+width*from,x1:segment.x0+width*to,y0:segment.y0,y1:segment.y1}});
        }
      }
    }
  }
  const chosen=new Map(),used=new Set();
  const take=(hit,value,confidence,evidence)=>chosen.set(hit.field.id,{fieldId:hit.field.id,label:hit.field.label,type:hit.field.type,value,confidence,source:'posição',evidence:evidence.slice(0,140)});
  // 2. A value in the same segment is the most reliable: "Força: 16", "PV 24/30", or "+7 Acrobacia".
  for(const hit of hits){
    if(chosen.has(hit.field.id)||hit.segment.stacked)continue;
    const after=hit.rest.replace(/^\s*(?:\([^)]{1,12}\)\s*)?(?:[:=.·_\s]|[-–—]\s+)*/,'');
    let value=null,confidence='alta';
    if(hit.field.type==='status'){const pair=after.match(/^(\d{1,4})\s*(?:\/|\\|de)\s*(\d{1,4})/i);if(pair)value={current:Number(pair[1]),max:Number(pair[2])};}
    else if(hit.field.type==='number'){
      const number=after.match(/^([+-]?\d{1,4}(?:[.,]\d{1,2})?)(?!\d)/);
      if(number)value=toNumberText(number[1]);
      else{const ahead=hit.before.match(/([+-]?\d{1,4}(?:[.,]\d{1,2})?)\s*[|:()[\]]*\s*$/);if(ahead){value=toNumberText(ahead[1]);confidence='media';}}
    }else if(hit.field.type==='text'&&/^\s*[:=\-–—]/.test(hit.rest)){const text=cut(after.trim());if(text&&!NUMERIC.test(text))value=text.slice(0,60);}
    if(value!==null&&value!=='')take(hit,value,confidence,hit.segment.text);
  }
  // 3. Neighbouring values, closest first; each value is used once.
  const valueSegments=base.filter(segment=>NUMERIC.test(segment.text)||PAIR.test(segment.text)||!hits.some(hit=>hit.segment===segment&&!hit.rest.trim()));
  const candidates=[];
  for(const hit of hits){
    if(chosen.has(hit.field.id))continue;
    const label=hit.box,h=Math.max(height,hit.segment.h);
    for(const segment of valueSegments){
      if(hit.segment.tokens.some(token=>segment.tokens.includes(token)))continue;
      const value=valueFor(hit.field,segment.text);
      if(value===null)continue;
      const labelCx=(label.x0+label.x1)/2,dx=segment.cx-labelCx,below=segment.y0-label.y1,above=label.y0-segment.y1,sameRow=Math.abs(segment.cy-center(label))<=h*0.8;
      const column=overlapX(label,segment)>=0.25||Math.abs(dx)<=Math.max(label.x1-label.x0,segment.x1-segment.x0)*0.8+h;
      let cost=null,confidence='media',where='';
      if(sameRow&&segment.x0>=label.x1-h*0.5&&segment.x0-label.x1<=h*8){cost=(segment.x0-label.x1)/h+1;where='ao lado';}
      else if(column&&below>=-h*0.3&&below<=h*2.6){cost=Math.max(0,below)/h+2+Math.abs(dx)/(h*8);where='abaixo';}
      else if(column&&above>=-h*0.3&&above<=h*2.6){cost=Math.max(0,above)/h+3+Math.abs(dx)/(h*8);where='acima';confidence='baixa';}
      else if(hit.field.type==='number'&&sameRow&&label.x0-segment.x1>=-h*0.5&&label.x0-segment.x1<=h*4){cost=(label.x0-segment.x1)/h+3.5;where='antes';confidence='baixa';}
      if(cost!==null)candidates.push({hit,segment,value,cost,confidence,where});
    }
  }
  candidates.sort((a,b)=>a.cost-b.cost||b.hit.length-a.hit.length);
  for(const candidate of candidates){
    if(chosen.has(candidate.hit.field.id)||used.has(candidate.segment))continue;
    used.add(candidate.segment);
    take(candidate.hit,candidate.value,candidate.confidence,`${candidate.hit.segment.text.slice(0,60)} ← ${candidate.segment.text.slice(0,40)} (${candidate.where})`);
  }
  const matches=fields.filter(field=>chosen.has(field.id)).map(field=>chosen.get(field.id));
  const found=new Set(matches.map(match=>match.fieldId));
  return {matches,
    missing:importable.filter(field=>!found.has(field.id)).map(field=>({fieldId:field.id,label:field.label,type:field.type})),
    manual:fields.filter(field=>!IMPORTABLE_TYPES.includes(field.type)&&field.type!=='formula').map(field=>({fieldId:field.id,label:field.label,type:field.type}))};
}
