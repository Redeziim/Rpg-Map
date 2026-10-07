import {simplifyGeometry} from './simplifyGeometry.js';
self.onmessage=async event=>{
  try{const result=await simplifyGeometry(event.data);self.postMessage({result},[result.index.buffer,...Object.values(result.attributes).map(a=>a.array.buffer)]);}
  catch{self.postMessage({error:'Não foi possível simplificar esta malha.'});}
};
