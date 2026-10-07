import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import { ScrollText, LogOut, Plus, ArrowRight, Users, KeyRound, ShieldCheck, Copy, X } from 'lucide-react';
import { api, ROLE_LABELS } from '../api.js';
import { useRoom } from '../useRoom.js';
import AmbientFog from './AmbientFog.jsx';
import '../account.css';

const RPGMapExplorer=lazy(()=>import('./RPGMapExplorer.jsx'));

function Brand(){return <div className="account-brand"><ScrollText size={32}/><span>Grimório</span></div>;}
function Backdrop(){return <AmbientFog/>;}
function Login({onLogin,invite,notice,initialUsername=''}){
  const [register,setRegister]=useState(false),[username,setUsername]=useState(initialUsername),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const confirmRef=useRef(null);
  async function submit(e){e.preventDefault();setError('');if(register&&password!==confirm){setError('As senhas não coincidem.');confirmRef.current?.focus();return;}setBusy(true);try{await onLogin(await api(`/auth/${register?'register':'login'}`,{method:'POST',data:{username,password}}));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <main className="mist-theme account-screen"><Backdrop/><div className="login-story"><Brand/><h1>Sua próxima jornada<br/>começa à mesa.</h1><p>Convide o grupo, organize as fichas e abra o mapa da campanha.</p><div className="login-role-list"><span><Users size={18}/>Jogador · sua ficha e observações</span><span><ScrollText size={18}/>Mestre · campanha e participantes</span><span><ShieldCheck size={18}/>ADM · os dois modos e permissões</span></div></div><section className="login-panel"><span className="account-caption">Sua conta no Grimório</span><h2>{register?'Crie sua conta':'Entre para jogar'}</h2>{invite&&<p className="account-hint">Você recebeu um convite. Entre ou crie sua conta para acessar a mesa.</p>}<form onSubmit={submit}><label>Usuário<input name="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,29}" spellCheck={false} placeholder="Seu nome de usuário…"/></label><label>Senha<input name="password" type="password" autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required placeholder={register?"Pelo menos 8 caracteres…":"Sua senha"}/></label>{register&&<label>Repita a senha<input ref={confirmRef} name="confirm" type="password" aria-invalid={error==='As senhas não coincidem.'} aria-describedby={error==='As senhas não coincidem.'?'confirm-error':undefined} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={8}/></label>}{(error||notice)&&<p id={error==='As senhas não coincidem.'?'confirm-error':undefined} className="account-error" role="alert">{error||notice}</p>}<button className="account-primary" disabled={busy}>{busy?'Aguarde…':register?'Criar conta':'Entrar'}<ArrowRight size={17}/></button></form><button className="account-text-button" onClick={()=>{setRegister(!register);setError('');}} disabled={busy}>{register?'Já tem uma conta? Entrar':'Primeiro acesso? Criar conta'}</button></section></main>;
}
function Lobby({user,onOpen,onLogout,invite,onInviteUsed,notice}){
  const [rooms,setRooms]=useState([]),[name,setName]=useState(''),[code,setCode]=useState(invite||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{api('/rooms').then(setRooms).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function action(fn){setBusy(true);setError('');try{const room=await fn();onOpen(room);}catch(e){setError(e.message);}finally{setBusy(false);}}
  function inviteCode(raw){try{return new URL(raw).searchParams.get('convite')||raw.trim();}catch{return raw.trim();}}
  return <main className="mist-theme account-screen lobby-screen"><Backdrop/><header className="lobby-header"><Brand/><div><span>@{user.username}</span><button className="sheet-tool-btn" onClick={onLogout}><LogOut size={16}/>Sair da conta</button></div></header><div className="lobby-heading"><div><span className="account-caption">Mesas e convites</span><h1>Minhas mesas</h1></div><span className="account-hint">O criador de cada mesa é seu ADM.</span></div>{(error||notice)&&<p className="account-error" role="alert">{error||notice}</p>}<div className="lobby-forms"><section><h2><Plus size={19}/>Criar uma mesa</h2><p>Prepare uma nova campanha e convide o grupo.</p><form onSubmit={e=>{e.preventDefault();action(()=>api('/rooms',{method:'POST',data:{name}}));}}><label>Nome da mesa<input name="roomName" autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={80} required placeholder="Ex.: Ecos da névoa…"/></label><button className="account-primary" disabled={busy}>Criar mesa</button></form></section><section><h2><KeyRound size={19}/>Entrar com convite</h2><p>Cole o código ou o link enviado pelo mestre.</p><form onSubmit={e=>{e.preventDefault();action(async()=>{const room=await api('/join',{method:'POST',data:{code:inviteCode(code)}});onInviteUsed();return room;});}}><label>Código ou link<input name="inviteCode" autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} required placeholder="Cole seu convite…"/></label><button className="sheet-tool-btn" disabled={busy}>Entrar na mesa<ArrowRight size={16}/></button></form></section></div><section className="room-list"><h2>Suas campanhas</h2>{loading?<p>Carregando mesas…</p>:rooms.length===0?<div className="lobby-empty"><ScrollText size={30}/><p>Você ainda não participa de uma mesa. Crie a primeira ou use um convite.</p></div>:rooms.map(room=><button className="room-row" key={room.id} disabled={busy} onClick={()=>action(()=>api(`/rooms/${room.id}`))}><span><strong>{room.name}</strong><small>{room.memberCount} participantes</small></span><span className={`role-badge role-${room.role}`}>{ROLE_LABELS[room.role]}</span><ArrowRight size={18}/></button>)}</section></main>;
}
function ActiveRoom({initialRoom,user,onExit,onLogout}){
  const [adminMode,setAdminMode]=useState('master');
  const {room,error,connection,saving,mutate}=useRoom(initialRoom,onExit,adminMode);
  useEffect(()=>{if(room.role!=='admin')setAdminMode('master');},[room.role]);
  const leave=()=>{if(!saving||confirm('Há alterações sendo enviadas. Deseja sair mesmo assim?'))onExit();};
  const logout=()=>{if(!saving||confirm('Há alterações sendo enviadas. Deseja sair mesmo assim?'))onLogout();};
  return <><Suspense fallback={<main className="mist-theme account-loading"><Brand/><p role="status">Preparando sua mesa…</p></main>}><RPGMapExplorer adminMode={adminMode} setAdminMode={setAdminMode} room={room} user={user} mutate={mutate} onExit={leave} onLogout={logout} connection={connection} saving={saving} error={error}/></Suspense>{error&&<div role="alert" className="room-error-toast">{error}</div>}</>;
}
export default function AccountApp(){
  const resume=useRef(null);
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[room,setRoom]=useState(null),[notice,setNotice]=useState('');
  const [invite,setInvite]=useState(()=>new URLSearchParams(location.search).get('convite')||'');
  const boot=()=>{setLoading(true);api('/auth/me').then(setUser).catch(e=>{if(e.status===401)setUser(null);else setError(e.message);}).finally(()=>setLoading(false));};
  useEffect(boot,[]);
  async function logout(){try{await api('/auth/logout',{method:'POST'});resume.current=null;setRoom(null);setUser(null);setNotice('');}catch(e){setError(e.message);}}
  async function login(next){
    const target=resume.current;resume.current=null;setLoading(true);setUser(next);setNotice('');
    try{if(target?.userId===next.id)setRoom(await api(`/rooms/${target.roomId}`));}
    catch(cause){setNotice(cause.message);}
    finally{setLoading(false);}
  }
  if(loading)return <main className="mist-theme account-loading"><Brand/><p>Preparando sua mesa…</p></main>;
  if(error)return <main className="mist-theme account-loading"><Brand/><p role="alert">{error}</p><button className="sheet-tool-btn" onClick={()=>{setError('');boot();}}>Tentar novamente</button></main>;
  if(!user)return <Login invite={invite} onLogin={login} notice={notice} initialUsername={resume.current?.username}/>;
  if(room)return <ActiveRoom key={room.id} initialRoom={room} user={user} onExit={(message,status)=>{setNotice(message||'');setRoom(null);if(status===401){resume.current={roomId:room.id,userId:user.id,username:user.username};setUser(null);}}} onLogout={logout}/>;
  return <Lobby user={user} onOpen={setRoom} onLogout={logout} notice={notice} invite={invite} onInviteUsed={()=>{setInvite('');history.replaceState(null,'',location.pathname);}}/>;
}
