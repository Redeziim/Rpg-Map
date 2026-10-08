import {useEffect,useMemo,useState} from 'react';
import {MapPin,Search,X} from 'lucide-react';
import {POINT_TYPE_ALL,countByType,filterPoints} from '../shared/pointSearch.js';
import './PointFinder.css';

// Search box, type chips and an ordered list of the points this person can see. Opening a point and showing it on the map are
// separate actions: "Ver no mapa" centers it without leaving the list.
const PAGE=40;
export default function PointFinder({points,types,query,onQuery,type,onType,linkLabel,canDelete,saving,onOpen,onShow,onDelete,foundId}){
  const typeLabels=useMemo(()=>Object.fromEntries(types.map(item=>[item.value,item.label])),[types]);
  const matches=useMemo(()=>filterPoints(points,{query,type,typeLabels}),[points,query,type,typeLabels]);
  const counts=useMemo(()=>countByType(points,{query,typeLabels}),[points,query,typeLabels]);
  const [cleared,setCleared]=useState(0),[limit,setLimit]=useState(PAGE);
  // A long list is shown in pages, so the panel keeps a single scroll instead of a list scrolling inside it.
  useEffect(()=>setLimit(PAGE),[query,type]);
  const filtering=!!query.trim()||type!==POINT_TYPE_ALL;
  const clear=()=>{onQuery('');onType(POINT_TYPE_ALL);setCleared(value=>value+1);};
  return <div className="point-finder">
    {points.length>0&&<>
      <label className="point-search">Buscar ponto
        <span><Search size={16} aria-hidden="true"/><input key={cleared} type="search" name="point-search" autoComplete="off" maxLength={80} value={query} onChange={event=>onQuery(event.target.value)} placeholder="Nome, descrição ou tipo…"/></span>
      </label>
      <div className="point-types" role="group" aria-label="Filtrar por tipo">
        <button type="button" aria-pressed={type===POINT_TYPE_ALL} onClick={()=>onType(POINT_TYPE_ALL)}>Todos <span>{counts[POINT_TYPE_ALL]||0}</span></button>
        {types.map(item=>{const Icon=item.icon;return <button key={item.value} type="button" aria-pressed={type===item.value} disabled={!counts[item.value]&&type!==item.value} onClick={()=>onType(type===item.value?POINT_TYPE_ALL:item.value)}><Icon size={14} aria-hidden="true" style={{color:item.color}}/>{item.label} <span>{counts[item.value]||0}</span></button>;})}
      </div>
      <p className="point-count" role="status" aria-live="polite">{filtering?`${matches.length} de ${points.length} ${points.length===1?'ponto':'pontos'}`:`${points.length} ${points.length===1?'ponto':'pontos'}`}{filtering&&<button type="button" className="point-clear" onClick={clear}><X size={13} aria-hidden="true"/>Limpar filtros</button>}</p>
    </>}
    {!points.length&&<p className="point-empty">{canDelete?'Nenhum ponto neste mapa ainda. Clique no mapa para adicionar o primeiro.':'Nenhum ponto revelado neste mapa ainda.'}</p>}
    {points.length>0&&!matches.length&&<p className="point-empty">Nenhum ponto encontrado{query.trim()?` para “${query.trim()}”`:''}{type!==POINT_TYPE_ALL?` em ${typeLabels[type]||'este tipo'}`:''}. Tente outras palavras ou limpe os filtros.</p>}
    <div className="points-list">{matches.slice(0,limit).map(point=>{
      const info=types.find(item=>item.value===point.type),Icon=info?.icon;
      return <div key={point.id} className={`point-item${foundId===point.id?' is-found':''}`}>
        <button type="button" className="point-info" onClick={()=>onOpen(point)}>{Icon&&<Icon size={16} style={{color:info?.color}} aria-hidden="true"/>}<div><strong>{point.name}</strong><small>{info?.label||point.type}</small>{linkLabel(point)&&<small className="point-link-count">{linkLabel(point)}</small>}</div></button>
        <button type="button" className="point-show" aria-label={`Ver ${point.name} no mapa`} title="Ver no mapa" onClick={()=>onShow(point)}><MapPin size={16} aria-hidden="true"/></button>
        {canDelete&&<button type="button" className="delete-btn" aria-label={`Excluir ponto ${point.name}`} disabled={saving} onClick={()=>onDelete(point.id)}><X size={16} aria-hidden="true"/></button>}
      </div>;})}</div>
    {matches.length>limit&&<button type="button" className="point-more" onClick={()=>setLimit(value=>value+PAGE)}>Mostrar mais {Math.min(PAGE,matches.length-limit)} de {matches.length-limit} restantes</button>}
  </div>;
}