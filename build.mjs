import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
const origin=process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_SITE_URL;
if(!origin)throw new Error('Falta la dirección pública del sitio.');
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const path='dist/index.html';
const html=await readFile(path,'utf8');
await writeFile(path,html.replaceAll('https://yeremicell.lunar-ghost-1130.chatgpt.site',new URL(origin).origin));
console.log('Catálogo estático preparado.');
