export function markerScreenScale(zoom){
  return Math.max(.75,Math.min(1.4,1/Math.sqrt(zoom)));
}

export function mapCoordinates(clientX,clientY,rect,width,height){
  return {x:(clientX-rect.left)*width/rect.width,y:(clientY-rect.top)*height/rect.height};
}

function distanceToSegment(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/length)):0;
  return Math.hypot(x-(x1+t*dx),y-(y1+t*dy));
}

export function strokeNear(strokes,x,y,radius,canErase=()=>true){
  for(let i=strokes.length-1;i>=0;i--){
    const stroke=strokes[i];
    if(!canErase(stroke))continue;
    const numbers=stroke.path.match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
    for(let n=2;n<numbers.length;n+=2){
      if(distanceToSegment(x,y,numbers[n-2],numbers[n-1],numbers[n],numbers[n+1])<=radius)return stroke;
    }
  }
  return null;
}
