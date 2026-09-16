import { resolve } from 'node:path';
import { createApplication } from './app.js';
const production=process.env.NODE_ENV==='production';
const publicOrigin=process.env.PUBLIC_ORIGIN || '';
if(production&&!publicOrigin.startsWith('https://'))throw Error('Defina PUBLIC_ORIGIN com o endereço HTTPS público do site.');
const app=createApplication({dbPath:process.env.DB_PATH||resolve('data/grimorio.sqlite'),production,publicOrigin});
const port=Number(process.env.PORT||3001),host=process.env.HOST||(production?'0.0.0.0':'127.0.0.1');
app.server.listen(port,host,()=>console.log(`Grimório: servidor em http://${host}:${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{app.close();process.exit(0);});
