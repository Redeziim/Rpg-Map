// Lê uma ficha de PDF, de imagem ou de arquivo de texto (TXT) neste navegador. O arquivo nunca sai da máquina: o PDF.js lê a camada de texto e os campos
// de formulário; o Tesseract (WebAssembly, arquivos servidos por este mesmo servidor) faz o OCR de imagens e de PDFs escaneados.
export const SHEET_FILE_LIMIT=15*1024*1024;
export const SHEET_PAGE_LIMIT=8;
const IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
const OCR_BASE='/vendor/ocr';

const isPdf=file=>file.type==='application/pdf'||/\.pdf$/i.test(file.name);
const isText=file=>file.type==='text/plain'||/\.(txt|text|md)$/i.test(file.name);
const TEXT_LIMIT=400000;

export function checkSheetFile(file){
  if(!file)return 'Escolha um arquivo.';
  const pdf=isPdf(file),text=isText(file);
  if(!pdf&&!text&&!IMAGE_TYPES.includes(file.type))return 'Use um PDF, uma imagem PNG, JPEG ou WebP, ou um arquivo TXT.';
  if(file.size>SHEET_FILE_LIMIT)return text?'O arquivo de texto passa de 15 MB.':'O arquivo passa de 15 MB. Exporte o PDF com qualidade menor ou recorte a imagem.';
  if(file.size<(text?3:64))return 'O arquivo está vazio ou corrompido.';
  return '';
}

// pdf.js reports text pieces with a position. Rebuild reading order: top to bottom, then left to right; a wide gap is a new column.
function pageLines(items){
  const rows=[];
  for(const item of items){
    if(!item.str&&!item.hasEOL)continue;
    const [,, , ,x,y]=item.transform,row=rows.find(entry=>Math.abs(entry.y-y)<=Math.max(2,(item.height||8)*0.4));
    if(row)row.items.push({x,width:item.width||0,text:item.str});else rows.push({y,items:[{x,width:item.width||0,text:item.str}]});
  }
  return rows.sort((a,b)=>b.y-a.y).map(row=>{
    let line='',end=null;
    for(const piece of row.items.sort((a,b)=>a.x-b.x)){
      if(end!==null){const gap=piece.x-end;line+=gap>18?'   ':gap>1.5?' ':'';}
      // A blank item that is wide on the page is a column gap, not a word space.
      line+=!piece.text.trim()&&piece.width>12?'   ':piece.text;end=piece.x+piece.width;
    }
    return line.replace(/\s+$/,'');
  }).filter(Boolean);
}

// Three readings of the same picture: the default one gives running text; the two sparse-text modes keep the position of every
// word, which is what makes box-style sheets (value above or beside its label) readable. A failed extra reading never loses the first.
const PASSES=[['3',false],['12',true],['6',true]];
async function ocr(image,{onProgress,signal}){
  const {createWorker}=await import('tesseract.js');
  let pass=0;
  const worker=await createWorker(['por','eng'],1,{workerPath:`${OCR_BASE}/worker.min.js`,corePath:`${OCR_BASE}/core`,langPath:`${OCR_BASE}/lang`,gzip:true,
    logger:message=>{if(message.status==='recognizing text')onProgress?.(`Reconhecendo o texto (leitura ${pass} de ${PASSES.length})… ${Math.round(message.progress*100)}%`);}});
  const stop=()=>{worker.terminate().catch(()=>{});};
  signal?.addEventListener('abort',stop,{once:true});
  const aborted=()=>{if(signal?.aborted)throw new DOMException('Leitura cancelada.','AbortError');};
  let text='';const wordSets=[];
  try{
    for(const [mode,keepWords] of PASSES){
      aborted();pass++;
      try{
        await worker.setParameters({tessedit_pageseg_mode:mode});
        const {data}=await worker.recognize(image,{},{blocks:true});
        aborted();
        if(!keepWords)text=data.text||'';
        else{
          const words=(data.blocks||[]).flatMap(block=>block.paragraphs.flatMap(paragraph=>paragraph.lines.flatMap(line=>line.words))).map(word=>[word.text,word.bbox.x0,word.bbox.y0,word.bbox.x1,word.bbox.y1,word.confidence]);
          if(words.length)wordSets.push(words);
        }
      }catch(error){if(error?.name==='AbortError'||!keepWords)throw error;console.warn('Leitura extra do OCR falhou:',mode,error?.message);}
    }
    return {text,wordSets};
  }finally{signal?.removeEventListener('abort',stop);await worker.terminate().catch(()=>{});}
}
// Small screenshots lose digits in OCR; enlarge them (up to 2600 px wide) and flatten to gray.
async function prepareImage(file){
  const bitmap=await createImageBitmap(file),scale=Math.max(1,Math.min(3,2000/bitmap.width));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const context=canvas.getContext('2d');context.imageSmoothingQuality='high';context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return canvas;
}

