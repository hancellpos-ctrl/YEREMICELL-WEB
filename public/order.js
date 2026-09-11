import {money} from './shared.js';

export const orderKey=(id,colorId='')=>colorId?`${id}~${colorId}`:id;
export const colorAvailable=c=>c.status!=='soldout'&&c.quantity!==0;
export const productAvailable=p=>p.status==='available'&&(!p.colors?.length||p.colors.some(colorAvailable));
export function resolveOrderItem(key,products){
 const [id,colorId]=key.split('~'),product=products.find(p=>p.id===id);
 if(!product||!productAvailable(product))return null;
 const color=product.colors?.find(c=>c.id===colorId)||null;
 if(product.colors?.length?!color||!colorAvailable(color):Boolean(colorId))return null;
 return {key,product,color,maxQuantity:Math.min(99,color?.quantity??99)};
}

export function parseOrder(value){
 try{
  const entries=JSON.parse(value||'[]');
  if(!Array.isArray(entries))return new Map();
  return new Map(entries.filter(entry=>Array.isArray(entry)&&typeof entry[0]==='string'&&/^[a-z0-9-]{1,150}(~[a-z0-9-]{1,64})?$/.test(entry[0])&&Number.isInteger(entry[1])&&entry[1]>0).slice(0,200).map(([id,quantity])=>[id,Math.min(99,quantity)]));
 }catch{return new Map()}
}

export function summarizeOrder(selection,products){
 const items=[];let quantity=0,totalCents=0,unknownQuantity=0;
 for(const [key,requested] of selection){
  const item=resolveOrderItem(key,products);if(!item)continue;
  const {product}=item,count=Math.min(requested,item.maxQuantity);
  const lineCents=product.price===null?null:Math.round(product.price*100)*count;
  items.push({...item,quantity:count,lineCents});quantity+=count;
  if(lineCents===null)unknownQuantity+=count;else totalCents+=lineCents;
 }
 return {items,quantity,totalCents,unknownQuantity,knownQuantity:quantity-unknownQuantity};
}

export function whatsappOrder(summary,phone,origin){
 const clean=value=>String(value).replace(/\s+/g,' ').trim();
 if(!summary.items.length)return {message:'',url:null};
 const lines=['Hola, me interesan estos artículos de YEREMICELL:',''];
 summary.items.forEach(({product:p,color,quantity,lineCents},i)=>{
  lines.push(`${i+1}. ${quantity} × ${clean(p.brand)} ${clean(p.name)} · ${clean(p.storage)}${p.condition!=='Consultar'?' · '+clean(p.condition):''}`);
  if(color)lines.push(`Color: ${clean(color.name)}`);
  lines.push(lineCents===null?'Precio por consultar':`${money(p.price)} c/u · ${money(lineCents/100)}`);
  lines.push(`${origin}/producto/${encodeURIComponent(p.id)}`,'');
 });
 lines.push(`Total estimado: ${summary.knownQuantity?money(summary.totalCents/100):'Por consultar'}`);
 if(summary.unknownQuantity&&summary.knownQuantity)lines.push(`Más ${summary.unknownQuantity} ${summary.unknownQuantity===1?'unidad con precio':'unidades con precio'} por consultar.`);
 lines.push('','¿Me confirmas la disponibilidad y el total?');
 const message=lines.join('\n');
 return {message,url:/^[1-9]\d{7,14}$/.test(phone||'')?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:null};
}
