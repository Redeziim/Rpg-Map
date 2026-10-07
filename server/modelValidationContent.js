import sharp from 'sharp';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {Box3,Vector3} from 'three';
import {mapAssetDataInfo} from '../src/shared/mapAssetTransfer.js';
import {mapImageHeader,MAP_SOURCE_PIXELS,MAP_SOURCE_SIDE} from '../src/shared/mapImages.js';
import {resolveMapResource} from '../src/shared/mapAssetResources.js';
import {validateGltf} from './gltfValidation.js';
import {validateFbx} from './fbxValidation.js';

// OBJ expands each triangle into three vertices, including triangulated quads.
export const MODEL_LIMITS={vertices:6_000_000,triangles:2_000_000,nodes:20000,arrayBytes:64*1024*1024};
export const MODEL_GEOMETRY_LIMIT_MESSAGE='O modelo excede 6 milhões de vértices ou 2 milhões de triângulos. Reduza a malha.';
export const modelError=(message,status=400)=>Object.assign(Error(message),{status,modelValidation:true});
const fail=(message,status)=>{throw modelError(message,status);};
export function checkGeometry(root){
  let vertices=0,triangles=0,nodes=0;
  root.updateMatrixWorld(true);
  root.traverse(object=>{
    if(++nodes>MODEL_LIMITS.nodes)fail('O modelo excede 20.000 elementos.',413);
    if([...object.matrixWorld.elements,...object.position,...object.scale,...object.quaternion].some(value=>!Number.isFinite(value)))fail('O modelo contém posição ou escala inválida.');
    const geometry=object.geometry;if(!geometry)return;
    const position=geometry.attributes.position;
    if(!position||!position.count)fail('A malha não tem vértices válidos.');
    vertices+=position.count;if(object.isMesh)triangles+=(geometry.index?.count||position.count)/3;
    if(vertices>MODEL_LIMITS.vertices||triangles>MODEL_LIMITS.triangles)fail(MODEL_GEOMETRY_LIMIT_MESSAGE,413);
    for(const attribute of [...Object.values(geometry.attributes),...Object.values(geometry.morphAttributes).flat()])for(const value of attribute.array)if(!Number.isFinite(value))fail('A malha contém um valor numérico inválido.');
    if(geometry.index)for(const value of geometry.index.array)if(!Number.isInteger(value)||value<0||value>=position.count)fail('A malha aponta para um vértice que não existe.');
    for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)for(const value of Object.values(material)){
      if(typeof value==='number'&&!Number.isFinite(value)||value?.isColor&&value.toArray().some(n=>!Number.isFinite(n)))fail('O material contém um valor numérico inválido.');
      if(value?.isTexture&&[...value.offset,...value.repeat,...value.center].some(n=>!Number.isFinite(n)))fail('A textura contém uma transformação inválida.');
    }
  });
  if(!vertices)fail('O arquivo não contém uma malha visível.');
  const size=new Box3().setFromObject(root).getSize(new Vector3());
  if(![...size].every(Number.isFinite)||Math.max(size.x,size.y,size.z)<1e-9)fail('A malha não tem tamanho visível. Exporte a escala e os vértices novamente.');
  for(const animation of root.animations||[])for(const track of animation.tracks)for(const value of [...track.times,...track.values])if(!Number.isFinite(value))fail('A animação contém um valor numérico inválido.');
  return {vertices,triangles,nodes};
}

