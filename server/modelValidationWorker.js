import {parentPort,workerData} from 'node:worker_threads';
import {validateModelContent} from './modelValidationContent.js';

try{
  globalThis.fetch=()=>{throw Error('Network access is not part of model validation.');};
  parentPort.postMessage({ok:true,summary:await validateModelContent(workerData)});
}catch(error){parentPort.postMessage({ok:false,status:error.status||400,message:error.modelValidation?error.message:'Modelo inválido. Exporte novamente.'});}
