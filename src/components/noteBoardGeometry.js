// Geometria do quadro do mapa mental, sem React: o tamanho do quadro e o caminho das conexões.
export const MIN_WIDTH=960,MIN_HEIGHT=620,MAX_WIDTH=3840,MAX_HEIGHT=2480,GROW_MARGIN=80;
const round=value=>Math.round(value*10)/10;

// O quadro cresce sozinho quando um cartão chega perto da borda (até o limite do servidor), sem botão para isso.
// Os limites e os passos mantêm largura e altura inteiras e dentro do que o servidor aceita (960 a 3840 por 620 a 2480).
export function grownBoard(board,x,y){
  let width=board.width||MIN_WIDTH,height=board.height||MIN_HEIGHT;
  while(x>width-220-GROW_MARGIN&&width<MAX_WIDTH)width=Math.min(MAX_WIDTH,width+480);
  while(y>height-150-GROW_MARGIN&&height<MAX_HEIGHT)height=Math.min(MAX_HEIGHT,height+310);
  return {width,height};
}

// Conexões: curva suave de um lado de um cartão ao lado do outro, com a ponta no cartão de destino.
const NORMAL={right:[1,0],left:[-1,0],bottom:[0,1],top:[0,-1]};
export function anchor(rect,side){
  if(side==='right')return {x:rect.x+rect.w,y:rect.y+rect.h/2};
  if(side==='left')return {x:rect.x,y:rect.y+rect.h/2};
  if(side==='bottom')return {x:rect.x+rect.w/2,y:rect.y+rect.h};
  return {x:rect.x+rect.w/2,y:rect.y};
}
// a e b são {x,y,w,h}. Devolve o caminho SVG, o ponto do meio (para o rótulo) e os lados escolhidos.
export function routeBetween(a,b){
  const dx=b.x+b.w/2-(a.x+a.w/2),dy=b.y+b.h/2-(a.y+a.h/2);
  const horizontal=Math.abs(dx)/(a.w/2+b.w/2)>=Math.abs(dy)/(a.h/2+b.h/2);
  const from=horizontal?(dx>=0?'right':'left'):(dy>=0?'bottom':'top'),to=horizontal?(dx>=0?'left':'right'):(dy>=0?'top':'bottom');
  const p1=anchor(a,from),p2=anchor(b,to),pull=Math.max(36,Math.min(150,Math.hypot(p2.x-p1.x,p2.y-p1.y)*.4));
  const c1={x:p1.x+NORMAL[from][0]*pull,y:p1.y+NORMAL[from][1]*pull},c2={x:p2.x+NORMAL[to][0]*pull,y:p2.y+NORMAL[to][1]*pull};
  return {from,to,d:`M${round(p1.x)} ${round(p1.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`,mid:{x:round((p1.x+3*c1.x+3*c2.x+p2.x)/8),y:round((p1.y+3*c1.y+3*c2.y+p2.y)/8)}};
}
