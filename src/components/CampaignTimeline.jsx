import {useEffect,useRef} from 'react';
import {TIMELINE_KINDS,formatTimelineDate} from '../shared/campaignTimeline.js';
import './CampaignTimeline.css';

const EMPTY=[];

// Reading is independent of the pending decision about who may write.
// The parent supplies an authorized page; this component does not infer access.
export default function CampaignTimeline({entries=EMPTY,points=EMPTY,scenes=EMPTY,kind='all',onKindChange,pageKey='first',hasMore=false,isFirstPage=true,loading=false,error='',connection='online',onRetry,onEarlier,onFirst,onOpenPoint,onOpenScene,renderActions,emptyHint}){
  const heading=useRef(null),requestedPageFocus=useRef(false);
  const pointNames=new Map(points.map(point=>[point.id,point.name]));
  const sceneNames=new Map(scenes.filter(scene=>!scene.archived).map(scene=>[scene.id,scene.title]));
  useEffect(()=>{if(requestedPageFocus.current&&!loading){requestedPageFocus.current=false;heading.current?.focus({preventScroll:true});}},[pageKey,loading]);
  const navigate=action=>{requestedPageFocus.current=true;action?.();};
  return <section className="campaign-timeline" aria-labelledby="campaign-timeline-title" aria-busy={loading}>
    <header className="timeline-header"><div><span className="timeline-kicker">Diário da campanha</span><h2 ref={heading} tabIndex={-1} id="campaign-timeline-title">Linha do tempo</h2><p>Sessões, acontecimentos e decisões, dos mais recentes aos mais antigos.</p></div>
      <label>Mostrar<select name="timeline-kind" autoComplete="off" value={kind} disabled={loading||connection!=='online'||!onKindChange} onChange={event=>navigate(()=>onKindChange(event.target.value))}><option value="all">Sessões e decisões</option>{Object.entries(TIMELINE_KINDS).map(([value,label])=><option key={value} value={value}>{label==='Sessão'?'Sessões':'Decisões'}</option>)}</select></label>
    </header>
    {connection!=='online'&&<p className="timeline-message" role="status">Reconectando à mesa. Estes são os últimos registros recebidos.</p>}
    {error&&<div className="timeline-message timeline-error" role="alert"><p>{error}</p>{onRetry&&<button type="button" disabled={loading} onClick={()=>navigate(onRetry)}>Tentar novamente</button>}</div>}
    {loading&&<p className="timeline-message" role="status">Carregando os registros da campanha…</p>}
    {entries.length?<ol className="timeline-entries" aria-label="Registros da campanha">{entries.map(entry=><li key={entry.id} className="timeline-entry">
      <div className="timeline-date"><time dateTime={entry.date}>{formatTimelineDate(entry.date)}</time><span>{TIMELINE_KINDS[entry.kind]||'Registro'}</span></div>
      <article aria-labelledby={`timeline-entry-${entry.id}`}><header><h3 id={`timeline-entry-${entry.id}`}>{entry.title}</h3>{entry.visibility==='master'&&<span className="timeline-visibility">Só mestres</span>}{entry.archived&&<span className="timeline-visibility">Arquivado</span>}</header>
        <p className="timeline-body">{entry.body}</p>
        {(entry.pointIds.some(id=>pointNames.has(id))||entry.sceneIds.some(id=>sceneNames.has(id)))&&<div className="timeline-links" role="group" aria-label={`Vínculos de ${entry.title}`}>
          {entry.pointIds.filter(id=>pointNames.has(id)).map(id=>onOpenPoint?<button key={`point-${id}`} type="button" onClick={()=>onOpenPoint(id)}>Abrir ponto: {pointNames.get(id)}</button>:<span key={`point-${id}`}>Ponto: {pointNames.get(id)}</span>)}
          {entry.sceneIds.filter(id=>sceneNames.has(id)).map(id=>onOpenScene?<button key={`scene-${id}`} type="button" onClick={()=>onOpenScene(id)}>Abrir cena: {sceneNames.get(id)}</button>:<span key={`scene-${id}`}>Cena: {sceneNames.get(id)}</span>)}
        </div>}
        <footer>Registrado por {entry.author}</footer>
        {renderActions&&<div className="timeline-actions" role="group" aria-label={`Ações de ${entry.title}`}>{renderActions(entry)}</div>}
      </article>
    </li>)}</ol>:!loading&&!error?<div className="timeline-empty"><h3>{kind==='decision'?'Nenhuma decisão registrada.':kind==='session'?'Nenhuma sessão registrada.':'Nenhum registro da campanha.'}</h3><p>{emptyHint||'Os registros disponíveis para você aparecerão aqui.'}</p></div>:null}
    {(!isFirstPage||hasMore)&&<nav className="timeline-pagination" aria-label="Páginas da campanha">{!isFirstPage&&<button type="button" disabled={loading||connection!=='online'||!onFirst} onClick={()=>navigate(onFirst)}>Voltar aos mais recentes</button>}{hasMore&&<button type="button" disabled={loading||connection!=='online'||!onEarlier} onClick={()=>navigate(onEarlier)}>Ver registros mais antigos</button>}</nav>}
  </section>;
}
