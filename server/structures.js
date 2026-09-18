export function validateStructure(data){
  const invalid=()=>{throw Object.assign(Error('Estrutura inválida. Use até 60 mil triângulos e 180 mil vértices.'),{status:400});};
  if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>120||!Array.isArray(data.vertices)||!data.vertices.length||data.vertices.length>180000||!Array.isArray(data.triangles)||!data.triangles.length||data.triangles.length>60000)invalid();
  if(data.vertices.some(v=>!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>30)))invalid();
  if(data.triangles.some(t=>!Array.isArray(t)||t.length!==3||new Set(t).size<3||t.some(i=>!Number.isInteger(i)||i<0||i>=data.vertices.length)))invalid();
  if(!Array.isArray(data.spawn)||data.spawn.length!==3||data.spawn.some(n=>!Number.isFinite(n)||Math.abs(n)>30))invalid();
  return {name:data.name.trim(),vertices:data.vertices,triangles:data.triangles,spawn:data.spawn};
}
