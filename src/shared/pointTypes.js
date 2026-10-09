// Nome e cor de cada um dos cinco tipos de ponto do mapa. Eram editáveis pela "legenda do mapa", que saiu do aplicativo em 2026-10-08
// junto com as rotas de exploração e a exportação de vista (ADR 036); agora os tipos são fixos e vêm daqui.
export const defaultPointTypes=()=>[
  {type:'cidade',label:'Cidade',color:'#c7ab76'},
  {type:'dungeon',label:'Dungeon',color:'#8b0000'},
  {type:'taverna',label:'Taverna',color:'#cd853f'},
  {type:'floresta',label:'Floresta',color:'#228b22'},
  {type:'evento',label:'Evento',color:'#ff4500'}
];
