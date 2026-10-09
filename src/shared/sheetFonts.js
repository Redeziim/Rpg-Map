// Tipografias que o mestre pode escolher para a ficha. Só a primeira (a do tema) vem junto com a página; as outras cinco são
// pedidas ao Google Fonts quando alguém as usa (loadSheetFont), para não pesar toda abertura do app com fontes decorativas.
// Os ids ficam salvos nas mesas e são aceitos pelo servidor; não renomeie nem remova um id existente.
export const SHEET_FONTS=Object.freeze([
  {id:'cinzel',label:'Grimório (padrão)',family:'var(--font-display)'},
  {id:'medieval',label:'MedievalSharp',family:"'MedievalSharp', cursive",google:'MedievalSharp'},
  {id:'uncial',label:'Uncial Antiqua',family:"'Uncial Antiqua', cursive",google:'Uncial+Antiqua'},
  {id:'fell',label:'IM Fell English',family:"'IM Fell English', serif",google:'IM+Fell+English:ital@0;1'},
  {id:'metamorphous',label:'Metamorphous',family:"'Metamorphous', cursive",google:'Metamorphous'},
  {id:'grenze',label:'Grenze',family:"'Grenze', serif",google:'Grenze:wght@400;600'},
]);
export const SHEET_FONT_IDS=SHEET_FONTS.map(font=>font.id);

export const sheetFontUrl=font=>font?.google?`https://fonts.googleapis.com/css2?family=${font.google}&display=swap`:null;

// Acrescenta uma folha de estilo da fonte escolhida, uma vez só. Devolve o elemento (ou null quando a fonte já vem com o tema).
export function loadSheetFont(id,doc=globalThis.document){
  const font=SHEET_FONTS.find(item=>item.id===id),url=sheetFontUrl(font);
  if(!url||!doc?.head)return null;
  const key=`sheet-font-${font.id}`,existing=doc.getElementById?.(key);
  if(existing)return existing;
  const link=doc.createElement('link');
  link.id=key;link.rel='stylesheet';link.href=url;
  doc.head.append(link);
  return link;
}
