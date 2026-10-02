import {createHash} from 'node:crypto';
import {isInlineRoomImage,mapRoomImages} from '../src/shared/roomMedia.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
export function roomImageSources(room){
  const images=new Map(),known=new Map();
  const projected=mapRoomImages(room,value=>{
    if(!isInlineRoomImage(value))return value;
    let id=known.get(value);
    if(!id){id=hash(value);known.set(value,id);images.set(id,value);}
    return {_roomImage:id};
  });
  return {images,projected};
}

export function createRoomMediaTransfer(){
  const manifests=new Map();let entries=0;
  const remove=key=>{entries-=manifests.get(key).images.size;manifests.delete(key);};
  return {
    encode(room,userId,knownVersion){
      const now=Date.now();
      for(const [key,manifest] of manifests)if(now-manifest.created>300000)remove(key);
      const {images,projected}=roomImageSources(room),hashes=[...images.keys()].sort(),version=hash(JSON.stringify(hashes));
      const prefix=room.id+':'+userId+':',known=manifests.get(prefix+knownVersion)?.images;
      const added=Object.fromEntries([...images].filter(([id])=>!known?.has(id)));
      const key=prefix+version;
      if(manifests.has(key))remove(key);
      if(images.size<=65536){manifests.set(key,{images:new Set(hashes),created:now});entries+=images.size;}
      while(manifests.size>128||entries>65536)remove(manifests.keys().next().value);
      return {...projected,roomMedia:{version,hashes,images:added}};
    },
  };
}
