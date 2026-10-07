import {once} from 'node:events';
import {MAP_ASSET_MEDIA,MAP_ASSET_MAX_BYTES,MAP_ASSET_MAX_HEADER,mapAssetHeader,mapAssetPrefix,mapAssetHeaderLength,mapAssetDataInfo} from '../src/shared/mapAssetTransfer.js';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};

export async function readMapAssetRequest(req){
  if(Number(req.headers['content-length'])>MAP_ASSET_MAX_BYTES+MAP_ASSET_MAX_HEADER+8)fail(413,'Limite de 50 MB por importação.');
  const iterator=req[Symbol.asyncIterator]();let pending=Buffer.alloc(0),received=0;
  async function read(size){
    const bytes=Buffer.allocUnsafe(size);let offset=0;
    while(offset<size){
      if(!pending.length){
        const chunk=await iterator.next();if(chunk.done)fail(400,'Pacote 3D incompleto.');
        pending=chunk.value;received+=pending.length;req.diagnosticBytes=received;
        if(received>MAP_ASSET_MAX_BYTES+MAP_ASSET_MAX_HEADER+8)fail(413,'Limite de 50 MB por importação.');
      }
      const length=Math.min(size-offset,pending.length);pending.copy(bytes,offset,0,length);offset+=length;pending=pending.subarray(length);
    }
    return bytes;
  }
  const length=mapAssetHeaderLength(await read(8));let raw;
  try{raw=JSON.parse((await read(length)).toString('utf8'));}catch(error){if(error.status)throw error;fail(400,'Cabeçalho do pacote inválido.');}
  const header=mapAssetHeader(raw),files=[];
  for(const file of header.files){const bytes=await read(file.size);files.push({name:file.name,data:`data:${file.mime};base64,${bytes.toString('base64')}`});}
  if(pending.length||!(await iterator.next()).done)fail(400,'O pacote contém bytes extras.');
  return {main:header.main,kind:header.kind,files,...(header.placement!==undefined?{placement:header.placement}:{})};
}

export async function sendMapAsset(req,res,bundle,hash,checkAccess){
  const etag=`"${hash}.binary-v1"`,headers={'Content-Type':MAP_ASSET_MEDIA,'Cache-Control':'private, no-cache, must-revalidate','Vary':'Cookie, Accept','ETag':etag};
  checkAccess();
  if((req.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag)){res.writeHead(304,headers);res.end();return;}
  const source=JSON.parse(bundle),infos=source.files.map(file=>({name:file.name,...mapAssetDataInfo(file.data)}));
  const metadata=mapAssetHeader({version:1,main:source.main,kind:source.kind,files:infos.map(({name,mime,size})=>({name,mime,size}))});
  const header=Buffer.from(JSON.stringify(metadata)),prefix=mapAssetPrefix(header.length);
  const bytes=infos.reduce((total,file)=>total+file.size,header.length+8);
  const controller=new AbortController(),abort=()=>controller.abort();res.on('close',abort);
  async function write(buffer){
    for(let offset=0;offset<buffer.length;offset+=65536){
      controller.signal.throwIfAborted();checkAccess();
      if(!res.write(buffer.subarray(offset,offset+65536)))await once(res,'drain',{signal:controller.signal});
    }
  }
  try{
    res.writeHead(200,{...headers,'Content-Length':bytes});await write(prefix);await write(header);
    // Only one decoded file is held while it is sent; the persisted bundle stays unchanged.
    for(const file of infos)await write(Buffer.from(file.encoded,'base64'));
    res.end();
  }catch(error){if(res.headersSent)res.destroy();throw error;}
  finally{res.off('close',abort);}
}
