import { spawn } from 'node:child_process';
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),200).unref();}
function start(args){const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});children.push(child);child.on('exit',code=>stop(code||0));child.on('error',e=>{console.error(e.message);stop(1);});}
start(['server/index.js']);start(['node_modules/vite/bin/vite.js',...process.argv.slice(2)]);
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