export async function validateModelContent(bundle){
  const files=new Map(),warnings=[];let embeddedBytes=0,current=bundle.main;
  try{
    for(const file of bundle.files){
      current=file.name;const info=mapAssetDataInfo(file.data),bytes=Buffer.from(info.encoded,'base64');
      if(bytes.toString('base64')!==info.encoded)fail('Codificação do arquivo inválida.');
      files.set(file.name,{bytes,mime:info.mime});
    }
    const resolveResource=(source,reference)=>{try{return resolveMapResource([...files.keys()],source,reference);}catch(error){fail(error.message);}};
    const resource=(source,reference)=>files.get(resolveResource(source,reference));
    const dataUri=uri=>{
      let info;try{info=mapAssetDataInfo(uri);}catch{fail('Recurso incorporado inválido.');}
      embeddedBytes+=info.size;if(embeddedBytes>50*1024*1024)fail('Os recursos incorporados excedem 50 MiB.',413);
      const bytes=Buffer.from(info.encoded,'base64');if(bytes.toString('base64')!==info.encoded)fail('Recurso incorporado inválido.');return {bytes,mime:info.mime};
    };
    const checkedImages=new Map();
    async function image(bytes,expected){
      let header;try{header=mapImageHeader(bytes);}catch{fail('A textura não é uma imagem PNG, JPEG ou WebP válida.');}
      if(!['image/png','image/jpeg','image/webp'].includes(header.type)||expected&&header.type!==expected)fail('O conteúdo da textura não corresponde ao formato informado.');
      if(header.width>MAP_SOURCE_SIDE||header.height>MAP_SOURCE_SIDE||header.width*header.height>MAP_SOURCE_PIXELS)fail('A textura excede 16.000 px por lado ou 32 milhões de pixels. Reduza a imagem.',413);
      if(checkedImages.has(bytes))return checkedImages.get(bytes);
      try{
        const decoder=sharp(bytes,{limitInputPixels:MAP_SOURCE_PIXELS,failOn:'error'}),meta=await decoder.metadata();
        if(meta.width!==header.width||meta.height!==header.height||(meta.pages||1)>1)fail('Use uma textura fixa, completa e sem animação.');
        await decoder.resize({width:1,height:1,fit:'inside'}).png().toBuffer();
        checkedImages.set(bytes,meta);return meta;
      }catch(error){if(error.modelValidation)throw error;fail('A textura está incompleta ou não pôde ser decodificada.');}
    }
    const text=file=>new TextDecoder('utf-8',{fatal:true}).decode(files.get(file).bytes);
    const materials=new Map();
    for(const name of files.keys()){
      current=name;
      const extension=name.split('.').pop().toLowerCase();
      if(['png','jpg','jpeg','webp'].includes(extension)){
        const expected=extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg';
        if(files.get(name).mime.startsWith('image/')&&files.get(name).mime!==expected)fail('O formato declarado da textura está incorreto.');
        await image(files.get(name).bytes,expected);
      }
      if(extension==='mtl'){
        const names=new Set();
        for(const raw of text(name).split(/\r?\n/)){
          const line=raw.trim();if(!line||line.startsWith('#'))continue;
          const at=line.search(/\s/),key=line.slice(0,at<0?line.length:at).toLowerCase(),value=line.slice(at+1).trim();
          if(key==='newmtl'){if(!value)fail('Material sem nome.');names.add(value);}
          if(['ka','kd','ks','ke','tf','ns','ni','d','tr','illum'].includes(key)&&value.split(/\s+/).some(v=>!Number.isFinite(Number(v))))fail('O material contém um valor numérico inválido.');
          if(key.startsWith('map_')||['bump','norm','disp','decal','refl'].includes(key)){
            const parts=value.split(/\s+/);
            for(const [option,length]of [['-bm',1],['-s',3],['-o',3]]){
              const index=parts.indexOf(option);if(index<0)continue;
              const numbers=parts.slice(index+1,index+length+1);if(numbers.length!==length||numbers.some(v=>!Number.isFinite(Number(v))))fail('Opção de textura inválida.');parts.splice(index,length+1);
            }
            const uri=parts.join(' ');if(uri.startsWith('data:'))await image(dataUri(uri).bytes);else await image(resource(name,uri).bytes);
          }
        }
        materials.set(name,names);
      }
    }
    current=bundle.main;const extension=current.split('.').pop().toLowerCase(),main=files.get(current).bytes;
    let stats;
    if(extension==='obj'){
      const source=text(current).replace(/\\\r?\n/g,''),counts={v:0,vt:0,vn:0},used=new Set(),available=new Set();let rendered=0;
      for(const raw of source.split(/\r?\n/)){
        const line=raw.trim();if(!line||line.startsWith('#'))continue;
        const [key,...values]=line.split(/\s+/);
        if(['v','vt','vn'].includes(key)){
          const minimum=key==='vt'?2:3;if(values.length<minimum||values.some(v=>!Number.isFinite(Number(v))))fail('A malha contém um vértice ou uma normal inválida.');
          if(++counts[key]>MODEL_LIMITS.vertices)fail(MODEL_GEOMETRY_LIMIT_MESSAGE,413);
        }else if(['f','l','p'].includes(key)){
          if(values.length<(key==='f'?3:key==='l'?2:1))fail('A malha contém uma face ou linha incompleta.');
          rendered+=key==='f'?(values.length-2)*3:values.length;if(rendered>MODEL_LIMITS.vertices)fail(MODEL_GEOMETRY_LIMIT_MESSAGE,413);
          for(const vertex of values){const indices=vertex.split('/');if(indices.length>3)fail('Índice de vértice inválido.');for(let i=0;i<indices.length;i++)if(indices[i]||i===0){const n=Number(indices[i]),count=counts[['v','vt','vn'][i]];if(!Number.isInteger(n)||!n||n>count||n< -count)fail('A malha aponta para um vértice que não existe.');}}
        }else if(key==='mtllib'){
          const name=resolveResource(current,values.join(' '));if(!materials.has(name))fail('A biblioteca de materiais não é um arquivo MTL.');for(const value of materials.get(name))available.add(value);
        }else if(key==='usemtl')used.add(values.join(' '));
        else if(!['o','g','s'].includes(key))fail('O OBJ contém um comando não suportado. Exporte como malha ou GLB.');
      }
      if(!rendered)fail('O arquivo não contém faces ou linhas visíveis.');
      if(available.size)for(const name of used)if(!available.has(name))fail(`Material ausente: ${name.slice(0,120)}.`);
      const root=new OBJLoader().parse(source);stats=checkGeometry(root);
    }else if(['gltf','glb'].includes(extension))stats=await validateGltf({name:current,bytes:main,resource,dataUri,image,warnings});
    else if(extension==='fbx')stats=await validateFbx({name:current,bytes:main,resource,dataUri,image,warnings});
    else{await image(main);stats={vertices:4,triangles:2,nodes:1};}
    return {...stats,warnings:warnings.slice(0,8)};
  }catch(error){
    if(error.modelValidation)throw modelError(`${current}: ${error.message}`,error.status);
    throw modelError(`${current}: o arquivo está incompleto, corrompido ou não é compatível. Exporte novamente.`);
  }
}
