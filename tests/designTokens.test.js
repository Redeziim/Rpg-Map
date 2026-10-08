import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=resolve('src');
const walk=(directory,extension)=>readdirSync(directory).flatMap(name=>{
  const path=join(directory,name);
  return statSync(path).isDirectory()?walk(path,extension):path.endsWith(extension)?[path]:[];
});
const read=path=>({name:relative(root,path).replaceAll('\\','/'),text:readFileSync(path,'utf8')});
const css=walk(root,'.css').map(read),scripts=[...walk(root,'.jsx'),...walk(root,'.js')].map(read);
const theme=css.find(({name})=>name==='theme.css').text;
const rootBlock=theme.match(/:root\{[^}]*\}/)?.[0]||'';
const declared=text=>new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(match=>match[1]));
const rootTokens=declared(rootBlock);

// The catalog in docs/DESIGN_TOKENS.md. New code uses these names instead of literals.
const CATALOG=['--ink','--ink-strong','--ink-warm','--ink-soft','--muted','--gold','--gold-light','--gold-bright','--gold-deep','--gold-shadow','--accent','--red','--danger-ink','--rule-soft','--rule','--rule-strong','--line','--line-strong','--surface-0','--surface-1','--surface-2','--paper-0','--paper-1','--paper-2','--black','--wine-deep','--wine-line','--fog','--fog-deep','--font-display','--font-brand','--font-body','--fs-label','--fs-small','--fs-body','--fs-lead','--fs-title','--fs-heading','--lh-body','--lh-tight','--space-1','--space-2','--space-3','--space-4','--space-5','--space-6','--radius-s','--radius-m','--target','--motion-fast','--motion-base','--ease-out','--focus-ring','--focus-offset'];

test('the token catalog is declared on :root',()=>{
  assert.deepEqual(CATALOG.filter(name=>!rootTokens.has(name)),[]);
});

test('every var(--name) without a fallback points to a declared property',()=>{
  const everywhere=new Set([...css.flatMap(({text})=>[...declared(text)]),...scripts.flatMap(({text})=>[...text.matchAll(/['"`](--[a-z0-9-]+)['"`]?\s*:/g)].map(match=>match[1]))]);
  const missing=[];
  for(const {name,text} of css)for(const match of text.matchAll(/var\((--[a-z0-9-]+)\s*\)/g))if(!everywhere.has(match[1]))missing.push(`${name}: ${match[1]}`);
  assert.deepEqual([...new Set(missing)],[],'var() sem declaração nem valor reserva');
});

test('literal colors only go down: use a token or add one to docs/DESIGN_TOKENS.md',()=>{
  // 2026-10-09: todas as telas migraram para tokens. Só a roda de cores do traço do mapa guarda hexadecimais, porque são as cores que a pessoa escolhe.
  const BASELINE=0,PALETTE='components/MapStrokeColor.css';
  let literals=0;
  for(const {name,text} of css){
    if(name===PALETTE||name==='themeLight.css')continue;
    // variáveis locais também contam (--note-gold: #hex); só o :root de theme.css e o tema claro declaram cores por valor
    const body=text.replace(/url\([^)]*\)/g,'').replace(name==='theme.css'?/:root\{[^}]*\}/:/^\b$/,'');
    literals+=(body.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length;
  }
  assert.ok(literals<=BASELINE,`${literals} cores literais; o limite é ${BASELINE}. Use var(--token).`);
});

test('font families come from the font tokens',()=>{
  const offenders=css.filter(({name,text})=>name!=='theme.css'&&/(?:'Cinzel'|"Cinzel"|Cinzel|'Cormorant Garamond'|'Grenze Gotisch')\s*,|(?:'Source Sans 3'|"Source Sans 3")\s*,/.test(text)).map(({name})=>name);
  assert.deepEqual(offenders,[],'use var(--font-display), var(--font-brand) ou var(--font-body)');
});
