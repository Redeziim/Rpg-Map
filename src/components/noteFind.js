const fold=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function findTextMatches(text,query){
  const needle=fold(query.trim());
  if(!needle)return [];
  let folded='',offset=0;
  const starts=[],ends=[];
  for(const char of text){
    const normalized=fold(char),end=offset+char.length;
    if(!normalized&&ends.length)ends[ends.length-1]=end;
    for(let i=0;i<normalized.length;i++){starts.push(offset);ends.push(end);}
    folded+=normalized;offset=end;
  }
  const matches=[];
  for(let cursor=0;(cursor=folded.indexOf(needle,cursor))!==-1;cursor+=needle.length){
    matches.push({start:starts[cursor],end:ends[cursor+needle.length-1]});
  }
  return matches;
}

export function findNoteMatches(note,query,boardOpen){
  if(!boardOpen)return findTextMatches(note.body||'',query).map(range=>({...range,kind:'body',id:'body'}));
  const board=note.board||{};
  return [...(board.nodes||[]).flatMap(node=>findTextMatches(node.text||'',query).map(range=>({...range,kind:'node',id:node.id}))),
    ...(board.edges||[]).flatMap(edge=>findTextMatches(edge.label||'',query).map(range=>({...range,kind:'edge',id:edge.id})))];
}
