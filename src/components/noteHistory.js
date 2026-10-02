import {NOTE_FIELDS} from './noteConflict.js';

export function restoreNoteFields(draft,version,fields){
  const next={...draft};
  for(const field of NOTE_FIELDS)if(fields.includes(field))next[field]=version[field];
  return next;
}
