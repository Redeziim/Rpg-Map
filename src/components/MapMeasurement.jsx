import {forwardRef,useImperativeHandle,useRef,useState} from 'react';
import {defaultMapScale,isMapScale,pixelDistance,measurementLabel,calibrateMapScale,gridStride,translateMeasurement,formatDistance} from '../shared/mapMeasurement.js';
import {isMapPointRevealed} from '../shared/mapFog.js';
import './MapMeasurement.css';

export function loadMapMeasurementPrefs(key){
  try{return {grid:JSON.parse(localStorage.getItem(key))?.grid===true};}catch{return {grid:false};}
}
const scaleValues=scale=>Object.fromEntries(Object.entries(scale||defaultMapScale()).map(([key,value])=>[key,String(value)]));
const valuesScale=values=>({...values,unit:values.unit.trim(),cellSize:Number(values.cellSize),cellDistance:Number(values.cellDistance),offsetX:Number(values.offsetX),offsetY:Number(values.offsetY)});

function MapScaleEditor({scale,version,measurement,onSave,busy,hasImage}){
  const [draft,setDraft]=useState(null),[failure,setFailure]=useState(''),[knownDistance,setKnownDistance]=useState('');
  const values=draft?.values||scaleValues(scale),outdated=draft&&draft.version!==version;
  const edit=(key,value)=>{setDraft(current=>({version:current?.version||version,values:{...(current?.values||scaleValues(scale)),[key]:value}}));setFailure('');};
  async function submit(event){
    event.preventDefault();if(busy||outdated)return;
    const next=valuesScale(values);
    if(!isMapScale(next)){setFailure('Confira a unidade, os valores positivos e o alinhamento dentro de um quadrado.');return;}
    if(await onSave(next,draft?.version||version)){setDraft(null);setFailure('');}
    else setFailure('Não foi possível guardar a escala. Seus ajustes continuam aqui.');
  }
  function calibrate(){
    const next=calibrateMapScale(valuesScale(values),measurement,Number(knownDistance));
    if(!next){setFailure('Digite a distância real do trecho e uma unidade válida.');return;}
    setDraft({version:draft?.version||version,values:scaleValues(next)});setFailure('');
  }
  return <form className="map-scale-editor" onSubmit={submit}>
    <p>Defina o tamanho de um quadrado na imagem e a distância que ele representa.</p>
    <label>Unidade<input name="map-scale-unit" value={values.unit} onChange={event=>edit('unit',event.target.value)} maxLength={20} required autoComplete="off" spellCheck={false} placeholder="Ex.: m, km ou pés…" disabled={busy}/></label>
    <label>Tamanho do quadrado na imagem (px)<input name="map-scale-cell-size" type="number" inputMode="numeric" min="4" max="2000" step="1" required autoComplete="off" value={values.cellSize} onChange={event=>edit('cellSize',event.target.value)} disabled={busy}/></label>
    <label>Distância por quadrado<input name="map-scale-cell-distance" type="number" inputMode="decimal" min="0.000001" max="1000000000" step="any" required autoComplete="off" value={values.cellDistance} onChange={event=>edit('cellDistance',event.target.value)} disabled={busy}/></label>
    <details className="map-scale-align"><summary>Alinhar grade à imagem</summary>
      <p>Desloque o início da grade em pixels, dentro de um quadrado.</p>
      {['offsetX','offsetY'].map(key=><label key={key}>{key==='offsetX'?'Deslocamento horizontal (px)':'Deslocamento vertical (px)'}<input name={`map-scale-${key}`} type="number" inputMode="numeric" min="0" max={Math.max(0,Number(values.cellSize)-1)} step="1" required autoComplete="off" value={values[key]} onChange={event=>edit(key,event.target.value)} disabled={busy}/></label>)}
    </details>
    {measurement&&pixelDistance(measurement)>0&&<details className="map-scale-calibration"><summary>Calibrar pelo trecho medido</summary>
      <p>O trecho selecionado tem {formatDistance(pixelDistance(measurement),'px')}. Informe sua distância real para calcular a escala.</p>
      <label>Distância real do trecho ({values.unit||'unidade'})<input name="map-calibration-distance" type="number" inputMode="decimal" min="0.000001" max="1000000000" step="any" value={knownDistance} onChange={event=>setKnownDistance(event.target.value)} autoComplete="off" placeholder="Ex.: 100…" disabled={busy}/></label>
      <button type="button" disabled={busy||outdated} onClick={calibrate}>Calcular escala pelo trecho</button>
      <p>O cálculo preenche os ajustes. Revise e salve para aplicar à mesa.</p>
    </details>}
    {outdated&&<div className="map-scale-conflict" role="alert"><p>A escala mudou na mesa: {scale?`${formatDistance(scale.cellDistance,scale.unit)} por quadrado de ${scale.cellSize} px`:'sem escala definida'}. Seus ajustes foram preservados.</p><button type="button" onClick={()=>{setDraft(null);setFailure('');}}>Usar escala atual</button><button type="button" onClick={()=>setDraft(current=>({...current,version}))}>Manter meus ajustes</button></div>}
    {failure&&<p role="alert" className="map-scale-error">{failure}</p>}
    <button type="submit" disabled={busy||!hasImage||!!outdated}>{busy?'Salvando…':'Salvar escala na mesa'}</button>
  </form>;
}

