const MARGIN=8;
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function noteWindowRect(position,viewport,{wide=false,docked=false}={}){
  const maxWidth=Math.max(1,viewport.width-MARGIN*2),maxHeight=Math.max(1,viewport.height-MARGIN*2);
  const width=position.expanded?maxWidth:clamp(finite(position.width,wide?1000:500),Math.min(340,maxWidth),maxWidth);
  const height=position.expanded?maxHeight:clamp(finite(position.height,wide?720:500),Math.min(320,maxHeight),maxHeight);
  return {width,height,x:docked?MARGIN:clamp(finite(position.x,MARGIN),MARGIN,viewport.width-width-MARGIN),y:docked?viewport.height-height-MARGIN:clamp(finite(position.y,MARGIN),MARGIN,viewport.height-height-MARGIN)};
}

export function resizeNoteWindow(rect,deltaWidth,deltaHeight,viewport,docked=false){
  const maxWidth=Math.max(1,viewport.width-rect.x-MARGIN);
  const maxHeight=Math.max(1,docked?rect.y+rect.height-MARGIN:viewport.height-rect.y-MARGIN);
  const width=clamp(rect.width+deltaWidth,Math.min(340,maxWidth),maxWidth);
  const height=clamp(rect.height+deltaHeight,Math.min(320,maxHeight),maxHeight);
  return {...rect,width,height,y:docked?rect.y+rect.height-height:rect.y};
}
