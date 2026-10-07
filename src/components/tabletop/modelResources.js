// Resources may be shared by Object3D clones, materials or glTF texture copies.
const owners=new WeakMap(),references=new WeakMap(),disposed=new WeakSet();

function collect(root){
  const resources=new Set(),visited=new WeakSet();
  const image=value=>{if(Array.isArray(value))value.forEach(image);else if(value?.close)resources.add(value);};
  const texture=value=>{
    if(value?.isTexture){resources.add(value);image(value.image);return;}
    if(!value||typeof value!=='object'||visited.has(value))return;
    visited.add(value);if(Array.isArray(value))value.forEach(texture);else for(const child of Object.values(value))texture(child);
  };
  root.traverse(node=>{
    if(node.geometry)resources.add(node.geometry);
    for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){
      resources.add(material);
      for(const value of Object.values(material))if(value?.isTexture||Array.isArray(value))texture(value);
      if(material.uniforms)texture(material.uniforms);
    }
    // Skeleton owns its bone texture, which may be allocated by the renderer
    // after registration. Keep the whole skeleton until its last owner exits.
    if(node.skeleton)resources.add(node.skeleton);
    if(node.isInstancedMesh)resources.add(node);
  });
  return resources;
}
function release(resource){
  const count=references.get(resource)-1;
  if(count>0){references.set(resource,count);return;}
  references.delete(resource);
  if(resource.close)resource.close();else resource.dispose?.();
}
export function retainModel(root){
  if(disposed.has(root))throw Error('Um modelo descartado não pode ser reutilizado.');
  const next=collect(root),previous=owners.get(root)||new Set();
  for(const resource of next)if(!previous.has(resource))references.set(resource,(references.get(resource)||0)+1);
  for(const resource of previous)if(!next.has(resource))release(resource);
  owners.set(root,next);return root;
}
export function disposeModel(root){
  if(disposed.has(root))return;
  retainModel(root);disposed.add(root);
  const resources=owners.get(root);owners.delete(root);
  for(const resource of resources)release(resource);
}
