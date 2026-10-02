export const MAP_IMAGE_BYTES=5*1024*1024;
export const MAP_IMAGE_PIXELS=8_000_000;
export const MAP_IMAGE_SIDE=4096;
export const MAP_SOURCE_BYTES=20*1024*1024;
export const MAP_SOURCE_PIXELS=32_000_000;
export const MAP_SOURCE_SIDE=16000;
export const MAP_IMAGE_TYPES=['image/png','image/jpeg','image/webp','image/gif'];

// Read dimensions before asking the browser to allocate decoded image pixels.
export function mapImageHeader(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(at,text)=>[...text].every((char,i)=>bytes[at+i]===char.charCodeAt(0));
  let type,width,height;
  if(bytes.length>=24&&ascii(0,'\x89PNG\r\n\x1a\n')&&ascii(12,'IHDR')){type='image/png';width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes.length>=10&&(ascii(0,'GIF87a')||ascii(0,'GIF89a'))){type='image/gif';width=view.getUint16(6,true);height=view.getUint16(8,true);}
  else if(bytes.length>=25&&ascii(0,'RIFF')&&ascii(8,'WEBP')){
    type='image/webp';
    if(bytes.length>=30&&ascii(12,'VP8X')){width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;}
    else if(bytes.length>=30&&ascii(12,'VP8 ')&&ascii(23,'\x9d\x01\x2a')){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(ascii(12,'VP8L')&&bytes[20]===0x2f){const bits=view.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}
  }else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
    type='image/jpeg';let at=2;
    while(at+4<=bytes.length){
      if(bytes[at++]!==255)break;while(bytes[at]===255)at++;
      const marker=bytes[at++];if(marker===0xd9||marker===0xda)break;if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      if(at+2>bytes.length)break;const length=view.getUint16(at);if(length<2||at+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7){height=view.getUint16(at+3);width=view.getUint16(at+5);break;}at+=length;
    }
  }
  if(!width||!height)throw Error('Não foi possível ler a imagem. Use PNG, JPEG, WebP ou GIF válido; se necessário, exporte o arquivo novamente.');
  return {type,width,height};
}
export function validMapDimensions(width,height,{pixels=MAP_IMAGE_PIXELS,side=MAP_IMAGE_SIDE}={}){
  return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=side&&height<=side&&width*height<=pixels;
}
export function fitMapImage(width,height,side=MAP_IMAGE_SIDE){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Dimensões inválidas.');
  const factor=Math.min(1,side/width,side/height,Math.sqrt(MAP_IMAGE_PIXELS/(width*height)));
  return {width:Math.max(1,Math.floor(width*factor)),height:Math.max(1,Math.floor(height*factor))};
}
export function resizedMapPoints(points,from,to){
  if(!from.width||!from.height)throw Error('Aguarde o mapa atual terminar de abrir.');
  return points.map(point=>({...point,x:point.x*to.width/from.width,y:point.y*to.height/from.height}));
}
