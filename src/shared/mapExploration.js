import {isMapStrokeRevealed} from './mapFog.js';
import {formatDistance} from './mapMeasurement.js';
import {isMapStrokeColor} from './mapStrokeColor.js';

export const defaultMapLegend=()=>[
  {type:'cidade',label:'Cidade',color:'#c7ab76'},
  {type:'dungeon',label:'Dungeon',color:'#8b0000'},
  {type:'taverna',label:'Taverna',color:'#cd853f'},
  {type:'floresta',label:'Floresta',color:'#228b22'},
  {type:'evento',label:'Evento',color:'#ff4500'}
];
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function isMapLegend(value){
  return Array.isArray(value)&&value.length===5&&value.every((entry,index)=>plain(entry)&&Object.keys(entry).sort().join(',')==='color,label,type'&&entry.type===defaultMapLegend()[index].type&&typeof entry.label==='string'&&entry.label===entry.label.trim()&&entry.label.length>=1&&entry.label.length<=40&&!/[\u0000-\u001f\u007f]/.test(entry.label)&&isMapStrokeColor(entry.color));
}
export function isMapRouteFields(value){
  return plain(value)&&Object.keys(value).sort().join(',')==='color,name,status,visibility,waypoints'&&typeof value.name==='string'&&value.name===value.name.trim()&&value.name.length>=1&&value.name.length<=120&&!/[\u0000-\u001f\u007f]/.test(value.name)&&isMapStrokeColor(value.color)&&['planned','traveled'].includes(value.status)&&['master','table'].includes(value.visibility)&&Array.isArray(value.waypoints)&&value.waypoints.length>=2&&value.waypoints.length<=100&&value.waypoints.every(point=>plain(point)&&Object.keys(point).sort().join(',')==='x,y'&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&point.x>=0&&point.y>=0&&point.x<=16000&&point.y<=16000)&&value.waypoints.some((point,index)=>index>0&&(point.x!==value.waypoints[0].x||point.y!==value.waypoints[0].y));
}
export const routePath=waypoints=>waypoints.map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' ');
export const routePixels=waypoints=>waypoints.reduce((total,point,index)=>total+(index?Math.hypot(point.x-waypoints[index-1].x,point.y-waypoints[index-1].y):0),0);
export const routeDistanceLabel=(waypoints,scale)=>formatDistance(routePixels(waypoints)*(scale?scale.cellDistance/scale.cellSize:1),scale?.unit||'px');
export function visibleMapRoutes(routes,master,fog){
  return (routes||[]).filter(route=>master||!route.archived&&route.visibility==='table'&&isMapStrokeRevealed(fog,{path:routePath(route.waypoints)}));
}
export function mapExportGeometry(viewport,artwork,maxSide=4096,maxPixels=8_000_000){
  if(!viewport.width||!viewport.height||!artwork.width||!artwork.height)throw Error('Aguarde o mapa terminar de abrir.');
  const factor=Math.min(1,maxSide/viewport.width,maxSide/viewport.height,Math.sqrt(maxPixels/(viewport.width*viewport.height)));
  return {width:Math.max(1,Math.floor(viewport.width*factor)),height:Math.max(1,Math.floor(viewport.height*factor)),factor,x:(artwork.x-viewport.x)*factor,y:(artwork.y-viewport.y)*factor,mapWidth:artwork.width*factor,mapHeight:artwork.height*factor};
}
