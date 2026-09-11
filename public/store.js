import {$,esc,icon,logo,money,api,toast,share,placeholder,contact} from './shared.js';
import {parseOrder,summarizeOrder,whatsappOrder,orderKey,resolveOrderItem,productAvailable,colorAvailable} from './order.js';
const state={products:[],settings:{},brand:'',budget:80000,storage:new Set(),query:'',favorites:false,available:false,sort:'featured',limit:12};
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('yc-favorites')||'[]'))}catch{}
let selection=new Map();try{selection=parseOrder(localStorage.getItem('yc-order'))}catch{}
const orderDialog=$('#order-dialog'),orderOrigin=location.origin;let orderReady=false,orderLoading=false,orderRequest=0,orderRemoved=0;
const orderButtonLabels=new WeakMap();
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
$('#brand-logo').innerHTML=logo();$('#footer-logo').innerHTML=logo();document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));$('#year').textContent=new Date().getFullYear();
$('#product-grid').innerHTML=Array.from({length:6},()=>'<div class="skeleton"></div>').join('');
const dialog=$('#product-dialog');let currentProduct=null,previousPath='/',lastFocus,selectedColorId=null,detailQuantity='1';
function fitCustomerDialogs(){
 const viewport=window.visualViewport,height=viewport?.height||innerHeight,top=viewport?.offsetTop||0;
 for(const el of [dialog,orderDialog]){el.style.setProperty('--shop-height',height+'px');el.style.setProperty('--shop-top',top+'px');el.style.setProperty('--shop-bottom',Math.max(0,innerHeight-height-top)+'px')}
}
window.visualViewport?.addEventListener('resize',fitCustomerDialogs);window.visualViewport?.addEventListener('scroll',fitCustomerDialogs);window.addEventListener('resize',fitCustomerDialogs);fitCustomerDialogs();
const photoViewer=$('#photo-viewer'),photoStage=$('#photo-stage'),viewerImage=$('#viewer-image');
let photoSources=[],photoIndex=0,zoomed=false,swipeStart=null;
function favorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('yc-favorites',JSON.stringify([...favorites]))}catch{}render();if(currentProduct)showProduct(currentProduct.id,false);toast(favorites.has(id)?'Guardado en tus favoritos':'Eliminado de favoritos')}
function render(){
 $('#favorites-count').textContent=favorites.size;$('#only-favorites').checked=state.favorites;
 const all=state.products.filter(p=>(!state.brand||p.brand===state.brand)&&(!state.query||normalize(`${p.brand} ${p.name} ${p.storage}`).includes(normalize(state.query)))&&(state.budget===80000||p.price===null||p.price<=state.budget)&&(!state.storage.size||state.storage.has(p.storage))&&(!state.available||productAvailable(p))&&(!state.favorites||favorites.has(p.id)));
 all.sort((a,b)=>state.sort==='price-asc'?(a.price??Infinity)-(b.price??Infinity):state.sort==='price-desc'?(b.price??-1)-(a.price??-1):state.sort==='name'?a.name.localeCompare(b.name,'es'):Number(b.featured)-Number(a.featured)||Number(!!b.images.length)-Number(!!a.images.length)||a.name.localeCompare(b.name,'es'));
 $('#result-count').innerHTML=`<b>${all.length}</b> ${all.length===1?'teléfono':'teléfonos'}${state.brand?' de '+esc(state.brand):' para descubrir'}`;
 $('#product-grid').innerHTML=all.length?all.slice(0,state.limit).map(p=>`<article class="product-card">${!productAvailable(p)?'<span class="card-badge">Agotado</span>':p.featured?'<span class="card-badge featured">Destacado</span>':''}<button class="icon-button card-favorite ${favorites.has(p.id)?'selected':''}" data-favorite="${p.id}" aria-label="${favorites.has(p.id)?'Quitar de':'Añadir a'} favoritos: ${esc(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon('heart')}</button><a class="product-image" href="/producto/${p.id}" data-product="${p.id}" aria-label="Ver ${esc(p.name)} ${esc(p.storage)}">${p.images.length?`<img src="${esc(p.images[0])}" alt="${esc(p.name)}${p.imageNote?' · Imagen de referencia':''}" loading="lazy">`:placeholder()}</a><div class="product-info"><span class="product-brand">${esc(p.brand)}</span><h3><a href="/producto/${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="spec-chips"><span>${esc(p.storage)}</span>${p.condition!=='Consultar'?`<span>${esc(p.condition)}</span>`:''}</div><div class="card-bottom"><a href="/producto/${p.id}" data-product="${p.id}" aria-label="Precio y detalles de ${esc(p.name)}"><span class="price-label">${!productAvailable(p)?'Temporalmente agotado':'Precio de catálogo'}</span><span class="price ${p.price===null?'price-consult':''}">${money(p.price)}</span></a><a class="card-go" href="/producto/${p.id}" data-product="${p.id}" aria-label="Ver detalles de ${esc(p.name)}">${icon('arrow')}</a></div><button type="button" class="btn card-add" data-add-order="${p.id}"></button></div></article>`).join(''):`<div class="empty-state">${icon('search')}<h3>${state.favorites?'Tus favoritos te esperan':'No encontramos ese teléfono'}</h3><p>${state.favorites?'Guarda los equipos que te gusten tocando el corazón.':'Prueba con otro modelo o ajusta los filtros.'}</p><button class="btn" id="empty-clear">Ver todo el catálogo ${icon('arrow')}</button></div>`;
 $('#empty-clear')?.addEventListener('click',clear);
 $('#load-more').hidden=all.length<=state.limit;
 $('#active-filters').innerHTML=[state.brand&&['brand',state.brand],state.query&&['query',`“${state.query}”`],state.budget<80000&&['budget',`Hasta ${money(state.budget)}`],state.favorites&&['favorites','Mis favoritos']].filter(Boolean).map(([key,label])=>`<button class="filter-chip" data-clear="${key}">${esc(label)} ${icon('close')}</button>`).join('');
 syncOrderButtons();
 document.querySelectorAll('.brand-tab').forEach(b=>{b.classList.toggle('active',b.dataset.brand===state.brand);b.setAttribute('aria-pressed',String(b.dataset.brand===state.brand))});
}
function clear(){Object.assign(state,{brand:'',budget:80000,query:'',favorites:false,available:false,limit:12});state.storage.clear();$('#search').value='';$('#budget').value='80000';$('#budget-value').textContent='Sin límite';$('#only-available').checked=false;document.querySelectorAll('[data-storage]').forEach(e=>e.checked=false);render()}
function setBrand(value){state.brand=value;state.limit=12;render()}
function showProduct(id,push=true){
 const p=state.products.find(p=>p.id===id);if(!p){toast('Este producto ya no está disponible.');return}
 if(currentProduct?.id!==p.id)detailQuantity=String(selection.get(p.id)||1);
 if(currentProduct?.id!==p.id||!p.colors?.some(c=>c.id===selectedColorId&&colorAvailable(c)))selectedColorId=null;
 currentProduct=p;const detailItem=resolveOrderItem(orderKey(p.id,selectedColorId||''),state.products);if(detailItem)detailQuantity=String(quantityValue(detailQuantity,detailItem.maxQuantity));const url=contact(state.settings,p);const variants=state.products.filter(x=>x.name===p.name&&x.brand===p.brand);
 $('#product-detail').innerHTML=`<div class="detail-layout"><div><div class="detail-gallery">${p.images.length?`<button type="button" class="image-open" id="open-photo" aria-label="Ampliar fotos de ${esc(p.name)}"><img id="detail-image" src="${esc(p.images[0])}" alt="${esc(p.name)}"></button>`:placeholder()}</div>${p.images.length>1?`<div class="gallery-thumbs">${p.images.map((src,i)=>`<button data-photo="${esc(src)}" data-photo-index="${i}" aria-label="Ver foto ${i+1}" aria-pressed="${i===0}"><img src="${esc(src)}" alt="Foto ${i+1}"></button>`).join('')}</div>`:''}<p class="detail-note">${esc(p.imageNote||(!p.images.length?'Solicita fotos de este equipo al consultarnos.':''))}</p></div><div class="detail-copy"><span class="eyebrow muted">${esc(p.brand)}</span><h2 id="detail-title">${esc(p.name)}</h2><div class="detail-specs"><span>${esc(p.storage)}</span><span>${p.condition==='Consultar'?'Condición: consultar':esc(p.condition)}</span>${!productAvailable(p)?'<span>Agotado</span>':''}</div>${variants.length>1?`<div class="detail-variants">${variants.map(v=>`<button class="btn ${v.id===id?'active':''}" data-product="${v.id}">${esc(v.storage)}</button>`).join('')}</div>`:''}${p.colors?.length?`<fieldset class="detail-colors"><legend>Color</legend><div>${p.colors.map(c=>`<button type="button" class="btn" data-select-color="${esc(c.id)}" aria-pressed="${selectedColorId===c.id}" ${!colorAvailable(c)?'disabled':''}>${esc(c.name)}${!colorAvailable(c)?'<small>Agotado</small>':c.quantity!=null?`<small>${c.quantity} disponibles</small>`:''}</button>`).join('')}</div></fieldset>`:''}<div class="price">${money(p.price)}</div><p class="detail-note">Precios en pesos dominicanos. Confirma disponibilidad.</p><p>${esc(p.description)}</p><div class="detail-buttons"><div class="detail-quantity-row"><div><label for="detail-quantity">Cantidad</label><small id="detail-quantity-note"></small></div><div class="quantity-control"><button type="button" class="icon-button" data-detail-delta="-1" aria-label="Restar un equipo">−</button><input id="detail-quantity" type="number" inputmode="numeric" min="1" max="99" step="1" value="${esc(detailQuantity)}" aria-describedby="detail-quantity-note" required><button type="button" class="icon-button" data-detail-delta="1" aria-label="Sumar un equipo">${icon('plus')}</button></div></div><button type="button" class="btn primary" id="detail-add-order" data-add-order="${p.id}"></button>${url?`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Consultar este artículo">${icon('chat')}</a>`:''}<button class="btn" id="share-product" aria-label="Compartir producto">${icon('share')}</button><button class="btn" data-favorite="${id}" aria-label="Guardar producto en favoritos" aria-pressed="${favorites.has(id)}">${icon('heart')}</button></div><p class="detail-note">${icon('shield')} ${esc(state.settings.warranty)}<br>${icon('truck')} ${esc(state.settings.shipping)}</p></div></div>`;
 photoIndex=0;photoSources=p.images.length>1?[...document.querySelectorAll('#product-detail [data-photo]')].map(b=>b.dataset.photo):p.images.length?[$('#detail-image').getAttribute('src')]:[];
 syncOrderButtons();
 $('#open-photo')?.addEventListener('click',openPhoto);
 $('#share-product').onclick=()=>share(`${location.origin}/producto/${id}`,`${p.name} | YEREMICELL`);
 if(!dialog.open){lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden'}
 if(push){if(!location.pathname.startsWith('/producto/'))previousPath=location.pathname+location.search+location.hash;history.pushState({product:id},'',`/producto/${id}`)}document.title=`${p.name} · ${p.storage} | YEREMICELL`;
}
function closeProduct(update=true){if(orderDialog.open)orderDialog.close();if(photoViewer.open)photoViewer.close();dialog.close();currentProduct=null;document.body.style.overflow='';document.title='YEREMICELL · Tu próximo teléfono está aquí';if(update&&location.pathname.startsWith('/producto/'))history.replaceState({},'',previousPath);lastFocus?.focus()}
$('#close-product').onclick=()=>closeProduct();dialog.addEventListener('cancel',e=>{e.preventDefault();closeProduct()});dialog.addEventListener('click',e=>{if(e.target===dialog&&e.clientX>=0){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProduct()}});
window.addEventListener('popstate',()=>{if(orderDialog.open)orderDialog.close();if(photoViewer.open)photoViewer.close();const id=location.pathname.match(/^\/producto\/([^/]+)$/)?.[1];if(id)showProduct(id,false);else closeProduct(false)});
document.addEventListener('click',e=>{const color=e.target.closest('[data-select-color]');if(color){if(selectedColorId!==color.dataset.selectColor)detailQuantity=String(selection.get(orderKey(currentProduct.id,color.dataset.selectColor))||1);selectedColorId=color.dataset.selectColor;document.querySelectorAll('[data-select-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.selectColor===selectedColorId)));syncOrderButtons();return}const add=e.target.closest('[data-add-order]');if(add){addToOrder(add.dataset.addOrder,add.id==='detail-add-order');return}const fav=e.target.closest('[data-favorite]');if(fav){e.preventDefault();favorite(fav.dataset.favorite);return}const prod=e.target.closest('[data-product]');if(prod){if(e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();showProduct(prod.dataset.product);return}const brand=e.target.closest('[data-brand]');if(brand){setBrand(brand.dataset.brand);return}const budget=e.target.closest('[data-budget]');if(budget){state.budget=Number(budget.dataset.budget);$('#budget').value=state.budget;$('#budget-value').textContent=state.budget===80000?'Sin límite':money(state.budget);render();return}const clearButton=e.target.closest('[data-clear]');if(clearButton){const key=clearButton.dataset.clear;state[key]=key==='budget'?80000:key==='favorites'?false:'';if(key==='query')$('#search').value='';if(key==='budget'){$('#budget').value=80000;$('#budget-value').textContent='Sin límite'}render()}const photo=e.target.closest('[data-photo]');if(photo)selectPhoto(Number(photo.dataset.photoIndex))});
function selectPhoto(index){
 if(!photoSources.length)return;
 photoIndex=(index+photoSources.length)%photoSources.length;
 $('#detail-image').src=photoSources[photoIndex];
 document.querySelectorAll('#product-detail [data-photo-index]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.photoIndex)===photoIndex)));
 if(photoViewer.open)renderPhoto();
}
function setZoom(value){
 zoomed=value;photoStage.classList.toggle('is-zoomed',value);
 $('#zoom-photo').setAttribute('aria-pressed',String(value));$('#zoom-photo').setAttribute('aria-label',value?'Reducir imagen':'Ampliar imagen');$('#zoom-photo').title=value?'Reducir imagen':'Ampliar imagen';$('#zoom-plus').style.display=value?'none':'';
 photoStage.scrollTo({left:value?(photoStage.scrollWidth-photoStage.clientWidth)/2:0,top:value?(photoStage.scrollHeight-photoStage.clientHeight)/2:0,behavior:'instant'});
}
function renderPhoto(){
 setZoom(false);swipeStart=null;$('#viewer-count').textContent=`Foto ${photoIndex+1} de ${photoSources.length}`;
 $('#viewer-loading').textContent='Cargando foto…';viewerImage.hidden=false;$('#zoom-photo').disabled=true;
 viewerImage.alt=`${currentProduct.name} · Foto ${photoIndex+1}`;
 viewerImage.src=photoSources[photoIndex];$('#original-photo').href=photoSources[photoIndex];
 for(const id of ['previous-photo','next-photo'])$('#'+id).hidden=photoSources.length<2;
 document.querySelectorAll('[data-viewer-photo]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.viewerPhoto)===photoIndex)));
 $('[data-viewer-photo="'+photoIndex+'"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
 if(viewerImage.complete&&viewerImage.naturalWidth)photoLoaded();
}
function photoLoaded(){if(!photoViewer.open)return;$('#viewer-loading').textContent='';$('#zoom-photo').disabled=false}
viewerImage.addEventListener('load',photoLoaded);
viewerImage.addEventListener('error',()=>{if(!photoViewer.open)return;viewerImage.hidden=true;$('#viewer-loading').textContent='No pudimos cargar esta foto. Prueba otra imagen o abre la original.';$('#zoom-photo').disabled=true});
function openPhoto(){
 if(!photoSources.length)return;
 $('#viewer-title').textContent=currentProduct.name;
 $('#viewer-thumbs').innerHTML=photoSources.length>1?photoSources.map((url,i)=>`<button type="button" data-viewer-photo="${i}" aria-label="Ampliar foto ${i+1}"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join(''):'';
 photoViewer.showModal();renderPhoto();
}
$('#close-photo').onclick=()=>photoViewer.close();
photoViewer.addEventListener('close',()=>{setZoom(false);swipeStart=null;if(dialog.open)$('#open-photo')?.focus({preventScroll:true})});
photoViewer.addEventListener('cancel',e=>{e.preventDefault();photoViewer.close()});
$('#next-photo').onclick=()=>selectPhoto(photoIndex+1);$('#previous-photo').onclick=()=>selectPhoto(photoIndex-1);
$('#zoom-photo').onclick=()=>setZoom(!zoomed);
photoStage.addEventListener('dblclick',()=>{if(!$('#zoom-photo').disabled)setZoom(!zoomed)});
$('#viewer-thumbs').addEventListener('click',e=>{const button=e.target.closest('[data-viewer-photo]');if(button)selectPhoto(Number(button.dataset.viewerPhoto))});
photoViewer.addEventListener('keydown',e=>{if(!zoomed&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();selectPhoto(photoIndex+(e.key==='ArrowRight'?1:-1))}});
photoStage.addEventListener('touchstart',e=>{swipeStart=!zoomed&&e.touches.length===1&&(window.visualViewport?.scale||1)<=1.01?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
photoStage.addEventListener('touchmove',e=>{if(e.touches.length!==1)swipeStart=null},{passive:true});
photoStage.addEventListener('touchcancel',()=>swipeStart=null,{passive:true});
photoStage.addEventListener('touchend',e=>{
 if(!swipeStart||zoomed||e.touches.length||!e.changedTouches.length)return;
 const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;swipeStart=null;
 if(Math.abs(dx)>50&&Math.abs(dy)<Math.abs(dx)*.6)selectPhoto(photoIndex+(dx<0?1:-1));
},{passive:true});
$('#share-store').onclick=()=>share(location.origin,'YEREMICELL · Catálogo de teléfonos');
$('#favorites-button').onclick=()=>{state.favorites=!state.favorites;state.limit=12;render();$('#catalogo').scrollIntoView({behavior:'smooth'})};
$('#clear-filters').onclick=clear;$('#search-form').onsubmit=e=>{e.preventDefault();$('#catalogo').scrollIntoView({behavior:'smooth'})};
$('#search').oninput=e=>{state.query=e.target.value;state.limit=12;render()};
$('#budget').oninput=e=>{state.budget=Number(e.target.value);$('#budget-value').textContent=state.budget===80000?'Sin límite':money(state.budget);state.limit=12;render()};
$('#sort').onchange=e=>{state.sort=e.target.value;render()};$('#only-available').onchange=e=>{state.available=e.target.checked;render()};$('#only-favorites').onchange=e=>{state.favorites=e.target.checked;render()};
$('#load-more').onclick=()=>{state.limit+=12;render()};$('#filter-toggle').onclick=()=>{const on=$('#filters').classList.toggle('open');$('#filter-toggle').setAttribute('aria-expanded',String(on))};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!dialog.open&&!orderDialog.open){e.preventDefault();$('#search').focus()}});
async function load(){try{const data=await api('/api/catalog');state.products=data.products;state.settings=data.settings;reconcileOrder();const brands=[...new Set(data.products.map(p=>p.brand))];$('#brand-tabs').innerHTML=[['','Todos'],...brands.map(b=>[b,b==='Apple'?'iPhone':b])].map(([value,label])=>`<button class="brand-tab" data-brand="${esc(value)}"><span>${esc(label)}</span><small>${value?data.products.filter(p=>p.brand===value).length:data.products.length}</small></button>`).join('');$('#storage-filters').innerHTML=[...new Set(data.products.map(p=>p.storage))].sort((a,b)=>parseInt(a)-parseInt(b)).map(s=>`<label class="check-label"><input type="checkbox" data-storage="${esc(s)}">${esc(s)}</label>`).join('');document.querySelectorAll('[data-storage]').forEach(e=>e.onchange=()=>{e.checked?state.storage.add(e.dataset.storage):state.storage.delete(e.dataset.storage);state.limit=12;render()});const url=contact(data.settings);if(url){$('#main-contact').href=url;$('#filter-contact').href=url;$('#filter-contact').target='_blank';$('#filter-contact').rel='noopener noreferrer'}$('#contact-label').textContent=data.settings.whatsapp?'Escríbenos por WhatsApp':'Escríbenos por Instagram';$('#store-location').textContent=data.settings.location;$('#footer-logo').nextElementSibling.textContent=data.settings.tagline;$('#benefit-shipping').textContent=data.settings.shipping;$('#benefit-warranty').textContent=data.settings.warranty;$('#instagram-link').textContent=data.settings.instagram?'@'+data.settings.instagram+' ↗':'';$('#instagram-link').href=data.settings.instagram?`https://www.instagram.com/${data.settings.instagram}/`:'#contacto';render();const id=location.pathname.match(/^\/producto\/([^/]+)$/)?.[1];if(id)showProduct(id,false)}catch(e){$('#result-count').textContent='No se pudo cargar el catálogo';$('#product-grid').innerHTML=`<div class="empty-state"><h3>No pudimos cargar los teléfonos</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Volver a intentar</button></div>`;$('#retry').onclick=load}}
load();

$('#dock-favorites')?.addEventListener('click',()=>$('#favorites-button').click());

function persistOrder(){try{localStorage.setItem('yc-order',JSON.stringify([...selection]))}catch{}}
const quantityValue=(value,max=99)=>Math.max(1,Math.min(max,Math.floor(Number(value)||1)));
const detailKey=()=>currentProduct?orderKey(currentProduct.id,selectedColorId||''):'';
function syncDetailQuantity(){
 const input=$('#detail-quantity');if(!input||!currentProduct)return;
 const item=resolveOrderItem(detailKey(),state.products),count=Number(detailQuantity)||1;
 input.value=detailQuantity;input.max=item?.maxQuantity||99;input.disabled=!item;
 $('[data-detail-delta="-1"]').disabled=!item||count<=1;
 $('[data-detail-delta="1"]').disabled=!item||count>=item.maxQuantity;
 $('#detail-quantity-note').textContent=!item?(productAvailable(currentProduct)?'Elige un color':'Agotado'):item.color?.quantity!=null?`${item.color.quantity} disponibles`:'';
}
$('#product-detail').addEventListener('click',e=>{
 const button=e.target.closest('[data-detail-delta]');if(!button)return;
 const item=resolveOrderItem(detailKey(),state.products);if(!item)return;
 detailQuantity=String(quantityValue(quantityValue(detailQuantity,item.maxQuantity)+Number(button.dataset.detailDelta),item.maxQuantity));syncOrderButtons();
});
$('#product-detail').addEventListener('input',e=>{if(e.target.id==='detail-quantity'){detailQuantity=e.target.value;syncOrderButtons()}});
$('#product-detail').addEventListener('change',e=>{if(e.target.id==='detail-quantity'){detailQuantity=String(quantityValue(e.target.value,resolveOrderItem(detailKey(),state.products)?.maxQuantity||99));syncOrderButtons()}});
$('#product-detail').addEventListener('focusin',e=>{if(e.target.id==='detail-quantity')e.target.select()});
function syncOrderButtons(){
 const quantity=[...selection.values()].reduce((sum,n)=>sum+n,0);
 document.querySelectorAll('[data-order-count]').forEach(el=>{el.textContent=quantity>99?'99+':quantity;el.hidden=!quantity});
 for(const id of ['open-order','dock-order'])$('#'+id).setAttribute('aria-label',`Ver mi lista, ${quantity} ${quantity===1?'artículo':'artículos'}`);
 document.querySelectorAll('[data-add-order]').forEach(button=>{
  const p=state.products.find(p=>p.id===button.dataset.addOrder),detail=button.id==='detail-add-order',needsColor=Boolean(p?.colors?.length),colorId=detail&&needsColor?selectedColorId:'';
  const key=orderKey(button.dataset.addOrder,colorId||''),added=selection.has(key),count=quantityValue(detailQuantity,resolveOrderItem(key,state.products)?.maxQuantity||99),changed=detail&&added&&count!==selection.get(key);
  button.disabled=!p||!productAvailable(p);button.classList.toggle('in-order',added);
  const choosing=needsColor&&(!detail||!colorId);
  const label=button.disabled?'Agotado':choosing?'Elegir color':changed?'Actualizar cantidad':added?`${icon('check')} En mi lista (${selection.get(key)})`:detail?`${icon('plus')} Añadir ${count>1?count+' equipos':'a mi lista'}`:`${icon('plus')} Añadir`;if(orderButtonLabels.get(button)!==label){button.innerHTML=label;orderButtonLabels.set(button,label)}
  button.setAttribute('aria-label',`${choosing?'Elegir color de':changed?'Actualizar cantidad de':added?'Ver en mi lista':'Añadir a mi lista'}: ${p?.name||''} ${p?.storage||''}`);
 });
 syncDetailQuantity();
}
function reconcileOrder(){
 let removed=0;
 for(const [key,quantity] of selection){
  const item=resolveOrderItem(key,state.products);
  if(!item){selection.delete(key);removed+=quantity}
  else if(quantity>item.maxQuantity){selection.set(key,item.maxQuantity);removed+=quantity-item.maxQuantity}
 }
 if(removed){persistOrder();orderRemoved+=removed}return removed;
}
function addToOrder(id,fromDetail=false){
 const p=state.products.find(p=>p.id===id);if(!p||!productAvailable(p))return;
 if(p.colors?.length&&(!fromDetail||!selectedColorId)){
  if(currentProduct?.id!==id||!dialog.open)showProduct(id);
  $('.detail-colors')?.scrollIntoView({block:'center'});$('[data-select-color]:not(:disabled)')?.focus({preventScroll:true});return;
 }
 const key=orderKey(id,p.colors?.length?selectedColorId:'');
 const item=resolveOrderItem(key,state.products);if(!item)return;
 const count=fromDetail?quantityValue(detailQuantity,item.maxQuantity):1,already=selection.has(key);
 if(already&&(!fromDetail||selection.get(key)===count)){openOrder();return}
 selection.set(key,count);if(fromDetail)detailQuantity=String(count);persistOrder();syncOrderButtons();toast(already?'Cantidad actualizada':`${count} ${count===1?'equipo añadido':'equipos añadidos'} a mi lista`);
}
function orderNotice(message){$('#order-notice').textContent=message;$('#order-notice').hidden=!message}
function renderOrder(){
 const summary=summarizeOrder(selection,state.products);
 $('#order-items').innerHTML=summary.items.length?summary.items.map(({key,product:p,color,maxQuantity,quantity,lineCents})=>`<article class="order-item"><div class="order-photo">${p.images.length?`<img src="${esc(p.images[0])}" alt="" loading="lazy">`:icon('phone')}</div><div class="order-info"><h3>${esc(p.name)}</h3><p>${esc(p.storage)}${color?' · '+esc(color.name):''}${p.condition!=='Consultar'?' · '+esc(p.condition):''}</p><small>${money(p.price)}${p.price!==null?' c/u':''}</small></div><button type="button" class="icon-button order-remove" data-order-remove="${esc(key)}" aria-label="Quitar ${esc(p.name)} ${esc(p.storage)}">${icon('trash')}</button><div class="order-item-bottom"><div class="order-units"><label class="quantity-caption" for="order-quantity-${esc(key)}">Cantidad</label><div class="order-quantity"><button class="icon-button" type="button" data-order-quantity="${esc(key)}" data-delta="-1" aria-label="Restar una unidad de ${esc(p.name)}">−</button><input id="order-quantity-${esc(key)}" data-order-count-input="${esc(key)}" type="number" inputmode="numeric" min="1" max="${maxQuantity}" step="1" value="${quantity}" aria-label="Cantidad de ${esc(p.name)} ${esc(p.storage)}${color?' '+esc(color.name):''}" required><button class="icon-button" type="button" data-order-quantity="${esc(key)}" data-delta="1" aria-label="Sumar una unidad de ${esc(p.name)}" ${quantity>=maxQuantity?'disabled':''}>${icon('plus')}</button></div></div><strong class="order-line-total">${lineCents===null?'Por consultar':money(lineCents/100)}</strong></div></article>`).join(''):`<div class="order-empty">${icon('bag')}<h3>Tu lista está vacía</h3><p>Añade los teléfonos que te interesan.</p><button class="btn primary" type="button" id="browse-order">Ver teléfonos ${icon('arrow')}</button></div>`;
 $('#browse-order')?.addEventListener('click',()=>orderDialog.close());
 renderOrderTotals(summary);
}
function renderOrderTotals(summary=summarizeOrder(selection,state.products)){
 $('#order-count').textContent=`${summary.quantity} ${summary.quantity===1?'artículo':'artículos'}`;
 $('#order-footer').hidden=!summary.items.length;
 $('#order-total').textContent=summary.knownQuantity?money(summary.totalCents/100):'Por consultar';
 $('#order-unknown').hidden=!summary.unknownQuantity;$('#order-unknown').textContent=`${summary.unknownQuantity} ${summary.unknownQuantity===1?'unidad con precio':'unidades con precio'} por consultar${summary.knownQuantity?' (no incluida'+(summary.unknownQuantity===1?'':'s')+' en el total)':''}.`;
 const {url}=whatsappOrder(summary,state.settings.whatsapp,orderOrigin);
 const enabled=Boolean(url&&orderReady&&!orderLoading);const send=$('#send-order');
 if(enabled)send.href=url;else send.removeAttribute('href');send.setAttribute('aria-disabled',String(!enabled));send.tabIndex=enabled?0:-1;
 $('#order-items').setAttribute('aria-busy',String(orderLoading));syncOrderButtons();
}
async function openOrder(){
 if(!orderDialog.open){orderDialog.showModal();document.body.style.overflow='hidden'}
 const request=++orderRequest;orderReady=false;orderLoading=true;$('#retry-order').hidden=true;$('#order-copy-text').hidden=true;orderNotice('Actualizando tu lista…');renderOrder();
 try{
  const data=await api('/api/catalog');if(request!==orderRequest)return;
  state.products=data.products;state.settings=data.settings;reconcileOrder();const removed=orderRemoved;orderRemoved=0;orderReady=true;
  orderNotice(removed?`Se ajustó tu lista: ${removed} ${removed===1?'unidad ya no está disponible':'unidades ya no están disponibles'}.`:!state.settings.whatsapp?'La tienda no tiene WhatsApp disponible. Puedes copiar tu lista.':'');
  render();if(currentProduct){const p=state.products.find(p=>p.id===currentProduct.id);if(p)showProduct(p.id,false)}
 }catch{if(request!==orderRequest)return;orderNotice('No pudimos actualizar el catálogo. Reintenta para enviar tu lista.');$('#retry-order').hidden=false}
 finally{if(request===orderRequest){orderLoading=false;renderOrder()}}
}
$('#open-order').onclick=openOrder;$('#dock-order').onclick=openOrder;$('#retry-order').onclick=openOrder;
$('#close-order').onclick=()=>orderDialog.close();$('#continue-shopping').onclick=()=>orderDialog.close();
orderDialog.addEventListener('cancel',e=>{e.preventDefault();orderDialog.close()});
orderDialog.addEventListener('close',()=>{
 if(currentProduct&&!state.products.some(p=>p.id===currentProduct.id))closeProduct();
 document.body.style.overflow=dialog.open?'hidden':'';
 const focus=dialog.open?$('#detail-add-order'):matchMedia('(max-width:600px)').matches?$('#dock-order'):$('#open-order');focus?.focus({preventScroll:true});
});
$('#order-items').addEventListener('click',e=>{
 const remove=e.target.closest('[data-order-remove]'),quantity=e.target.closest('[data-order-quantity]');
 if(remove)selection.delete(remove.dataset.orderRemove);
 else if(quantity){const id=quantity.dataset.orderQuantity,n=(selection.get(id)||0)+Number(quantity.dataset.delta);if(n<1)selection.delete(id);else selection.set(id,Math.min(n,resolveOrderItem(id,state.products)?.maxQuantity??0))}
 else return;
 const key=remove?.dataset.orderRemove||quantity?.dataset.orderQuantity;if(key===detailKey())detailQuantity=String(selection.get(key)||1);
 persistOrder();$('#order-copy-text').hidden=true;renderOrder();
 const next=quantity?$(`[data-order-quantity="${quantity.dataset.orderQuantity}"][data-delta="${quantity.dataset.delta}"]`):$('#order-items .order-remove');(next||$('#close-order')).focus({preventScroll:true});
});
$('#send-order').onclick=e=>{if(!orderReady||orderLoading||!e.currentTarget.hasAttribute('href'))e.preventDefault()};
function editOrderQuantity(input,normalize=false){
 const key=input.dataset.orderCountInput,item=resolveOrderItem(key,state.products);if(!item)return;
 const count=normalize?quantityValue(input.value,item.maxQuantity):Number(input.value);
 if(!Number.isInteger(count)||count<1||count>item.maxQuantity)return;
 if(normalize)input.value=count;
 selection.set(key,count);if(key===detailKey())detailQuantity=String(count);persistOrder();$('#order-copy-text').hidden=true;
 const summary=summarizeOrder(selection,state.products),line=summary.items.find(i=>i.key===key),row=input.closest('.order-item');
 row.querySelector('.order-line-total').textContent=line.lineCents===null?'Por consultar':money(line.lineCents/100);
 row.querySelector('[data-delta="1"]').disabled=count>=item.maxQuantity;renderOrderTotals(summary);
}
$('#order-items').addEventListener('input',e=>{if(e.target.matches('[data-order-count-input]'))editOrderQuantity(e.target)});
$('#order-items').addEventListener('change',e=>{if(e.target.matches('[data-order-count-input]'))editOrderQuantity(e.target,true)});
$('#order-items').addEventListener('focusin',e=>{if(e.target.matches('[data-order-count-input]'))e.target.select()});
$('#copy-order').onclick=async()=>{
 const {message}=whatsappOrder(summarizeOrder(selection,state.products),state.settings.whatsapp,orderOrigin);
 try{await navigator.clipboard.writeText(message);orderNotice('Lista copiada. Puedes pegarla en WhatsApp.')}
 catch{const field=$('#order-copy-text');field.hidden=false;field.value=message;field.focus();field.select();orderNotice('Mantén pulsado el texto para copiar tu lista.')}
};
