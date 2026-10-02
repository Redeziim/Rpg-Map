export const defaultMapScale=()=>({cellSize:50,cellDistance:5,unit:'m',offsetX:0,offsetY:0});
export function isMapScale(scale){
  return !!scale&&typeof scale==='object'&&!Array.isArray(scale)&&Object.keys(scale).sort().join(',')==='cellDistance,cellSize,offsetX,offsetY,unit'
    &&Number.isInteger(scale.cellSize)&&scale.cellSize>=4&&scale.cellSize<=2000
    &&Number.isFinite(scale.cellDistance)&&scale.cellDistance>=.000001&&scale.cellDistance<=1e9
    &&typeof scale.unit==='string'&&scale.unit===scale.unit.trim()&&scale.unit.length>=1&&scale.unit.length<=20&&!/[\u0000-\u001f\u007f]/.test(scale.unit)
    &&[scale.offsetX,scale.offsetY].every(value=>Number.isInteger(value)&&value>=0&&value<scale.cellSize);
}
export const pixelDistance=measurement=>measurement?Math.hypot(measurement.to.x-measurement.from.x,measurement.to.y-measurement.from.y):0;
export const measuredDistance=(measurement,scale)=>pixelDistance(measurement)*(scale?scale.cellDistance/scale.cellSize:1);
export function formatDistance(value,unit){return `${new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:5}).format(value)} ${unit}`;}
export const measurementLabel=(measurement,scale)=>formatDistance(measuredDistance(measurement,scale),scale?.unit||'px');
export function calibrateMapScale(scale,measurement,knownDistance){
  const pixels=pixelDistance(measurement);
  if(!pixels||!Number.isFinite(knownDistance)||knownDistance<=0)return null;
  const calibrated={...scale,cellDistance:Number((knownDistance*scale.cellSize/pixels).toPrecision(12))};
  return isMapScale(calibrated)?calibrated:null;
}
export function gridStride(scale,screenRatio){
  return 2**Math.max(0,Math.ceil(Math.log2(12/((scale?.cellSize||50)*Math.max(.001,screenRatio)))));
}
export function translateMeasurement(measurement,dx,dy,width,height){
  const left=Math.min(measurement.from.x,measurement.to.x),right=Math.max(measurement.from.x,measurement.to.x),top=Math.min(measurement.from.y,measurement.to.y),bottom=Math.max(measurement.from.y,measurement.to.y);
  dx=Math.max(-left,Math.min(width-right,dx));dy=Math.max(-top,Math.min(height-bottom,dy));
  return {...measurement,from:{x:measurement.from.x+dx,y:measurement.from.y+dy},to:{x:measurement.to.x+dx,y:measurement.to.y+dy}};
}
