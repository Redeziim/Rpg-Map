import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryWeight,paginate,viewStart,viewCount,pagesInView,clampStart,viewLabel} from '../src/shared/bookPages.js';

const field=type=>({type});
const many=(n,type='text')=>Array.from({length:n},()=>field(type));

test('os pesos batem com as alturas medidas na ficha real',()=>{
  assert.equal(categoryWeight(many(2,'number')),252,'Combate');
  assert.equal(categoryWeight(many(3,'number')),342,'Perícias');
  assert.equal(categoryWeight(many(3),{kind:'identity'}),252,'Identidade');
  assert.equal(categoryWeight(many(5,'number'),{kind:'attributes',cards:5}),320,'Atributos');
  assert.equal(categoryWeight([field('textarea')]),230,'Habilidades');
  assert.equal(categoryWeight(many(3,'status')),495,'Recursos');
});

test('o peso cresce com a quantidade e com a altura dos campos',()=>{
  assert.ok(categoryWeight(many(6))>categoryWeight(many(3)));
  assert.ok(categoryWeight([field('textarea')])>categoryWeight([field('text')]));
  assert.ok(categoryWeight(many(18,'number'),{kind:'compact'})<categoryWeight(many(18,'number')),'lista compacta usa menos altura');
  assert.ok(categoryWeight(many(6),{kind:'attributes',cards:6})>categoryWeight(many(3),{kind:'attributes',cards:3}));
});

test('categorias curtas dividem a página e as grandes ficam sozinhas, sempre na ordem do modelo',()=>{
  const pages=paginate([
    {category:'Identidade',weight:150},{category:'Combate',weight:150},{category:'Atributos',weight:360},
    {category:'Perícias',weight:700},{category:'Equipamento',weight:130}
  ],410);
  assert.deepEqual(pages.map(page=>page.categories),[['Identidade','Combate'],['Atributos'],['Perícias'],['Equipamento']]);
  assert.deepEqual(pages.map(page=>page.overflow),[false,false,true,false]);
});

test('sem categorias não há páginas e uma só categoria cabe numa página',()=>{
  assert.deepEqual(paginate([],410),[]);
  assert.deepEqual(paginate([{category:'Geral',weight:80}],410).map(page=>page.categories),[['Geral']]);
});

test('no livro aberto as vistas são pares de páginas e a última pode ficar com uma só',()=>{
  assert.equal(viewCount(5,2),3);
  assert.deepEqual(pagesInView(4,5,2),[4]);
  assert.deepEqual(pagesInView(0,5,2),[0,1]);
  assert.equal(viewStart(3,2),2);
  assert.equal(viewStart(3,1),3);
  assert.equal(clampStart(99,5,2),4);
  assert.equal(clampStart(-3,5,2),0);
  assert.equal(clampStart(0,0,2),0);
});

test('o rótulo diz quais páginas estão abertas',()=>{
  assert.equal(viewLabel(2,8,2),'Páginas 3 e 4 de 8');
  assert.equal(viewLabel(6,7,2),'Página 7 de 7');
  assert.equal(viewLabel(3,8,1),'Página 4 de 8');
});
