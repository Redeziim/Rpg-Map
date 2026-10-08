// Estado de cada instrumento do painel de ferramentas do mapa 2D: o que mostrar ao lado do nome e qual está em uso.
// "Em uso" é a ferramenta escolhida agora (medir, névoa, posição, rota); o resto só informa o que está ligado ou quanto há.
const count=(value,one,many)=>`${value} ${value===1?one:many}`;

export function instrumentStatuses({mapImage=false,pointCount=0,scale=1,gridVisible=false,hasScale=false,fogEnabled=false,positionsEnabled=false,routeCount=0,legendVisible=false,strokeCount=0,mapTool='pan',routeDraft=false}={}){
  return {
    imagem:{status:mapImage?'Publicada':'Sem imagem',active:false},
    pontos:{status:String(pointCount),active:false},
    controles:{status:`${Math.round(scale*100)}%`,active:false},
    medida:{status:gridVisible?'Grade visível':hasScale?'Com escala':'Sem escala',active:mapTool==='measure'},
    nevoa:{status:fogEnabled?'Ligada':'Desligada',active:mapTool==='reveal'||mapTool==='cover'},
    posicoes:{status:positionsEnabled?'Ligadas':'Desligadas',active:mapTool==='position'},
    rotas:{status:routeCount?count(routeCount,'rota','rotas'):'Nenhuma',active:!!routeDraft},
    legenda:{status:legendVisible?'Visível':'Oculta',active:false},
    exportar:{status:'',active:false},
    tracos:{status:strokeCount?String(strokeCount):'Nenhum',active:false},
  };
}

// Names of the instruments in use, for the line under the panel title.
export const INSTRUMENT_TITLES={medida:'Grade e régua',nevoa:'Névoa de guerra',posicoes:'Posições dos jogadores',rotas:'Rotas de exploração'};
export const activeInstruments=statuses=>Object.entries(statuses).filter(([,item])=>item.active).map(([id])=>INSTRUMENT_TITLES[id]).filter(Boolean);