import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CampaignTimeline from '../src/components/CampaignTimeline.jsx';
import {visibleTimelineEntries,timelinePage} from '../src/shared/campaignTimeline.js';
import '../src/index.css';
import './57-timeline-preview.css';

const points=[{id:'port',name:'Porto seguro'},{id:'tower',name:'Torre reservada'}];
const scenes=[{id:'bridge',title:'Travessia da ponte'},{id:'secret-scene',title:'Cena reservada'}];
const records=[
  {id:'session-12',date:'2026-10-04',createdAt:100,kind:'session',title:'Sessão 12 — a travessia',body:'O grupo saiu do porto e encontrou a ponte interditada.\nA guarda aceitou conversar antes de permitir a passagem.',author:'Mestre',visibility:'table',pointIds:['port','tower'],sceneIds:['bridge','secret-scene'],archived:false},
  {id:'decision-12',date:'2026-10-04',createdAt:500,kind:'decision',title:'Acordo com a guarda',body:'Os personagens decidiram escoltar o mensageiro até a próxima vila. A passagem será liberada ao amanhecer.',author:'Mestre',visibility:'table',pointIds:['port'],sceneIds:[],archived:false},
  {id:'decision-11',date:'2026-09-29',createdAt:200,kind:'decision',title:'O caminho escolhido',body:'Seguir pela margem do rio e evitar a estrada principal.',author:'Mestre',visibility:'table',pointIds:[],sceneIds:[],archived:false},
  {id:'session-11',date:'2026-09-19',createdAt:100,kind:'session',title:'Sessão 11 — chegada ao porto',body:'A primeira visita ao porto apresentou o mapa da região e os rumores da ponte.',author:'Mestre',visibility:'table',pointIds:['port'],sceneIds:[],archived:false},
  {id:'secret',date:'2026-10-05',createdAt:600,kind:'decision',title:'Segredo que não pode aparecer ao jogador',body:'Conteúdo reservado para verificar a projeção da prévia.',author:'Mestre',visibility:'master',pointIds:['tower'],sceneIds:['secret-scene'],archived:false},
];

function Preview(){
  const [mode,setMode]=useState('player'),[kind,setKind]=useState('all'),[before,setBefore]=useState(null),[status,setStatus]=useState('normal'),[notice,setNotice]=useState('');
  const visiblePoints=mode==='master'?points:points.filter(point=>point.id==='port'),visibleScenes=mode==='master'?scenes:scenes.filter(scene=>scene.id==='bridge');
  const entries=visibleTimelineEntries(records,{master:mode==='master',pointIds:new Set(visiblePoints.map(point=>point.id)),sceneIds:new Set(visibleScenes.map(scene=>scene.id))});
  const page=timelinePage(entries,{kind,before,limit:2});
  const changeKind=value=>{setKind(value);setBefore(null);};
  return <><a className="skip-link" href="#timeline-preview">Pular para a prévia</a><header className="timeline-preview-tools"><div><h1>Prévia local</h1><p>Dados fictícios · consulta em preparação · nenhuma mesa alterada</p><a href="/">Voltar ao Grimório</a></div><div className="timeline-preview-options"><label>Visão da prévia<select name="preview-view" autoComplete="off" value={mode} onChange={event=>{setMode(event.target.value);setBefore(null);}}><option value="player">Jogador</option><option value="master">Mestre</option></select></label><label>Estado da consulta<select name="preview-status" autoComplete="off" value={status} onChange={event=>setStatus(event.target.value)}><option value="normal">Normal</option><option value="loading">Carregando</option><option value="error">Erro</option><option value="offline">Desconectado</option><option value="empty">Vazio</option></select></label></div></header>
    {notice&&<p className="timeline-preview-notice" role="status">{notice}</p>}
    <main id="timeline-preview"><CampaignTimeline entries={status==='empty'?[]:page.entries} points={visiblePoints} scenes={visibleScenes} kind={kind} onKindChange={changeKind} pageKey={`${mode}:${kind}:${before?.id||'first'}`} hasMore={status!=='empty'&&page.hasMore} isFirstPage={!before} loading={status==='loading'} error={status==='error'?'Não foi possível obter os registros da campanha.':''} connection={status==='offline'?'offline':'online'} onRetry={()=>setStatus('normal')} onEarlier={()=>setBefore(page.next)} onFirst={()=>setBefore(null)} onOpenPoint={id=>setNotice(`Prévia: abrir o ponto ${visiblePoints.find(point=>point.id===id).name}.`)} onOpenScene={id=>setNotice(`Prévia: abrir a cena ${visibleScenes.find(scene=>scene.id===id).title}.`)}/></main>
  </>;
}

const root=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<React.StrictMode><Preview/></React.StrictMode>);
