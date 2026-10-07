import {api} from '../../api.js';
import {MAP_ASSET_MEDIA,MAP_ASSET_MAX_HEADER,mapAssetHeader,mapAssetPrefix,mapAssetHeaderLength} from '../../shared/mapAssetTransfer.js';

const mimeByExtension={glb:'model/gltf-binary',gltf:'model/gltf+json',obj:'text/plain',mtl:'text/plain',fbx:'application/octet-stream',bin:'application/octet-stream',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
export function nativeMapAsset(files,main,kind){
  return {main,kind,files:files.map(file=>({name:file.webkitRelativePath||file.name,blob:file}))};
}
export function createMapAssetBlob(bundle){
  const header=mapAssetHeader({version:1,main:bundle.main,kind:bundle.kind,files:bundle.files.map(file=>({name:file.name,mime:file.blob.type||mimeByExtension[file.name.split('.').pop().toLowerCase()]||'application/octet-stream',size:file.blob.size})),...(bundle.placement!==undefined?{placement:bundle.placement}:{})});
  const encoded=new TextEncoder().encode(JSON.stringify(header));
  return new Blob([mapAssetPrefix(encoded.length),encoded,...bundle.files.map(file=>file.blob)],{type:MAP_ASSET_MEDIA});
}
export async function readMapAssetBlob(blob){
  // Older servers still answer with the original JSON representation.
  if(blob.type.startsWith('application/json'))return JSON.parse(await blob.text());
  const invalid=()=>{throw Error('Pacote 3D incompleto ou inválido.');};
  if(blob.size<8)invalid();
  const length=mapAssetHeaderLength(new Uint8Array(await blob.slice(0,8).arrayBuffer()));
  if(length>MAP_ASSET_MAX_HEADER||blob.size<8+length)invalid();
  const header=mapAssetHeader(JSON.parse(await blob.slice(8,8+length).text()));let offset=8+length;
  const files=header.files.map(file=>{const start=offset;offset+=file.size;if(offset>blob.size)invalid();return {name:file.name,blob:blob.slice(start,offset,file.mime)};});
  if(offset!==blob.size)invalid();return {main:header.main,kind:header.kind,files};
}
export async function fetchMapAsset(roomId,assetId,signal){
  const blob=await api(`/rooms/${roomId}/map-assets/${assetId}`,{signal,headers:{Accept:MAP_ASSET_MEDIA},responseType:'blob'});
  return readMapAssetBlob(blob);
}
