import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {prepareMapImage,mapImageDataUrl} from './mapImagePreparation.js';
import {trapDialogFocus} from './trapDialogFocus.js';
import './MapImageUpload.css';

const number=new Intl.NumberFormat('pt-BR'),decimal=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const size=bytes=>bytes>=1024*1024?`${decimal.format(bytes/(1024*1024))} MB`:`${decimal.format(bytes/1024)} KB`;
const dimensions=image=>`${number.format(image.width)} × ${number.format(image.height)} px`;

export default function MapImageUpload({file,initialVersion,version,initialPointsVersion,pointsVersion,hasImage,points,currentSize,strokeCount,routeCount=0,fogEnabled,hasScale,positionCount,editable,saving,error,onPublish,onClose}){
  const dialog=useRef(null),title=useRef(null),failureFocus=useRef(null),controller=useRef(null),queue=useRef(Promise.resolve()),previewUrl=useRef(null),sequence=useRef(0),publishing=useRef(false);
  const [side,setSide]=useState(4096),[prepared,setPrepared]=useState(null),[busy,setBusy]=useState(true),[failure,setFailure]=useState(''),[publishFailed,setPublishFailed]=useState(false);
  const [baseVersion,setBaseVersion]=useState(initialVersion),[basePointsVersion,setBasePointsVersion]=useState(initialPointsVersion),[confirmed,setConfirmed]=useState(false),[adjustPoints,setAdjustPoints]=useState(false),[actualSize,setActualSize]=useState(false);
  const conflict=baseVersion!==version||adjustPoints&&basePointsVersion!==pointsVersion,canAdjust=hasImage&&points.length>0&&currentSize.width>0&&currentSize.height>0;
  const shownPoints=prepared?points.map(point=>adjustPoints&&canAdjust?{...point,x:point.x*prepared.width/currentSize.width,y:point.y*prepared.height/currentSize.height}:point):[];
  const outside=prepared?shownPoints.filter(point=>point.x<0||point.y<0||point.x>prepared.width||point.y>prepared.height).length:0;
  function prepare(nextSide){
    const attempt=++sequence.current;controller.current?.abort();const task=new AbortController();controller.current=task;
    if(previewUrl.current){URL.revokeObjectURL(previewUrl.current);previewUrl.current=null;}
    setPrepared(null);setBusy(true);setFailure('');setPublishFailed(false);setConfirmed(false);
    queue.current=queue.current.catch(()=>{}).then(()=>prepareMapImage(file,nextSide,task.signal)).then(result=>{
      if(task.signal.aborted||sequence.current!==attempt)return;
      const url=URL.createObjectURL(result.blob);previewUrl.current=url;setPrepared({...result,url});
    }).catch(reason=>{if(!task.signal.aborted&&sequence.current===attempt)setFailure(reason.name==='InvalidStateError'?'Não foi possível abrir a imagem. Exporte o arquivo novamente.':reason.message);}).finally(()=>{if(sequence.current===attempt&&!task.signal.aborted)setBusy(false);});
  }
  useEffect(()=>{
    const element=dialog.current,opener=document.activeElement;element.showModal();title.current?.focus({preventScroll:true});prepare(4096);
    return()=>{sequence.current++;controller.current?.abort();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);if(element.open)element.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};
  },[]);
  useEffect(()=>{if(failure&&!busy)failureFocus.current?.focus();},[failure,busy]);
  const close=()=>{if(!saving&&!publishing.current)onClose();};
  async function publish(event){
    event.preventDefault();if(!prepared||busy||saving||publishing.current||!editable||conflict||hasImage&&!confirmed)return;
    publishing.current=true;setPublishFailed(false);setFailure('');setBusy(true);
    try{
      const image=await mapImageDataUrl(prepared.blob,controller.current.signal);
      if(!await onPublish(image,baseVersion,adjustPoints&&canAdjust,prepared,basePointsVersion)){setPublishFailed(true);setFailure('A imagem não foi publicada. Confira a conexão e o mapa atual antes de tentar novamente.');}
    }catch(reason){if(reason.name!=='AbortError')setFailure(reason.message);}finally{publishing.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} className="map-upload-dialog" aria-labelledby="map-upload-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();close();}}>
    <form onSubmit={publish} className="map-upload-sheet">
      <header><span className="map-upload-kicker">Folha de cartografia</span><h2 id="map-upload-title" ref={title} tabIndex={-1}>Confira a imagem</h2><p>{file.name}</p><button type="button" aria-label="Fechar prévia da imagem" onClick={close} disabled={saving||publishing.current}><X size={20} aria-hidden="true"/></button></header>
      <div className="map-upload-content">
        <fieldset disabled={saving||publishing.current}><legend>Resolução para a mesa</legend><label><input type="radio" autoComplete="off" name="map-image-resolution" value="2048" checked={side===2048} onChange={()=>{setSide(2048);prepare(2048);}}/>Mais leve · até 2048 px</label><label><input type="radio" autoComplete="off" name="map-image-resolution" value="4096" checked={side===4096} onChange={()=>{setSide(4096);prepare(4096);}}/>Mais detalhe · até 4096 px</label></fieldset>
        {busy&&<p role="status">{publishing.current?'Publicando imagem…':'Preparando a prévia…'}</p>}
        {prepared&&<>
          <dl className="map-upload-spec"><div><dt>Arquivo escolhido</dt><dd>{dimensions(prepared.source)} · {size(file.size)}</dd></div><div><dt>Versão para a mesa</dt><dd>{dimensions(prepared)} · {size(prepared.blob.size)}</dd></div></dl>
          <div className="map-upload-actions" role="group" aria-label="Inspecionar prévia"><button type="button" aria-pressed={!actualSize} onClick={()=>setActualSize(false)}>Ajustar à tela</button><button type="button" aria-pressed={actualSize} onClick={()=>setActualSize(true)}>Ver em tamanho real</button></div>
          <figure><div className="map-upload-preview" tabIndex={0} role="region" aria-label="Prévia da imagem; em tamanho real, use as barras ou as setas para percorrer"><div className={`map-upload-paper ${actualSize?'actual-size':''}`} style={actualSize?{width:prepared.width}:{'--upload-aspect':prepared.width/prepared.height}}><img src={prepared.url} width={prepared.width} height={prepared.height} alt={`Prévia do mapa ${file.name}`}/>{hasImage&&<svg viewBox={`0 0 ${prepared.width} ${prepared.height}`} aria-hidden="true">{shownPoints.filter(point=>point.x>=0&&point.y>=0&&point.x<=prepared.width&&point.y<=prepared.height).map(point=><circle key={point.id} cx={point.x} cy={point.y} r={Math.max(prepared.width,prepared.height)/120} fill="#c7ab76" stroke="#151913" strokeWidth={Math.max(prepared.width,prepared.height)/400}/>)}</svg>}</div></div><figcaption>{hasImage?'Os círculos mostram onde ficarão os pontos atuais. ':''}A imagem é otimizada para a mesa; GIF e WebP animados usam uma imagem fixa. Confira textos pequenos em tamanho real.</figcaption></figure>
          {canAdjust&&<label className="map-upload-check"><input type="checkbox" autoComplete="off" name="map-image-adjust-points" checked={adjustPoints} disabled={saving||publishing.current||conflict} onChange={event=>{setAdjustPoints(event.target.checked);setBasePointsVersion(pointsVersion);setConfirmed(false);}}/>Reposicionar os pontos proporcionalmente à nova imagem</label>}
          {hasImage&&!!points.length&&<p>{adjustPoints?'Os vínculos e nomes permanecem; as coordenadas acompanham a mudança de tamanho.':'Os pontos permanecem nas mesmas coordenadas em pixels. Confira o alinhamento na prévia.'}</p>}
          {!!outside&&<p className="map-upload-warning" role="status">{number.format(outside)} {outside===1?'ponto ficará':'pontos ficarão'} fora da imagem. {canAdjust?'Use Reposicionar os pontos proporcionalmente para ajustar.':'Escolha uma imagem maior para manter esses locais visíveis.'}</p>}
        </>}
        {hasImage&&<section className="map-upload-warning" aria-label="Efeito da troca"><h3>Ao trocar a imagem</h3><ul><li>{strokeCount?`${number.format(strokeCount)} ${strokeCount===1?'traço será apagado':'traços serão apagados'}.`:'A imagem atual será substituída.'}</li>{routeCount>0&&<li>{number.format(routeCount)} {routeCount===1?'rota será removida':'rotas serão removidas'}, incluindo arquivadas.</li>}{fogEnabled&&<li>A névoa será desativada e as áreas reveladas serão removidas.</li>}{hasScale&&<li>A escala e a medida local serão removidas.</li>}{positionCount>0&&<li>As posições dos jogadores serão removidas.</li>}<li>{adjustPoints?'Os pontos serão reposicionados; seus vínculos serão mantidos.':'Os pontos e seus vínculos serão mantidos.'}</li></ul><label className="map-upload-check"><input type="checkbox" autoComplete="off" name="map-image-confirm" checked={confirmed} disabled={!prepared||busy||saving||conflict||!editable} onChange={event=>setConfirmed(event.target.checked)}/>Conferi a prévia e quero trocar a imagem</label></section>}
        {conflict&&<section className="map-upload-warning"><p role="alert">{baseVersion!==version?'A imagem mudou':'Os pontos mudaram'} em outra tela. Sua prévia foi mantida. Feche para consultar o mapa atual ou revise a troca.</p><button type="button" disabled={saving||busy||!editable} onClick={()=>{setBaseVersion(version);setBasePointsVersion(pointsVersion);setConfirmed(false);setAdjustPoints(false);setPublishFailed(false);setFailure('');}}>Revisar troca com o mapa atual</button></section>}
        {!editable&&<p className="map-upload-warning" role="alert">Você precisa do modo mestre e acesso de mestre ou ADM para publicar esta imagem.</p>}
        {failure&&<p ref={failureFocus} tabIndex={-1} className="map-upload-warning" role="alert">{publishFailed&&error?error:failure}</p>}
        <p className="map-upload-limits">Até 20 MB e 32 milhões de pixels no arquivo escolhido. A versão publicada tem até 5 MB e 8 milhões de pixels. A prévia fica somente nesta tela até você publicar.</p>
      </div>
      <footer><button type="button" onClick={close} disabled={saving||publishing.current}>Cancelar</button><button type="submit" disabled={!prepared||busy||saving||!editable||conflict||hasImage&&!confirmed}>{saving||publishing.current?'Publicando…':hasImage?'Trocar imagem':'Publicar imagem'}</button></footer>
    </form>
  </dialog>;
}
