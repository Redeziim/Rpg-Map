import {mapImageHeader,validMapDimensions,fitMapImage,MAP_IMAGE_BYTES,MAP_SOURCE_BYTES,MAP_SOURCE_PIXELS,MAP_SOURCE_SIDE} from '../shared/mapImages.js';

export async function readMapImageFile(file,signal){
  signal?.throwIfAborted();
  if(!file.size||file.size>MAP_SOURCE_BYTES)throw Error('Escolha uma imagem de até 20 MB. Reduza o arquivo antes de tentar novamente.');
  const header=mapImageHeader(new Uint8Array(await file.slice(0,1024*1024).arrayBuffer()));
  signal?.throwIfAborted();
  if(file.type&&file.type!==header.type)throw Error('O conteúdo não corresponde ao tipo do arquivo. Exporte a imagem novamente.');
  if(!validMapDimensions(header.width,header.height,{pixels:MAP_SOURCE_PIXELS,side:MAP_SOURCE_SIDE}))throw Error('A imagem excede 32 milhões de pixels ou 16.000 px por lado. Reduza a resolução antes de abrir.');
  return header;
}
export async function openMapBitmap(file,signal){
  signal?.throwIfAborted();
  if(typeof createImageBitmap==='function'){
    const bitmap=await createImageBitmap(file);
    if(signal?.aborted){bitmap.close();signal.throwIfAborted();}
    return bitmap;
  }
  const url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise((resolve,reject)=>{const abort=()=>{image.src='';reject(signal.reason);};signal?.addEventListener('abort',abort,{once:true});image.onload=()=>{signal?.removeEventListener('abort',abort);resolve();};image.onerror=()=>{signal?.removeEventListener('abort',abort);reject(Error('Não foi possível abrir a imagem. Exporte o arquivo novamente.'));};image.src=url;});
    signal?.throwIfAborted();
    return {width:image.naturalWidth,height:image.naturalHeight,image,close:()=>{image.src='';}};
  }finally{URL.revokeObjectURL(url);}
}
export async function prepareMapImage(file,side,signal){
  const header=await readMapImageFile(file,signal),bitmap=await openMapBitmap(file,signal),canvas=document.createElement('canvas');
  try{
    const source={width:bitmap.width,height:bitmap.height},dimensions=fitMapImage(source.width,source.height,side);canvas.width=dimensions.width;canvas.height=dimensions.height;
    const context=canvas.getContext('2d');if(!context)throw Error('O navegador não conseguiu preparar a imagem. Tente a opção Mais leve.');
    context.drawImage(bitmap.image||bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));signal?.throwIfAborted();
    if(!blob||blob.size>MAP_IMAGE_BYTES)throw Error('A versão preparada excede 5 MB. Escolha Mais leve ou reduza o arquivo.');
    return {blob,...dimensions,source,sourceType:header.type};
  }finally{bitmap.close();canvas.width=canvas.height=0;}
}
export function mapImageDataUrl(blob,signal){
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();const reader=new FileReader(),abort=()=>reader.abort(),cleanup=()=>signal?.removeEventListener('abort',abort);
    signal?.addEventListener('abort',abort,{once:true});reader.onload=()=>{cleanup();resolve(reader.result);};reader.onerror=()=>{cleanup();reject(Error('Não foi possível ler a imagem preparada. Tente novamente.'));};reader.onabort=()=>{cleanup();reject(signal?.reason||new DOMException('Cancelado','AbortError'));};reader.readAsDataURL(blob);
  });
}
