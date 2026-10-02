export const POINT_FIELDS=['name','description','type'];

export function pointFields(point){
  return {name:point.name,description:point.description||'',type:point.type||'cidade'};
}

export function mergePointFields(base,draft,latest,choices){
  return Object.fromEntries(POINT_FIELDS.map(field=>[
    field,draft[field]===base[field]||choices[field]==='latest'?latest[field]:draft[field]
  ]));
}
