// Modelos de ficha guardados por pessoa (ADR 037). Um modelo é só a lista de campos do mesmo tipo que a mesa usa; aqui ficam as regras
// que valem no navegador e no servidor, para o que o app grava ser o que o servidor aceita.
export const SHEET_FIELD_TYPES=Object.freeze(['text','number','textarea','image','list','checklist','formula','attack','status']);
export const SHEET_MODEL_SOURCES=Object.freeze(['file','room','manual']);
export const SHEET_MODEL_LIMITS=Object.freeze({fields:200,models:30,name:80,label:120,tab:100,formula:1000});
export class SheetModelError extends Error{}
const fail=message=>{throw new SheetModelError(message);};
const control=/[\u0000-\u001f\u007f]/;

export function cleanModelName(value){
  const name=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  if(!name||name.length>SHEET_MODEL_LIMITS.name)fail(`O nome do modelo deve ter de 1 a ${SHEET_MODEL_LIMITS.name} caracteres.`);
  if(control.test(name))fail('O nome do modelo tem caracteres inválidos.');
  return name;
}

// Normaliza a lista de campos de um modelo: tira o que não faz parte (inclusive ids, que cada mesa cria de novo) e recusa o resto.
export function cleanSheetFields(value){
  if(!Array.isArray(value)||!value.length)fail('O modelo precisa de pelo menos um campo.');
  if(value.length>SHEET_MODEL_LIMITS.fields)fail(`O modelo passa de ${SHEET_MODEL_LIMITS.fields} campos.`);
  const seen=new Set(),fields=[];
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item))fail('Campo do modelo inválido.');
    if(!SHEET_FIELD_TYPES.includes(item.type))fail('Tipo de campo inválido.');
    const label=typeof item.label==='string'?item.label.trim().replace(/\s+/g,' '):'';
    if(!label||label.length>SHEET_MODEL_LIMITS.label||control.test(label))fail(`Cada campo precisa de um nome de até ${SHEET_MODEL_LIMITS.label} caracteres.`);
    const key=label.toLocaleLowerCase('pt-BR');
    if(seen.has(key))fail(`Dois campos se chamam “${label}”. Os nomes precisam ser diferentes.`);
    seen.add(key);
    const tab=typeof item.tab==='string'&&item.tab.trim()?item.tab.trim().replace(/\s+/g,' '):'Geral';
    if(tab.length>SHEET_MODEL_LIMITS.tab||control.test(tab))fail('Categoria do campo inválida.');
    const field={type:item.type,label,tab};
    if(item.type==='formula'){
      const formula=typeof item.formula==='string'?item.formula.trim():'';
      if(!formula||formula.length>SHEET_MODEL_LIMITS.formula||control.test(formula))fail(`A fórmula de “${label}” está vazia ou é longa demais.`);
      field.formula=formula;
    }
    fields.push(field);
  }
  return fields;
}
