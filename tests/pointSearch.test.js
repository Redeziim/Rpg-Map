import test from 'node:test';
import assert from 'node:assert/strict';
import {POINT_TYPE_ALL,centerOnPoint,countByType,filterPoints} from '../src/shared/pointSearch.js';

const typeLabels={cidade:'Cidade',taverna:'Taverna',dungeon:'Dungeon',floresta:'Floresta',evento:'Evento'};
const points=[
  {id:'p3',name:'Porto velho',type:'taverna',description:'Taverna de marinheiros',x:100,y:100},
  {id:'p1',name:'Porto de Valdrin',type:'cidade',description:'Capital da costa',x:400,y:200},
  {id:'p2',name:'Cripta sob a Taverna',type:'dungeon',description:'Entrada pela adega',x:420,y:210},
  {id:'p4',name:'Floresta de Álamo',type:'floresta',description:'',x:50,y:500},
  {id:'p5',name:'Ponte 10',type:'evento',description:'Emboscada ao anoitecer',x:700,y:300},
  {id:'p6',name:'Ponte 2',type:'evento',x:710,y:310},
];
const names=list=>list.map(point=>point.name);

test('with nothing typed, every point comes back ordered by name, numbers by value',()=>{
  assert.deepEqual(names(filterPoints(points,{typeLabels})),['Cripta sob a Taverna','Floresta de Álamo','Ponte 2','Ponte 10','Porto de Valdrin','Porto velho']);
  assert.deepEqual(filterPoints([],{typeLabels}),[]);
});

test('search ignores accents and case, and looks in name, description and type',()=>{
  assert.deepEqual(names(filterPoints(points,{query:'PORTO',typeLabels})),['Porto de Valdrin','Porto velho']);
  assert.deepEqual(names(filterPoints(points,{query:'alamo',typeLabels})),['Floresta de Álamo']);
  assert.deepEqual(names(filterPoints(points,{query:'emboscada',typeLabels})),['Ponte 10']);
  assert.deepEqual(names(filterPoints(points,{query:'dungeon',typeLabels})),['Cripta sob a Taverna']);
  assert.deepEqual(names(filterPoints(points,{query:'  capital   costa ',typeLabels})),['Porto de Valdrin']);
});

test('every word typed must match, so extra words narrow the result',()=>{
  assert.deepEqual(names(filterPoints(points,{query:'taverna porto',typeLabels})),['Porto velho']);
  assert.deepEqual(filterPoints(points,{query:'taverna zzz',typeLabels}),[]);
});

test('the type filter combines with the search and never widens it',()=>{
  assert.deepEqual(names(filterPoints(points,{type:'evento',typeLabels})),['Ponte 2','Ponte 10']);
  assert.deepEqual(names(filterPoints(points,{type:'taverna',query:'cripta',typeLabels})),[]);
  assert.deepEqual(names(filterPoints(points,{type:'taverna',query:'taverna',typeLabels})),['Porto velho']);
  assert.deepEqual(filterPoints(points,{type:POINT_TYPE_ALL,query:'',typeLabels}).length,6);
});

test('chip counts follow the text search but not the chosen type',()=>{
  assert.deepEqual(countByType(points,{typeLabels}),{all:6,taverna:1,cidade:1,dungeon:1,floresta:1,evento:2});
  assert.deepEqual(countByType(points,{query:'taverna',typeLabels}),{all:2,taverna:1,dungeon:1});
  assert.deepEqual(countByType([],{typeLabels}),{all:0});
});

test('the filter only narrows the list it receives, so a hidden point can never appear',()=>{
  const revealed=points.filter(point=>point.id!=='p2');
  assert.ok(!names(filterPoints(revealed,{query:'cripta',typeLabels})).length);
  assert.equal(filterPoints(revealed,{typeLabels}).length,5);
  const input=[...points];filterPoints(input,{query:'porto',typeLabels});assert.deepEqual(input,points);
});

test('centering moves the map by the point distance from the canvas center, scaled',()=>{
  const view={width:1000,height:600,fit:0.8,scale:2};
  assert.deepEqual(centerOnPoint({x:500,y:300},view),{x:0,y:0});
  assert.deepEqual(centerOnPoint({x:600,y:300},view),{x:-160,y:0});
  const shifted=centerOnPoint({x:500,y:400},{...view,scale:1.5});assert.equal(shifted.x,0);assert.ok(Math.abs(shifted.y+120)<1e-9);
  assert.deepEqual(centerOnPoint({x:0,y:0},{...view,fit:1,scale:1}),{x:500,y:300});
});