export default function MapMeasurement({scale,version,measurement,canManage,tool,onTool,onClear,onSave,busy,hasImage,prefs,onPrefs,screenRatio}){
  const stride=gridStride(scale,screenRatio),size=scale?.cellSize||50;
  return <fieldset className="map-measurement"><legend>Grade e régua</legend>
    <p>{scale?`Escala: ${formatDistance(scale.cellDistance,scale.unit)} por quadrado.`:'Escala não definida. A régua mostra pixels até o mestre definir a unidade.'}</p>
    <label className="map-grid-toggle"><input name="map-show-grid" type="checkbox" checked={prefs.grid} onChange={event=>onPrefs({...prefs,grid:event.target.checked})}/><span>Mostrar grade</span></label>
    {prefs.grid&&stride>1&&<p>Para manter a leitura neste zoom, cada quadrado mostrado representa {scale?formatDistance(stride*scale.cellDistance,scale.unit):formatDistance(stride*size,'px')}.</p>}
    <button type="button" aria-pressed={tool==='measure'} disabled={!hasImage} onClick={()=>onTool('measure')}>Medir distância</button>
    {measurement&&<output className="map-measure-result" aria-label="Distância medida">{measurementLabel(measurement,scale)}<small>Em linha reta · somente na sua tela</small></output>}
    {(measurement||tool==='measure')&&<button type="button" onClick={onClear}>Limpar medida</button>}
    <p>Arraste ou toque em dois pontos. Pelo teclado: Enter inicia, setas movem o destino, Alt+setas movem o trecho, Enter fixa e Escape limpa. Shift usa passos menores.</p>
    {canManage&&<details className="map-scale-settings"><summary>Definir escala e alinhar grade</summary><MapScaleEditor scale={scale} version={version} measurement={measurement} onSave={onSave} busy={busy} hasImage={hasImage}/></details>}
  </fieldset>;
}

export function MapGrid({scale,visible,dimensions,screenRatio,id}){
  if(!visible||!dimensions.width||!dimensions.height)return null;
  const stride=gridStride(scale,screenRatio),step=(scale?.cellSize||50)*stride,stroke=1/Math.max(.001,screenRatio),path=`M ${step} 0 H 0 V ${step}`;
  return <g className="map-grid-overlay"><defs><pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse" x={scale?.offsetX||0} y={scale?.offsetY||0}><path d={path} fill="none" stroke="#161a14" strokeWidth={stroke*2} opacity=".6"/><path d={path} fill="none" stroke="#d1c89e" strokeWidth={stroke} opacity=".55"/></pattern></defs><rect width={dimensions.width} height={dimensions.height} fill={`url(#${id})`}/></g>;
}

