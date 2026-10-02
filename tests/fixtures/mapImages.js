import sharp from 'sharp';
export const testMapImage='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#c7ab76'}}).png().toBuffer()).toString('base64');
export const secondTestMapImage='data:image/png;base64,'+(await sharp({create:{width:80,height:50,channels:3,background:'#405070'}}).png().toBuffer()).toString('base64');
