export const NOTE_FIELDS=['title','body','board'];

export function sameNoteField(field,left,right){
  return field==='board'?JSON.stringify(left||null)===JSON.stringify(right||null):left===right;
}

export function editedNoteFields(draft,base){
  return Object.fromEntries(NOTE_FIELDS.map(field=>[field,!sameNoteField(field,draft?.[field],base?.[field])]));
}

export function sameRecipients(left=[],right=[]){
  return left.length===right.length&&left.every(name=>right.includes(name));
}

export function resolveNoteConflict(draft,latest,editedFields,choices){
  const resolved={...latest};
  for(const field of NOTE_FIELDS){
    resolved[field]=editedFields[field]&&choices[field]!=='latest'?draft[field]:latest[field];
  }
  return resolved;
}

function countChanges(left=[],right=[]){
  const before=new Map(left.map(item=>[item.id,item])),after=new Map(right.map(item=>[item.id,item]));
  let added=0,removed=0,changed=0;
  for(const [id,item] of after){if(!before.has(id))added++;else if(JSON.stringify(before.get(id))!==JSON.stringify(item))changed++;}
  for(const id of before.keys())if(!after.has(id))removed++;
  return {added,removed,changed};
}

export function boardDifference(left={},right={}){
  const nodes=countChanges(left.nodes,right.nodes),edges=countChanges(left.edges,right.edges),strokes=countChanges(left.strokes,right.strokes);
  return {nodes,edges,strokes,resized:(left.width||960)!==(right.width||960)||(left.height||620)!==(right.height||620)};
}

export function boardOutline(board={}){
  const nodes=board.nodes||[],edges=board.edges||[],strokes=board.strokes||[];
  return {
    counts:`${nodes.length} ${nodes.length===1?'ideia':'ideias'} · ${edges.length} ${edges.length===1?'conexão':'conexões'} · ${strokes.length} ${strokes.length===1?'traço':'traços'}`,
    size:`${board.width||960} × ${board.height||620}`,
    ideas:nodes.slice(0,4).map(node=>node.text||'Ideia sem título'),
    remaining:Math.max(0,nodes.length-4),
  };
}
