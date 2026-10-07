// Resolve only package entries. Never return a network or filesystem URL.
export function resolveMapResource(names,source,reference){
  const fail=message=>{throw Error(message);};
  if(typeof reference!=='string'||!reference.trim())fail('Referência de arquivo vazia.');
  let path;try{path=decodeURIComponent(reference.trim()).replaceAll('\\','/');}catch{fail('Referência de arquivo inválida.');}
  if(/^[a-z][a-z0-9+.-]*:/i.test(path)||path.startsWith('/')||/[?#\x00-\x1f]/.test(path))fail('Use arquivos de apoio dentro do pacote, sem endereços externos.');
  const parts=source.split('/').slice(0,-1);
  for(const part of path.split('/')){
    if(part===''||part==='.')continue;
    if(part==='..'){if(!parts.length)fail('A referência sai da pasta do pacote.');parts.pop();}
    else parts.push(part);
  }
  const target=parts.join('/').toLowerCase(),exact=names.find(name=>name.toLowerCase()===target);
  if(exact)return exact;
  const matches=names.filter(name=>name.split('/').pop().toLowerCase()===parts.at(-1)?.toLowerCase());
  if(matches.length===1)return matches[0];
  if(matches.length>1)fail(`Há mais de um arquivo chamado ${parts.at(-1)}. Use o caminho da pasta.`);
  fail(`Arquivo de apoio ausente: ${parts.at(-1)}. Selecione também esse arquivo.`);
}
