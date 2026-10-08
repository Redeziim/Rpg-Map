import {Component,createElement as h} from 'react';

// Tela de apoio quando algo quebra ao desenhar o aplicativo (por exemplo, um arquivo que não carregou). Sem isto a página ficava em branco.
// O estilo está em ErrorBoundary.css, importado por main.jsx.
export function ErrorFallback({error,onReload}){
  return h('main',{className:'error-fallback',role:'alert'},
    h('h1',null,'Algo saiu do lugar'),
    h('p',null,'Esta tela não conseguiu abrir. Suas notas e sua ficha continuam guardadas. Recarregue a página; se o problema voltar, avise o mestre.'),
    h('button',{type:'button',onClick:onReload},'Recarregar a página'),
    error?.message?h('details',null,h('summary',null,'Detalhes técnicos'),h('pre',null,String(error.message).slice(0,500))):null);
}

export default class ErrorBoundary extends Component{
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error){console.error('Falha ao desenhar a tela:',error);}
  render(){
    if(!this.state.error)return this.props.children;
    return h(ErrorFallback,{error:this.state.error,onReload:()=>window.location.reload()});
  }
}
