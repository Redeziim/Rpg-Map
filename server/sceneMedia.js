import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {emptyScenePresentation} from '../src/shared/scenePresentation.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const MAX_FILE=50*1024*1024;
const types={'video/mp4':'mp4','video/webm':'webm','image/gif':'gif'};
export async function readSceneMedia(req,name){
  const mime=req.headers['content-type']?.split(';')[0];
  if(!types[mime])fail(415,'Use um vídeo MP4 ou WebM, ou uma animação GIF.');
  if(typeof name!=='string'||name.length>120||!name.trim()||/[\x00-\x1f/\\]/.test(name)||name.split('.').pop().toLowerCase()!==types[mime])fail(400,'Nome ou formato de arquivo inválido.');
  if(Number(req.headers['content-length'])>MAX_FILE)fail(413,'Use um arquivo de até 50 MB.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;req.diagnosticBytes=size;if(size>MAX_FILE)fail(413,'Use um arquivo de até 50 MB.');chunks.push(chunk);}
  const data=Buffer.concat(chunks);
  if(mime==='image/gif'){
    if(!['GIF87a','GIF89a'].includes(data.subarray(0,6).toString()))fail(400,'O conteúdo não é uma animação GIF válida.');
    let metadata;try{metadata=await sharp(data,{animated:true,limitInputPixels:64*1024*1024}).metadata();}catch{fail(400,'Não foi possível ler a animação GIF.');}
    if(!metadata.width||!metadata.height||metadata.width>4096||(metadata.pageHeight||metadata.height)>4096||(metadata.pages||1)>1000)fail(400,'Reduza a animação: até 4096 px por lado e 1000 quadros.');
  }else if(mime==='video/mp4'){
    let offset=0,ftyp=false,moov=false,mdat=false;
    while(offset<data.length){
      if(offset+8>data.length)fail(400,'Arquivo MP4 incompleto.');let length=data.readUInt32BE(offset),header=8;const type=data.toString('ascii',offset+4,offset+8);
      if(length===1){if(offset+16>data.length)fail(400,'Arquivo MP4 incompleto.');const extended=data.readBigUInt64BE(offset+8);if(extended>BigInt(MAX_FILE))fail(400,'Arquivo MP4 inválido.');length=Number(extended);header=16;}
      if(length===0)length=data.length-offset;if(length<header||offset+length>data.length)fail(400,'Arquivo MP4 incompleto.');
      if(type==='ftyp'&&length>=header+8)ftyp=true;if(type==='moov'&&length>header)moov=true;if(type==='mdat'&&length>header)mdat=true;offset+=length;
    }
    if(!ftyp||!moov||!mdat)fail(400,'O arquivo não contém um vídeo MP4 completo.');
  }else if(data.length<16||data.readUInt32BE(0)!==0x1a45dfa3||!data.subarray(0,4096).includes(Buffer.from('webm'))||!data.includes(Buffer.from([0x16,0x54,0xae,0x6b]))||!data.includes(Buffer.from([0x1f,0x43,0xb6,0x75])))fail(400,'O arquivo não contém um vídeo WebM completo.');
  return {name:name.trim(),mime,data,bytes:data.length,hash:createHash('sha256').update(data).digest('hex')};
}
export function mediaMetadata(row){return row?{id:row.id,name:row.name,mime:row.mime,bytes:row.bytes}:null;}
export function assertSavedSceneMedia(db){
  for(const row of db.prepare('SELECT id,name,mime,bytes,hash,data FROM scene_media').iterate()){
    if(!types[row.mime]||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||row.bytes<1||row.bytes>MAX_FILE||row.data?.byteLength!==row.bytes||createHash('sha256').update(row.data).digest('hex')!==row.hash)throw Error('Arquivo de cena persistido inválido ou checksum incompatível.');
  }
  const asset=db.prepare('SELECT 1 FROM scene_media WHERE room_id=? AND id=?');
  for(const row of db.prepare('SELECT id,state FROM rooms').iterate())for(const scene of JSON.parse(row.state).campaignScenes||[])if(scene.mediaId&&!asset.get(row.id,scene.mediaId))throw Error('Uma cena referencia um arquivo ausente nesta mesa.');
}
export function changeScenePresentation(state,data){
  const previous=state.scenePresentation;
  if(!data||Object.keys(data).some(key=>!['action','sceneId','sceneVersion','position','version'].includes(key)))fail(400,'Comando de exibição inválido.');
  if(data.version!==previous.version)fail(409,'A exibição mudou. Confira os controles e tente novamente.');
  if(!['play','pause','stop'].includes(data.action))fail(400,'Comando de exibição inválido.');
  if(data.action==='stop')return previous.status==='stopped'?previous:{...emptyScenePresentation(),changedAt:Date.now(),version:previous.version+1};
  const scene=state.campaignScenes.find(scene=>scene.id===data.sceneId&&!scene.archived&&scene.mediaId);
  if(!scene)fail(404,'Selecione uma cena com vídeo ou animação.');
  if(data.sceneVersion!==scene.version)fail(409,'A cena mudou. Confira o arquivo antes de exibir.');
  if(!Number.isFinite(data.position)||data.position<0||data.position>86400)fail(400,'Posição do vídeo inválida.');
  if(data.action==='pause'&&(previous.sceneId!==scene.id||previous.status!=='playing'))fail(409,'Esta cena não está em exibição.');
  return {sceneId:scene.id,sessionId:data.action==='pause'||previous.sceneId===scene.id&&previous.status==='paused'?previous.sessionId:randomUUID(),status:data.action==='play'?'playing':'paused',position:data.position,changedAt:Date.now(),version:previous.version+1};
}
export function sendSceneMedia(req,res,row,read){
  const etag=`"${row.hash}"`,headers={'Content-Type':row.mime,'Cache-Control':'private, no-store','Vary':'Cookie','Accept-Ranges':'bytes','ETag':etag};
  let start=0,end=row.bytes-1,status=200;
  const range=req.headers.range;
  if(range&&(!req.headers['if-range']||req.headers['if-range']===etag)){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||!match[1]&&!match[2]){res.writeHead(416,{...headers,'Content-Range':`bytes */${row.bytes}`});return res.end();}
    if(!match[1])start=Math.max(0,row.bytes-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=row.bytes){res.writeHead(416,{...headers,'Content-Range':`bytes */${row.bytes}`});return res.end();}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${row.bytes}`;
  }else if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
  res.writeHead(status,{...headers,'Content-Length':end-start+1});return res.end(req.method==='HEAD'?undefined:read(start,end-start+1));
}
