import React,{useEffect,useState} from 'react';
import {api} from '../api.js';
import {boardOutline,NOTE_FIELDS,sameNoteField} from './noteConflict.js';
import './NoteVersionHistory.css';

const labels={title:'Nome',body:'Texto',board:'Mapa mental'};
const dates=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const kinds={save:'Conteúdo salvo',access:'Acesso alterado',baseline:'Versão anterior'};

function BoardSnapshot({board,roomId}){
  const width=board.width||960,height=board.height||620,outline=boardOutline(board);
  const nodes=new Map(board.nodes.map(node=>[node.id,node]));
  return <div className="note-history-board">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Miniatura do mapa mental: ${outline.counts}`}>
      {board.edges.map(edge=>{const from=nodes.get(edge.from),to=nodes.get(edge.to);return from&&to?<line key={edge.id} x1={from.x+95} y1={from.y+55} x2={to.x+95} y2={to.y+55}/>:null;})}
      {board.strokes.map(stroke=><path key={stroke.id} d={stroke.path}/>)}
      {board.nodes.map(node=><g key={node.id}>
        <rect x={node.x} y={node.y} width="190" height={node.kind==='image'?190:110}/>
        {node.kind==='image'&&<image href={node.assetId?`/api/rooms/${encodeURIComponent(roomId)}/note-assets/${encodeURIComponent(node.assetId)}`:node.src} x={node.x+10} y={node.y+10} width="170" height="106" preserveAspectRatio="xMidYMid meet"/>}
        <text x={node.x+10} y={node.y+(node.kind==='image'?145:40)}>{node.text.length>22?`${node.text.slice(0,21)}…`:node.text||'Sem texto'}</text>
      </g>)}
    </svg>
    <p>{outline.counts}</p><small>Quadro {outline.size}</small>
    {outline.ideas.length>0&&<ul tabIndex={0} aria-label="Ideias nesta miniatura">{outline.ideas.map((idea,index)=><li key={index}>{idea}</li>)}</ul>}
    {outline.remaining>0&&<small>+ {outline.remaining} outras ideias</small>}
  </div>;
}

export default function NoteVersionHistory({roomId,scope,noteId,latestVersion,draft,busy,onRestore,onClose}){
  const [versions,setVersions]=useState([]),[currentVersion,setCurrentVersion]=useState(latestVersion),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState(''),[fields,setFields]=useState([]),[retry,setRetry]=useState(0);
  const path=`/rooms/${encodeURIComponent(roomId)}/notes/${encodeURIComponent(scope)}/${encodeURIComponent(noteId)}/history`;
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    api(path,{signal:controller.signal}).then(result=>{
      if(controller.signal.aborted)return;
      setVersions(result.versions);setCurrentVersion(result.currentVersion);
      setSelected(current=>result.versions.some(row=>row.version===current)?current:(result.versions.find(row=>row.version<result.currentVersion)||result.versions[0])?.version||null);
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[path,latestVersion,retry]);
  useEffect(()=>{
    if(selected===null)return;
    const controller=new AbortController();setDetailLoading(true);setDetail(null);setFields([]);setError('');
    api(`${path}/${selected}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setDetail(result);})
      .catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});
    return()=>controller.abort();
  },[path,selected,retry]);
  const changed=detail?NOTE_FIELDS.filter(field=>!sameNoteField(field,draft[field],detail[field])):[];
  const chosen=fields.filter(field=>changed.includes(field));
  const headingId=`note-history-${scope}-${noteId}`;
  return <section className="note-history" aria-labelledby={headingId}>
    <header><span className="note-conflict-kicker">Arquivo da nota</span><h2 id={headingId}>Histórico de versões</h2><p>Escolha uma versão e os campos que deseja trazer para o rascunho. Revise o resultado antes de salvar.</p></header>
    {loading&&<p role="status">Carregando histórico…</p>}
    {error&&<div className="note-history-error"><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></div>}
    {!loading&&!error&&versions.length===1&&<p className="note-history-empty">Esta nota ainda não tem versões anteriores disponíveis.</p>}
    {!loading&&versions.length>0&&<ol className="note-history-list" aria-label="Versões disponíveis">{versions.map(row=><li key={row.version}><button type="button" aria-pressed={selected===row.version} onClick={()=>setSelected(row.version)}>
      <span className="note-history-number">v{row.version}{row.version===currentVersion&&<small>Atual</small>}</span>
      <span><strong>{row.title}</strong><small>{row.createdAt?dates.format(row.createdAt):'Data anterior não registrada'} · {row.author||'Autor não registrado'}</small><small>{kinds[row.kind]} · {row.summary.nodes} {row.summary.nodes===1?'cartão':'cartões'} · {row.summary.edges} {row.summary.edges===1?'conexão':'conexões'}</small></span>
    </button></li>)}</ol>}
    {detailLoading&&<p role="status">Abrindo versão {selected}…</p>}
    {detail&&!detailLoading&&<div className="note-history-comparison">
      <p className="note-history-instruction">Comparando seu rascunho com a versão {detail.version}. O compartilhamento atual é preservado.</p>
      {NOTE_FIELDS.map(field=><fieldset key={field} className="note-conflict-field"><legend>{labels[field]}</legend>
        <div className="note-conflict-columns"><div><h3>Meu rascunho</h3>{field==='board'?<BoardSnapshot board={draft.board} roomId={roomId}/>:<pre className="note-conflict-text" tabIndex={field==='body'?0:undefined} aria-label={`${labels[field]} do rascunho`}>{draft[field]||'(vazio)'}</pre>}</div><div><h3>Versão {detail.version}</h3>{field==='board'?<BoardSnapshot board={detail.board} roomId={roomId}/>:<pre className="note-conflict-text" tabIndex={field==='body'?0:undefined} aria-label={`${labels[field]} da versão ${detail.version}`}>{detail[field]||'(vazio)'}</pre>}</div></div>
        {changed.includes(field)?<label className="note-history-choice"><input type="checkbox" name={`history-restore-${field}`} autoComplete="off" checked={fields.includes(field)} onChange={event=>setFields(previous=>event.target.checked?[...previous,field]:previous.filter(value=>value!==field))}/>Restaurar {labels[field].toLowerCase()} da versão {detail.version}</label>:<p className="note-history-equal">Este campo é igual ao rascunho.</p>}
      </fieldset>)}
    </div>}
    <footer><button type="button" onClick={onClose}>Fechar histórico</button><button type="button" className="note-history-apply" disabled={busy||loading||detailLoading||Boolean(error)||!detail||chosen.length===0} onClick={()=>onRestore(detail,chosen)}>{chosen.length?`Aplicar ${chosen.length} ${chosen.length===1?'campo':'campos'} ao rascunho`:'Aplicar ao rascunho'}</button></footer>
    <p className="note-history-footnote">São guardadas até 30 versões, dentro de 20 MB por nota. Participantes veem somente versões em que já tinham acesso e precisam continuar autorizados na nota atual.</p>
  </section>;
}