async function readPdf(file,{onProgress,signal}){
  const [pdfjs,worker]=await Promise.all([import('pdfjs-dist/build/pdf.mjs'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
  const document_=await task.promise;
  const pages=Math.min(document_.numPages,SHEET_PAGE_LIMIT),lines=[],formFields=[],formFieldNames=[];
  try{
    for(let number=1;number<=pages;number++){
      if(signal?.aborted)throw new DOMException('Leitura cancelada.','AbortError');
      onProgress?.(`Lendo a página ${number} de ${pages}…`);
      const page=await document_.getPage(number);
      lines.push(...pageLines((await page.getTextContent()).items));
      for(const annotation of await page.getAnnotations()){
        // Check boxes and buttons carry no value worth copying.
        if(annotation.subtype!=='Widget'||!annotation.fieldName||annotation.fieldType==='Btn')continue;
        if(!formFieldNames.includes(annotation.fieldName))formFieldNames.push(annotation.fieldName);
        const value=Array.isArray(annotation.fieldValue)?annotation.fieldValue.join(', '):annotation.fieldValue;
        if(typeof value==='string'&&value.trim())formFields.push({name:annotation.fieldName,value});
      }
    }
    let scannedWords=[],text=lines.join('\n'),method=formFields.length?'campos do formulário e texto do PDF':'texto do PDF';
    // A scanned PDF has no text layer: draw each page and read it as an image.
    if(text.replace(/\s/g,'').length<40&&!formFields.length){
      const parts=[],wordSets=[];
      for(let number=1;number<=pages;number++){
        if(signal?.aborted)throw new DOMException('Leitura cancelada.','AbortError');
        onProgress?.(`Página ${number} de ${pages} é uma imagem. Reconhecendo o texto…`);
        const page=await document_.getPage(number),viewport=page.getViewport({scale:2.2}),canvas=document.createElement('canvas');
        canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
        await page.render({canvas,viewport}).promise;
        const read=await ocr(canvas,{onProgress:message=>onProgress?.(`Página ${number} de ${pages}: ${message}`),signal});parts.push(read.text);wordSets.push(...read.wordSets);
      }
      text=parts.join('\n');method='OCR do PDF escaneado';scannedWords=wordSets;
    }
    return {text,formFields,formFieldNames,pages,method,wordSets:scannedWords,truncated:document_.numPages>pages};
  }finally{task.destroy();}
}

async function readImage(file,{onProgress,signal}){
  onProgress?.('Preparando a imagem…');
  const canvas=await prepareImage(file);
  const {text,wordSets}=await ocr(canvas,{onProgress,signal});
  return {text,wordSets,formFields:[],formFieldNames:[],pages:1,method:'OCR da imagem',truncated:false};
}

async function readText(file){
  const raw=(await file.text()).replace(/^\uFEFF/,'');
  return {text:raw.slice(0,TEXT_LIMIT),wordSets:[],formFields:[],formFieldNames:[],pages:1,method:'arquivo de texto',truncated:raw.length>TEXT_LIMIT};
}

export async function readSheetFile(file,options={}){
  const problem=checkSheetFile(file);
  if(problem)throw Error(problem);
  try{return isPdf(file)?await readPdf(file,options):isText(file)?await readText(file):await readImage(file,options);}
  catch(error){
    if(error?.name==='AbortError')throw error;
    if(error?.name==='PasswordException')throw Error('Este PDF tem senha. Abra-o, salve uma cópia sem senha e tente de novo.');
    if(error?.name==='InvalidPDFException')throw Error('Não consegui abrir este PDF. Confira se o arquivo não está corrompido.');
    // The reason goes to the console for support; it never contains the sheet's content.
    console.warn('Leitura de ficha falhou:',error?.name,error?.message);
    throw Error('Não consegui ler o arquivo. Tente um PDF original em vez de uma foto, ou uma imagem mais nítida.');
  }
}
