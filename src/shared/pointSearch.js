// Busca e filtro dos pontos do mapa 2D (item 23, opção A): só o que o ponto já tem — nome, descrição e tipo.
// A lista recebida já vem sem os pontos que a névoa esconde de quem consulta; este módulo nunca amplia o que se vê.
const fold=text=>String(text||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');

export const POINT_TYPE_ALL='all';

// Every word typed must appear in the name, the description or the type's label ("taverna porto" finds a tavern named "Porto velho").
export function filterPoints(points,{query='',type=POINT_TYPE_ALL,typeLabels={}}={}){
  const words=fold(query).split(/\s+/).filter(Boolean);
  return points.filter(point=>{
    if(type!==POINT_TYPE_ALL&&point.type!==type)return false;
    if(!words.length)return true;
    const haystack=fold(`${point.name} ${point.description||''} ${typeLabels[point.type]||point.type||''}`);
    return words.every(word=>haystack.includes(word));
  }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{numeric:true,sensitivity:'base'})||String(a.id).localeCompare(String(b.id)));
}

// Count per type for the chips; the count follows the text search, so a chip never promises more than it shows.
export function countByType(points,{query='',typeLabels={}}={}){
  const counts={[POINT_TYPE_ALL]:0};
  for(const point of filterPoints(points,{query,typeLabels})){counts[point.type]=(counts[point.type]||0)+1;counts[POINT_TYPE_ALL]++;}
  return counts;
}

// Where the map has to move so a point sits in the middle of the view. The artwork scales around its own center and is
// laid out at `fit` times its canvas size, so the offset is the point's distance from the canvas center in screen pixels.
export function centerOnPoint(point,{width,height,fit,scale}){
  return {x:-scale*fit*(point.x-width/2)||0,y:-scale*fit*(point.y-height/2)||0};
}
