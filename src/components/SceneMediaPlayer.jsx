import {useEffect,useRef,useState} from 'react';
import {presentationPosition} from '../shared/scenePresentation.js';
import {trapDialogFocus} from './trapDialogFocus.js';
import './SceneMediaPlayer.css';

export function SceneMediaPlayer({roomId,scene,viewMode,presentation=null,serverTime,editable=false,saving=false,connection='online',onCommand}){
  const video=useRef(null),image=useRef(null),canvas=useRef(null),stage=useRef(null),latest=useRef(null),clock=useRef({offset:0,serverTime:null}),permitted=useRef(false);
  const [blocked,setBlocked]=useState(false),[failure,setFailure]=useState(''),[muted,setMuted]=useState(false),[gifPlaying,setGifPlaying]=useState(false);
  const [soundBlocked,setSoundBlocked]=useState(false);
  const [ended,setEnded]=useState(false);
  const live=!!presentation,animated=scene.media?.mime==='image/gif',source=`/api/rooms/${roomId}/scene-media/${scene.mediaId}?mapViewMode=${viewMode}`;
  latest.current=presentation;
  if(serverTime&&clock.current.serverTime!==serverTime)clock.current={serverTime,offset:serverTime-Date.now()};
  const targetTime=()=>presentationPosition(latest.current,Date.now()+clock.current.offset);
  const play=async()=>{
    const element=video.current;if(!element)return;
    if(live&&Number.isFinite(element.duration)){const desired=targetTime();element.currentTime=Math.min(desired,element.duration);if(desired>=element.duration){setEnded(true);setBlocked(false);return;}}
    try{await element.play();setBlocked(false);}catch(cause){if(cause.name==='NotAllowedError'){
      element.muted=true;setMuted(true);
      try{await element.play();setBlocked(false);setSoundBlocked(true);}catch(second){if(second.name==='NotAllowedError')setBlocked(true);else if(second.name!=='AbortError')setFailure('Não foi possível iniciar o vídeo. Toque em Tentar novamente.');}
    }else if(cause.name!=='AbortError')setFailure('Não foi possível tocar este vídeo. Use MP4 com H.264 ou WebM compatível com o navegador.');}
  };
  useEffect(()=>{
    const element=video.current;
    if(element&&element.getAttribute('src')!==source)element.setAttribute('src',source);
    return()=>{element?.pause();element?.removeAttribute('src');element?.load();};
  },[source]);
  useEffect(()=>{
    if(!live)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(animated){
      if(presentation.status==='playing'&&(!reduced||permitted.current))setGifPlaying(true);
      else {if(image.current?.naturalWidth&&canvas.current){canvas.current.width=image.current.naturalWidth;canvas.current.height=image.current.naturalHeight;canvas.current.getContext('2d').drawImage(image.current,0,0);}setGifPlaying(false);}
      if(reduced&&!permitted.current)setBlocked(true);
      return;
    }
    const sync=()=>{
      const element=video.current;if(!element||!Number.isFinite(element.duration))return;
      const desired=Math.min(targetTime(),element.duration);
      if(desired>=element.duration){element.pause();setEnded(true);setBlocked(false);if(element.currentTime!==element.duration)element.currentTime=element.duration;return;}
      setEnded(false);
      if(Math.abs(element.currentTime-desired)>.8)element.currentTime=desired;
      if(latest.current.status==='paused'){element.pause();return;}
      if(reduced&&!permitted.current){setBlocked(true);return;}
      if(element.paused&&desired<element.duration)void play();
    };
    const element=video.current;element?.addEventListener('loadedmetadata',sync);sync();
    const timer=setInterval(sync,1000);
    return()=>{clearInterval(timer);element?.removeEventListener('loadedmetadata',sync);};
  },[source,presentation?.version,animated,live]);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.current.requestFullscreen();}catch{setFailure('Tela cheia indisponível neste navegador.');}}
  const command=action=>onCommand?.(action,scene,action==='stop'?0:animated?0:video.current?.currentTime||targetTime());
  return <section className="scene-screen" ref={stage} aria-label={`Vídeo da cena ${scene.title}`}>
    {animated?<div className="scene-gif-stage">{gifPlaying&&<img ref={image} src={source} width={640} height={360} alt={scene.title} onError={()=>setFailure('Não foi possível carregar a animação. Confira a conexão e a liberação da cena.')}/>}<canvas ref={canvas} hidden={gifPlaying} role="img" aria-label={`Animação pausada: ${scene.title}`}/></div>:<video ref={video} src={source} controls={!live} playsInline preload={live?'auto':'metadata'} muted={muted} aria-label={scene.title} onError={()=>setFailure('Vídeo indisponível ou incompatível. Confira a conexão e a liberação da cena.')} />}
    {live&&<p className="scene-playback-status" role="status">{ended?'O vídeo terminou. O mestre pode recomeçar ou encerrar.':presentation.status==='paused'?'O mestre pausou a exibição.':'Cena em exibição para a mesa.'}{connection!=='online'?' Reconectando: aguardando os controles atuais do mestre.':''}</p>}
    {soundBlocked&&<p className="scene-playback-status" role="status">O vídeo começou sem som. Use “Ativar som” para ouvir.</p>}
    {blocked&&presentation?.status!=='paused'&&<div className="scene-playback-message"><p>Toque para entrar na exibição. O navegador ou sua preferência de movimento pede confirmação.</p><button type="button" onClick={()=>{permitted.current=true;if(animated){setGifPlaying(true);setBlocked(false);}else void play();}}>Assistir agora</button></div>}
    {failure&&<p className="scene-playback-message" role="alert">{failure}<button type="button" onClick={()=>{setFailure('');video.current?.load();if(animated)setGifPlaying(true);}}>Tentar novamente</button></p>}
    <div className="scene-player-controls">
      {animated&&!live&&<button type="button" onClick={()=>{if(gifPlaying&&image.current?.naturalWidth&&canvas.current){canvas.current.width=image.current.naturalWidth;canvas.current.height=image.current.naturalHeight;canvas.current.getContext('2d').drawImage(image.current,0,0);}setGifPlaying(current=>!current);}}>{gifPlaying?'Pausar animação':'Ver animação'}</button>}
      {live&&!animated&&<label className="scene-volume">Volume só para você<input type="range" min="0" max="1" step="0.05" defaultValue="1" onChange={event=>{if(video.current)video.current.volume=Number(event.target.value);}}/></label>}
      {live&&!animated&&<button type="button" aria-pressed={muted} onClick={()=>{if(video.current)video.current.muted=!muted;setMuted(value=>!value);setSoundBlocked(false);}}>{muted?'Ativar som':'Silenciar'}</button>}
      <button type="button" onClick={fullscreen}>Tela cheia</button>
      {live&&editable&&<><button type="button" disabled={saving||connection!=='online'||ended} onClick={()=>command(presentation.status==='playing'?'pause':'play')}>{presentation.status==='playing'?'Pausar para todos':'Continuar para todos'}</button><button type="button" disabled={saving||connection!=='online'} onClick={()=>onCommand('play',scene,0)}>Recomeçar para todos</button><button type="button" disabled={saving||connection!=='online'} onClick={()=>command('stop')}>Encerrar exibição</button></>}
    </div>
  </section>;
}

