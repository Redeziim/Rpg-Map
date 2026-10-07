export const MAP_ASSET_MEDIA='application/vnd.grimorio.map-asset';
export const MAP_ASSET_MAX_BYTES=50*1024*1024;
export const MAP_ASSET_MAX_HEADER=64*1024;
const supported=new Set(['glb','gltf','obj','fbx','png','jpg','jpeg','webp']);
const extensions=new Set([...supported,'mtl','bin']);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};

export function mapAssetPlacement(value){
  if(value===undefined)return {position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['position','rotation','scale'].includes(key)))fail('Posição, rotação ou escala da prévia inválida.');
  const placement={};
  for(const key of ['position','rotation','scale']){
    const vector=value[key];
    if(!Array.isArray(vector)||vector.length!==3||vector.some(component=>!Number.isFinite(component)||Math.abs(component)>10000||key==='scale'&&component<.001))fail('Posição, rotação ou escala da prévia inválida.');
    placement[key]=[...vector];
  }
  return placement;
}

export function validMapFileName(name){
  return typeof name==='string'&&name.length>0&&name.length<=240&&!name.includes('..')&&!/[\\?#\x00-\x1f]/.test(name)&&!name.startsWith('/')&&extensions.has(name.split('.').pop().toLowerCase());
}
export function mapAssetHeader(value){
  if(!value||value.version!==1||!['terrain','structure'].includes(value.kind)||!Array.isArray(value.files)||!value.files.length||value.files.length>100||Object.keys(value).some(key=>!['version','main','kind','files','placement'].includes(key)))fail('Pacote 3D inválido.');
  let bytes=0;const names=new Set();
  const files=value.files.map(file=>{
    if(!file||!validMapFileName(file.name)||names.has(file.name.toLowerCase())||typeof file.mime!=='string'||file.mime.length>100||!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(file.mime)||!Number.isSafeInteger(file.size)||file.size<1||Object.keys(file).some(key=>!['name','mime','size'].includes(key)))fail('Arquivo do pacote 3D inválido.');
    names.add(file.name.toLowerCase());bytes+=file.size;
    if(bytes>MAP_ASSET_MAX_BYTES)fail('Limite de 50 MB por importação.',413);
    return {name:file.name,mime:file.mime,size:file.size};
  });
  if(!files.some(file=>file.name===value.main&&supported.has(file.name.split('.').pop().toLowerCase())))fail('Selecione o arquivo principal do modelo.');
  return {version:1,main:value.main,kind:value.kind,files,...(value.placement!==undefined?{placement:mapAssetPlacement(value.placement)}:{})};
}
export function mapAssetPrefix(length){
  if(!Number.isInteger(length)||length<1||length>MAP_ASSET_MAX_HEADER)fail('Cabeçalho do pacote muito grande.',413);
  const prefix=new Uint8Array([71,82,77,49,0,0,0,0]);new DataView(prefix.buffer).setUint32(4,length);return prefix;
}
export function mapAssetHeaderLength(prefix){
  if(prefix.length!==8||prefix[0]!==71||prefix[1]!==82||prefix[2]!==77||prefix[3]!==49)fail('Formato do pacote 3D inválido.');
  const length=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength).getUint32(4);
  if(length<1||length>MAP_ASSET_MAX_HEADER)fail('Cabeçalho do pacote muito grande.',413);return length;
}
export function mapAssetDataInfo(data){
  if(typeof data!=='string')fail('Arquivo inválido.');
  const comma=data.indexOf(','),header=data.slice(0,comma),encoded=data.slice(comma+1);
  if(!/^data:[^;,]*;base64$/.test(header)||!encoded.length||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))fail('Arquivo inválido.');
  const size=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
  return {mime:header.slice(5,-7)||'application/octet-stream',encoded,size};
}
