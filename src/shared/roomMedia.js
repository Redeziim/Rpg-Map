export const isInlineRoomImage=value=>typeof value==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value);
export const isRoomImageReference=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&typeof value._roomImage==='string'&&/^[a-f0-9]{64}$/.test(value._roomImage);

export function mapNoteBoardImages(board,transform){
  if(!board||!Array.isArray(board.nodes))return board;
  return {...board,nodes:board.nodes.map(node=>node?.kind==='image'&&Object.hasOwn(node,'src')?{...node,src:transform(node.src)}:node)};
}

// Only declared image fields are media. Note text that happens to contain a data URL stays text.
export function mapRoomImages(room,transform){
  const state=room.state;
  const mapNotes=notes=>notes?.map(note=>({...note,...(note.board?{board:mapNoteBoardImages(note.board,transform)}:{})}));
  const profiles=entries=>Object.fromEntries(Object.entries(entries||{}).map(([name,profile])=>[name,{...profile,avatar:transform(profile.avatar)}]));
  const sheets=Object.fromEntries(Object.entries(state.playerSheets||{}).map(([name,sheet])=>{
    const fields=[...(state.sheetFields||[]),...(sheet.extraFields||[])],values={...sheet.values};
    for(const field of fields)if(field.type==='image'&&Object.hasOwn(values,field.id))values[field.id]=transform(values[field.id]);
    return [name,{...sheet,values,...(sheet.notebooks?{notebooks:mapNotes(sheet.notebooks)}:{})}];
  }));
  return {...room,groupBars:profiles(room.groupBars),state:{...state,
    ...(Object.hasOwn(state,'mapImage')?{mapImage:transform(state.mapImage)}:{}),
    statusBarsData:profiles(state.statusBarsData),playerSheets:sheets,
    ...(state.masterNotebooks?{masterNotebooks:mapNotes(state.masterNotebooks)}:{}),
    ...(state.sharedNotebooks?{sharedNotebooks:mapNotes(state.sharedNotebooks)}:{}),
  }};
}
