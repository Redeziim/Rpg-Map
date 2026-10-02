import {useEffect,useRef,useState} from 'react';
import {exportMapView} from './mapViewExport.js';
import {trapDialogFocus} from './trapDialogFocus.js';
import './MapViewExport.css';

function ExportPreview({image,onClose}){
  const dialog=useRef(null),heading=useRef(null);
  useEffect(()=>{const element=dialog.current,opener=document.activeElement;element.showModal();heading.current?.focus({preventScroll:true});return()=>{if(element.open)element.close();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};},[]);
  return <dialog ref={dialog} className="map-export-preview" aria-labelledby="map-export-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();onClose();}}>
    <header><span>Folha de cartografia</span><h2 id="map-export-title" ref={heading} tabIndex={-1}>Vista pronta para baixar</h2><p>{new Intl.NumberFormat('pt-BR').format(image.width)} × {new Intl.NumberFormat('pt-BR').format(image.height)} px · PNG · {image.master?'visão de mestre':'visão de jogador'}</p></header>
    <img src={image.url} width={image.width} height={image.height} alt="Prévia da vista do mapa que será baixada"/>
    <p>A vista foi capturada ao preparar o PNG. Painéis, notas e paradas ainda não salvas ficam fora da imagem.</p>
    {image.master&&<p>A visão de mestre inclui os locais e rotas privadas que estavam visíveis. Para compartilhar a visão dos jogadores, prepare o PNG no modo jogador.</p>}
    <footer><button type="button" onClick={onClose}>Fechar prévia do PNG</button><a href={image.url} download={image.name}>Baixar PNG</a></footer>
  </dialog>;
}

export default function MapViewExport({ready,master,capture}){
  const [busy,setBusy]=useState(false),[image,setImage]=useState(null),[failure,setFailure]=useState(''),alive=useRef(true),url=useRef(null),failureRef=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(url.current)URL.revokeObjectURL(url.current);};},[]);
  useEffect(()=>{if(failure)failureRef.current?.focus();},[failure]);
  const close=()=>{if(url.current){URL.revokeObjectURL(url.current);url.current=null;}setImage(null);};
  async function prepare(){
    if(!ready||busy)return;setBusy(true);setFailure('');
    try{const result=await exportMapView(capture());if(!alive.current)return;if(url.current)URL.revokeObjectURL(url.current);url.current=URL.createObjectURL(result.blob);setImage({...result,url:url.current,master});}
    catch(reason){if(alive.current)setFailure(reason.message||'Não foi possível exportar a vista. Tente novamente.');}
    finally{if(alive.current)setBusy(false);}
  }
  return <fieldset className="map-exploration map-exploration-download"><legend>Exportar vista</legend><p>PNG com imagem, pontos, rotas, traços, grade, régua, posições e legenda visíveis. O zoom e o deslocamento são mantidos.</p><button type="button" disabled={!ready||busy} onClick={prepare}>{busy?'Preparando PNG…':'Preparar PNG da vista'}</button>{busy&&<p role="status">Preparando a imagem para conferir antes de baixar…</p>}{failure&&<p ref={failureRef} tabIndex={-1} role="alert" className="map-exploration-error">{failure}</p>}{image&&<ExportPreview image={image} onClose={close}/>}</fieldset>;
}
