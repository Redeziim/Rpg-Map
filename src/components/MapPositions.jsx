import {useState} from 'react';
import './MapPositions.css';

export default function MapPositions({enabled,canManage,canShare,hasOwn,markers,members,userId,draft,conflict,covered,onEnable,onChoose,onShare,onClear,onCancel,onRebase,tool,busy,hasImage}){
  const [confirmDisable,setConfirmDisable]=useState(false);
  const names=new Map(members.map(member=>[member.id,member.username]));
  return <fieldset className="map-positions-controls"><legend>Posições dos jogadores</legend>
    <p>{enabled?'Cada pessoa escolhe se quer mostrar sua posição no mapa.':'As posições estão desativadas nesta mesa.'}</p>
    {canManage&&<button type="button" disabled={busy||!hasImage} onClick={()=>enabled?setConfirmDisable(true):onEnable(true)}>{enabled?'Desativar posições e remover marcadores':'Liberar posições para a mesa'}</button>}
    {canManage&&enabled&&confirmDisable&&<div className="map-position-confirm" role="group" aria-label="Confirmar remoção dos marcadores"><p>Desativar remove todas as posições. Cada jogador precisará escolher outra vez.</p><button type="button" disabled={busy} onClick={async()=>{if(await onEnable(false))setConfirmDisable(false);}}>Confirmar desativação</button><button type="button" disabled={busy} onClick={()=>setConfirmDisable(false)}>Manter posições</button></div>}
    {enabled&&<>
      <p>Todos veem os marcadores em áreas reveladas. Cada jogador move e remove somente o seu. As posições ficam salvas até serem removidas ou a imagem ser trocada.</p>
      {canShare&&<>
        <button type="button" aria-pressed={tool==='position'} disabled={busy||!hasImage} onClick={onChoose}>{hasOwn?'Mover minha posição':'Escolher minha posição'}</button>
        {(draft||tool==='position')&&<p>Toque no mapa para escolher; depois compartilhe. Pelo teclado: Enter inicia, setas escolhem, Enter compartilha e Escape cancela. Shift usa passos menores.</p>}
        {draft&&<>
          <p className="map-position-preview-note">Prévia escolhida · ainda não compartilhada</p>
          {covered&&<p role="alert">A escolha está em uma área oculta. Mova para uma área revelada.</p>}
          {conflict&&<div className="map-position-conflict" role="alert"><p>{conflict}</p><button type="button" disabled={busy} onClick={onCancel}>Descartar minha escolha</button><button type="button" disabled={busy} onClick={onRebase}>Manter minha escolha</button></div>}
          <button type="button" disabled={busy||!!conflict||covered} onClick={onShare}>{busy?'Compartilhando…':'Compartilhar posição'}</button>
        </>}
        {(draft||tool==='position')&&<button type="button" onClick={onCancel} disabled={busy}>Cancelar escolha</button>}
        {hasOwn&&<button type="button" disabled={busy} onClick={onClear}>Parar de mostrar minha posição</button>}
      </>}
      {Object.keys(markers).length?<ul aria-label="Jogadores com posição visível">{Object.keys(markers).map(id=><li key={id}><span className={id===userId?'map-position-initial own':'map-position-initial'} aria-hidden="true">{names.get(id)?.slice(0,1).toLocaleUpperCase('pt-BR')}</span><span>{names.get(id)}{id===userId&&<small>Sua posição</small>}</span></li>)}</ul>:<p>Nenhuma posição visível ainda.</p>}
      {canShare&&hasOwn&&!markers[userId]&&<p>Sua posição está em uma área que foi coberta. Você pode removê-la ou escolher outra área revelada.</p>}
    </>}
  </fieldset>;
}

export function MapPositionMarkers({markers,members,userId,draft,screenRatio}){
  const ratio=Math.max(.001,screenRatio),names=new Map(members.map(member=>[member.id,member.username]));
  const entries=[...Object.entries(markers).map(([id,point])=>({id,point,label:names.get(id)||'',own:id===userId})),...(draft?[{id:'draft',point:draft.point,label:'Prévia',own:true,preview:true}]:[])];
  return <g className="map-player-markers">{entries.map(({id,point,label,own,preview})=><g key={id} data-player-marker={id} transform={`translate(${point.x} ${point.y}) scale(${1/ratio})`}>
    <circle r="12" fill="#151913" stroke={own?'#f0d391':'#b6ccb3'} strokeWidth="2" strokeDasharray={preview?'3 3':undefined}/>
    <text className="map-position-letter" textAnchor="middle" y="5" fill={own?'#f0d391':'#b6ccb3'}>{preview?'+':label.slice(0,1).toLocaleUpperCase('pt-BR')}</text>
    <text className="map-position-name" textAnchor="middle" y="30">{label.length>28?label.slice(0,27)+'…':label}</text>
  </g>)}</g>;
}
