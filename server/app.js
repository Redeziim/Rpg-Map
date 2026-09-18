import {tower} from './structurePhysics.js';
import {validateStructure} from './structures.js';
import {validateMapAsset,validateMapTransform} from './mapAssets.js';
import { createTrayRoll } from './tray.js';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
const scrypt = promisify(scryptCallback);
const digest = s => createHash('sha256').update(s).digest('hex');
const SESSION_MS = 7 * 86400000;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const safeKeys = x => {
  if (!x || typeof x !== 'object') return;
  for (const [k,v] of Object.entries(x)) {
    if (['__proto__','constructor','prototype'].includes(k)) fail(400,'Nome de campo inválido.');
    safeKeys(v);
  }
};
const string = (value, max, label, min=0) => {
  if(typeof value!=='string'||value.length<min||value.length>max) fail(400,`${label}: use entre ${min} e ${max} caracteres.`);
  return value;
};
const image = value => value===null || (typeof value==='string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value));
const initialState = () => ({points:[],mapImage:null,sheetFields:[],sheetFont:'cinzel',masterNotes:'',playerSheets:{},statusBarsData:{}});
async function body(req,maxBytes=10*1024*1024) {
  if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Envie JSON.');
  let size=0,chunks=[];
  for await (const chunk of req) { size+=chunk.length;if(size>maxBytes)fail(413,'Arquivo muito grande para esta operação.');chunks.push(chunk); }
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'JSON inválido.');}
  if(!object(value))fail(400,'Dados inválidos.');safeKeys(value);return value;
}

