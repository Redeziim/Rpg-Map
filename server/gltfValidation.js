import validator from 'gltf-validator';
import {Matrix4,Quaternion,Vector3,Box3} from 'three';
import {MODEL_LIMITS,MODEL_GEOMETRY_LIMIT_MESSAGE,modelError} from './modelValidationContent.js';
const fail=(message,status)=>{throw modelError(message,status);};
const extensions=new Set(['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_dispersion','KHR_materials_sheen','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_emissive_strength','KHR_materials_specular','KHR_materials_iridescence','KHR_materials_anisotropy','EXT_materials_bump','KHR_lights_punctual','KHR_texture_transform','KHR_mesh_quantization','EXT_texture_webp','EXT_mesh_gpu_instancing']);

export async function validateGltf({name,bytes,resource,dataUri,image,warnings}){
  const binary=name.toLowerCase().endsWith('.glb');let document,bin;
  if(binary){
    if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)fail('Cabeçalho GLB inválido.');
    let at=12,json;
    while(at+8<=bytes.length){const length=bytes.readUInt32LE(at),type=bytes.readUInt32LE(at+4);if(length%4||at+8+length>bytes.length)fail('Bloco GLB incompleto.');const content=bytes.subarray(at+8,at+8+length);if(type===0x4e4f534a){if(json||at!==12)fail('Bloco JSON do GLB inválido.');json=content;}else if(type===0x004e4942){if(bin)fail('Bloco binário do GLB duplicado.');bin=content;}at+=8+length;}
    if(at!==bytes.length||!json)fail('GLB incompleto.');document=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(json));
  }else document=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!document||document.asset?.version!=='2.0')fail('Use um modelo glTF 2.0.');
  for(const extension of document.extensionsRequired||[])if(!extensions.has(extension))fail(`A extensão ${String(extension).slice(0,80)} não está habilitada. Exporte GLB sem essa compressão ou extensão.`);
  const buffers=(document.buffers||[]).map(buffer=>{
    const content=buffer.uri?(buffer.uri.startsWith('data:')?dataUri(buffer.uri):resource(name,buffer.uri)).bytes:bin;
    if(!content||!Number.isInteger(buffer.byteLength)||buffer.byteLength<1||buffer.byteLength>content.length)fail('Buffer ausente ou incompleto.');return content;
  });
  for(const texture of document.images||[]){
    let content,expected=texture.mimeType;
    if(texture.uri){const source=texture.uri.startsWith('data:')?dataUri(texture.uri):resource(name,texture.uri);content=source.bytes;if(source.mime.startsWith('image/'))expected=expected||source.mime;}
    else{
      const view=document.bufferViews?.[texture.bufferView],buffer=buffers[view?.buffer],start=view?.byteOffset||0,length=view?.byteLength;
      if(!buffer||!Number.isInteger(start)||start<0||!Number.isInteger(length)||length<1||start+length>buffer.length)fail('Textura incorporada incompleta.');content=buffer.subarray(start,start+length);
    }
    await image(content,expected);
  }
  // Dart's typed-byte bridge expects a standalone Uint8Array, not a pooled Buffer.
  const report=await validator.validateBytes(Uint8Array.from(bytes),{uri:name,format:binary?'glb':'gltf',maxIssues:64,writeTimestamp:false,externalResourceFunction:uri=>Promise.resolve(Uint8Array.from(resource(name,uri).bytes))});
  if(report.issues.numErrors){const first=report.issues.messages.find(issue=>issue.severity===0);fail(`GLTF/GLB inválido (${first?.code||'estrutura'})${first?.pointer?' em '+first.pointer.slice(0,160):''}. Exporte o modelo novamente.`);}
  if(report.issues.numWarnings)warnings.push('O modelo abriu com avisos de compatibilidade; confira a aparência na mesa.');
  if(document.animations?.length)warnings.push('O modelo contém animações. Esta versão mostra apenas a pose inicial.');
  const nodes=document.nodes||[];if(nodes.length>MODEL_LIMITS.nodes)fail('O modelo excede 20.000 elementos.',413);
  let vertices=0,triangles=0;const bounds=new Box3();
  function visit(index,parent,depth){
    if(depth>128)fail('A hierarquia do modelo excede 128 níveis.',413);
    const node=nodes[index],local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation||[0,0,0]),new Quaternion().fromArray(node.rotation||[0,0,0,1]),new Vector3().fromArray(node.scale||[1,1,1])),world=parent.clone().multiply(local);
    if(world.elements.some(value=>!Number.isFinite(value)))fail('A transformação do modelo contém um valor inválido.');
    if(node.mesh!==undefined){
    const instances=node.extensions?.EXT_mesh_gpu_instancing?.attributes;
    const copies=instances?document.accessors[Object.values(instances)[0]].count:1;
    for(const primitive of document.meshes[node.mesh].primitives){
      const position=document.accessors[primitive.attributes.POSITION],indices=primitive.indices===undefined?position:document.accessors[primitive.indices],mode=primitive.mode??4;
      vertices+=position.count*copies;triangles+=(mode===4?indices.count/3:mode===5||mode===6?Math.max(0,indices.count-2):0)*copies;
      if(vertices>MODEL_LIMITS.vertices||triangles>MODEL_LIMITS.triangles)fail(MODEL_GEOMETRY_LIMIT_MESSAGE,413);
      bounds.union(new Box3(new Vector3().fromArray(position.min),new Vector3().fromArray(position.max)).applyMatrix4(world));
    }
    }
    for(const child of node.children||[])visit(child,world,depth+1);
  }
  for(const index of document.scenes?.[document.scene??0]?.nodes||[])visit(index,new Matrix4(),0);
  if(!vertices)fail('O modelo não contém uma malha visível.');
  const size=bounds.getSize(new Vector3());if(![...size].every(Number.isFinite)||Math.max(size.x,size.y,size.z)<1e-9)fail('A cena principal não tem uma malha com tamanho visível.');
  return {vertices,triangles,nodes:nodes.length};
}
