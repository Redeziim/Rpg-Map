const DATABASE='grimorio-note-drafts-v1',STORE='windows',TAB_KEY='grimorio-note-draft-tab-v1',TIMEOUT=2000;
let databasePromise,identity=import.meta.hot?.data.identity;

// sessionStorage is copied by window.open. Each document owns a new writing ID;
// its predecessor is read-only and lets a reload resume the last copy.
export function draftTabId(){
  if(!identity){
    let previous=null;try{previous=sessionStorage.getItem(TAB_KEY);}catch{}
    identity={id:crypto.randomUUID(),previous};
    try{sessionStorage.setItem(TAB_KEY,identity.id);}catch{}
    if(import.meta.hot)import.meta.hot.data.identity=identity;
  }
  return identity.id;
}
function candidates(tabId){draftTabId();return tabId===identity.id&&identity.previous?[tabId,identity.previous]:[tabId];}
function recordId(key,tabId){return `${key}:${tabId}`;}
function validRecord(record){return record&&Array.isArray(record.windows)&&Number.isFinite(record.updatedAt);}
export function readLocalDraftWindows(key,tabId){
  try{
    for(const id of candidates(tabId)){
      const record=JSON.parse(localStorage.getItem(recordId(key,id)));
      if(validRecord(record))return record;
    }
    const owner=localStorage.getItem(key+':tabId');
    if(!owner||candidates(tabId).includes(owner)){
      const windows=JSON.parse(localStorage.getItem(key));
      if(Array.isArray(windows))return {windows,updatedAt:Number(localStorage.getItem(key+':updatedAt'))||0};
    }
  }catch{}
  return {windows:[],updatedAt:0};
}
export function saveLocalDraftWindows(key,tabId,windows,updatedAt=Date.now()){
  localStorage.setItem(recordId(key,tabId),JSON.stringify({windows,updatedAt}));
}
function database(){
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('IndexedDB indisponível.'));return;}
    let expired=false;
    const timer=setTimeout(()=>{expired=true;reject(Error('IndexedDB não respondeu.'));},TIMEOUT);
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onsuccess=()=>{clearTimeout(timer);const db=request.result;if(expired){db.close();return;}db.onversionchange=()=>{db.close();databasePromise=null;};resolve(db);};
    request.onerror=()=>{clearTimeout(timer);reject(request.error||Error('Não foi possível abrir IndexedDB.'));};
    request.onblocked=()=>{clearTimeout(timer);expired=true;reject(Error('IndexedDB bloqueado por outra janela.'));};
  }).catch(error=>{databasePromise=null;throw error;});
  return databasePromise;
}
async function transaction(mode,run){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);let value;
    const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('O armazenamento local não respondeu.'));},TIMEOUT);
    tx.oncomplete=()=>{clearTimeout(timer);resolve(value);};
    tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error||Error('Operação local interrompida.'));};
    run(tx.objectStore(STORE),result=>{value=result;});
  });
}
export async function loadDraftWindows(key,tabId){
  const ids=candidates(tabId);
  return transaction('readonly',(store,done)=>{
    let index=0;
    const next=()=>{const request=store.get(recordId(key,ids[index++]));request.onsuccess=()=>{if(validRecord(request.result)||index===ids.length)done(request.result||null);else next();};};
    next();
  });
}
export async function saveDraftWindows(key,tabId,windows,updatedAt=Date.now()){
  return transaction('readwrite',store=>{store.put({id:recordId(key,tabId),windows,updatedAt});});
}
export async function listDraftCopies(key,tabId){
  const copies=new Map(),prefix=key+':',excluded=new Set(candidates(tabId).map(id=>recordId(key,id)));
  try{for(let index=0;index<localStorage.length;index++){
    const id=localStorage.key(index);if(!id?.startsWith(prefix)||excluded.has(id))continue;
    try{const record=JSON.parse(localStorage.getItem(id));if(validRecord(record))copies.set(id,{...record,id});}catch{}
  }}catch{}
  let idbError;
  try{await transaction('readonly',(store,done)=>{
    const request=store.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    request.onsuccess=()=>{const cursor=request.result;if(!cursor){done();return;}const record=cursor.value;if(!excluded.has(record.id)&&validRecord(record)&&(!copies.has(record.id)||copies.get(record.id).updatedAt<record.updatedAt))copies.set(record.id,record);cursor.continue();};
  });}catch(error){idbError=error;}
  if(idbError&&!copies.size){try{localStorage.getItem(key);}catch{throw idbError;}}
  return [...copies.values()].sort((a,b)=>b.updatedAt-a.updatedAt);
}
