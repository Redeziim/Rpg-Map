import React,{useState} from 'react';
import {boardDifference,boardOutline,NOTE_FIELDS,sameNoteField} from './noteConflict.js';

const FIELD_LABELS={title:'Nome',body:'Texto',board:'Mapa mental'};

function BoardPreview({board}){
  const outline=boardOutline(board);
  return <div className="note-conflict-board-preview"><p>{outline.counts}</p><p>Quadro {outline.size}</p>{outline.ideas.length>0&&<ul>{outline.ideas.map((idea,index)=><li key={index}>{idea}</li>)}</ul>}{outline.remaining>0&&<small>+ {outline.remaining} outras ideias</small>}</div>;
}

function FieldPreview({field,value}){
  if(field==='board')return <BoardPreview board={value}/>;
  return <pre className="note-conflict-text">{value||'(vazio)'}</pre>;
}

export default function NoteConflictReview({draft,latest,editedFields,pendingRecipients,groupId,onApply,onCancel}){
  const [choices,setChoices]=useState({title:'mine',body:'mine',board:'mine',access:'mine'});
  const different=NOTE_FIELDS.filter(field=>!sameNoteField(field,draft[field],latest[field]));
  const boardChanges=boardDifference(draft.board,latest.board);
  const titleId=`note-conflict-title-${groupId}`;
  return <section className="note-conflict" aria-labelledby={titleId}>
    <header><span className="note-conflict-kicker">Revisão de versões</span><h2 id={titleId}>Escolha o que manter</h2><p>Seu rascunho continua aberto. Compare cada campo antes de atualizar a base da nota para a versão {latest.version} da mesa.</p></header>
    {!different.length&&!pendingRecipients&&<p className="note-conflict-equal">O conteúdo é igual nas duas versões. O acesso à nota ou outros dados da mesa podem ter mudado.</p>}
    {different.map(field=><fieldset className="note-conflict-field" key={field}>
      <legend>{FIELD_LABELS[field]}</legend>
      {field==='board'&&<p className="note-conflict-delta">Diferenças: ideias {boardChanges.nodes.added} novas na mesa, {boardChanges.nodes.removed} só no rascunho, {boardChanges.nodes.changed} alteradas; conexões {boardChanges.edges.added+boardChanges.edges.removed+boardChanges.edges.changed}; traços {boardChanges.strokes.added+boardChanges.strokes.removed+boardChanges.strokes.changed}{boardChanges.resized?'; tamanho do quadro alterado':''}.</p>}
      <div className="note-conflict-columns">
        <div><h3>Meu rascunho</h3><FieldPreview field={field} value={draft[field]}/></div>
        <div><h3>Versão da mesa</h3><FieldPreview field={field} value={latest[field]}/></div>
      </div>
      {editedFields[field]?<div className="note-conflict-choices" role="radiogroup" aria-label={`Qual ${FIELD_LABELS[field].toLowerCase()} manter`}>
        <label><input type="radio" name={`note-conflict-${groupId}-${field}`} value="mine" checked={choices[field]==='mine'} onChange={()=>setChoices(previous=>({...previous,[field]:'mine'}))}/>Manter meu rascunho</label>
        <label><input type="radio" name={`note-conflict-${groupId}-${field}`} value="latest" checked={choices[field]==='latest'} onChange={()=>setChoices(previous=>({...previous,[field]:'latest'}))}/>Usar versão da mesa</label>
      </div>:<p className="note-conflict-automatic">Você não editou este campo; a versão da mesa será usada.</p>}
    </fieldset>)}
    {pendingRecipients&&<fieldset className="note-conflict-field">
      <legend>Acesso à nota</legend>
      <div className="note-conflict-columns">
        <div><h3>Minha seleção</h3><p className="note-conflict-access-list">{pendingRecipients.length?pendingRecipients.join(', '):'Somente o dono da nota'}</p></div>
        <div><h3>Versão da mesa</h3><p className="note-conflict-access-list">{latest.sharedWith.length?latest.sharedWith.join(', '):'Somente o dono da nota'}</p></div>
      </div>
      <div className="note-conflict-choices" role="radiogroup" aria-label="Qual seleção de acesso manter">
        <label><input type="radio" name={`note-conflict-${groupId}-access`} value="mine" checked={choices.access==='mine'} onChange={()=>setChoices(previous=>({...previous,access:'mine'}))}/>Manter minha seleção</label>
        <label><input type="radio" name={`note-conflict-${groupId}-access`} value="latest" checked={choices.access==='latest'} onChange={()=>setChoices(previous=>({...previous,access:'latest'}))}/>Usar acesso da mesa</label>
      </div>
    </fieldset>}
    <footer><button type="button" onClick={onCancel}>Voltar sem alterar</button><button type="button" className="note-conflict-apply" onClick={()=>onApply(choices)}>Aplicar escolhas</button></footer>
    <p className="note-conflict-footnote">Aplicar escolhas atualiza apenas esta janela. Salve o conteúdo da nota e a seleção de acesso nos respectivos controles para enviá-los à mesa.</p>
  </section>;
}
