import {useEffect,useState} from 'react';
import {Clapperboard,History,Lightbulb,MessageSquareText,Send} from 'lucide-react';
import {api} from '../api.js';
import './CampaignPages.css';

const TYPES={suggestion:'Sugestão',issue:'Problema',other:'Outro'};
const dateFormatter=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
function feedbackDraft(key){try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}}

export function ScenesPanel(){
  return <main className="campaign-page scenes-page">
    <header className="campaign-page-heading"><span className="campaign-kicker">Arquivo do mestre · 05</span><h2>Cenas</h2><p>Um espaço reservado para preparar os momentos da mesa.</p></header>
    <section className="scenes-empty" aria-labelledby="scenes-empty-title">
      <div className="scenes-reel" aria-hidden="true"><span>01</span><Clapperboard size={42}/></div>
      <div><span className="campaign-kicker">Em preparação</span><h3 id="scenes-empty-title">Seu arquivo de cenas começa aqui</h3><p>Esta aba já está disponível para mestre e ADM. O suporte a vídeos e animações será adicionado em uma próxima etapa.</p></div>
    </section>
  </main>;
}

export function AboutPanel({roomId,username,role}){
  const draftKey=`grimorio-feedback-draft:${roomId}:${username}`;
  const [draft]=useState(()=>feedbackDraft(draftKey));
  const [category,setCategory]=useState(()=>TYPES[draft.category]?draft.category:'suggestion');
  const [message,setMessage]=useState(()=>typeof draft.message==='string'?draft.message:'');
  const [entries,setEntries]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{try{if(message)localStorage.setItem(draftKey,JSON.stringify({category,message}));else localStorage.removeItem(draftKey);}catch{}},[draftKey,category,message]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    api(`/rooms/${roomId}/feedback`,{signal:controller.signal})
      .then(data=>{setEntries(data);setError('');})
      .catch(cause=>{if(cause.name!=='AbortError')setError(cause.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[roomId]);
  async function submit(event){
    event.preventDefault();
    if(message.trim().length<10){setError('Escreva pelo menos 10 caracteres no feedback.');event.currentTarget.elements.feedbackMessage.focus();return;}
    setSending(true);setError('');setNotice('');
    try{
      const entry=await api(`/rooms/${roomId}/feedback`,{method:'POST',data:{category,message:message.trim()}});
      setEntries(previous=>[entry,...previous].slice(0,30));
      setMessage('');setNotice('Feedback registrado na mesa. Obrigado por contribuir.');
    }catch(cause){setError(cause.message);}
    finally{setSending(false);}
  }
  return <main className="campaign-page about-page">
    <header className="campaign-page-heading"><span className="campaign-kicker">Guia da mesa · Sobre</span><h2>Sobre o Grimório</h2><p>Um lugar para acompanhar as ferramentas da mesa e contar o que pode melhorar.</p></header>
    <div className="about-columns">
      <div className="about-reading">
        <section className="about-section" aria-labelledby="about-tips"><h3 id="about-tips"><Lightbulb size={20} aria-hidden="true"/>Dicas de uso</h3><ul><li>Abra o Mapa para explorar a mesa em 3D ou marcar pontos no mapa 2D.</li><li>Use a Ficha para acompanhar o personagem e a bandeja para rolar dados.</li><li>Abra várias notas, mova as janelas e compartilhe as que o grupo deve editar.</li></ul></section>
        <section className="about-section" aria-labelledby="about-changes"><h3 id="about-changes"><History size={20} aria-hidden="true"/>Alterações recentes</h3><ul><li>A ordem de turnos agora destaca quem está jogando.</li><li>As notas permitem texto, mapa mental, desenho e imagens.</li><li>O quadro e o texto das notas ficaram sem grade para facilitar a leitura.</li></ul></section>
      </div>
      <section className="feedback-section" aria-labelledby="feedback-title">
        <div className="feedback-heading"><MessageSquareText size={22} aria-hidden="true"/><div><span className="campaign-kicker">Sua voz na mesa</span><h3 id="feedback-title">Enviar feedback</h3></div></div>
        <p>Deixe uma sugestão, relate um problema ou peça uma melhoria. O mestre e o ADM desta mesa poderão ler sua mensagem.</p>
        <form onSubmit={submit}>
          <label htmlFor="feedback-type">Tipo de mensagem</label>
          <select id="feedback-type" name="feedbackType" autoComplete="off" value={category} onChange={event=>setCategory(event.target.value)} disabled={sending}>{Object.entries(TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
          <label htmlFor="feedback-message">Seu feedback</label>
          <textarea id="feedback-message" name="feedbackMessage" autoComplete="off" value={message} onChange={event=>setMessage(event.target.value)} minLength={10} maxLength={2000} required rows={6} disabled={sending} placeholder="Conte o que aconteceu ou o que gostaria de ver…"/>
          <div className="feedback-actions"><span>{message.length}/2000 caracteres</span><button type="submit" disabled={sending}><Send size={17} aria-hidden="true"/>{sending?'Enviando…':'Enviar feedback'}</button></div>
        </form>
        {notice&&<p className="feedback-notice" role="status">{notice}</p>}
        {error&&<p className="feedback-error" role="alert">{error}</p>}
        <div className="feedback-log"><h4>{['master','admin'].includes(role)?'Feedbacks da mesa':'Seus feedbacks'}</h4>{loading?<p role="status">Carregando feedbacks…</p>:entries.length?<ol>{entries.map(entry=><li key={entry.id}><div><strong>{TYPES[entry.category]||'Feedback'}</strong><time dateTime={new Date(entry.createdAt).toISOString()}>{dateFormatter.format(entry.createdAt)}</time></div>{['master','admin'].includes(role)&&entry.username!==username&&<small>De @{entry.username}</small>}<p>{entry.message}</p></li>)}</ol>:<p>Nenhum feedback registrado ainda.</p>}</div>
      </section>
    </div>
  </main>;
}
