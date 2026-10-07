export const TIMELINE_KINDS=Object.freeze({session:'Sessão',decision:'Decisão'});
export const TIMELINE_PAGE_SIZE=20;
const idPattern=/^[a-zA-Z0-9-]{1,100}$/;

export function isTimelineDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))return false;
  const time=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}

// This projection receives the viewer's already authorized points and scenes.
// Entry text is published explicitly; links never grant access to their targets.
export function visibleTimelineEntries(entries,{master=false,pointIds=new Set(),sceneIds=new Set()}={}){
  return entries.filter(entry=>!entry.archived&&(master||entry.visibility==='table')).map(entry=>({
    ...entry,
    pointIds:entry.pointIds.filter(id=>pointIds.has(id)),
    sceneIds:entry.sceneIds.filter(id=>sceneIds.has(id)),
  }));
}

const compareText=(left,right)=>left===right?0:left<right?-1:1;
const compareEntries=(left,right)=>compareText(right.date,left.date)||right.createdAt-left.createdAt||compareText(right.id,left.id);

// The continuation tuple belongs to a visible entry. A caller must reject it
// when the collection revision changes, then start again at the first page.
export function timelinePage(entries,{kind='all',before=null,limit=TIMELINE_PAGE_SIZE}={}){
  if(kind!=='all'&&!Object.hasOwn(TIMELINE_KINDS,kind))throw Error('Tipo de registro inválido.');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Tamanho de página inválido.');
  if(before&&(!isTimelineDate(before.date)||!Number.isSafeInteger(before.createdAt)||before.createdAt<1||!idPattern.test(before.id)))throw Error('Página da campanha inválida.');
  const ordered=entries.filter(entry=>(kind==='all'||entry.kind===kind)&&(!before||compareEntries(entry,before)>0)).sort(compareEntries);
  const page=ordered.slice(0,limit),last=page.at(-1),hasMore=ordered.length>limit;
  return {entries:page,hasMore,next:hasMore?{date:last.date,createdAt:last.createdAt,id:last.id}:null};
}

const formatter=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
export const formatTimelineDate=value=>isTimelineDate(value)?formatter.format(new Date(`${value}T00:00:00Z`)):'Data indisponível';
