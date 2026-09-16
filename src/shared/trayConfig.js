export const TRAY_SCALE=7;
export const TRAY_FLOOR=-.135;
// Inner wall planes measured from the supplied Meshy mesh (world units).
export const TRAY_WALLS=[30,90,150,210,270,330].map((degrees,i)=>({angle:degrees*Math.PI/180,distance:[.739,.774,.742,.745,.777,.741][i]*TRAY_SCALE}));
export const PHYSICS_FIELDS=[
  {key:'gravity',label:'Gravidade',min:8,max:35,step:1,value:22},
  {key:'mass',label:'Peso dos dados',min:.5,max:3,step:.1,value:1},
  {key:'friction',label:'Atrito',min:.1,max:1,step:.05,value:.45},
  {key:'restitution',label:'Quique',min:0,max:.65,step:.05,value:.3},
  {key:'angularDamping',label:'Perda de rotação',min:.1,max:.8,step:.05,value:.25},
  {key:'linearDamping',label:'Perda de velocidade',min:.1,max:.8,step:.01,value:.22},
  {key:'spinForce',label:'Força da rotação',min:2,max:35,step:1,value:25},
  {key:'throwForce',label:'Força do gesto',min:.3,max:1.3,step:.1,value:1},
  {key:'startingHeight',label:'Altura da mão',min:.9,max:1.7,step:.1,value:1.3},
];
export const DEFAULT_PHYSICS=Object.fromEntries(PHYSICS_FIELDS.map(f=>[f.key,f.value]));
export function validatePhysics(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!(k in DEFAULT_PHYSICS)))throw Object.assign(Error('Ajustes de física inválidos.'),{status:400});
  const result={...DEFAULT_PHYSICS,...input};
  for(const f of PHYSICS_FIELDS)if(!Number.isFinite(result[f.key])||result[f.key]<f.min||result[f.key]>f.max)throw Object.assign(Error(`Ajuste inválido: ${f.label}.`),{status:400});
  return result;
}
