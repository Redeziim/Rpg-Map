// Divide a ficha em páginas de livro. Puro: recebe categorias e devolve páginas, para ser testado sem navegador.
// Os pesos são alturas estimadas em pixels, medidas na ficha real com a página a uns 400 px de largura:
// cabeçalho da categoria 72, campo curto 90, área de texto 158, lista 140, barra de recurso 141, fileira de atributos 124.
const SHORT=new Set(['text','number','formula','select']);
const TALL={textarea:158,list:140,image:220,checklist:150,attack:150,status:141};
const HEADING=72,SHORT_ROW=90,ATTRIBUTE_ROW=124,COMPACT_ROW=38;
export const CATEGORY_GAP=24;

export function categoryWeight(fields,{kind='default',cards=fields.length}={}){
  if(kind==='attributes')return HEADING+Math.ceil(cards/3)*ATTRIBUTE_ROW;
  if(kind==='compact')return HEADING+fields.length*COMPACT_ROW;
  if(kind==='identity')return HEADING+Math.ceil(fields.length/2)*SHORT_ROW;
  let height=0;
  for(const field of fields)height+=SHORT.has(field.type)?SHORT_ROW:(TALL[field.type]??SHORT_ROW*1.5);
  return HEADING+height;
}

// Agrupa categorias vizinhas, na ordem do modelo, até a página lotar. Categoria maior que a página fica sozinha e rola por dentro.
export function paginate(items,capacity){
  const pages=[];
  for(const item of items){
    const current=pages[pages.length-1];
    if(current&&current.weight+CATEGORY_GAP+item.weight<=capacity){current.categories.push(item.category);current.weight+=CATEGORY_GAP+item.weight;}
    else pages.push({categories:[item.category],weight:item.weight});
  }
  return pages.map(page=>({...page,overflow:page.weight>capacity}));
}

// Primeira página de cada vista: de 2 em 2 no livro aberto (capa e página 1, depois 2 e 3...), de 1 em 1 no celular.
export const viewStart=(page,perView)=>Math.floor(Math.max(0,page)/perView)*perView;
export const viewCount=(total,perView)=>Math.ceil(total/perView);
export const pagesInView=(start,total,perView)=>Array.from({length:perView},(_,i)=>start+i).filter(page=>page<total);
export const clampStart=(start,total,perView)=>viewStart(Math.min(Math.max(0,start),Math.max(0,total-1)),perView);
export function viewLabel(start,total,perView){
  const shown=pagesInView(start,total,perView).map(page=>page+1);
  if(shown.length===2)return `Páginas ${shown[0]} e ${shown[1]} de ${total}`;
  return `Página ${shown[0]} de ${total}`;
}
