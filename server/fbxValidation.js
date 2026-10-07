import {LoadingManager} from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {inflateSync} from 'node:zlib';
import {MODEL_LIMITS,modelError,checkGeometry} from './modelValidationContent.js';
const fail=(message,status)=>{throw modelError(message,status);};

function preflight(bytes){
  if(bytes.subarray(0,23).toString('binary')!=='Kaydara FBX Binary  \0\x1a\0'){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(!/FBXHeaderExtension\s*:/.test(text)||!/(?:^|\n)\s*FBXVersion:\s*7\d{3}/.test(text))fail('Cabeçalho FBX inválido.');
    let elements=0;for(const match of text.matchAll(/:\s*\*(\d+)\s*\{/g)){elements+=Number(match[1]);if(elements*8>MODEL_LIMITS.arrayBytes)fail('As matrizes descompactadas do FBX excedem 64 MiB.',413);}return;
  }
  if(bytes.length<27)fail('FBX incompleto.');
  const wide=bytes.readUInt32LE(23)>=7500,header=wide?25:13;let arrays=0,nodes=0;
  const integer=at=>{if(at+(wide?8:4)>bytes.length)fail('FBX incompleto.');const value=wide?Number(bytes.readBigUInt64LE(at)):bytes.readUInt32LE(at);if(!Number.isSafeInteger(value))fail('Offset FBX inválido.');return value;};
  function node(at,limit,depth){
    if(depth>128||++nodes>MODEL_LIMITS.nodes)fail('O FBX contém elementos demais ou hierarquia muito profunda.',413);
    if(at+header>limit)fail('FBX incompleto.');
    const end=integer(at),count=integer(at+(wide?8:4)),length=integer(at+(wide?16:8)),name=bytes[at+header-1];
    if(!end)return at+header;
    if(end>limit||end<at+header+name||count>1_000_000)fail('Estrutura FBX inválida.');
    let offset=at+header+name;const propertiesEnd=offset+length;if(propertiesEnd>end)fail('Propriedades FBX incompletas.');
    for(let i=0;i<count;i++){
      const type=String.fromCharCode(bytes[offset++]),sizes={Y:2,C:1,I:4,F:4,D:8,L:8};
      if(sizes[type]){
        if(offset+sizes[type]>propertiesEnd)fail('Valor FBX incompleto.');
        if((type==='F'&&!Number.isFinite(bytes.readFloatLE(offset)))||(type==='D'&&!Number.isFinite(bytes.readDoubleLE(offset))))fail('O FBX contém um valor numérico inválido.');offset+=sizes[type];
      }else if(type==='S'||type==='R'){
        if(offset+4>propertiesEnd)fail('Propriedade FBX incompleta.');const size=bytes.readUInt32LE(offset);offset+=4+size;
      }else if('fdlibc'.includes(type)){
        if(offset+12>propertiesEnd)fail('Matriz FBX incompleta.');const size=bytes.readUInt32LE(offset),encoding=bytes.readUInt32LE(offset+4),compressed=bytes.readUInt32LE(offset+8),unit={f:4,d:8,l:8,i:4,b:1,c:1}[type],decoded=size*unit;offset+=12;
        arrays+=decoded;if(arrays>MODEL_LIMITS.arrayBytes)fail('As matrizes descompactadas do FBX excedem 64 MiB.',413);
        if(![0,1].includes(encoding)||offset+compressed>propertiesEnd||!encoding&&compressed!==decoded)fail('Matriz FBX inválida.');
        const source=bytes.subarray(offset,offset+compressed),values=encoding?inflateSync(source,{maxOutputLength:Math.max(1,decoded)}):source;if(values.length!==decoded)fail('Matriz FBX incompleta.');
        if(type==='f'||type==='d')for(let n=0;n<values.length;n+=unit)if(!Number.isFinite(type==='f'?values.readFloatLE(n):values.readDoubleLE(n)))fail('A malha FBX contém um valor numérico inválido.');offset+=compressed;
      }else fail('Tipo de propriedade FBX inválido.');
      if(offset>propertiesEnd)fail('Propriedade FBX incompleta.');
    }
    if(offset!==propertiesEnd)fail('Tamanho de propriedades FBX inválido.');
    while(offset+header<=end){if(integer(offset)===0){offset+=header;break;}offset=node(offset,end,depth+1);}
    if(offset!==end)fail('Elemento FBX incompleto.');return end;
  }
  let offset=27;while(offset+header<=bytes.length&&integer(offset)!==0)offset=node(offset,bytes.length,0);
}

export async function validateFbx({name,bytes,resource,dataUri,image,warnings}){
  preflight(bytes);
  const tasks=[],blobs=new Map();let counter=0,embedded=0;
  // The parser needs image records, not a browser or renderer. Each record reads
  // only package bytes and is decoded by Sharp; no URL is fetched.
  globalThis.window={URL:{createObjectURL(blob){embedded+=blob.size;if(embedded>50*1024*1024)fail('As texturas incorporadas excedem 50 MiB.',413);const id=`blob:model-validation-${++counter}`;blobs.set(id,blob);return id;}}};
  globalThis.document={createElementNS(_namespace,tag){
    if(tag!=='img')fail('Recurso FBX não suportado.');
    return new class extends EventTarget{
      set src(url){tasks.push((async()=>{const source=blobs.has(url)?{bytes:Buffer.from(await blobs.get(url).arrayBuffer())}:url.startsWith('data:')?dataUri(url):resource(name,url);const meta=await image(source.bytes,source.mime?.startsWith('image/')?source.mime:undefined);this.width=meta.width;this.height=meta.height;this.dispatchEvent(new Event('load'));})());}
    }();
  }};
  const manager=new LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')&&!blobs.has(url))fail('Referência de textura inválida.');return url;});
  try{
    const root=new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    await Promise.all(tasks);const stats=checkGeometry(root);
    if(root.animations?.length)warnings.push('O modelo contém animações. Esta versão mostra apenas a pose inicial.');return stats;
  }finally{await Promise.allSettled(tasks);blobs.clear();delete globalThis.window;delete globalThis.document;}
}
