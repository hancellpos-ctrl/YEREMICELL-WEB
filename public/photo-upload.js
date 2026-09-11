const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1800;

async function isHeic(file) {
  const head = new Uint8Array(await file.slice(0,32).arrayBuffer());
  const text = new TextDecoder().decode(head);
  return text.slice(4,8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8));
}

function decode(blob) {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const clean = () => {clearTimeout(timer);URL.revokeObjectURL(url);image.onload=null;image.onerror=null;};
    const timer = setTimeout(() => {clean();reject(new Error('La foto tardó demasiado en abrirse. Prueba con otra imagen.'));},30000);
    image.onload = () => {clean();resolve(image);};
    image.onerror = () => {clean();reject(new Error('No pudimos abrir esta foto.'));};
    image.src = url;
  });
}

function encode(canvas,type,quality) {
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No pudimos preparar la foto.')),type,quality));
}

export async function readPhoto(file, onProgress = () => {}) {
  if(!file.size) throw new Error('La foto está vacía. Selecciona otra imagen.');
  if(file.size > MAX_SOURCE_BYTES) throw new Error('Selecciona fotos de hasta 30 MB.');
  const heic = await isHeic(file);
  const supported = /\.(jpe?g|png|webp)$/i.test(file.name) || ['image/jpeg','image/png','image/webp'].includes(file.type);
  if(!heic && !supported) throw new Error('Usa fotos JPG, PNG, WebP o HEIC del iPhone.');
  onProgress(heic ? 'Preparando foto del iPhone…' : 'Optimizando foto…');
  let decoded;
  try { decoded = await decode(file); }
  catch {
    if(!heic) throw new Error('La foto está dañada o no tiene un formato compatible.');
    onProgress('Convirtiendo foto del iPhone…');
    try {
      const {heicTo} = await import('./vendor/heic-to.js');
      const converted = await heicTo({blob:file,type:'image/jpeg',quality:0.95});
      decoded = await decode(converted);
    } catch {
      throw new Error('No pudimos convertir esta foto. Exporta una copia JPG y vuelve a intentarlo.');
    }
  }
  const width = decoded.naturalWidth, height = decoded.naturalHeight;
  if(!width || !height || width * height > 65000000) throw new Error('La resolución de esta foto es demasiado grande. Usa una versión más pequeña.');
  const scale = Math.min(1,MAX_EDGE/width,MAX_EDGE/height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(width*scale));
  canvas.height = Math.max(1,Math.round(height*scale));
  try {
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error('No pudimos preparar la foto en este navegador.');
    ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(decoded,0,0,canvas.width,canvas.height);
    return canvas;
  } catch(error) {canvas.width=1;canvas.height=1;throw error;}
  finally {decoded.src='';}
}

export async function encodePhoto(canvas,name='foto') {
    let blob = await encode(canvas,'image/webp',0.84);
    if(blob.type !== 'image/webp') blob = await encode(canvas,'image/jpeg',0.84);
    if(blob.size > MAX_UPLOAD_BYTES) throw new Error('La foto sigue siendo demasiado grande. Selecciona una versión más pequeña.');
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob],name.replace(/\.[^.]+$/,'') + '.' + extension,{type:blob.type});
}

export async function preparePhoto(file,onProgress=()=>{}) {
  const canvas=await readPhoto(file,onProgress);
  try {return await encodePhoto(canvas,file.name);}
  finally {canvas.width=1;canvas.height=1;}
}
