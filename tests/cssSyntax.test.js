import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=resolve('src');
const walk=directory=>readdirSync(directory).flatMap(name=>{
  const path=join(directory,name);
  return statSync(path).isDirectory()?walk(path):path.endsWith('.css')?[path]:[];
});

// Devolve os trechos de nível mais alto que não são regra nem instrução @: declarações soltas, sem seletor.
// Uma declaração sem seletor faz o navegador juntá-la ao seletor da regra seguinte e descartar as duas.
export function strayTopLevel(css){
  // primeiro os textos entre aspas (uma URL de dados pode ter "url(...)" e apóstrofos dentro), depois as url() sem aspas
  const text=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,'""').replace(/url\([^)]*\)/g,'url()');
  const stray=[];let depth=0,start=0;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='{'){
      if(depth===0){
        // instruções @import, @charset e @namespace terminam em ";" no nível mais alto e são válidas
        const prelude=text.slice(start,i).replace(/@(?:import|charset|namespace)[^;]*;/g,'').trim();
        if(prelude.includes(';'))stray.push(prelude.slice(0,80).replace(/\s+/g,' '));
      }
      depth++;
    }else if(char==='}'){depth--;if(depth===0)start=i+1;if(depth<0)return [...stray,'chave } sobrando'];}
  }
  return depth===0?stray:[...stray,'chave { sem fechar'];
}

test('the detector finds a declaration block that lost its selector',()=>{
  assert.equal(strayTopLevel('.a{x:1}\n\n  padding: 2rem;\n  margin: 0;\n}\n.b{y:2}').length>0,true);
  assert.deepEqual(strayTopLevel('@import url("a.css");\n.a{x:1}\n@media(min-width:1px){.b{y:2}}'),[]);
  assert.deepEqual(strayTopLevel('.a{background:url(data:image/svg+xml;utf8,<svg/>)}'),[]);
});

test('no stylesheet has declarations outside a rule or unbalanced braces',()=>{
  const problems=walk(root).flatMap(path=>strayTopLevel(readFileSync(path,'utf8')).map(found=>`${relative(root,path).replaceAll('\\','/')}: ${found}`));
  assert.deepEqual(problems,[]);
});
