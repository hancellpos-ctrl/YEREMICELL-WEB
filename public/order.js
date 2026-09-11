import {money} from './shared.js';

export function parseOrder(value){
 try{
  const entries=JSON.parse(value||'[]');
  if(!Array.isArray(entries))return new Map();
  return new Map(entries.filter(entry=>Array.isArray(entry)&&typeof entry[0]==='string'&&/^[a-z0-9-]{1,150}$/.test(entry[0])&&Number.isInteger(entry[1])&&entry[1]>0).slice(0,200).map(([id,quantity])=>[id,Math.min(99,quantity)]));
 }catch{return new Map()}
}

export function summarizeOrder(selection,products){
 const available=new Map(products.filter(p=>p.status==='available').map(p=>[p.id,p]));
 const items=[];let quantity=0,totalCents=0,unknownQuantity=0;
 for(const [id,count] of selection){
  const product=available.get(id);if(!product)continue;
  const lineCents=product.price===null?null:Math.round(product.price*100)*count;
  items.push({product,quantity:count,lineCents});quantity+=count;
  if(lineCents===null)unknownQuantity+=count;else totalCents+=lineCents;
 }
 return {items,quantity,totalCents,unknownQuantity,knownQuantity:quantity-unknownQuantity};
}

export function whatsappOrder(summary,phone,origin){
 const clean=value=>String(value).replace(/\s+/g,' ').trim();
 if(!summary.items.length)return {message:'',url:null};
 const lines=['Hola, me interesan estos artículos de YEREMICELL:',''];
 summary.items.forEach(({product:p,quantity,lineCents},i)=>{
  lines.push(`${i+1}. ${quantity} × ${clean(p.brand)} ${clean(p.name)} · ${clean(p.storage)}${p.condition!=='Consultar'?' · '+clean(p.condition):''}`);
  lines.push(lineCents===null?'Precio por consultar':`${money(p.price)} c/u · ${money(lineCents/100)}`);
  lines.push(`${origin}/producto/${encodeURIComponent(p.id)}`,'');
 });
 lines.push(`Total estimado: ${summary.knownQuantity?money(summary.totalCents/100):'Por consultar'}`);
 if(summary.unknownQuantity&&summary.knownQuantity)lines.push(`Más ${summary.unknownQuantity} ${summary.unknownQuantity===1?'unidad con precio':'unidades con precio'} por consultar.`);
 lines.push('','¿Me confirmas la disponibilidad y el total?');
 const message=lines.join('\n');
 return {message,url:/^[1-9]\d{7,14}$/.test(phone||'')?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:null};
}
