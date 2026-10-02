const DATABASE='grimorio-note-drafts-v1',STORE='windows',TAB_KEY='grimorio-note-draft-tab-v1';
let databasePromise;

export function draftTabId(){
  try{
    let id=sessionStorage.getItem(TAB_KEY);
    if(!id){id=crypto.randomUUID();sessionStorage.setItem(TAB_KEY,id);}
    return id;
  }catch{return crypto.randomUUID();}
}

function database(){
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('IndexedDB indisponível.'));return;}
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null;};resolve(db);};
    request.onerror=()=>reject(request.error||Error('Não foi possível abrir IndexedDB.'));
    request.onblocked=()=>reject(Error('IndexedDB bloqueado por outra janela.'));
  }).catch(error=>{databasePromise=null;throw error;});
  return databasePromise;
}

function recordId(key,tabId){return `${key}:${tabId}`;}

export async function loadDraftWindows(key,tabId){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(STORE,'readonly').objectStore(STORE).get(recordId(key,tabId));
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>reject(request.error||Error('Não foi possível ler os rascunhos locais.'));
  });
}

export async function saveDraftWindows(key,tabId,windows,updatedAt=Date.now()){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).put({id:recordId(key,tabId),windows,updatedAt});
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||Error('Não foi possível salvar os rascunhos locais.'));
    transaction.onabort=()=>reject(transaction.error||Error('Salvamento local interrompido.'));
  });
}
