import sharp from 'sharp';
import {MAP_IMAGE_BYTES,MAP_IMAGE_PIXELS,MAP_IMAGE_TYPES,validMapDimensions,mapImageHeader} from '../src/shared/mapImages.js';

export function createMapImageValidator(){
  let queue=Promise.resolve(),pending=0;
  return image=>{
    if(image===null)return Promise.resolve(null);
    const reject=(status,message)=>Promise.reject(Object.assign(Error(message),{status}));
    if(typeof image!=='string'||image.length>Math.ceil(MAP_IMAGE_BYTES*4/3)+100)return reject(413,'A imagem preparada deve ter até 5 MB. Use a prévia para reduzir o arquivo.');
    const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if(!match||!MAP_IMAGE_TYPES.includes(match[1]))return reject(400,'Use imagem PNG, JPEG, WebP ou GIF válido.');
    const bytes=Buffer.from(match[2],'base64');
    if(bytes.length>MAP_IMAGE_BYTES)return reject(413,'A imagem preparada deve ter até 5 MB. Use a prévia para reduzir o arquivo.');
    if(!bytes.length||bytes.toString('base64')!==match[2])return reject(400,'Arquivo de imagem inválido. Exporte a imagem novamente.');
    let header;try{header=mapImageHeader(bytes);}catch{return reject(400,'Não foi possível abrir a imagem. Exporte o arquivo novamente.');}
    if(header.type!==match[1])return reject(400,'O conteúdo da imagem não corresponde ao formato informado.');
    if(!validMapDimensions(header.width,header.height))return reject(413,'A imagem preparada excede 4096 px por lado ou 8 milhões de pixels. Use a prévia para reduzir.');
    if(pending>=4)return reject(503,'Há imagens aguardando validação. Aguarde e tente novamente.');
    pending++;
    const result=queue.then(async()=>{
      try{
        const decoder=sharp(bytes,{limitInputPixels:MAP_IMAGE_PIXELS,failOn:'error'}),metadata=await decoder.metadata();
        if(!validMapDimensions(metadata.width,metadata.height))throw Error('dimensions');
        if((metadata.pages||1)>1)throw Error('animated');
        await decoder.resize({width:1,height:1,fit:'inside'}).png().toBuffer();
        return {width:header.width,height:header.height};
      }catch{throw Object.assign(Error('A imagem está incompleta ou animada. Use a prévia para preparar uma imagem fixa válida.'),{status:400});}
    }).finally(()=>pending--);
    queue=result.catch(()=>{});return result;
  };
}
