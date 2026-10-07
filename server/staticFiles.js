import {readFile,stat} from 'node:fs/promises';
import {extname} from 'node:path';
import {brotliCompress,gzip,constants} from 'node:zlib';
import {promisify} from 'node:util';

const brotli=promisify(brotliCompress),deflate=promisify(gzip);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.gz':'application/gzip','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.obj':'text/plain; charset=utf-8','.mtl':'text/plain; charset=utf-8','.mp4':'video/mp4'};
// Text formats compress well; images and video are already compressed.
const COMPRESSIBLE=new Set(['.html','.js','.mjs','.css','.svg','.json','.obj','.mtl','.wasm']);
const MIN_BYTES=1024,CACHE_LIMIT=96*1024*1024;
// Vite names bundles name-HASH.ext in assets/. Those never change under the same name.
const HASHED=/^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:m?js|css|woff2?)$/;

export function createStaticFiles(){
  const cache=new Map();let cached=0;
  function remember(key,value){
    cache.set(key,value);cached+=value.length;
    // Oldest entries go first; the Map keeps insertion order.
    for(const [oldKey,old] of cache){if(cached<=CACHE_LIMIT||oldKey===key)break;cache.delete(oldKey);cached-=old.length;}
  }
  const pick=header=>{const accepted=String(header||'').toLowerCase().split(',').map(item=>item.split(';')[0].trim());return accepted.includes('br')?'br':accepted.includes('gzip')?'gzip':null;};
  async function send(req,res,{file,urlPath,method}){
    const info=await stat(file),extension=extname(file),type=MIME[extension]||'application/octet-stream';
    const headers={'Content-Type':type,'Cache-Control':file.endsWith('index.html')?'no-cache':HASHED.test(urlPath)?'public, max-age=31536000, immutable':'public, max-age=3600','Vary':'Accept-Encoding'};
    const encoding=COMPRESSIBLE.has(extension)&&info.size>=MIN_BYTES?pick(req.headers['accept-encoding']):null;
    if(!encoding){
      res.writeHead(200,{...headers,'Content-Length':info.size});
      if(method==='HEAD')return res.end();
      return {stream:true};
    }
    const key=`${file}:${info.size}:${info.mtimeMs}:${encoding}`;
    let body=cache.get(key);
    if(!body){
      const source=await readFile(file);
      // Quality 5 keeps first-request latency low for a 13 MB model while still beating gzip.
      body=encoding==='br'?await brotli(source,{params:{[constants.BROTLI_PARAM_QUALITY]:5,[constants.BROTLI_PARAM_SIZE_HINT]:source.length}}):await deflate(source,{level:6});
      remember(key,body);
    }
    res.writeHead(200,{...headers,'Content-Encoding':encoding,'Content-Length':body.length});
    if(method==='HEAD')return res.end();
    res.end(body);
    return {stream:false};
  }
  return {send};
}