function LiveDialog({roomId,scene,viewMode,presentation,serverTime,editable,saving,connection,onCommand,onClose}){
  const dialog=useRef(null),heading=useRef(null);
  useEffect(()=>{const element=dialog.current,opener=document.activeElement;element.showModal();heading.current?.focus({preventScroll:true});return()=>{if(element.open)element.close();if(opener?.isConnected)opener.focus({preventScroll:true});};},[]);
  return <dialog ref={dialog} className="scene-live-dialog" aria-labelledby="scene-live-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();onClose();}}><header><div><span>Exibição da mesa</span><h2 id="scene-live-title" ref={heading} tabIndex={-1}>{scene.title}</h2></div><button type="button" onClick={onClose}>Minimizar</button></header><SceneMediaPlayer roomId={roomId} scene={scene} viewMode={viewMode} presentation={presentation} serverTime={serverTime} editable={editable} saving={saving} connection={connection} onCommand={onCommand}/><p className="scene-live-help">Minimizar fecha a exibição apenas na sua tela.{scene.media?.mime==='image/gif'?' A animação GIF reinicia ao continuar.':''}</p>{scene.body&&<details className="scene-description"><summary>Descrição da cena</summary><p>{scene.body}</p></details>}</dialog>;
}

export default function ScenePresentation({roomId,scenes,viewMode,presentation,serverTime,editable,saving,connection,onCommand}){
  const [dismissed,setDismissed]=useState(null);
  const scene=scenes.find(scene=>scene.id===presentation?.sceneId&&scene.media);
  if(!scene||presentation.status==='stopped')return null;
  return dismissed===presentation.sessionId?<aside className="scene-live-banner" aria-label="Cena em exibição"><span>{scene.title} · {presentation.status==='paused'?'pausada':'em exibição'}</span><button type="button" onClick={()=>setDismissed(null)}>Voltar à exibição</button>{editable&&<button type="button" disabled={saving||connection!=='online'} onClick={()=>onCommand('stop',scene,0)}>Encerrar exibição</button>}</aside>:<LiveDialog key={`${presentation.sessionId}:${viewMode}`} roomId={roomId} scene={scene} viewMode={viewMode} presentation={presentation} serverTime={serverTime} editable={editable} saving={saving} connection={connection} onCommand={onCommand} onClose={()=>setDismissed(presentation.sessionId)}/>;
}
