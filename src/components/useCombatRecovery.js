import {useEffect,useRef,useState} from 'react';

const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ACTIONS=new Set(['next','skip','end','select','up','down','remove','include','add','initiative','sort','effect-add','effect-remove']);
function validIntent(value){
  if(!value||!UUID.test(value.operationId||'')||!Number.isSafeInteger(value.requestedAt)||value.requestedAt<=0||!value.request||!ACTIONS.has(value.request.action)||!Number.isSafeInteger(value.request.version)||value.request.version<1)return false;
  const keys=value.request.action==='effect-add'?['action','version','player','name','origin','visibility','duration']:value.request.action==='effect-remove'?['action','version','effectId']:value.request.action==='add'?['action','version','name','kind']:value.request.action==='initiative'?['action','version','player','value']:['action','version','player'];
  if(value.request.action==='effect-add'){
    const {player,name,origin,visibility,duration}=value.request;
    if(typeof player!=='string'||!player||typeof name!=='string'||typeof origin!=='string'||!['all','master'].includes(visibility)||!duration||Object.keys(duration).sort().join(',')!=='kind,remaining'||!(duration.kind==='manual'?duration.remaining===null:duration.kind==='next-turn'?duration.remaining===1:duration.kind==='rounds'&&Number.isInteger(duration.remaining)&&duration.remaining>=1&&duration.remaining<=99))return false;
  }
  if(value.request.action==='effect-remove'&&!UUID.test(value.request.effectId||''))return false;
  return Object.keys(value).every(key=>['operationId','requestedAt','request'].includes(key))&&Object.keys(value.request).every(key=>keys.includes(key));
}
function readPending(key){
  try{const raw=localStorage.getItem(key);if(!raw)return null;const parsed=JSON.parse(raw);return validIntent(parsed)?parsed:{corrupt:true};}catch{return {corrupt:true};}
}
const initial=key=>{const pending=readPending(key);return {pending,phase:pending?.corrupt?'corrupt':'unknown',notice:''};};

export default function useCombatRecovery({roomId,userId,connection,mutate,onConfirmed}){
  const storageKey=`grimorio-combat-pending-v1:${roomId}:${userId}`;
  const [state,setState]=useState(()=>initial(storageKey));
  const current=useRef(state),busy=useRef(false),mounted=useRef(true),actions=useRef(null);
  const update=next=>{current.current=next;if(mounted.current)setState(next);};
  function clear(intent,notice){
    try{
      const stored=readPending(storageKey);
      if(stored&&!stored.corrupt&&stored.operationId!==intent?.operationId){update({pending:stored,phase:'unknown',notice:''});return false;}
      localStorage.removeItem(storageKey);
    }catch{update({pending:intent,phase:'unknown',notice:'A confirmação chegou, mas não foi possível limpar este aviso. Tente verificar novamente.'});return false;}
    update({pending:null,phase:'unknown',notice});return true;
  }
  function confirmed(intent,result){
    if(result?.combatOperation?.phase!=='confirmed'||result.combatOperation.operationId!==intent.operationId)return false;
    if(current.current.pending?.operationId!==intent.operationId)return true;
    if(clear(intent,'Seu comando foi confirmado. A tela mostra a ordem atual da mesa.'))onConfirmed?.(intent.request);
    return true;
  }
  async function inspect(intent){
    update({pending:intent,phase:'checking',notice:''});
    const result=await mutate(`/turn-operations/${intent.operationId}?requestedAt=${intent.requestedAt}`,undefined,'GET');
    if(!mounted.current||current.current.pending?.operationId!==intent.operationId)return false;
    if(confirmed(intent,result))return result;
    const phase=['unconfirmed','expired'].includes(result?.combatOperation?.phase)?result.combatOperation.phase:'unknown';
    update({pending:intent,phase,notice:phase==='unconfirmed'?'Ainda não há confirmação. Reenviar usará a mesma ação e versão.':phase==='expired'?'A confirmação antiga não está disponível. Confira a ordem atual antes de liberar os controles.':'Ainda não foi possível conferir o comando. Os próximos comandos continuam bloqueados.'});
    return false;
  }
  async function send(intent){
    update({pending:intent,phase:'sending',notice:''});let failure;
    const result=await mutate('/turns',{...intent.request,operationId:intent.operationId,requestedAt:intent.requestedAt},'POST',undefined,cause=>{failure=cause;});
    if(!mounted.current)return false;
    if(confirmed(intent,result))return result;
    if(current.current.pending?.operationId!==intent.operationId)return false;
    if(failure?.status>=400&&failure.status<500){clear(intent,failure.message);return false;}
    return inspect(intent);
  }
  async function execute(command){
    if(busy.current||current.current.pending)return false;
    const stored=readPending(storageKey);
    if(stored){update({pending:stored,phase:stored.corrupt?'corrupt':'unknown',notice:''});return false;}
    const intent={operationId:crypto.randomUUID(),requestedAt:Date.now(),request:Object.fromEntries(Object.entries(command).filter(([,value])=>value!==undefined))};
    try{localStorage.setItem(storageKey,JSON.stringify(intent));}
    catch{update({pending:null,phase:'unknown',notice:'Não foi possível guardar a confirmação no navegador. Libere espaço e tente novamente; o comando não foi enviado.'});return false;}
    busy.current=true;try{return await send(intent);}finally{busy.current=false;}
  }
  async function verify(){
    const pending=current.current.pending;if(busy.current||!pending||pending.corrupt)return;
    busy.current=true;try{await inspect(pending);}finally{busy.current=false;}
  }
  async function retry(){
    const {pending,phase}=current.current;if(busy.current||!pending||pending.corrupt||phase!=='unconfirmed')return;
    busy.current=true;try{await send(pending);}finally{busy.current=false;}
  }
  async function acknowledge(){
    if(busy.current||!['expired','corrupt'].includes(current.current.phase))return;
    const pending=current.current.pending;busy.current=true;
    try{const result=await mutate('',undefined,'GET');if(result?.state&&mounted.current)clear(pending,'Ordem atual conferida. Você pode iniciar um novo comando.');}
    finally{busy.current=false;}
  }
  actions.current={verify};
  useEffect(()=>{
    mounted.current=true;
    const changed=event=>{if(event.key!==storageKey)return;const pending=readPending(storageKey);update({pending,phase:pending?.corrupt?'corrupt':'unknown',notice:''});};
    window.addEventListener('storage',changed);
    return()=>{mounted.current=false;window.removeEventListener('storage',changed);};
  },[storageKey]);
  useEffect(()=>{if(connection==='online'&&current.current.pending&&!current.current.pending.corrupt&&['unknown','unconfirmed'].includes(current.current.phase))void actions.current.verify();},[connection,state.pending?.operationId]);
  return {...state,execute,verify,retry,acknowledge};
}
