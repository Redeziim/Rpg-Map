// Exports a note exactly as the person has it open: text, board data or a picture of the board.
// Nothing here talks to the server except the image requests the board itself already makes.
const CARD_TYPES={person:'Pessoa',place:'Local',scene:'Cena',clue:'Pista'};
const CARD_W=190,CARD_H=110,IMAGE_H=190;
const stamp=()=>new Date().toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'});

export function noteFileName(title,extension){
  const base=String(title||'nota').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,60)||'nota';
  return `${base}.${extension}`;
}

export function noteToText(note,{points=[]}={}){
  const pointNames=new Map(points.map(point=>[point.id,point.name]));
  const board=note.board||{nodes:[],edges:[],strokes:[]};
  const lines=[note.title||'Nota sem nome','='.repeat(Math.min(60,(note.title||'Nota sem nome').length)),`Exportada em ${stamp()}`,''];
  lines.push(note.body?note.body.replace(/\r\n/g,'\n'):'(sem texto)');
  if(board.nodes.length||board.edges.length){
    const label=new Map(board.nodes.map((node,index)=>[node.id,node.kind==='image'?`Imagem ${index+1}`:(node.text||`Cartão ${index+1}`)]));
    lines.push('','Mapa mental','-----------','');
    board.nodes.forEach((node,index)=>{
      const parts=[node.kind==='image'?`Imagem: ${node.text||'sem legenda'}`:node.text||'(cartão vazio)'];
      if(CARD_TYPES[node.category])parts.push(`tipo: ${CARD_TYPES[node.category]}`);
      if(node.tags?.length)parts.push(`etiquetas: ${node.tags.join(', ')}`);
      if(node.pointId)parts.push(`ponto do mapa: ${pointNames.get(node.pointId)||'indisponível'}`);
      lines.push(`${index+1}. ${parts.join(' · ')}`);
    });
    if(board.edges.length){
      lines.push('','Conexões:');
      for(const edge of board.edges)lines.push(`- ${label.get(edge.from)||'?'} → ${label.get(edge.to)||'?'}${edge.label?` (${edge.label})`:''}`);
    }
  }
  return lines.join('\n')+'\n';
}

export function noteToJSON(note){
  const board=note.board||{nodes:[],edges:[],strokes:[]};
  // Images stay as references to the table's library; the file carries only this note.
  return JSON.stringify({format:'grimorio-note',formatVersion:1,exportedAt:new Date().toISOString(),title:note.title||'',body:note.body||'',board
    },null,2);
}

function wrap(context,text,width,maxLines){
  const lines=[];
  for(const paragraph of String(text||'').split('\n')){
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      const next=line?`${line} ${word}`:word;
      if(context.measureText(next).width<=width||!line)line=next;else{lines.push(line);line=word;}
    }
    lines.push(line);
  }
  if(lines.length>maxLines){lines.length=maxLines;lines[maxLines-1]=lines[maxLines-1].replace(/.{0,2}$/,'…');}
  return lines;
}
const loadImage=url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=url;});

