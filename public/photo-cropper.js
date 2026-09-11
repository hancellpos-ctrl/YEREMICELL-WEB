import {readPhoto,encodePhoto} from './photo-upload.js';
import {cropRect,zoomAt} from './photo-frame.js';

export async function framePhoto(file,{index=1,total=1,onProgress=()=>{},onConfirm=async value=>value}={}){
 const source=await readPhoto(file,onProgress);
 const dialog=document.querySelector('#photo-cropper'),frame=dialog.querySelector('#crop-frame'),preview=dialog.querySelector('#crop-preview'),workspace=dialog.querySelector('.crop-workspace');
 const zoom=dialog.querySelector('#crop-zoom'),error=dialog.querySelector('#crop-error'),confirm=dialog.querySelector('#crop-confirm');
 const events=new AbortController(),pointers=new Map();let oriented=source,rotation=0,format='original',state,busy=false,gesture=null,observer;
 const listen=(el,event,handler,options={})=>el.addEventListener(event,handler,{...options,signal:events.signal});
 function reset(){
  const width=oriented.width,height=oriented.height,ratio=format==='square'?1:format==='portrait'?4/5:width/height;
  state={width,height,ratio,zoom:1,cx:width/2,cy:height/2};render();
 }
 function rect(){return cropRect(state.width,state.height,state.ratio,state.zoom,state.cx,state.cy)}
 function render(){
  const r=rect();state.cx=r.x+r.width/2;state.cy=r.y+r.height/2;
  const width=Math.max(1,Math.min(workspace.clientWidth-16,(workspace.clientHeight-16)*state.ratio)),height=width/state.ratio,dpr=Math.min(devicePixelRatio||1,2);
  frame.style.width=width+'px';frame.style.height=height+'px';preview.width=Math.round(width*dpr);preview.height=Math.round(height*dpr);
  preview.getContext('2d').drawImage(oriented,r.x,r.y,r.width,r.height,0,0,preview.width,preview.height);
  zoom.value=state.zoom;dialog.querySelector('#crop-zoom-value').textContent=state.zoom.toFixed(1)+'×';
  dialog.querySelectorAll('[data-crop-format]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cropFormat===format)));
 }
 function scale(value,x,y){const b=frame.getBoundingClientRect();state=zoomAt(state,value,(x-b.left)/b.width,(y-b.top)/b.height);render()}
 function pan(dx,dy){const b=frame.getBoundingClientRect(),r=rect();state.cx-=dx/b.width*r.width;state.cy-=dy/b.height*r.height;render()}
 function currentGesture(){const values=[...pointers.values()];if(!values.length)return null;const [a,b]=values;return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)}:{...a,distance:0}}
 function setBusy(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=value);confirm.textContent=value?'Guardando foto…':'Usar foto';frame.setAttribute('aria-busy',String(value));pointers.clear();gesture=null}
 function rotate(){
  rotation=(rotation+1)%4;if(oriented!==source){oriented.width=1;oriented.height=1}
  if(!rotation)oriented=source;
  else{oriented=document.createElement('canvas');oriented.width=rotation%2?source.height:source.width;oriented.height=rotation%2?source.width:source.height;const ctx=oriented.getContext('2d');ctx.translate(oriented.width/2,oriented.height/2);ctx.rotate(rotation*Math.PI/2);ctx.drawImage(source,-source.width/2,-source.height/2)}reset();
 }
 try{
  return await new Promise((resolve,reject)=>{
   const cancel=()=>{if(!busy)reject(new DOMException('Selección cancelada','AbortError'))};
   dialog.querySelector('#crop-counter').textContent=total>1?`Foto ${index} de ${total}`:'Antes de subir';
   dialog.querySelector('#crop-skip').textContent=total>1?'Omitir foto':'Cancelar';error.hidden=true;setBusy(false);
   listen(dialog.querySelector('#crop-close'),'click',cancel);
   listen(dialog,'cancel',e=>{e.preventDefault();cancel()});
   listen(dialog.querySelector('#crop-skip'),'click',()=>{if(!busy){if(total>1)resolve(null);else cancel()}});
   listen(dialog.querySelector('#crop-rotate'),'click',rotate);
   listen(dialog.querySelector('#crop-reset'),'click',()=>{format='original';if(oriented!==source){oriented.width=1;oriented.height=1}oriented=source;rotation=0;reset()});
   dialog.querySelectorAll('[data-crop-format]').forEach(button=>listen(button,'click',()=>{format=button.dataset.cropFormat;reset()}));
   listen(zoom,'input',()=>{state=zoomAt(state,Number(zoom.value));render()});
   listen(preview,'pointerdown',e=>{if(busy||e.button>0)return;e.preventDefault();preview.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture=currentGesture()});
   listen(preview,'pointermove',e=>{if(!pointers.has(e.pointerId)||busy)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=currentGesture();if(gesture){if(next.distance&&gesture.distance)scale(state.zoom*next.distance/gesture.distance,gesture.x,gesture.y);pan(next.x-gesture.x,next.y-gesture.y)}gesture=next});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(preview,type,e=>{pointers.delete(e.pointerId);gesture=currentGesture()});
   listen(preview,'wheel',e=>{if(busy)return;e.preventDefault();scale(state.zoom*Math.exp(-e.deltaY*.002),e.clientX,e.clientY)},{passive:false});
   listen(preview,'keydown',e=>{if(busy)return;const directions={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};if(directions[e.key]){e.preventDefault();pan(...directions[e.key])}else if(['+','=','-'].includes(e.key)){e.preventDefault();state=zoomAt(state,state.zoom+(e.key==='-'?-.1:.1));render()}});
   listen(confirm,'click',async()=>{
    if(busy)return;setBusy(true);error.hidden=true;const r=rect(),output=document.createElement('canvas');
    output.width=Math.max(1,Math.round(r.width));output.height=Math.max(1,Math.round(r.height));
    try{output.getContext('2d').drawImage(oriented,r.x,r.y,r.width,r.height,0,0,output.width,output.height);const encoded=await encodePhoto(output,file.name);resolve(await onConfirm(encoded))}
    catch(e){error.textContent=e.message||'No pudimos guardar la foto. Vuelve a intentar.';error.hidden=false;setBusy(false)}
    finally{output.width=1;output.height=1}
   });
   dialog.showModal();reset();observer=new ResizeObserver(render);observer.observe(workspace);
  });
 }finally{events.abort();observer?.disconnect();pointers.clear();if(dialog.open)dialog.close();if(oriented!==source){oriented.width=1;oriented.height=1}source.width=1;source.height=1;preview.width=1;preview.height=1;}
}
