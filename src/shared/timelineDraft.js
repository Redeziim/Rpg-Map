import {TIMELINE_KINDS,isTimelineDate} from './campaignTimeline.js';

export const TIMELINE_FIELDS=['date','kind','title','body','visibility','pointIds','sceneIds'];
export const TIMELINE_FIELD_LABELS={date:'Data',kind:'Tipo',title:'Título',body:'Texto',visibility:'Visibilidade',pointIds:'Pontos vinculados',sceneIds:'Cenas vinculadas'};
const today=()=>{const now=new Date(),pad=value=>String(value).padStart(2,'0');return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;};
export const timelineFields=entry=>({date:entry?.date||today(),kind:entry?.kind||'session',title:entry?.title||'',body:entry?.body||'',visibility:entry?.visibility||'master',pointIds:entry?.pointIds||[],sceneIds:entry?.sceneIds||[]});
export const sameTimelineField=(field,a,b)=>Array.isArray(a)?JSON.stringify([...a].sort())===JSON.stringify([...b].sort()):a===b;
// Fields the person did not touch follow the table; touched fields stay unless they choose the table's value.
export const mergeTimelineFields=(base,draft,latest,choices)=>Object.fromEntries(TIMELINE_FIELDS.map(field=>[field,sameTimelineField(field,base[field],draft[field])||choices[field]==='latest'?latest[field]:draft[field]]));
export function validTimelineDraft(record){
  const fields=value=>value&&isTimelineDate(value.date)&&Object.hasOwn(TIMELINE_KINDS,value.kind)&&typeof value.title==='string'&&value.title.length<=120&&typeof value.body==='string'&&value.body.length<=10000&&['master','table'].includes(value.visibility)&&Array.isArray(value.pointIds)&&Array.isArray(value.sceneIds)&&[...value.pointIds,...value.sceneIds].length<=40&&[...value.pointIds,...value.sceneIds].every(id=>typeof id==='string'&&id.length<=100);
  return record&&typeof record.id==='string'&&/^[a-zA-Z0-9-]{8,100}$/.test(record.id)&&Number.isSafeInteger(record.base?.version)&&record.base.version>=0&&fields(record.fields)&&fields(record.base.fields)?record:null;
}
export const makeTimelineDraft=entry=>({id:entry?.id||crypto.randomUUID(),base:{version:entry?.version||0,fields:timelineFields(entry)},fields:timelineFields(entry)});