export function createApplication({dbPath=resolve('data/grimorio.sqlite'),distPath=resolve('dist'),production=false,publicOrigin='',rateLimit=true}={}) {
  if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
  const db=new DatabaseSync(dbPath);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS members(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('admin','master','player')),PRIMARY KEY(room_id,user_id));
    CREATE TABLE IF NOT EXISTS dice_structures(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),name TEXT NOT NULL,mesh TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS map_assets(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),bundle TEXT NOT NULL,bytes INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('master','player')),expires INTEGER NOT NULL,created_by TEXT NOT NULL REFERENCES users(id));
  `);
  const query=(sql,...params)=>db.prepare(sql).get(...params);
  const all=(sql,...params)=>db.prepare(sql).all(...params);
  const run=(sql,...params)=>db.prepare(sql).run(...params);
  const transaction=fn=>{if(db.isTransaction)return fn();db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const clients=new Set(),limits=new Map(),trayRolls=new Map();
  function limit(key,max){
    if(!rateLimit)return;
    const now=Date.now(),entry=limits.get(key);
    if(!entry||entry.until<now){limits.set(key,{count:1,until:now+60000});return;}
    if(++entry.count>max)fail(429,'Muitas tentativas. Aguarde um minuto.');
  }
  function auth(req){
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('grimorio_session='))?.slice(17);
    if(!token)fail(401,'Entre na sua conta.');
    const user=query('SELECT u.id,u.username,s.expires,s.token_hash FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?',digest(token),Date.now());
    if(!user)fail(401,'Sua sessão expirou. Entre novamente.');return user;
  }
  function membership(roomId,userId){
    const member=query('SELECT * FROM members WHERE room_id=? AND user_id=?',roomId,userId);
    if(!member)fail(403,'Você não participa desta mesa.');return member;
  }
  const privileged=m=>{if(!['master','admin'].includes(m.role))fail(403,'Esta ação é exclusiva do mestre ou ADM.');};
  const admin=m=>{if(m.role!=='admin')fail(403,'Somente o ADM pode fazer isso.');};
  function snapshot(roomId,userId){
    const m=membership(roomId,userId),room=query('SELECT * FROM rooms WHERE id=?',roomId);
    const state=JSON.parse(room.state),members=all('SELECT u.id,u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE room_id=? ORDER BY u.username',roomId);
    const usernames=new Set(members.map(u=>u.username));
    const groupBars=Object.fromEntries(members.map(u=>[u.username,{...(state.statusBarsData[u.username]||{avatar:null,bars:[]}),bars:[...(state.statusBarsData[u.username]?.bars||[]),...state.sheetFields.filter(f=>f.type==='status').map((f,i)=>({id:f.id,label:f.label,color:['#a84d51','#c8a65e','#ddd0b2'][i%3],...(state.playerSheets[u.username]?.values?.[f.id]||{current:0,max:0})}))]}]));
    state.playerSheets=Object.fromEntries(Object.entries(state.playerSheets).filter(([name])=>usernames.has(name)&&(m.role!=='player'||members.find(u=>u.id===userId)?.username===name)));
    state.statusBarsData=Object.fromEntries(Object.entries(state.statusBarsData).filter(([name])=>usernames.has(name)));
    if(m.role==='player')delete state.masterNotes;
    return {id:room.id,name:room.name,ownerId:room.owner_id,role:m.role,revision:room.revision,members,state,groupBars,diceStructures:all('SELECT id,name FROM dice_structures WHERE room_id=?',roomId),trayRoll:trayRolls.get(roomId)||null,serverTime:Date.now()};
  }
  function send(client){
    try{
      if(!query('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?',client.tokenHash,Date.now()))throw Error('session');
      client.res.write(`event: room\ndata: ${JSON.stringify(snapshot(client.roomId,client.userId))}\n\n`);
    }catch{client.res.write('event: revoked\ndata: {}\n\n');client.res.end();clients.delete(client);}
  }
  const broadcast=roomId=>{for(const c of clients)if(c.roomId===roomId)send(c);};
  function saveState(roomId,state){
    const json=JSON.stringify(state);if(Buffer.byteLength(json)>20*1024*1024)fail(413,'A mesa atingiu o limite de 20 MB. Reduza as imagens.');
    run('UPDATE rooms SET state=?,revision=revision+1 WHERE id=?',json,roomId);
  }
  function addMember(roomId,userId,role){
    if(query('SELECT 1 FROM members WHERE room_id=? AND user_id=?',roomId,userId))fail(409,'Esta pessoa já participa da mesa.');
    const username=query('SELECT username FROM users WHERE id=?',userId).username;
    transaction(()=>{
      run('INSERT INTO members VALUES(?,?,?)',roomId,userId,role);
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      state.playerSheets[username] ||= {values:{},extraFields:[],observations:''};state.statusBarsData[username] ||= {avatar:null,bars:[]};saveState(roomId,state);
    });
  }
  const timer=setInterval(()=>{
    run('DELETE FROM sessions WHERE expires<?',Date.now());
    for(const [key,v] of limits)if(v.until<Date.now())limits.delete(key);
    for(const client of clients)send(client);
  },20000);timer.unref();
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function route(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    const url=new URL(req.url,'http://server'),path=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
    if(path[0]!=='api'){
      if(!['GET','HEAD'].includes(method))fail(405,'Método inválido.');
      let file=resolve(distPath,'.'+url.pathname);
      if(!file.startsWith(resolve(distPath)+sep)&&file!==resolve(distPath))fail(403,'Caminho inválido.');
      if(!existsSync(file)||!statSync(file).isFile())file=resolve(distPath,'index.html');
      if(!existsSync(file))fail(404,'Execute npm run build para gerar o site.');
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});
      if(method==='HEAD')res.end();else createReadStream(file).pipe(res);return;
    }
    if(method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true});
    const ip=req.socket.remoteAddress || 'local';limit(`api:${ip}`,600);
    if(!['GET','HEAD'].includes(method)){
      const allowed=publicOrigin || `http://${req.headers.host}`;
      if(req.headers.origin && req.headers.origin!==allowed)fail(403,'Origem não autorizada.');
      if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Origem não autorizada.');
    }
    // Read the entire payload before checking current permissions; slow requests must not retain revoked access.
    if(path[3]==='map-assets'&&method==='POST')privileged(membership(path[2],auth(req).id));
    const requestBody=['POST','PATCH'].includes(method)&&url.pathname!=='/api/auth/logout'?await body(req,path[3]==='map-assets'?72*1024*1024:10*1024*1024):{};
    if(path[1]==='auth'&&['login','register'].includes(path[2])&&method==='POST'){
      limit(`auth:${ip}`,12);const data=requestBody;
      const username=string(data.username,30,'Usuário',3).trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username)||['constructor','prototype','__proto__'].includes(username))fail(400,'Use 3–30 letras sem acento, números, ponto, hífen ou sublinhado.');
      const password=string(data.password,128,'Senha',8);limit(`user:${username}`,12);
      let user=query('SELECT * FROM users WHERE username=?',username);
      if(path[2]==='register'){
        if(user)fail(409,'Esse nome de usuário já está em uso.');
        const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
        user={id:randomUUID(),username,password_hash:hash,salt};
        try{run('INSERT INTO users VALUES(?,?,?,?)',user.id,username,hash,salt);}catch{fail(409,'Esse nome de usuário já está em uso.');}
      }else{
        const hash=await scrypt(password,user?.salt || 'invalid-user-salt',64);
        if(!user||!timingSafeEqual(hash,Buffer.from(user.password_hash,'hex')))fail(401,'Usuário ou senha incorretos.');
      }
      const token=randomBytes(32).toString('hex');run('INSERT INTO sessions VALUES(?,?,?)',digest(token),user.id,Date.now()+SESSION_MS);
      res.setHeader('Set-Cookie',`grimorio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS/1000}${production?'; Secure':''}`);
      return json(res,200,{id:user.id,username:user.username});
    }
    const user=auth(req);
    if(url.pathname==='/api/auth/me'&&method==='GET')return json(res,200,{id:user.id,username:user.username});
    if(url.pathname==='/api/auth/logout'&&method==='POST'){
      run('DELETE FROM sessions WHERE token_hash=?',user.token_hash);res.setHeader('Set-Cookie',`grimorio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${production?'; Secure':''}`);
      for(const c of clients)if(c.tokenHash===user.token_hash){c.res.end();clients.delete(c);}
      return json(res,200,{ok:true});
    }
    if(path[1]==='rooms'&&path.length===2){
      if(method==='GET')return json(res,200,all('SELECT r.id,r.name,m.role,(SELECT count(*) FROM members x WHERE x.room_id=r.id) AS memberCount FROM rooms r JOIN members m ON r.id=m.room_id WHERE m.user_id=? ORDER BY r.rowid DESC',user.id));
      if(method==='POST'){
        const data=requestBody,name=string(data.name,80,'Nome da mesa',1).trim();if(!name)fail(400,'Informe o nome da mesa.');
        if(query('SELECT count(*) AS n FROM rooms WHERE owner_id=?',user.id).n>=30)fail(400,'Limite de 30 mesas por conta.');
        const id=randomUUID();transaction(()=>{run('INSERT INTO rooms(id,name,owner_id,state) VALUES(?,?,?,?)',id,name,user.id,JSON.stringify(initialState()));addMember(id,user.id,'admin');});
        return json(res,201,snapshot(id,user.id));
      }
    }
    if(url.pathname==='/api/join'&&method==='POST'){
      limit(`join:${user.id}`,20);const data=requestBody;const code=string(data.code,100,'Código',10).trim();
      const invite=query('SELECT * FROM invites WHERE token_hash=? AND expires>?',digest(code),Date.now());if(!invite)fail(404,'Convite inválido, revogado ou expirado.');
      if(!query('SELECT 1 FROM members WHERE room_id=? AND user_id=?',invite.room_id,user.id))addMember(invite.room_id,user.id,invite.role);
      broadcast(invite.room_id);return json(res,200,snapshot(invite.room_id,user.id));
    }
    if(path[1]!=='rooms'||!path[2])fail(404,'Rota não encontrada.');
    const roomId=path[2],m=membership(roomId,user.id);
    if(path.length===3&&method==='GET')return json(res,200,snapshot(roomId,user.id));
    if(path[3]==='map-assets'){
      if(method==='GET'&&path[4]){
        const asset=query('SELECT bundle FROM map_assets WHERE id=? AND room_id=?',path[4],roomId);
        if(!asset)fail(404,'Modelo não encontrado.');
        return json(res,200,JSON.parse(asset.bundle));
      }
      if(method==='POST'&&path.length===4){
        privileged(m);limit(`map-upload:${user.id}`,12);
        const bundle=validateMapAsset(requestBody),state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
        const objects=state.mapObjects||[];
        if(objects.length>=100)fail(400,'Limite de 100 objetos por mesa.');
        const used=query('SELECT COALESCE(SUM(bytes),0) AS size FROM map_assets WHERE room_id=?',roomId).size;
        if(used+bundle.bytes>300*1024*1024)fail(413,'Limite de 300 MB de modelos por mesa.');
        const id=randomUUID();
        state.mapObjects=[...objects,{id,assetId:id,name:bundle.main.split('/').pop().slice(0,120),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}];
        transaction(()=>{run('INSERT INTO map_assets VALUES(?,?,?,?)',id,roomId,JSON.stringify(bundle),bundle.bytes);saveState(roomId,state);});
        broadcast(roomId);return json(res,201,snapshot(roomId,user.id));
      }
    }
    if(path[3]==='map-objects'&&path[4]&&['PATCH','DELETE'].includes(method)){
      privileged(m);const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      const item=state.mapObjects?.find(o=>o.id===path[4]);if(!item)fail(404,'Objeto não encontrado.');
      if(method==='PATCH')Object.assign(item,validateMapTransform(requestBody));
      else state.mapObjects=state.mapObjects.filter(o=>o.id!==item.id);
      transaction(()=>{saveState(roomId,state);if(method==='DELETE')run('DELETE FROM map_assets WHERE id=? AND room_id=?',item.assetId,roomId);});
      broadcast(roomId);return json(res,200,snapshot(roomId,user.id));
    }
    if(path[3]==='events'&&method==='GET'){
      if([...clients].filter(c=>c.userId===user.id).length>=10)fail(429,'Muitas salas abertas. Feche algumas abas.');
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      const client={roomId,userId:user.id,tokenHash:user.token_hash,res};clients.add(client);send(client);res.on('close',()=>clients.delete(client));return;
    }
    if(path[3]==='dice-structures'){
      if(method==='GET'&&path[4]){const item=query('SELECT mesh FROM dice_structures WHERE id=? AND room_id=?',path[4],roomId);if(!item)fail(404,'Estrutura não encontrada.');return json(res,200,JSON.parse(item.mesh));}
      if(method==='POST'&&path.length===4){
        limit(`structure:${user.id}`,10);const data=validateStructure(requestBody);
        if(query('SELECT count(*) AS n FROM dice_structures WHERE room_id=?',roomId).n>=10)fail(400,'Limite de 10 estruturas por mesa.');
        const id=randomUUID();run('INSERT INTO dice_structures VALUES(?,?,?,?)',id,roomId,data.name,JSON.stringify(data));broadcast(roomId);return json(res,201,{id,...snapshot(roomId,user.id),structureId:id});
      }
    }
    if(path[3]==='tray-rolls'&&method==='POST'){
      const previous=trayRolls.get(roomId);
      if(previous&&Date.now()<previous.startedAt+previous.duration)fail(409,'Aguarde os dados da mesa pararem.');
      limit(`tray:${user.id}`,30);
      const structureId=requestBody.structureId||'tray';let structure=null;
      if(structureId==='tower')structure=tower;
      else if(structureId!=='tray'){const asset=query('SELECT mesh FROM dice_structures WHERE id=? AND room_id=?',structureId,roomId);if(!asset)fail(404,'Estrutura não encontrada nesta mesa.');structure=JSON.parse(asset.mesh);}
      const roll=createTrayRoll(user.username,requestBody.terms,requestBody.skinId,requestBody.gesture,requestBody.physics,structure);
      roll.structureId=structureId;
      trayRolls.set(roomId,roll);broadcast(roomId);return json(res,201,snapshot(roomId,user.id));
    }
    if(path[3]==='state'&&method==='PATCH'){
      privileged(m);const patch=requestBody;const allowed=['points','mapImage','sheetFields','sheetFont','masterNotes'];
      if(Object.keys(patch).some(k=>!allowed.includes(k)))fail(400,'Campo de mesa inválido.');
      if('points'in patch && (!Array.isArray(patch.points)||patch.points.length>1000||patch.points.some(p=>!object(p)||typeof p.name!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.y))))fail(400,'Pontos inválidos.');
      if('mapImage'in patch&&!image(patch.mapImage))fail(400,'Use imagem PNG, JPEG, GIF ou WebP.');
      if('sheetFields'in patch && (!Array.isArray(patch.sheetFields)||patch.sheetFields.length>200||patch.sheetFields.some(f=>!object(f)||typeof f.id!=='string'||typeof f.label!=='string'||!['text','number','textarea','image','list','checklist','formula','attack','status'].includes(f.type))))fail(400,'Modelo de ficha inválido.');
      if(patch.sheetFields){
        const ids=new Set();
        for(const field of patch.sheetFields){
          string(field.id,100,'Identificador',1);string(field.label,200,'Nome do campo',1);
          if(ids.has(field.id))fail(400,'Campos duplicados.');ids.add(field.id);
          if(field.tab!==undefined)string(field.tab,100,'Categoria');
          if(field.type==='formula')string(field.formula,1000,'Fórmula');
        }
      }
      if('sheetFont'in patch&&!['cinzel','medieval','uncial','fell','metamorphous','grenze'].includes(patch.sheetFont))fail(400,'Fonte inválida.');
      if('masterNotes'in patch)string(patch.masterNotes,50000,'Notas');
      const state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);saveState(roomId,{...state,...patch});broadcast(roomId);return json(res,200,snapshot(roomId,user.id));
    }
    if(['sheets','profiles'].includes(path[3])&&path[4]&&method==='PATCH'){
      const target=query('SELECT u.* FROM users u JOIN members m ON m.user_id=u.id WHERE m.room_id=? AND u.username=?',roomId,path[4]);
      if(!target)fail(404,'Jogador não encontrado nesta mesa.');
      if(m.role!=='admin'&&(m.role!=='player'||target.id!==user.id))fail(403,'Você pode editar apenas a sua ficha como jogador.');
      const patch=requestBody,state=JSON.parse(query('SELECT state FROM rooms WHERE id=?',roomId).state);
      if(path[3]==='sheets'){
        if(Object.keys(patch).some(k=>!['values','observations'].includes(k)))fail(400,'Jogadores podem preencher campos e observações, sem alterar o modelo.');
        if('observations'in patch)string(patch.observations,50000,'Observações');
        if('values'in patch){
          if(!object(patch.values))fail(400,'Valores inválidos.');
          for(const [id,value] of Object.entries(patch.values)){
            const field=state.sheetFields.find(f=>f.id===id);if(!field)fail(400,'Campo fora do modelo da mesa.');
            if(field.type==='image'&&!image(value))fail(400,'Imagem inválida.');
            if(['text','textarea'].includes(field.type)&&typeof value!=='string')fail(400,'Texto inválido.');
            if(field.type==='number'&&!(value===''||((typeof value==='string'||typeof value==='number')&&Number.isFinite(Number(value)))))fail(400,'Número inválido.');
            if(['list','checklist'].includes(field.type)&&!Array.isArray(value))fail(400,'Lista inválida.');
            if(field.type==='list'&&value.some(item=>typeof item!=='string'))fail(400,'Lista inválida.');
            if(field.type==='checklist'&&value.some(item=>!object(item)||typeof item.id!=='string'||typeof item.text!=='string'||typeof item.checked!=='boolean'))fail(400,'Lista marcável inválida.');
            if(field.type==='formula')fail(400,'Fórmulas são calculadas pelo modelo.');
            if(field.type==='status'&&(!object(value)||!Number.isFinite(value.max)||!Number.isFinite(value.current)||value.current<0||value.max<0||value.current>value.max))fail(400,'Recurso inválido.');
            if(field.type==='attack'&&(!object(value)||typeof value.damage!=='string'))fail(400,'Ataque inválido.');
          }
        }
        const previous=state.playerSheets[target.username]||{values:{},extraFields:[]};state.playerSheets[target.username]={...previous,...patch,values:{...previous.values,...patch.values}};
      }else{
        if(Object.keys(patch).some(k=>!['avatar','bars'].includes(k)))fail(400,'Perfil inválido.');
        if('avatar'in patch&&!image(patch.avatar))fail(400,'Imagem inválida.');
        if('bars'in patch&&(!Array.isArray(patch.bars)||patch.bars.length>30||patch.bars.some(b=>!object(b)||typeof b.label!=='string'||!Number.isFinite(b.current)||!Number.isFinite(b.max)||b.max<0||b.current<0||b.current>b.max)))fail(400,'Barras inválidas.');
        state.statusBarsData[target.username]={...state.statusBarsData[target.username],...patch};
      }
      saveState(roomId,state);broadcast(roomId);return json(res,200,snapshot(roomId,user.id));
    }
    if(path[3]==='members'){
      if(method==='POST'){
        privileged(m);const data=requestBody,role=data.role||'player';
        if(!['player','master'].includes(role)||(m.role==='master'&&role!=='player'))fail(403,'Apenas o ADM pode nomear mestres.');
        const target=query('SELECT id FROM users WHERE username=?',string(data.username,30,'Usuário',3).toLowerCase().trim());if(!target)fail(404,'Conta não encontrada. Envie um convite para a pessoa se cadastrar.');
        addMember(roomId,target.id,role);broadcast(roomId);return json(res,200,snapshot(roomId,user.id));
      }
      if(path[4]&&['PATCH','DELETE'].includes(method)){
        admin(m);const target=membership(roomId,path[4]);if(target.role==='admin')fail(400,'O criador da mesa permanece ADM.');
        if(method==='DELETE')run('DELETE FROM members WHERE room_id=? AND user_id=?',roomId,path[4]);
        else{const data=requestBody;if(!['player','master'].includes(data.role))fail(400,'Papel inválido.');run('UPDATE members SET role=? WHERE room_id=? AND user_id=?',data.role,roomId,path[4]);}
        // Invitations granted by a removed or demoted member are no longer valid.
        if(method==='DELETE'||query('SELECT role FROM members WHERE room_id=? AND user_id=?',roomId,path[4])?.role==='player')run('DELETE FROM invites WHERE room_id=? AND created_by=?',roomId,path[4]);
        run('UPDATE rooms SET revision=revision+1 WHERE id=?',roomId);broadcast(roomId);return json(res,200,snapshot(roomId,user.id));
      }
    }
    if(path[3]==='invites'){
      privileged(m);
      if(method==='GET')return json(res,200,all('SELECT id,role,expires FROM invites WHERE room_id=? AND expires>?',roomId,Date.now()).filter(i=>m.role==='admin'||i.role==='player'));
      if(method==='POST'){
        const data=requestBody,role=data.role||'player';if(!['master','player'].includes(role)||(m.role==='master'&&role!=='player'))fail(403,'Apenas o ADM pode convidar mestres.');
        if(query('SELECT count(*) AS n FROM invites WHERE room_id=? AND expires>?',roomId,Date.now()).n>=30)fail(400,'Revogue convites antigos antes de criar mais.');
        const code=randomBytes(18).toString('hex'),id=randomUUID(),expires=Date.now()+7*86400000;
        run('INSERT INTO invites VALUES(?,?,?,?,?,?)',id,roomId,digest(code),role,expires,user.id);return json(res,201,{id,code,role,expires});
      }
      if(method==='DELETE'&&path[4]){
        const invitation=query('SELECT * FROM invites WHERE id=? AND room_id=?',path[4],roomId);if(!invitation)fail(404,'Convite não encontrado.');
        if(m.role!=='admin'&&invitation.role!=='player')fail(403,'Apenas o ADM pode revogar esse convite.');
        run('DELETE FROM invites WHERE id=?',path[4]);return json(res,200,{ok:true});
      }
    }
    fail(404,'Rota não encontrada.');
  }
  const server=createServer((req,res)=>route(req,res).catch(e=>{if(res.headersSent)return res.end();if(!e.status)console.error(e);json(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir a operação.'});}));
  return {server,db,close:()=>{clearInterval(timer);for(const c of clients)c.res.end();server.close();db.close();}};
}
