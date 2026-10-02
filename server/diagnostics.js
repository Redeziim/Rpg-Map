import {randomUUID} from 'node:crypto';

const operations=new Set(['auth','room','upload','save','export','sse','other']);
const outcomes=new Set(['ok','validation','access','conflict','timeout','storage','internal','closed']);
const bytes=chunk=>typeof chunk==='string'?Buffer.byteLength(chunk):chunk?.byteLength||0;

export function diagnosticOperation(method,pathname){
  if(!pathname.startsWith('/api/'))return null;
  if(pathname.includes('/events'))return 'sse';
  if(pathname.includes('/exports'))return 'export';
  if(method==='POST'&&(pathname.includes('/map-assets')||pathname.includes('/note-assets')||pathname.includes('/dice-structures')))return 'upload';
  if(['POST','PATCH','DELETE'].includes(method)&&['/api/rooms','/api/join'].includes(pathname))return 'save';
  if(['POST','PATCH','DELETE'].includes(method)&&pathname.startsWith('/api/rooms/'))return 'save';
  if(pathname.startsWith('/api/auth/'))return 'auth';
  if(pathname.startsWith('/api/rooms'))return 'room';
  return 'other';
}

export function diagnosticOutcome(status,error){
  if(typeof error?.code==='string'&&['SQLITE_','ERR_SQLITE_'].some(prefix=>error.code.startsWith(prefix)))return 'storage';
  if(['ETIMEDOUT','ECONNRESET','EPIPE','ABORT_ERR'].includes(error?.code)||status===408||status===504)return 'timeout';
  if(status>=200&&status<400)return 'ok';
  if(status===401||status===403)return 'access';
  if(status===409)return 'conflict';
  if(status>=400&&status<500)return 'validation';
  return 'internal';
}

export function createDiagnostics({logger=line=>console.info(line),maxEventsPerMinute=60}={}){
  const counts=Object.fromEntries([...operations].map(operation=>[operation,Object.fromEntries([...outcomes].map(outcome=>[outcome,0]))]));
  let windowStart=Date.now(),emitted=0,suppressed=0;
  function record(event){
    const operation=operations.has(event.operation)?event.operation:'other';
    const outcome=outcomes.has(event.outcome)?event.outcome:'internal';
    counts[operation][outcome]++;
    const now=Date.now();
    if(now-windowStart>=60000){windowStart=now;emitted=0;suppressed=0;}
    if(emitted>=maxEventsPerMinute){suppressed++;return;}
    emitted++;
    // Reconstruct from a fixed schema: no request URL, body, cookie, filename or exception text.
    const line=JSON.stringify({event:'api',requestId:event.requestId,operation,outcome,
      status:Number.isInteger(event.status)?event.status:0,
      durationMs:Math.max(0,Math.round(event.durationMs||0)),
      requestBytes:Math.max(0,Math.round(event.requestBytes||0)),
      responseBytes:Math.max(0,Math.round(event.responseBytes||0))});
    try{logger(line);}catch{}
  }
  function observe(req,res){
    const pathname=req.url?.split('?')[0]||'';
    const operation=diagnosticOperation(req.method,pathname);
    if(!operation)return null;
    const requestId=randomUUID(),started=performance.now();
    let responseBytes=0,recorded=false,error=null;
    res.setHeader('X-Request-ID',requestId);
    req.diagnosticBytes=0;
    const write=res.write.bind(res),end=res.end.bind(res);
    res.write=(chunk,...args)=>{responseBytes+=bytes(chunk);return write(chunk,...args);};
    res.end=(chunk,...args)=>{responseBytes+=bytes(chunk);return end(chunk,...args);};
    const finish=(closed=false)=>{
      if(recorded)return;
      recorded=true;
      const status=res.statusCode;
      const outcome=closed?'closed':diagnosticOutcome(status,error);
      if(operation==='upload'||operation==='save'||operation==='sse'||outcome!=='ok')record({requestId,operation,outcome,status,durationMs:performance.now()-started,requestBytes:req.diagnosticBytes,responseBytes});
      else counts[operation][outcome]++;
    };
    res.once('finish',()=>finish());
    res.once('close',()=>finish(true));
    return {requestId,failed:cause=>{error=cause;},streamFailure:cause=>record({requestId,operation:'sse',outcome:diagnosticOutcome(cause?.status||500,cause),status:cause?.status||500,durationMs:performance.now()-started,requestBytes:req.diagnosticBytes,responseBytes})};
  }
  return {observe,record,snapshot:()=>({counts:structuredClone(counts),suppressed})};
}
