// Formulas of the character sheet: arithmetic over other fields, by name. Nothing else is evaluated.
// Functions use Portuguese names so a master can read them: piso (round down), teto (round up), min, max, abs.
const FUNCTIONS={piso:'Math.floor',teto:'Math.ceil',min:'Math.min',max:'Math.max',abs:'Math.abs'};
const FUNCTION_NAMES=/\b(piso|teto|min|max|abs)\b/gi;
const escapeLabel=label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// Empty, text or missing values count as 0, and a resource bar counts as its current value.
export function toNumber(value){
  if(value&&typeof value==='object'&&!Array.isArray(value)&&'current' in value)value=value.current;
  if(value===''||value===null||value===undefined||typeof value==='boolean')return 0;
  const number=Number(value);
  return Number.isFinite(number)?number:0;
}

// `numbers` maps a field label to its number. Longer labels are replaced first so "Mod. Força" wins over "Força".
export function evaluateFormula(formula,numbers){
  if(!formula||!String(formula).trim())return null;
  let expression=String(formula);
  for(const label of Object.keys(numbers).sort((a,b)=>b.length-a.length)){
    if(!label)continue;
    expression=expression.replace(new RegExp(escapeLabel(label),'gi'),`(${toNumber(numbers[label])})`);
  }
  // After substitution only digits, operators, parentheses, commas and the five function names may remain.
  if(!/^[0-9+\-*/().,\s]*$/.test(expression.replace(FUNCTION_NAMES,'')))return 'erro';
  expression=expression.replace(FUNCTION_NAMES,name=>FUNCTIONS[name.toLowerCase()]);
  try{
    const result=Function(`"use strict"; return (${expression||'0'});`)();
    return typeof result==='number'&&Number.isFinite(result)?Math.round(result*100)/100:'erro';
  }catch{return 'erro';}
}

// Pareia cada atributo com a fórmula do seu modificador ("Mod. Força" -> "Força"; "Modificador de Destreza" -> "Destreza"), para a ficha
// mostrar os dois no mesmo cartão. Devolve mods (id do atributo -> campo de fórmula) e hidden (ids de fórmula que já aparecem no cartão).
const MODIFIER_LABEL=/^(?:mod\.?|modificador)(?:\s+de)?\s+(.+)$/i;
export function pairModifiers(fields){
  const mods=new Map(),hidden=new Set();
  for(const field of fields){
    if(field.type!=='formula')continue;
    const match=MODIFIER_LABEL.exec(String(field.label||'').trim());
    if(!match)continue;
    const base=fields.find(other=>other.type==='number'&&!mods.has(other.id)&&String(other.label||'').trim().toLowerCase()===match[1].trim().toLowerCase());
    if(base){mods.set(base.id,field);hidden.add(field.id);}
  }
  return {mods,hidden};
}
// "+2", "−1" (sinal de menos de verdade), "+0". Sem valor no atributo ou erro na fórmula, não inventa número: mostra "—".
export function formatModifier(result,hasScore){
  if(typeof result!=='number'||!hasScore)return '—';
  return `${result<0?'−':'+'}${Math.abs(result)}`;
}
// Categoria só de números e com muitos campos (perícias, salvaguardas): a ficha mostra como lista compacta em colunas.
export const isCompactCategory=fields=>fields.length>=5&&fields.every(field=>field.type==='number');

// Computes every formula field, following references between formulas. A cycle or a broken formula yields 'erro',
// and any formula that depends on it does too. Returns Map(field id -> number | 'erro' | null).
export function resolveFormulas(fields,values={}){
  const results=new Map(),visiting=new Set();
  function resolve(field){
    if(results.has(field.id))return results.get(field.id);
    if(visiting.has(field.id))return 'erro';
    visiting.add(field.id);
    const text=String(field.formula||'').toLowerCase(),numbers={};let broken=false;
    for(const other of fields){
      if(other.id===field.id||!other.label||!text.includes(other.label.toLowerCase()))continue;
      if(other.type==='formula'){const inner=resolve(other);if(inner==='erro')broken=true;numbers[other.label]=typeof inner==='number'?inner:0;}
      else numbers[other.label]=toNumber(values[other.id]);
    }
    visiting.delete(field.id);
    const result=broken?'erro':evaluateFormula(field.formula,numbers);
    results.set(field.id,result);
    return result;
  }
  for(const field of fields)if(field.type==='formula')resolve(field);
  return results;
}
