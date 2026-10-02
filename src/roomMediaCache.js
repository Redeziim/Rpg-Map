import {isInlineRoomImage,isRoomImageReference,mapNoteBoardImages,mapRoomImages} from './shared/roomMedia.js';

export function createRoomMediaCache(){
  let images=new Map(),sourceIds=new Map(),version='',manifest=new Set(),imageFields=new Set();
  const invalid=()=>{version='';manifest=new Set();throw Error('Uma imagem da mesa não está disponível nesta cópia. Reconecte para carregar o conteúdo completo.');};
  const reference=value=>{
    const id=sourceIds.get(value);
    return id&&manifest.has(id)?{_roomImage:id}:value;
  };
  return {
    headers:()=>({'X-Grimorio-Media':'1',...(version?{'X-Grimorio-Media-Cache':version}:{})}),
    decode(room){
      if(!room?.roomMedia){if(room?.state&&typeof room.revision==='number'){version='';manifest=new Set();}return room;}
      const media=room.roomMedia;
      if(!/^[a-f0-9]{64}$/.test(media.version)||!Array.isArray(media.hashes)||!media.images||typeof media.images!=='object'||Array.isArray(media.images))return invalid();
      const required=new Set(media.hashes),candidate=new Map(images);
      if(required.size!==media.hashes.length||media.hashes.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)))return invalid();
      for(const [id,value] of Object.entries(media.images)){
        if(!required.has(id)||!isInlineRoomImage(value))return invalid();
        candidate.set(id,value);
      }
      for(const id of required)if(!candidate.has(id))return invalid();
      const {roomMedia,...snapshot}=room;
      const result=mapRoomImages(snapshot,value=>{
        if(isRoomImageReference(value)){if(!required.has(value._roomImage))return invalid();return candidate.get(value._roomImage);}
        if(value&&typeof value==='object')return invalid();
        return value;
      });
      let size=[...candidate.values()].reduce((sum,value)=>sum+value.length,0);
      // Keep older images for HTTP/SSE reordering, bounded separately from the current snapshot.
      for(const [id,value] of candidate){if(size<=40*1024*1024)break;if(!required.has(id)){size-=value.length;candidate.delete(id);}}
      if(size>40*1024*1024)return invalid();
      images=candidate;sourceIds=new Map([...images].map(([id,value])=>[value,id]));version=media.version;manifest=required;
      imageFields=new Set([...(result.state.sheetFields||[]),...Object.values(result.state.playerSheets||{}).flatMap(sheet=>sheet.extraFields||[])].filter(field=>field.type==='image').map(field=>field.id));
      return result;
    },
    encode(data){
      if(!data)return data;
      const result={...data};
      for(const key of ['mapImage','avatar'])if(Object.hasOwn(data,key))result[key]=reference(data[key]);
      if(data.board)result.board=mapNoteBoardImages(data.board,reference);
      if(data.values){result.values={...data.values};for(const id of imageFields)if(Object.hasOwn(data.values,id))result.values[id]=reference(data.values[id]);}
      return result;
    },
  };
}
