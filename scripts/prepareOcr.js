// Copia para public/vendor/ocr os arquivos que o leitor de fichas serve ao navegador: o worker e o núcleo do OCR e os
// dados de idioma (português e inglês). Tudo sai deste servidor; nenhuma CDN é consultada. Roda antes de `dev` e `build`.
import {copyFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'public/vendor/ocr');
const modules=resolve(root,'node_modules');
const cores=['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js'];
const files=[
  ['tesseract.js/dist/worker.min.js','worker.min.js'],
  ...cores.map(name=>[`tesseract.js-core/${name}`,`core/${name}`]),
  ['@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz','lang/por.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','lang/eng.traineddata.gz'],
];
let copied=0;const missing=[];
for(const [from,to] of files){
  const source=resolve(modules,from),target=resolve(out,to);
  if(!existsSync(source)){missing.push(from);continue;}
  mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);copied++;
}
mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'NOTICE.txt'),'Arquivos de OCR servidos localmente.\ntesseract.js e tesseract-core: Apache-2.0.\n@tesseract.js-data (por, eng): MIT, dados do projeto tessdata_best do Tesseract (Apache-2.0).\n');
if(missing.length)console.warn(`prepareOcr: faltam ${missing.length} arquivo(s); a leitura de fichas por imagem não vai funcionar: ${missing.join(', ')}`);
else console.log(`prepareOcr: ${copied} arquivos em public/vendor/ocr`);