// Only this small SVG component updates while measuring; the map composition and
// room state stay unchanged until the local measurement is fixed.
export const MapRuler=forwardRef(function MapRuler({measurement,onChange,onNotice,scale,dimensions,screenRatio,fog,canManage},ref){
  const gesture=useRef(null),[draft,setDraft]=useState(null);
  const clamp=point=>({x:Math.round(Math.max(0,Math.min(dimensions.width,point.x))),y:Math.round(Math.max(0,Math.min(dimensions.height,point.y)))});
  const update=next=>{gesture.current=next;setDraft(next?{from:next.from,to:next.to}:null);};
  function finish(){
    const current=gesture.current;if(!current)return;
    if(!pixelDistance(current)){onNotice('Escolha um segundo ponto diferente do primeiro.');return;}
    if(!canManage&&(!isMapPointRevealed(fog,current.from)||!isMapPointRevealed(fog,current.to))){update({...current,pointerId:undefined,tap:true});onNotice('Escolha dois pontos dentro das áreas reveladas.');return;}
    const result={from:current.from,to:current.to};update(null);onChange(result);onNotice(`Distância em linha reta: ${measurementLabel(result,scale)}. A medida fica só na sua tela.`);
  }
  useImperativeHandle(ref,()=>({
    start(point,pointerId){const current=gesture.current,next=clamp(point);onChange(null);update(current?.tap?{...current,pointerId,to:next}:{from:next,to:next,pointerId});},
    move(point,pointerId){const current=gesture.current;if(current&&current.pointerId===pointerId)update({...current,to:clamp(point)});},
    end(pointerId,cancelled){const current=gesture.current;if(!current||current.pointerId!==pointerId)return;if(cancelled){update(null);onNotice('Medida cancelada.');return;}if(!pixelDistance(current)){update({...current,pointerId:undefined,tap:true});onNotice('Primeiro ponto marcado. Toque no destino para medir.');}else finish();},
    cancelDraft(){update(null);},
    clear(){update(null);onChange(null);onNotice('Medida limpa.');},
    keyDown(event){
      const current=gesture.current;
      if(event.key==='Escape'){event.preventDefault();update(null);onChange(null);onNotice('Medida limpa.');return true;}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(current)finish();else{const point={x:Math.floor(dimensions.width/2),y:Math.floor(dimensions.height/2)};onChange(null);update({from:point,to:point});onNotice('Medida iniciada no centro. Setas movem o destino; Enter fixa.');}return true;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(current&&delta){event.preventDefault();const step=event.shiftKey?5:20;update(event.altKey?translateMeasurement(current,delta[0]*step,delta[1]*step,dimensions.width,dimensions.height):{...current,to:clamp({x:current.to.x+delta[0]*step,y:current.to.y+delta[1]*step})});return true;}
      return false;
    }
  }));
  const current=draft||measurement;
  if(!current||!canManage&&!draft&&(!isMapPointRevealed(fog,current.from)||!isMapPointRevealed(fog,current.to)))return null;
  const ratio=Math.max(.001,screenRatio),radius=4/ratio,label=measurementLabel(current,scale),x=(current.from.x+current.to.x)/2,y=(current.from.y+current.to.y)/2-14/ratio;
  return <g className="map-ruler-overlay" data-ruler-phase={draft?'selecting':'fixed'}>
    <line {...{x1:current.from.x,y1:current.from.y,x2:current.to.x,y2:current.to.y}} stroke="#111810" strokeWidth={5/ratio}/>
    <line className="map-ruler-line" {...{x1:current.from.x,y1:current.from.y,x2:current.to.x,y2:current.to.y}} stroke="#f0d391" strokeWidth={2/ratio} strokeDasharray={draft?`${5/ratio} ${4/ratio}`:undefined}/>
    {[current.from,current.to].map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={radius} fill="#f0d391" stroke="#111810" strokeWidth={2/ratio}/>)}
    <text className="map-ruler-label" x={x} y={Math.max(18/ratio,y)} textAnchor="middle" fill="#fff1cf" stroke="#111810" strokeWidth={4/ratio} paintOrder="stroke" fontSize={16/ratio}>{label}</text>
  </g>;
});
