import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHEET_FONTS,SHEET_FONT_IDS,loadSheetFont,sheetFontUrl} from '../src/shared/sheetFonts.js';

test('saved font ids stay valid and the default uses the theme font',()=>{
  assert.deepEqual(SHEET_FONT_IDS,['cinzel','medieval','uncial','fell','metamorphous','grenze']);
  assert.equal(SHEET_FONTS[0].family,'var(--font-display)');assert.equal(sheetFontUrl(SHEET_FONTS[0]),null);
});

test('every optional font names the same family it asks Google for (so the choice actually changes the text)',()=>{
  for(const font of SHEET_FONTS.slice(1)){
    const wanted=decodeURIComponent(font.google.split(':')[0].replaceAll('+',' ')),used=font.family.match(/^'([^']+)'/)?.[1];
    assert.equal(used,wanted,font.id);
    assert.match(sheetFontUrl(font),/^https:\/\/fonts\.googleapis\.com\/css2\?family=[^&\s]+&display=swap$/,font.id);
  }
});

test('loading a font adds one stylesheet, once, and the default adds none',()=>{
  const items=[],doc={head:{append:item=>items.push(item)},getElementById:id=>items.find(item=>item.id===id)||null,createElement:()=>({})};
  assert.equal(loadSheetFont('cinzel',doc),null);assert.equal(items.length,0);
  const first=loadSheetFont('fell',doc);assert.equal(first.rel,'stylesheet');assert.match(first.href,/IM\+Fell\+English/);
  assert.equal(loadSheetFont('fell',doc),first);assert.equal(items.length,1);
  loadSheetFont('grenze',doc);assert.equal(items.length,2);
  assert.equal(loadSheetFont('desconhecida',doc),null);assert.equal(loadSheetFont('fell',{}),null);
});

test('the sheet asks for its font when it changes, and the server accepts only the listed ids',()=>{
  const sheet=readFileSync(new URL('../src/components/CharacterSheet.jsx',import.meta.url),'utf8'),server=readFileSync(new URL('../server/app.js',import.meta.url),'utf8');
  assert.match(sheet,/loadSheetFont\(sheetFont\)/);
  assert.match(server,/SHEET_FONT_IDS\.includes\(patch\.sheetFont\)/);assert.equal(server.includes("'cinzel','medieval'"),false);
});
