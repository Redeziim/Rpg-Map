import React,{useEffect,useRef,useState} from 'react';
import TabletopScene from './TabletopScene.jsx';
import {api} from '../../api.js';
import {loadMapAsset,disposeModel} from './loadMapAsset.js';
import './TabletopMap.css';
const supported=/\.(glb|gltf|obj|fbx|png|jpe?g|webp)$/i;
const model=/\.(glb|gltf|obj|fbx)$/i;
const read=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.webkitRelativePath||file.name,data:reader.result});reader.onerror=()=>reject(Error('Não foi possível ler '+file.name));reader.readAsDataURL(file);});

export default function TabletopMap({room,mutate,editable}){
  const objects=room.state.mapObjects||[],[selected,setSelected]=useState(null),[mode,setMode]=useState('translate'),[files,setFiles]=useState([]),[main,setMain]=useState(''),[kind,setKind]=useState('terrain'),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[toolsOpen,setToolsOpen]=useState(false);
  const actions=useRef(null),pending=useRef(new Map()),timer=useRef(null),alive=useRef(true),inflight=useRef(false),permission=useRef(editable);
  permission.current=editable;
  const item=objects.find(o=>o.id===selected);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);pending.current.clear();};},[]);
  useEffect(()=>{if(!editable)pending.current.clear();},[editable]);
  const flush=async()=>{
    timer.current=null;
    if(inflight.current||!alive.current||!permission.current)return;
    const next=pending.current.entries().next().value;if(!next)return;
    const [id,patch]=next;pending.current.delete(id);inflight.current=true;
    try{await api(`/rooms/${room.id}/map-objects/${id}`,{method:'PATCH',data:patch});if(alive.current)setError('');}
    catch(e){if(alive.current)setError(e.message);}
    finally{inflight.current=false;if(alive.current&&pending.current.size)timer.current=setTimeout(flush,150);}
  };
  const transform=(id,patch)=>{pending.current.set(id,{...pending.current.get(id),...patch});if(!inflight.current){clearTimeout(timer.current);timer.current=setTimeout(flush,150);}};
  // A bounded stream shares the intermediate positions while the handle is being dragged.
  const stream=(id,patch)=>{pending.current.set(id,{...pending.current.get(id),...patch});if(!timer.current&&!inflight.current)timer.current=setTimeout(()=>{timer.current=null;flush();},180);};
  function choose(event){
    const list=Array.from(event.target.files||[]);setFiles(list);setError('');
    const first=list.find(f=>model.test(f.name))||list.find(f=>supported.test(f.name));setMain(first?(first.webkitRelativePath||first.name):'');
    event.target.value='';
  }
  async function upload(){
    if(!files.length||!main)return;setBusy(true);setError('');
    try{
      if(files.length>100||files.reduce((n,f)=>n+f.size,0)>50*1024*1024)throw Error('Selecione até 100 arquivos, somando no máximo 50 MB.');
      const bundle={files:await Promise.all(files.map(read)),main,kind};
      setStatus('Conferindo modelo e texturas…');const preview=await loadMapAsset(bundle);disposeModel(preview);
      setStatus('Enviando para a mesa…');
      const result=await api(`/rooms/${room.id}/map-assets`,{method:'POST',data:bundle,signal:AbortSignal.timeout(120000)});
      if(alive.current){setSelected(result.state.mapObjects.at(-1).id);setFiles([]);setMain('');setStatus('');}
    }catch(e){if(alive.current){setError(e.message);setStatus('');}}
    finally{if(alive.current)setBusy(false);}
  }
  async function remove(){
    pending.current.delete(item.id);
    const result=await mutate(`/map-objects/${item.id}`,{},'DELETE');if(result)setSelected(null);
  }
  return <section className="tabletop-map" aria-label="Mapa tridimensional">
    <aside id="tabletop-tools-panel" className="tabletop-tools" aria-label="Ferramentas do mapa" hidden={!toolsOpen}>
      <h2>Mesa 3D</h2><p>{editable?'Monte o terreno e posicione suas estruturas.':'Explore a cena. Mestre e ADM cuidam dos objetos.'}</p>
      {editable&&<div className="tabletop-import">
        <label>Importar como<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}><option value="terrain">Mapa / terreno</option><option value="structure">Estrutura / objeto</option></select></label>
        <label className="tabletop-file">{files.length?`${files.length} arquivo${files.length>1?'s':''} selecionado${files.length>1?'s':''} · trocar`:'Selecionar arquivos'}<input type="file" multiple disabled={busy} accept=".glb,.gltf,.obj,.mtl,.fbx,.bin,.png,.jpg,.jpeg,.webp" onChange={choose}/></label>
        <small>GLB, GLTF, OBJ, FBX ou PNG/JPG/WebP. Selecione junto os materiais, texturas e arquivos BIN. Até 50 MB.</small>
        {!!files.length&&<><label>Arquivo principal<select value={main} disabled={busy} onChange={e=>setMain(e.target.value)}>{files.filter(f=>supported.test(f.name)).map(f=><option key={f.name} value={f.webkitRelativePath||f.name}>{f.name}</option>)}</select></label><button onClick={upload} disabled={busy||!main}>{busy?'Importando…':`Adicionar à mesa (${files.length} arquivos)`}</button></>}
      </div>}
      <h3>Objetos da mesa <span>{objects.length}</span></h3>
      <div className="tabletop-objects">{objects.map(o=><button key={o.id} aria-pressed={o.id===selected} onClick={()=>setSelected(o.id)}>{o.name}</button>)}{!objects.length&&<p>{editable?'Importe seu primeiro mapa para começar.':'Aguardando o mestre importar o mapa.'}</p>}</div>
      {item&&<div className="tabletop-inspector" key={item.id}>
        <h3>{item.name}</h3><button onClick={()=>actions.current?.('fit')}>Focar objeto</button>
        {editable&&<><div className="tabletop-modes" role="group" aria-label="Editar objeto">{[['translate','Mover'],['rotate','Girar'],['scale','Escala']].map(([value,label])=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}</div>
        <p>Arraste os eixos sobre o objeto. As alterações aparecem para todos.</p>
        {['position','rotation','scale'].map((key,k)=><fieldset key={key}><legend>{['Posição','Rotação (graus)','Escala'][k]}</legend><div className="tabletop-vector">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input aria-label={`${['Posição','Rotação','Escala'][k]} ${axis}`} type="number" step={key==='rotation'?5:.1} min={key==='scale'?.001:undefined} key={`${item.id}-${key}-${i}-${item[key][i]}`} defaultValue={+(item[key][i]*(key==='rotation'?180/Math.PI:1)).toFixed(3)} onBlur={e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||e.target.value==='')return;const vector=[...item[key]];vector[i]=key==='rotation'?v*Math.PI/180:key==='scale'?Math.max(.001,v):v;transform(item.id,{[key]:vector});}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>)}</div></fieldset>)}
        <button className="tabletop-remove" onClick={remove}>Remover da cena</button></>}
      </div>}
    </aside>
    <div className="tabletop-stage">
      <div className="tabletop-camera" role="group" aria-label="Câmera do mapa"><button type="button" className="tabletop-tools-toggle" aria-expanded={toolsOpen} aria-controls="tabletop-tools-panel" onClick={()=>setToolsOpen(open=>!open)}>{toolsOpen?'Fechar ferramentas':'Ferramentas'}</button>{[['fit','Enquadrar'],['top','Vista superior'],['in','Aproximar'],['out','Afastar']].map(([action,label])=><button key={action} onClick={()=>actions.current?.(action)}>{label}</button>)}</div>
      <TabletopScene roomId={room.id} objects={objects} selected={selected} editable={editable} mode={mode} onSelect={setSelected} onTransform={stream} onStatus={setStatus} actions={actions}/>
      <p className="tabletop-help">Arraste para girar · botão direito para deslocar · roda ou pinça para zoom. Sua câmera é individual.</p>
      {(status||error)&&<div className={`tabletop-notice ${error?'has-error':''}`} role={error?'alert':'status'}>{error||status}</div>}
    </div>
  </section>;
}
