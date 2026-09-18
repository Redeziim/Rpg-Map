const formats=new Set(['glb','gltf','obj','fbx','png','jpg','jpeg','webp']);
const extensions=new Set([...formats,'mtl','bin']);
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function validateMapAsset(data){
  if(!data||!Array.isArray(data.files)||!data.files.length||data.files.length>100)fail('Selecione o modelo e até 100 arquivos de apoio.');
  const files=data.files.map(file=>{
    if(!file||typeof file.name!=='string'||file.name.length>240||file.name.includes('..')||/[\\?#\x00-\x1f]/.test(file.name)||file.name.startsWith('/'))fail('Nome de arquivo inválido.');
    const extension=file.name.split('.').pop().toLowerCase();
    if(!extensions.has(extension))fail('Formato não suportado. Use GLB, GLTF, OBJ, FBX, PNG, JPG ou WebP.');
    if(typeof file.data!=='string'||!/^data:[^;,]*;base64,[A-Za-z0-9+/=]+$/.test(file.data))fail('Arquivo inválido.');
    return {name:file.name,data:file.data};
  });
  if(new Set(files.map(f=>f.name.toLowerCase())).size!==files.length)fail('Há arquivos com nomes repetidos.');
  const main=files.find(f=>f.name===data.main);
  if(!main||!formats.has(main.name.split('.').pop().toLowerCase()))fail('Selecione o arquivo principal do modelo.');
  const size=files.reduce((n,f)=>n+Buffer.from(f.data.split(',')[1],'base64').length,0);
  if(size>50*1024*1024)throw Object.assign(new Error('Limite de 50 MB por importação.'),{status:413});
  return {main:main.name,files,kind:data.kind==='terrain'?'terrain':'structure',bytes:size};
}
export function validateMapTransform(data){
  if(!data||Object.keys(data).some(k=>!['name','position','rotation','scale'].includes(k)))fail('Alteração de objeto inválida.');
  const patch={};
  if('name'in data){if(typeof data.name!=='string'||!data.name.trim()||data.name.length>120)fail('Nome inválido.');patch.name=data.name.trim();}
  for(const key of ['position','rotation','scale'])if(key in data){
    const vector=data[key];
    if(!Array.isArray(vector)||vector.length!==3||vector.some(v=>!Number.isFinite(v)||Math.abs(v)>10000||(key==='scale'&&v<.001)))fail('Posição, rotação ou escala inválida.');
    patch[key]=vector;
  }
  return patch;
}