// Draws the whole board at 1:1 (up to 3840 x 2480). Colors come from the app's tokens, so the file matches the screen.
export async function boardToPNG(board,{title='',assetUrl=()=>null}={}){
  const width=board.width||960,height=board.height||620,header=44;
  const root=getComputedStyle(document.documentElement),color=(name,fallback)=>root.getPropertyValue(name).trim()||fallback;
  const paper=color('--paper-0','#1c1b17'),card=color('--paper-2','#2c291f'),rule=color('--rule-strong','#76613f'),ink=color('--ink','#eee7d9'),soft=color('--ink-soft','#cbb58a'),gold=color('--gold-bright','#e2c786');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height+header;
  const context=canvas.getContext('2d');
  context.fillStyle=paper;context.fillRect(0,0,width,height+header);
  context.fillStyle=ink;context.font='600 20px Cinzel, Georgia, serif';context.textBaseline='middle';context.fillText(title||'Mapa mental',16,header/2);
  context.fillStyle=soft;context.font='13px "Source Sans 3", system-ui, sans-serif';context.textAlign='right';context.fillText(`Exportado em ${stamp()}`,width-16,header/2);context.textAlign='left';
  context.strokeStyle=rule;context.beginPath();context.moveTo(0,header-.5);context.lineTo(width,header-.5);context.stroke();
  context.save();context.translate(0,header);
  const nodes=new Map(board.nodes.map(node=>[node.id,node]));
  const heightOf=node=>node.kind==='image'?IMAGE_H:CARD_H;
  for(const stroke of board.strokes||[]){try{context.strokeStyle=stroke.color||gold;context.lineWidth=3;context.lineCap='round';context.lineJoin='round';context.stroke(new Path2D(stroke.path));}catch{/* a malformed path is skipped, the rest still exports */}}
  context.lineWidth=2;context.font='13px "Source Sans 3", system-ui, sans-serif';
  for(const edge of board.edges||[]){
    const from=nodes.get(edge.from),to=nodes.get(edge.to);if(!from||!to)continue;
    const ax=from.x+CARD_W/2,ay=from.y+heightOf(from)/2,bx=to.x+CARD_W/2,by=to.y+heightOf(to)/2;
    context.strokeStyle=rule;context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.stroke();
    if(edge.label){const mx=(ax+bx)/2,my=(ay+by)/2,w=context.measureText(edge.label).width+12;context.fillStyle=paper;context.fillRect(mx-w/2,my-11,w,22);context.fillStyle=soft;context.textAlign='center';context.fillText(edge.label,mx,my+1);context.textAlign='left';}
  }
  const images=await Promise.all(board.nodes.map(node=>node.kind==='image'?loadImage(node.src||assetUrl(node.assetId)||''):null));
  board.nodes.forEach((node,index)=>{
    const h=heightOf(node);
    context.fillStyle=card;context.fillRect(node.x,node.y,CARD_W,h);context.strokeStyle=node.pointId?gold:rule;context.lineWidth=node.pointId?2:1;context.strokeRect(node.x+.5,node.y+.5,CARD_W-1,h-1);
    let textTop=node.y+12;
    if(CARD_TYPES[node.category]){context.fillStyle=gold;context.font='600 12px "Source Sans 3", system-ui, sans-serif';context.fillText(CARD_TYPES[node.category],node.x+10,node.y+14);textTop+=14;}
    if(node.kind==='image'){
      const image=images[index];
      if(image){const box={x:node.x+8,y:textTop,w:CARD_W-16,h:h-(textTop-node.y)-34},scale=Math.min(box.w/image.width,box.h/image.height);context.drawImage(image,box.x+(box.w-image.width*scale)/2,box.y,image.width*scale,image.height*scale);}
      else{context.fillStyle=soft;context.font='13px "Source Sans 3", system-ui, sans-serif';context.fillText('Imagem indisponível',node.x+10,textTop+20);}
      context.fillStyle=ink;context.font='13px "Source Sans 3", system-ui, sans-serif';wrap(context,node.text,CARD_W-20,1).forEach(line=>context.fillText(line,node.x+10,node.y+h-16));
    }else{
      context.fillStyle=ink;context.font='15px "Source Sans 3", system-ui, sans-serif';
      wrap(context,node.text||'',CARD_W-20,node.tags?.length?3:4).forEach((line,row)=>context.fillText(line,node.x+10,textTop+10+row*19));
      if(node.tags?.length){context.fillStyle=soft;context.font='12px "Source Sans 3", system-ui, sans-serif';wrap(context,node.tags.map(tag=>`#${tag}`).join(' '),CARD_W-20,1).forEach(line=>context.fillText(line,node.x+10,node.y+h-14));}
    }
  });
  context.restore();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('O navegador não conseguiu gerar a imagem.')),'image/png'));
}

export function saveBlob(blob,fileName){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
