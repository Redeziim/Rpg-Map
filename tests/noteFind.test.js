import test from 'node:test';
import assert from 'node:assert/strict';
import {findNoteMatches,findTextMatches} from '../src/components/noteFind.js';

test('find preserves source offsets with accents, combining marks and emoji',()=>{
  const text='🗺️ AÇÃO e ac\u0327a\u0303o; ação.';
  const matches=findTextMatches(text,'ACAO');
  assert.deepEqual(matches.map(({start,end})=>text.slice(start,end)),['AÇÃO','ac\u0327a\u0303o','ação']);
});

test('find treats punctuation literally and skips empty queries',()=>{
  const text='pista [a+b] e [a+b].';
  assert.deepEqual(findTextMatches(text,'[a+b]').map(({start,end})=>text.slice(start,end)),['[a+b]','[a+b]']);
  assert.deepEqual(findTextMatches(text,'  '),[]);
  assert.deepEqual(findTextMatches('banana','ana'),[{start:1,end:4}]);
});

test('find uses only the open view, including image captions and connection labels',()=>{
  const note={title:'Porto no título',body:'No porto, outro PORTO.',board:{nodes:[{id:'a',kind:'text',text:'Porto velho'},{id:'b',kind:'image',text:'Foto do porto'}],edges:[{id:'c',from:'a',to:'b',label:'Caminho ao porto'}]}};
  assert.deepEqual(findNoteMatches(note,'porto',false).map(result=>result.kind),['body','body']);
  assert.deepEqual(findNoteMatches(note,'porto',true).map(({kind,id})=>({kind,id})),[{kind:'node',id:'a'},{kind:'node',id:'b'},{kind:'edge',id:'c'}]);
});
