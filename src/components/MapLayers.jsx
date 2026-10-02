import {strokeVisibility} from '../shared/mapLayers.js';
import './MapLayers.css';

export function loadMapLayers(key){
  try{const stored=JSON.parse(localStorage.getItem(key));return {mine:stored?.mine!==false,others:stored?.others!==false};}catch{return {mine:true,others:true};}
}
export function MapStrokeAudience({value,onChange}){
  return <label className="map-stroke-audience">Traço para<select name="map-stroke-audience" autoComplete="off" value={value} onChange={event=>onChange(event.target.value)}><option value="table">Todos</option><option value="master">Só mestres</option></select></label>;
}
export default function MapLayers({strokes,username,settings,onChange}){
  const mine=strokes.filter(stroke=>stroke.author===username).length,others=strokes.length-mine;
  return <fieldset className="map-layers"><legend>Mostrar traços</legend>
    <label><input name="map-show-mine" type="checkbox" checked={settings.mine} onChange={event=>onChange({...settings,mine:event.target.checked})}/><span>Meus traços</span><small>{mine}</small></label>
    <label><input name="map-show-others" type="checkbox" checked={settings.others} onChange={event=>onChange({...settings,others:event.target.checked})}/><span>Traços dos outros</span><small>{others}</small></label>
    <p>Mostrar ou esconder muda apenas sua visão. Os traços continuam salvos na mesa.</p>
    {strokes.some(stroke=>strokeVisibility(stroke)==='master')&&<p className="map-layers-private">“Só mestres” fica disponível apenas para mestre e ADM no modo mestre.</p>}
  </fieldset>;
}
