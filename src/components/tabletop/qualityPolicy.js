const modes=new Set(['auto','original','light']);
const key=(accountId,roomId)=>`tabletop-quality.v1.${accountId}.${roomId}`;
export function readQualityPreference(accountId,roomId,storage){
  try{const value=(storage||localStorage).getItem(key(accountId,roomId));return modes.has(value)?value:'auto';}catch{return 'auto';}
}
export function writeQualityPreference(accountId,roomId,mode,storage){
  if(!modes.has(mode))return false;
  try{(storage||localStorage).setItem(key(accountId,roomId),mode);return true;}catch{return false;}
}
export function createQualityController({mode='auto',hardware={}}={}){
  let choice=modes.has(mode)?mode:'auto',quality,samples=[];
  const initial=()=>choice==='auto'?hardware.memory>0&&hardware.memory<=4||hardware.cores>0&&hardware.cores<=4||hardware.maxTextureSize>0&&hardware.maxTextureSize<4096?'light':'original':choice;
  quality=initial();
  return {
    get mode(){return choice;},get quality(){return quality;},
    setMode(next){choice=modes.has(next)?next:'auto';samples=[];quality=initial();return quality;},
    observeComplexity({triangles=0,texturePixels=0}){if(choice==='auto'&&(triangles>500000||texturePixels>32000000))quality='light';return quality;},
    observeRender(duration){
      if(choice!=='auto'||quality==='light'||!Number.isFinite(duration)||duration<0||duration>250)return quality;
      samples.push(duration);if(samples.length>30)samples.shift();
      if(samples.length===30&&samples.reduce((a,b)=>a+b,0)/30>24)quality='light';return quality;
    }
  };
}
