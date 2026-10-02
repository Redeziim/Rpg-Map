import {mapExportGeometry,routePath,routeDistanceLabel,visibleMapRoutes} from '../shared/mapExploration.js';
import {isMapPointRevealed,isMapStrokeRevealed} from '../shared/mapFog.js';
import {gridStride,measurementLabel} from '../shared/mapMeasurement.js';

// Render only the currently visible map data. No DOM snapshot or hidden room
// fields enter the export, including when an ADM uses the player view.
export async function exportMapView({canvas,viewport,dimensions,points,pointLabels,legend,showLegend,strokes,routes,fog,master,markers,members,userId,scale,grid,measurement,screenRatio,markerUnit,roomName}){
  const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const geometry=mapExportGeometry(rect(viewport),rect(canvas)),output=document.createElement('canvas'),fogLayer=document.createElement('canvas');
  output.width=geometry.width;output.height=geometry.height;
  try{
    const ctx=output.getContext('2d');if(!ctx)throw Error('O navegador não conseguiu exportar o mapa.');
    ctx.fillStyle='#151913';ctx.fillRect(0,0,output.width,output.height);
    ctx.save();ctx.translate(geometry.x,geometry.y);ctx.scale(geometry.mapWidth/dimensions.width,geometry.mapHeight/dimensions.height);
    ctx.drawImage(canvas,0,0,dimensions.width,dimensions.height);
    if(grid){
      const step=(scale?.cellSize||50)*gridStride(scale,screenRatio),offsetX=scale?.offsetX||0,offsetY=scale?.offsetY||0;
      ctx.beginPath();for(let x=offsetX;x<=dimensions.width;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,dimensions.height);}for(let y=offsetY;y<=dimensions.height;y+=step){ctx.moveTo(0,y);ctx.lineTo(dimensions.width,y);}
      ctx.strokeStyle='#d1c89e';ctx.globalAlpha=.55;ctx.lineWidth=1/Math.max(.001,screenRatio);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    if(fog?.enabled){
      fogLayer.width=output.width;fogLayer.height=output.height;const mask=fogLayer.getContext('2d');
      if(!mask)throw Error('O navegador não conseguiu preparar a névoa para exportação.');
      const left=Math.floor(geometry.x)-1,top=Math.floor(geometry.y)-1,right=Math.ceil(geometry.x+geometry.mapWidth)+1,bottom=Math.ceil(geometry.y+geometry.mapHeight)+1;
      mask.fillStyle='#151913';mask.fillRect(left,top,right-left,bottom-top);mask.globalCompositeOperation='destination-out';
      const rx=geometry.mapWidth/dimensions.width,ry=geometry.mapHeight/dimensions.height;
      for(const area of fog.areas){const x=Math.ceil(geometry.x+area.x*rx),y=Math.ceil(geometry.y+area.y*ry),endX=Math.floor(geometry.x+(area.x+area.width)*rx),endY=Math.floor(geometry.y+(area.y+area.height)*ry);if(endX>x&&endY>y)mask.fillRect(x,y,endX-x,endY-y);}
      ctx.globalAlpha=master?.62:1;ctx.drawImage(fogLayer,0,0);ctx.globalAlpha=1;
    }
    ctx.save();ctx.translate(geometry.x,geometry.y);ctx.scale(geometry.mapWidth/dimensions.width,geometry.mapHeight/dimensions.height);
    ctx.beginPath();ctx.rect(0,0,dimensions.width,dimensions.height);ctx.clip();
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const stroke of strokes.filter(stroke=>master||stroke.visibility!=='master'&&isMapStrokeRevealed(fog,stroke))){ctx.strokeStyle=stroke.color;ctx.lineWidth=4;ctx.stroke(new Path2D(stroke.path));}
    const unit=1/Math.max(.001,screenRatio),text=(label,x,y,size=14,textUnit=unit)=>{ctx.font=`600 ${size*textUnit}px Georgia,serif`;ctx.textAlign='center';ctx.lineWidth=3*textUnit;ctx.strokeStyle='#151913';ctx.fillStyle='#fff1cf';ctx.strokeText(label,x,y);ctx.fillText(label,x,y);};
    for(const [index,route] of visibleMapRoutes(routes,master,fog).filter(route=>!route.archived).entries()){
      ctx.lineWidth=4*unit;ctx.strokeStyle=route.color;ctx.setLineDash(route.status==='planned'?[9*unit,6*unit]:[]);ctx.stroke(new Path2D(routePath(route.waypoints)));ctx.setLineDash([]);
      const last=route.waypoints.at(-1),name=route.name.length>32?route.name.slice(0,31)+'…':route.name;text(`${name} · ${routeDistanceLabel(route.waypoints,scale)}`,last.x,last.y+(22+index%5*18)*unit,13);
    }
    for(const point of points.filter(point=>master||isMapPointRevealed(fog,point))){
      const entry=legend.find(item=>item.type===point.type);ctx.beginPath();ctx.arc(point.x,point.y,12*markerUnit,0,Math.PI*2);ctx.fillStyle=entry?.color||'#c7ab76';ctx.fill();ctx.lineWidth=2*markerUnit;ctx.strokeStyle='#fff1cf';ctx.stroke();text(point.name.length>28?point.name.slice(0,27)+'…':point.name,point.x,point.y-21*markerUnit,14,markerUnit);
      if(pointLabels?.[point.id]){const label=pointLabels[point.id];ctx.fillStyle='#25221c';ctx.fillRect(point.x+18*markerUnit,point.y-9*markerUnit,(label.length*6.5+12)*markerUnit,22*markerUnit);text(label,point.x+(24+label.length*3.25)*markerUnit,point.y+6*markerUnit,11,markerUnit);}
    }
    for(const [id,marker] of Object.entries(markers||{})){
      const member=members.find(member=>member.id===id);if(!member||!master&&!isMapPointRevealed(fog,marker))continue;
      ctx.beginPath();ctx.arc(marker.x,marker.y,12*unit,0,Math.PI*2);ctx.fillStyle='#151913';ctx.fill();ctx.strokeStyle=id===userId?'#f0d391':'#b6ccb3';ctx.lineWidth=2*unit;ctx.stroke();
      text(member.username.slice(0,1).toLocaleUpperCase('pt-BR'),marker.x,marker.y+5*unit,15);
      text(member.username.length>28?member.username.slice(0,27)+'…':member.username,marker.x,marker.y+30*unit,14);
    }
    if(measurement){ctx.beginPath();ctx.moveTo(measurement.from.x,measurement.from.y);ctx.lineTo(measurement.to.x,measurement.to.y);ctx.lineWidth=7*unit;ctx.strokeStyle='#151913';ctx.stroke();ctx.lineWidth=3*unit;ctx.strokeStyle='#f0d391';ctx.stroke();for(const point of [measurement.from,measurement.to]){ctx.beginPath();ctx.arc(point.x,point.y,5*unit,0,Math.PI*2);ctx.fillStyle='#f0d391';ctx.fill();ctx.lineWidth=2*unit;ctx.strokeStyle='#151913';ctx.stroke();}text(measurementLabel(measurement,scale),(measurement.from.x+measurement.to.x)/2,Math.max(18*unit,(measurement.from.y+measurement.to.y)/2-14*unit),16);}
    ctx.restore();
    if(showLegend){
      const f=geometry.factor,padding=12*f,width=Math.min(230*f,output.width-24*f),rows=[];
      ctx.font=`${14*f}px Georgia,serif`;
      for(const entry of legend){let row='';for(const word of entry.label.split(/\s+/)){const test=row?row+' '+word:word;if(row&&ctx.measureText(test).width>width-40*f){rows.push({text:row,color:entry.color});row=word;}else row=test;}rows.push({text:row,color:entry.color});}
      const height=(38+rows.length*22)*f,x=padding,y=Math.max(padding,output.height-padding-height);ctx.fillStyle='#1c1b17';ctx.fillRect(x,y,width,height);ctx.strokeStyle='#76613f';ctx.lineWidth=f;ctx.strokeRect(x,y,width,height);ctx.fillStyle='#e2c786';ctx.textAlign='left';ctx.fillText('Legenda',x+12*f,y+22*f);
      rows.forEach((row,index)=>{const baseline=y+(45+index*22)*f;ctx.fillStyle=row.color;ctx.fillRect(x+12*f,baseline-10*f,10*f,10*f);ctx.fillStyle='#eadfc9';ctx.fillText(row.text,x+30*f,baseline,width-42*f);});
    }
    const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw Error('Não foi possível gerar o PNG. Tente novamente.');
    return {blob,name:`${roomName.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'mapa'}-vista.png`,width:output.width,height:output.height};
  }finally{output.width=output.height=0;fogLayer.width=fogLayer.height=0;}
}
