import sharp from 'sharp';

const imageBytes=image=>Buffer.from(image.slice(image.indexOf(',')+1),'base64');
const inputOptions={limitInputPixels:32*1024*1024,failOn:'error'};

export async function mapImageDimensions(image){
  const metadata=await sharp(imageBytes(image),inputOptions).metadata();
  const rotated=metadata.orientation>=5&&metadata.orientation<=8;
  const width=rotated?metadata.height:metadata.width,height=rotated?metadata.width:metadata.height;
  if(!width||!height||width>16000||height>16000)throw Error('dimensions');
  return {width,height};
}

export async function maskedMapImage(image,fog){
  const holes=fog.areas.map(area=>`<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" fill="black"/>`).join('');
  const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fog.width}" height="${fog.height}"><mask id="fog"><rect width="100%" height="100%" fill="white"/>${holes}</mask><rect width="100%" height="100%" fill="#151913" mask="url(#fog)"/></svg>`);
  return sharp(imageBytes(image),inputOptions).autoOrient().composite([{input:overlay}]).png().toBuffer();
}

export function createMapFogRenderer(){
  const cache=new Map();let queue=Promise.resolve(),bytes=0,pending=0;
  return (key,image,fog)=>{
    if(cache.has(key))return cache.get(key).promise;
    if(pending>=4)return Promise.reject(Object.assign(Error('busy'),{status:503}));
    const entry={bytes:0};
    pending++;
    entry.promise=queue.then(()=>maskedMapImage(image,fog)).finally(()=>{pending--;});
    queue=entry.promise.catch(()=>{});
    cache.set(key,entry);
    entry.promise.then(buffer=>{
      if(cache.get(key)!==entry)return;
      entry.bytes=buffer.length;bytes+=entry.bytes;
      while(cache.size>8||bytes>32*1024*1024){const oldest=cache.keys().next().value;bytes-=cache.get(oldest).bytes;cache.delete(oldest);}
    },()=>{if(cache.get(key)===entry)cache.delete(key);});
    return entry.promise;
  };
}
