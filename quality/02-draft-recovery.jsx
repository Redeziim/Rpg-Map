import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Notebook from '../src/components/Notebook.jsx';
import {emptyNoteBoard} from '../src/components/noteBoardDefaults.js';
import {draftTabId,loadDraftWindows} from '../src/components/noteDraftStore.js';
import '../src/index.css';
import '../src/workspace.css';

const params=new URLSearchParams(location.search),storageKey=`qa-draft-recovery-${params.get('room')||'room'}:qa-user:qa-user`;
// Fault injection at the browser API boundary, exclusively in this QA page.
if(params.get('idb')==='off')Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});
const tabId=draftTabId(),notes=[{id:'qa-note',title:'Nota de recuperação',body:'Texto confirmado da mesa.',board:emptyNoteBoard(),version:1,sharedWith:[]}];
function RecoveryPreview(){
  const [calls,setCalls]=useState(0),[recoverable,setRecoverable]=useState('Ainda não consultado.'),[quota,setQuota]=useState('Disponível');
  const [downloadCheck,setDownloadCheck]=useState('Ainda não gerado.');
  useEffect(()=>{const inspect=async event=>{const link=event.target.closest?.('a[download]');if(!link?.href.startsWith('blob:'))return;try{const data=await (await fetch(link.href)).json();setDownloadCheck(JSON.stringify({format:data.format,title:data.title,bodyLength:data.body.length,bodyStart:data.body.slice(0,60),boardPresent:!!data.board}));}catch{setDownloadCheck('Falha ao ler JSON gerado.');}};document.addEventListener('click',inspect,true);return()=>document.removeEventListener('click',inspect,true);},[]);
  return <><header style={{padding:20,fontFamily:'Source Sans 3',maxWidth:720}}><h1 style={{fontFamily:'Cinzel',fontSize:24}}>Recuperação de notas</h1><p>Teste local · dados fictícios · sem envio à mesa</p><p>Sessão da aba: <output data-testid="draft-tab-id">{tabId}</output></p><p>Envios solicitados: <output data-testid="save-count">{calls}</output></p><button type="button" style={{position:'fixed',right:16,top:16,zIndex:200,minHeight:44,padding:12}} onClick={()=>window.open(window.location.href,'_blank')}>Duplicar aba de teste</button></header>
    <aside style={{position:'fixed',right:16,top:80,width:330,fontFamily:'Source Sans 3',zIndex:200}}><button type="button" style={{minHeight:44,padding:12}} onClick={async()=>{try{const copy=await loadDraftWindows('grimorio-notes-v2:'+storageKey,tabId);setRecoverable(copy?.windows?.[0]?.body||'Nenhum texto recuperável.');}catch{setRecoverable('IndexedDB indisponível neste teste.');}}}>Conferir cópia local desta aba</button><p>Texto recuperável: <output data-testid="recoverable-body">{recoverable}</output></p><button type="button" style={{minHeight:44}} onClick={()=>{let index=0;try{for(;index<1000;index++)localStorage.setItem(`qa-quota-${index}`,'x'.repeat(32768));}catch(error){setQuota(`${error.name}: limite atingido com ${index} blocos`);}}}>Encher armazenamento local</button><button type="button" style={{minHeight:44}} onClick={()=>{for(let index=0;index<1000;index++)localStorage.removeItem(`qa-quota-${index}`);setQuota('Disponível');}}>Liberar espaço do teste</button><p><output data-testid="quota-state">{quota}</output></p></aside>
    <main className="mist-theme" style={{padding:20}}><Notebook title="Notas do teste" hint="Rascunhos locais" storageKey={storageKey} scope="qa-user" username="qa-user" notes={notes} onSave={async()=>{setCalls(value=>value+1);return false;}}/></main>
    <output data-testid="download-check" style={{position:'fixed',bottom:12,right:12,zIndex:200,maxWidth:340,overflowWrap:'anywhere'}}>{downloadCheck}</output>
  </>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<React.StrictMode><RecoveryPreview/></React.StrictMode>);
