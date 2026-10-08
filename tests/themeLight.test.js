import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_THEME,STORAGE_KEY,THEMES,applyTheme,nextTheme,normalizeTheme,readTheme,saveTheme} from '../src/themePreference.js';

const theme=readFileSync('src/theme.css','utf8'),light=readFileSync('src/themeLight.css','utf8');
const colors=block=>Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map(m=>[m[1],m[2]]));
const dark=colors(theme.match(/:root\{[^}]*\}/)[0]);
const claro=colors(light.match(/:root\[data-theme="claro"\]\{[^}]*\}/)[0]);
const linear=value=>{const c=parseInt(value,16)/255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;};
const lum=hex=>.2126*linear(hex.slice(1,3))+.7152*linear(hex.slice(3,5))+.0722*linear(hex.slice(5,7));
const ratio=(a,b)=>{const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};

test('o tema claro redefine todos os tokens de cor do tema sombrio',()=>{
  const missing=Object.keys(dark).filter(name=>!(name in claro));
  assert.deepEqual(missing,[],'token de cor sem valor no tema claro');
});

// pares de texto e fundo usados de fato pelas telas; vale para os dois temas
const PAIRS=[
  ['--ink',['--surface-0','--surface-1','--surface-2','--paper-0','--paper-1','--paper-2']],
  ['--ink-strong',['--surface-0','--surface-1','--paper-0','--paper-1','--paper-2']],
  ['--ink-warm',['--surface-0','--surface-1','--paper-0','--paper-1','--paper-2']],
  ['--ink-soft',['--surface-0','--paper-0','--paper-1']],
  ['--muted',['--surface-0','--surface-1','--surface-2','--paper-0','--paper-1']],
  ['--gold-light',['--surface-0','--paper-0','--paper-1']],
  ['--gold-bright',['--surface-0','--paper-0','--paper-1']],
  ['--gold-deep',['--surface-0','--paper-0','--paper-1']],
  ['--gold',['--paper-0','--paper-1','--paper-2']],
  ['--on-red',['--red']], // texto sobre vinho (alternador ativo dos dados)
  ['--accent',['--surface-0','--paper-0','--paper-1']],
  ['--danger-ink',['--wine-deep','--paper-0']],
  ['--ok-ink',['--paper-0','--surface-0']],
  ['--surface-0',['--gold']] // texto do botão principal sobre o preenchimento dourado
];
for(const [name,palette] of [['sombrio',dark],['claro',claro]])test(`contraste AA no tema ${name}`,()=>{
  const failures=[];
  for(const [fg,backgrounds] of PAIRS)for(const bg of backgrounds){
    const value=ratio(palette[fg],palette[bg]);
    if(value<4.5)failures.push(`${fg} ${palette[fg]} sobre ${bg} ${palette[bg]}: ${value.toFixed(2)}`);
  }
  assert.deepEqual(failures,[]);
});

test('o tema claro não importa fontes nem usa cores fixas fora dos tokens',()=>{
  const body=light.replace(/:root\[data-theme="claro"\]\{[^}]*\}/,'').replace(/url\([^)]*\)/g,'');
  assert.equal((body.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length,0);
});

const memory=(initial={})=>{const data={...initial};return {getItem:key=>key in data?data[key]:null,setItem:(key,value)=>{data[key]=value;},data};};
const page=()=>{const meta={content:'#101010',setAttribute(name,value){this[name]=value;}};return {documentElement:{dataset:{}},querySelector:selector=>selector==='meta[name="theme-color"]'?meta:null,meta};};

test('a preferência lida de valor inválido, ausente ou armazenamento quebrado cai no sombrio',()=>{
  assert.equal(readTheme(memory()),DEFAULT_THEME);
  assert.equal(readTheme(memory({[STORAGE_KEY]:'roxo'})),DEFAULT_THEME);
  assert.equal(readTheme({getItem(){throw new Error('bloqueado');}}),DEFAULT_THEME);
  assert.equal(readTheme(null),DEFAULT_THEME);
  assert.equal(readTheme(memory({[STORAGE_KEY]:'claro'})),'claro');
});

test('salvar grava só nomes válidos e informa quando o navegador recusa',()=>{
  const storage=memory();
  assert.equal(saveTheme(storage,'claro'),true);
  assert.equal(storage.data[STORAGE_KEY],'claro');
  saveTheme(storage,'inexistente');
  assert.equal(storage.data[STORAGE_KEY],DEFAULT_THEME);
  assert.equal(saveTheme({setItem(){throw new Error('cheio');}},'claro'),false);
});

test('aplicar o tema escreve o atributo e a cor da barra do navegador; o padrão não deixa atributo',()=>{
  const doc=page();
  assert.equal(applyTheme(doc,'claro'),'claro');
  assert.equal(doc.documentElement.dataset.theme,'claro');
  assert.equal(doc.meta.content,THEMES.claro.color);
  assert.equal(applyTheme(doc,'sombrio'),'sombrio');
  assert.equal('theme' in doc.documentElement.dataset,false);
  assert.equal(doc.meta.content,THEMES.sombrio.color);
  assert.equal(nextTheme('sombrio'),'claro');
  assert.equal(nextTheme('claro'),'sombrio');
  assert.equal(normalizeTheme(undefined),DEFAULT_THEME);
});

test('o script de index.html e o módulo usam a mesma chave e a mesma cor',()=>{
  const html=readFileSync('index.html','utf8');
  assert.ok(html.includes(`'${STORAGE_KEY}'`));
  assert.ok(html.includes(THEMES.claro.color));
  assert.ok(html.indexOf(`'${STORAGE_KEY}'`)<html.indexOf('rel="stylesheet"'),'o tema deve ser aplicado antes de qualquer folha de estilo');
});
