import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
import {createApplication} from '../server/app.js';

test('static files are compressed by negotiation, cached by name and never mangled',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'grimorio-static-')),dist=join(directory,'dist');
  mkdirSync(join(dist,'assets','tray'),{recursive:true});
  const script='export const linha="Grimório 🎲";\n'.repeat(400),model='v 1.0 2.0 3.0\n'.repeat(2000),png=Buffer.alloc(4096,7);
  writeFileSync(join(dist,'index.html'),'<!doctype html><title>teste</title>'+' '.repeat(2000));
  writeFileSync(join(dist,'assets','index-AbCd1234.js'),script);
  writeFileSync(join(dist,'assets','tray','base.obj'),model);
  writeFileSync(join(dist,'assets','pixel.png'),png);
  writeFileSync(join(dist,'assets','tiny.js'),'x=1');
  writeFileSync(join(dist,'assets','pdf.worker.min-AbCd1234.mjs'),script);writeFileSync(join(dist,'assets','lang.traineddata.gz'),png);
  let app;
  try{
    app=createApplication({dbPath:join(directory,'static.sqlite'),distPath:dist,exportRoot:join(directory,'exports'),rateLimit:false,diagnosticsLogger:()=>{}});
    await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
    const base=`http://127.0.0.1:${app.server.address().port}`;
    // fetch would decode for us; ask for raw bytes through a plain request.
    const raw=async(path,{encoding,method='GET'}={})=>{const response=await fetch(base+path,{method,headers:{'Accept-Encoding':encoding??'identity'}});return {status:response.status,headers:response.headers,body:Buffer.from(await response.arrayBuffer())};};
    const identity=await raw('/assets/index-AbCd1234.js');
    assert.equal(identity.body.toString(),script);assert.equal(identity.headers.get('content-encoding'),null);assert.equal(identity.headers.get('vary'),'Accept-Encoding');
    assert.equal(identity.headers.get('cache-control'),'public, max-age=31536000, immutable');
    const zipped=await raw('/assets/index-AbCd1234.js',{encoding:'gzip'});
    // Node's fetch decodes gzip itself; the decoded body must still equal the source and the header must say what was sent.
    assert.equal(zipped.body.toString(),script);
    const sizes=await (await fetch(base+'/assets/tray/base.obj',{headers:{'Accept-Encoding':'br'}})).arrayBuffer();assert.equal(Buffer.from(sizes).toString(),model);
    // Check the wire size with a raw socket request, since fetch hides Content-Length after decoding.
    const {request}=await import('node:http');
    const wire=(path,encoding)=>new Promise((done,fail)=>{const req=request(base+path,{headers:{'Accept-Encoding':encoding}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>done({headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',fail);req.end();});
    const gz=await wire('/assets/index-AbCd1234.js','gzip,deflate'),br=await wire('/assets/tray/base.obj','br, gzip'),none=await wire('/assets/tray/base.obj','identity');
    assert.equal(gz.headers['content-encoding'],'gzip');assert.equal(gunzipSync(gz.body).toString(),script);assert.ok(gz.body.length<script.length/5);assert.equal(Number(gz.headers['content-length']),gz.body.length);
    assert.equal(br.headers['content-encoding'],'br');assert.equal(brotliDecompressSync(br.body).toString(),model);assert.ok(br.body.length<model.length/10);
    assert.equal(none.headers['content-encoding'],undefined);assert.equal(none.body.toString(),model);
    // Images and tiny files are sent as they are, and an unhashed asset is not marked immutable.
    const image=await wire('/assets/pixel.png','gzip, br'),tiny=await wire('/assets/tiny.js','gzip'),unhashed=await wire('/assets/tray/base.obj','gzip');
    assert.equal(image.headers['content-encoding'],undefined);assert.deepEqual(image.body,png);assert.equal(tiny.headers['content-encoding'],undefined);assert.equal(unhashed.headers['cache-control'],'public, max-age=3600');
    // Module workers (PDF.js) need a JavaScript MIME type, and a gzip data file must be sent as it is, without a content encoding.
    const worker=await wire('/assets/pdf.worker.min-AbCd1234.mjs','br'),data=await wire('/assets/lang.traineddata.gz','gzip, br');
    assert.equal(worker.headers['content-type'],'text/javascript');assert.equal(worker.headers['content-encoding'],'br');assert.equal(worker.headers['cache-control'],'public, max-age=31536000, immutable');
    assert.equal(data.headers['content-encoding'],undefined);assert.equal(data.headers['content-type'],'application/gzip');assert.deepEqual(data.body,png);
    // The entry page is never cached; a HEAD request has headers and no body; unknown paths fall back to the entry page; traversal stays blocked.
    const page=await wire('/qualquer/rota','gzip');assert.equal(page.headers['cache-control'],'no-cache');assert.match(gunzipSync(page.body).toString(),/<title>teste<\/title>/);
    const head=await raw('/assets/index-AbCd1234.js',{encoding:'gzip',method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);
    const escaped=await wire('/%2e%2e/%2e%2e/package.json','identity'),encoded=await wire('/assets/..%2f..%2f..%2fpackage.json','identity');
    for(const attempt of [escaped,encoded])assert.match(attempt.body.toString(),/<title>teste<\/title>/);
    assert.equal((await raw('/assets/index-AbCd1234.js',{method:'POST'})).status,405);
  }finally{if(app){const done=new Promise(resolve=>app.server.once('close',resolve));app.close();app.server.closeAllConnections();await done;}const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
