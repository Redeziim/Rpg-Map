import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=resolve('src');
function files(directory,extension){
  return readdirSync(directory).flatMap(name=>{
    const path=join(directory,name);
    return statSync(path).isDirectory()?files(path,extension):path.endsWith(extension)?[path]:[];
  });
}
const css=files(root,'.css').map(path=>({name:relative(root,path).replaceAll('\\','/'),text:readFileSync(path,'utf8')}));
// Declarations that really move something: a non-"none" animation or a transition with a duration.
const animates=text=>/@keyframes\s|animation\s*:\s*(?!none\b)[^;}]+/.test(text)||/(?<![\w-])transition\s*:\s*(?!none\b)[^;}]*\d(?:ms|s)\b/.test(text);

test('no stylesheet transitions every property',()=>{
  for(const {name,text} of css)assert.equal(/transition(?:-property)?\s*:\s*all\b/.test(text),false,`${name} usa transition: all; nomeie as propriedades.`);
});

test('every stylesheet that animates also answers prefers-reduced-motion',()=>{
  // theme.css carries the global rule for everything inside .mist-theme; other files must carry their own.
  const covered=new Set(css.filter(({text})=>text.includes('prefers-reduced-motion')).map(({name})=>name));
  const missing=css.filter(({name,text})=>animates(text)&&!covered.has(name)).map(({name})=>name);
  assert.deepEqual(missing,[],`Estes arquivos animam sem tratar prefers-reduced-motion: ${missing.join(', ')}`);
});

test('the global reduced-motion rule disables animation, transition and smooth scrolling',()=>{
  const theme=css.find(({name})=>name==='theme.css').text;
  const rule=theme.match(/@media\(prefers-reduced-motion:reduce\)\{[^}]*\{[^}]*\}\}/)?.[0]||'';
  for(const declaration of ['animation:none','transition:none','scroll-behavior:auto'])assert.ok(rule.includes(declaration),`theme.css não declara ${declaration} para movimento reduzido.`);
});

test('script-driven motion reads the preference before it moves anything',()=>{
  const scripts=files(root,'.jsx').concat(files(root,'.js')).map(path=>({name:relative(root,path).replaceAll('\\','/'),text:readFileSync(path,'utf8')}));
  const smooth=scripts.filter(({text})=>/behavior\s*:\s*['"]smooth['"]/.test(text)&&!text.includes('prefers-reduced-motion')).map(({name})=>name);
  assert.deepEqual(smooth,[],`Rolagem suave sem checar movimento reduzido em: ${smooth.join(', ')}`);
});
