export const emptyMapFog=()=>({enabled:false,width:0,height:0,areas:[]});

export function mapArea(from,to){
  const x=Math.min(from.x,to.x),y=Math.min(from.y,to.y);
  return {x,y,width:Math.abs(to.x-from.x),height:Math.abs(to.y-from.y)};
}

export function revealMapArea(areas,area){
  if(areas.some(old=>area.x>=old.x&&area.y>=old.y&&area.x+area.width<=old.x+old.width&&area.y+area.height<=old.y+old.height))return areas;
  return [...areas.filter(old=>!(old.x>=area.x&&old.y>=area.y&&old.x+old.width<=area.x+area.width&&old.y+old.height<=area.y+area.height)),area];
}

export function coverMapArea(areas,cut){
  return areas.flatMap(area=>{
    const left=Math.max(area.x,cut.x),top=Math.max(area.y,cut.y),right=Math.min(area.x+area.width,cut.x+cut.width),bottom=Math.min(area.y+area.height,cut.y+cut.height);
    if(left>=right||top>=bottom)return [area];
    return [
      {x:area.x,y:area.y,width:area.width,height:top-area.y},
      {x:area.x,y:bottom,width:area.width,height:area.y+area.height-bottom},
      {x:area.x,y:top,width:left-area.x,height:bottom-top},
      {x:right,y:top,width:area.x+area.width-right,height:bottom-top}
    ].filter(rect=>rect.width>0&&rect.height>0);
  });
}

export function isMapPointRevealed(fog,point){
  return !fog?.enabled||fog.areas.some(area=>point.x>=area.x&&point.x<area.x+area.width&&point.y>=area.y&&point.y<area.y+area.height);
}

// Keep whole strokes intact for author-based undo. A partially covered stroke is
// withheld rather than sending its hidden coordinates or rewriting its geometry.
export function isMapStrokeRevealed(fog,stroke){
  if(!fog?.enabled)return true;
  const points=[...stroke.path.matchAll(/[ML] (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
  if(points.length<2)return false;
  return points.every((point,index)=>{
    if(!isMapPointRevealed(fog,point))return false;
    if(!index)return true;
    const from=points[index-1],dx=point.x-from.x,dy=point.y-from.y,intervals=[];
    for(const area of fog.areas){
      let start=0,end=1;
      for(const [origin,delta,min,max] of [[from.x,dx,area.x,area.x+area.width],[from.y,dy,area.y,area.y+area.height]]){
        if(!delta){if(origin<min||origin>=max){start=1;end=0;break;}}
        else{const a=(min-origin)/delta,b=(max-origin)/delta;start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));}
      }
      if(start<=end)intervals.push([start,end]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    let reached=0;
    for(const [start,end] of intervals){if(start>reached+1e-10)return false;reached=Math.max(reached,end);if(reached>=1)return true;}
    return false;
  });
}
