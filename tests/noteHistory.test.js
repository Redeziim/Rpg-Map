import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreNoteFields} from '../src/components/noteHistory.js';

test('selective restoration preserves other draft fields, version and current sharing',()=>{
  const board={nodes:[{id:'current'}]},oldBoard={nodes:[{id:'old'}]};
  const draft={title:'Nome atual',body:'Texto atual',board,version:8,sharedWith:['alice']};
  const old={title:'Nome antigo',body:'Texto antigo',board:oldBoard,version:2,sharedWith:['bob']};
  const text=restoreNoteFields(draft,old,['body','sharedWith','version']);
  assert.deepEqual(text,{...draft,body:'Texto antigo'});
  assert.deepEqual(restoreNoteFields(draft,old,['title','board']),{...draft,title:'Nome antigo',board:oldBoard});
  assert.equal(draft.body,'Texto atual');
});
