// Preferência de tema, guardada só neste navegador. Funções puras para poderem ser testadas sem DOM.
// O script em index.html repete a leitura para aplicar o tema antes da primeira pintura; mantenha os dois em sintonia.
export const STORAGE_KEY='grimorio-tema';
export const DEFAULT_THEME='sombrio';
export const THEMES={
  sombrio:{label:'Sombrio',color:'#101010'},
  claro:{label:'Claro',color:'#f3ebd8'}
};
export const normalizeTheme=value=>Object.hasOwn(THEMES,value)?value:DEFAULT_THEME;
export const nextTheme=theme=>normalizeTheme(theme)==='claro'?'sombrio':'claro';
export function readTheme(storage){
  try{return normalizeTheme(storage?.getItem(STORAGE_KEY));}catch{return DEFAULT_THEME;}
}
export function saveTheme(storage,theme){
  try{storage.setItem(STORAGE_KEY,normalizeTheme(theme));return true;}catch{return false;}
}
// O tema sombrio é o padrão e não escreve atributo; só "claro" aparece em <html data-theme="claro">.
export function applyTheme(doc,theme){
  const name=normalizeTheme(theme),root=doc.documentElement;
  if(name===DEFAULT_THEME)delete root.dataset.theme;else root.dataset.theme=name;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEMES[name].color);
  return name;
}
