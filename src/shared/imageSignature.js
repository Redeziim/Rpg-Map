export function imageSignatureMatches(type,bytes){
  const ascii=(offset,text)=>[...text].every((char,index)=>bytes[offset+index]===char.charCodeAt(0));
  if(type==='image/png'){
    if(bytes.length<24||![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)||!ascii(12,'IHDR'))return false;
    const width=(bytes[16]*2**24+bytes[17]*2**16+bytes[18]*256+bytes[19])>>>0;
    const height=(bytes[20]*2**24+bytes[21]*2**16+bytes[22]*256+bytes[23])>>>0;
    return width>0&&height>0;
  }
  if(type==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/webp')return bytes.length>=12&&ascii(0,'RIFF')&&ascii(8,'WEBP');
  return false;
}
