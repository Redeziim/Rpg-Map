export const LIGHTING_PRESETS={
  default:{label:'Padrão',sky:0xfff5e3,ground:0x484a53,ambient:2.4,sun:0xffffff,intensity:3},
  bright:{label:'Luz clara',sky:0xfffaf0,ground:0x777b86,ambient:3.1,sun:0xfff7e8,intensity:3.8},
  dim:{label:'Luz baixa',sky:0xd6dce8,ground:0x34313a,ambient:1.1,sun:0xffd4a1,intensity:1.3},
};
export const isLightingPreset=value=>typeof value==='string'&&Object.hasOwn(LIGHTING_PRESETS,value);
