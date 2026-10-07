import React,{useState} from 'react';
import {mapAssetPlacement} from '../../shared/mapAssetTransfer.js';

const labels={position:'Posição',rotation:'Giro (graus)'};
const number=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});
export default function ModelPreviewPanel({preview,info,mode,onMode,onChange,onCancel,onReset,onRetry,onConfirm,disabled,blocked,editable,confirmRef,feedbackRef}){
  const [error,setError]=useState('');
  const ready=info?.id===preview.id&&info.phase==='ready';
  function commit(event,key,index){
    const input=event.currentTarget,value=Number(input.value),pose={position:[...preview.position],rotation:[...preview.rotation],scale:[...preview.scale]};
    pose[key][index]=key==='rotation'?value*Math.PI/180:value;
    try{if(input.value===''||!Number.isFinite(value))throw Error();mapAssetPlacement(pose);setError('');onChange(preview.id,pose);}
    catch{setError(key==='scale'?'Use um multiplicador entre 0,001 e 10.000.':'Use um número válido dentro dos limites da mesa.');input.value=String(+(preview[key][index]*(key==='rotation'?180/Math.PI:1)).toFixed(3));}
  }
  function commitSize(event){
    const input=event.currentTarget,value=Number(input.value),factor=value/preview.scale[0],pose={position:[...preview.position],rotation:[...preview.rotation],scale:preview.scale.map(axis=>axis*factor)};
    try{if(input.value===''||!Number.isFinite(value)||value<=0)throw Error();mapAssetPlacement(pose);setError('');onChange(preview.id,pose);}
    catch{setError('Use um tamanho proporcional dentro dos limites da mesa.');input.value=String(preview.scale[0]);}
  }
  return <section ref={feedbackRef} tabIndex={-1} className="tabletop-preview" aria-labelledby="model-preview-title">
    <p className="tabletop-preview-tag">Prévia — só você</p>
    <h3 id="model-preview-title">{preview.bundle.main.split('/').pop()}</h3>
    <p>Os outros participantes só verão o modelo depois de adicionar.</p>
    {!editable?<p role="status">A edição não está disponível no seu modo ou acesso atual. Os arquivos continuam selecionados.</p>:
      info?.id===preview.id&&info.phase==='failed'?<p role="alert">{info.message}</p>:!ready?<p role="status">Preparando a prévia…</p>:
      <p role="status">Tamanho na cena: {info.dimensions.map(number).join(' × ')} unidades.</p>}
    <small>1 unidade = 1 quadrado da grade. Tamanho inicial: maior lado de {preview.bundle.kind==='terrain'?30:5} unidades. Multiplicador 1 mantém esse tamanho.</small>
    <div className="tabletop-modes" role="group" aria-label="Ajustar a prévia">{[['translate','Mover'],['rotate','Girar'],['scale','Tamanho']].map(([value,label])=><button type="button" key={value} disabled={disabled||!ready||!editable} aria-pressed={mode===value} onClick={()=>onMode(value)}>{label}</button>)}</div>
    <p>Arraste os eixos na cena ou ajuste os números abaixo. Tamanho mantém as proporções do modelo.</p>
    <label className="tabletop-proportional-size">Tamanho proporcional<input name="previewUniformSize" type="number" inputMode="decimal" autoComplete="off" min={preview.scale[0]*.001/Math.min(...preview.scale)} max={preview.scale[0]*10000/Math.max(...preview.scale)} step="any" disabled={disabled||!ready||!editable} key={`${preview.id}-${preview.scale.join(',')}`} defaultValue={+preview.scale[0].toFixed(6)} onBlur={commitSize} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
    <small>1 mantém o tamanho inicial · 2 dobra · 0,5 reduz à metade.</small>
    {info?.id===preview.id&&info.phase==='failed'&&<><small>Para trocar ou completar os arquivos, cancele a prévia.</small><button type="button" disabled={blocked||!editable||disabled} onClick={onRetry}>Tentar prévia novamente</button></>}
    <div className="tabletop-preview-actions">
      <button type="button" disabled={disabled||!ready||!editable} onClick={()=>{setError('');onReset();}}>Restaurar ajustes</button>
      <button type="button" disabled={blocked} onClick={onCancel}>Cancelar prévia</button>
      <button ref={confirmRef} type="button" className="tabletop-preview-confirm" disabled={disabled||!ready||!editable} onClick={onConfirm}>Adicionar à mesa</button>
    </div>
    <details className="tabletop-preview-numbers"><summary>Ajustar por números</summary><div>{Object.keys(labels).map(key=><fieldset key={key} disabled={disabled||!ready||!editable}><legend>{labels[key]}</legend><div className="tabletop-vector">{['X','Y','Z'].map((axis,index)=><label key={axis}>{axis}<input name={`preview-${key}-${axis}`} aria-label={`Prévia ${key==='rotation'?'giro':key==='scale'?'tamanho':'posição'} ${axis}`} type="number" step={key==='rotation'?5:.1} min={key==='scale'?.001:undefined} max={key==='scale'?10000:undefined} inputMode="decimal" autoComplete="off" key={`${preview.id}-${key}-${index}-${preview[key][index]}`} defaultValue={+(preview[key][index]*(key==='rotation'?180/Math.PI:1)).toFixed(3)} onBlur={event=>commit(event,key,index)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>)}</div></fieldset>)}</div></details>
    {error&&<p className="tabletop-preview-error" role="alert">{error}</p>}
  </section>;
}
