import test from 'node:test';
import assert from 'node:assert/strict';
import {activeInstruments,instrumentStatuses} from '../src/shared/mapInstruments.js';

test('a fresh map shows what is off or empty, and nothing is in use',()=>{
  const s=instrumentStatuses();
  assert.equal(s.imagem.status,'Sem imagem');assert.equal(s.pontos.status,'0');assert.equal(s.controles.status,'100%');
  assert.equal(s.medida.status,'Sem escala');assert.equal(s.nevoa.status,'Desligada');assert.equal(s.posicoes.status,'Desligadas');
  assert.equal(s.tracos.status,'Nenhum');
  assert.deepEqual(activeInstruments(s),[]);
});

test('statuses follow the map: image, counts, zoom, grid, fog, positions, strokes',()=>{
  const s=instrumentStatuses({mapImage:true,pointCount:12,scale:1.5,gridVisible:true,hasScale:true,fogEnabled:true,positionsEnabled:true,strokeCount:7});
  assert.deepEqual([s.imagem.status,s.pontos.status,s.controles.status,s.medida.status,s.nevoa.status,s.posicoes.status,s.tracos.status],['Publicada','12','150%','Grade visível','Ligada','Ligadas','7']);
  assert.equal(instrumentStatuses({hasScale:true}).medida.status,'Com escala');
});

test('the panel lists only the instruments that still exist (routes, legend and export were removed from the interface)',()=>{
  assert.deepEqual(Object.keys(instrumentStatuses()),['imagem','pontos','controles','medida','nevoa','posicoes','tracos']);
});

test('the chosen tool marks exactly its instrument as in use',()=>{
  const inUse=tool=>activeInstruments(instrumentStatuses({mapTool:tool}));
  assert.deepEqual(inUse('measure'),['Grade e régua']);assert.deepEqual(inUse('reveal'),['Névoa de guerra']);assert.deepEqual(inUse('cover'),['Névoa de guerra']);
  assert.deepEqual(inUse('position'),['Posições dos jogadores']);
  for(const tool of ['pan','draw','erase'])assert.deepEqual(inUse(tool),[]);
});
