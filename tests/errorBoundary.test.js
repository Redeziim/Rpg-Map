import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ErrorBoundary,{ErrorFallback} from '../src/ErrorBoundary.js';

test('the fallback tells the person what to do and offers a reload button',()=>{
  const html=renderToStaticMarkup(h(ErrorFallback,{error:new Error('Falha ao carregar o módulo'),onReload(){}}));
  assert.match(html,/role="alert"/);assert.match(html,/Recarregar a página/);assert.match(html,/continuam guardadas/);assert.match(html,/Falha ao carregar o módulo/);
});

test('a render error is caught and shown instead of a blank page; children render normally otherwise',()=>{
  assert.equal(ErrorBoundary.getDerivedStateFromError(new Error('x')).error.message,'x');
  const boundary=new ErrorBoundary({children:'conteúdo'});
  assert.equal(boundary.render(),'conteúdo');
  boundary.state={error:new Error('quebrou')};
  assert.match(renderToStaticMarkup(boundary.render()),/Algo saiu do lugar/);
});

test('long technical details are cut so the screen stays readable',()=>{
  const html=renderToStaticMarkup(h(ErrorFallback,{error:new Error('a'.repeat(900)),onReload(){}}));
  assert.equal(html.includes('a'.repeat(501)),false);
});
