import {$,esc,icon,logo,money,api,toast,share,placeholder,contact} from './shared.js';
const state={products:[],settings:{},brand:'',budget:80000,storage:new Set(),query:'',favorites:false,available:false,sort:'featured',limit:12};
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('yc-favorites')||'[]'))}catch{}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
$('#brand-logo').innerHTML=logo();$('#footer-logo').innerHTML=logo();document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));$('#year').textContent=new Date().getFullYear();
$('#product-grid').innerHTML=Array.from({length:6},()=>'<div class="skeleton"></div>').join('');
const dialog=$('#product-dialog');let currentProduct=null,previousPath='/',lastFocus;
const photoViewer=$('#photo-viewer'),photoStage=$('#photo-stage'),viewerImage=$('#viewer-image');
let photoSources=[],photoIndex=0,zoomed=false,swipeStart=null;
function favorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('yc-favorites',JSON.stringify([...favorites]))}catch{}render();if(currentProduct)showProduct(currentProduct.id,false);toast(favorites.has(id)?'Guardado en tus favoritos':'Eliminado de favoritos')}
function render(){
 $('#favorites-count').textContent=favorites.size;$('#only-favorites').checked=state.favorites;
 const all=state.products.filter(p=>(!state.brand||p.brand===state.brand)&&(!state.query||normalize(`${p.brand} ${p.name} ${p.storage}`).includes(normalize(state.query)))&&(state.budget===80000||p.price===null||p.price<=state.budget)&&(!state.storage.size||state.storage.has(p.storage))&&(!state.available||p.status==='available')&&(!state.favorites||favorites.has(p.id)));
 all.sort((a,b)=>state.sort==='price-asc'?(a.price??Infinity)-(b.price??Infinity):state.sort==='price-desc'?(b.price??-1)-(a.price??-1):state.sort==='name'?a.name.localeCompare(b.name,'es'):Number(b.featured)-Number(a.featured)||Number(!!b.images.length)-Number(!!a.images.length)||a.name.localeCompare(b.name,'es'));
 $('#result-count').innerHTML=`<b>${all.length}</b> ${all.length===1?'teléfono':'teléfonos'}${state.brand?' de '+esc(state.brand):' para descubrir'}`;
 $('#product-grid').innerHTML=all.length?all.slice(0,state.limit).map(p=>`<article class="product-card">${p.featured?'<span class="card-badge featured">Destacado</span>':p.status==='soldout'?'<span class="card-badge">Agotado</span>':''}<button class="icon-button card-favorite ${favorites.has(p.id)?'selected':''}" data-favorite="${p.id}" aria-label="${favorites.has(p.id)?'Quitar de':'Añadir a'} favoritos: ${esc(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon('heart')}</button><a class="product-image" href="/producto/${p.id}" data-product="${p.id}" aria-label="Ver ${esc(p.name)} ${esc(p.storage)}">${p.images.length?`<img src="${esc(p.images[0])}" alt="${esc(p.name)}${p.imageNote?' · Imagen de referencia':''}" loading="lazy">`:placeholder()}</a><div class="product-info"><span class="product-brand">${esc(p.brand)}</span><h3><a href="/producto/${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="spec-chips"><span>${esc(p.storage)}</span>${p.condition!=='Consultar'?`<span>${esc(p.condition)}</span>`:''}</div><div class="card-bottom"><a href="/producto/${p.id}" data-product="${p.id}" aria-label="Precio y detalles de ${esc(p.name)}"><span class="price-label">${p.status==='soldout'?'Temporalmente agotado':'Precio de catálogo'}</span><span class="price ${p.price===null?'price-consult':''}">${money(p.price)}</span></a><a class="card-go" href="/producto/${p.id}" data-product="${p.id}" aria-label="Ver detalles de ${esc(p.name)}">${icon('arrow')}</a></div></div></article>`).join(''):`<div class="empty-state">${icon('search')}<h3>${state.favorites?'Tus favoritos te esperan':'No encontramos ese teléfono'}</h3><p>${state.favorites?'Guarda los equipos que te gusten tocando el corazón.':'Prueba con otro modelo o ajusta los filtros.'}</p><button class="btn" id="empty-clear">Ver todo el catálogo ${icon('arrow')}</button></div>`;
 $('#empty-clear')?.addEventListener('click',clear);
 $('#load-more').hidden=all.length<=state.limit;
 $('#active-filters').innerHTML=[state.brand&&['brand',state.brand],state.query&&['query',`“${state.query}”`],state.budget<80000&&['budget',`Hasta ${money(state.budget)}`],state.favorites&&['favorites','Mis favoritos']].filter(Boolean).map(([key,label])=>`<button class="filter-chip" data-clear="${key}">${esc(label)} ${icon('close')}</button>`).join('');
 document.querySelectorAll('.brand-tab').forEach(b=>{b.classList.toggle('active',b.dataset.brand===state.brand);b.setAttribute('aria-pressed',String(b.dataset.brand===state.brand))});
}
function clear(){Object.assign(state,{brand:'',budget:80000,query:'',favorites:false,available:false,limit:12});state.storage.clear();$('#search').value='';$('#budget').value='80000';$('#budget-value').textContent='Sin límite';$('#only-available').checked=false;document.querySelectorAll('[data-storage]').forEach(e=>e.checked=false);render()}
function setBrand(value){state.brand=value;state.limit=12;render()}
function showProduct(id,push=true){
 const p=state.products.find(p=>p.id===id);if(!p){toast('Este producto ya no está disponible.');return}
 currentProduct=p;const url=contact(state.settings,p);const variants=state.products.filter(x=>x.name===p.name&&x.brand===p.brand);
 $('#product-detail').innerHTML=`<div class="detail-layout"><div><div class="detail-gallery">${p.images.length?`<button type="button" class="image-open" id="open-photo" aria-label="Ampliar fotos de ${esc(p.name)}"><img id="detail-image" src="${esc(p.images[0])}" alt="${esc(p.name)}"></button>`:placeholder()}</div>${p.images.length>1?`<div class="gallery-thumbs">${p.images.map((src,i)=>`<button data-photo="${esc(src)}" data-photo-index="${i}" aria-label="Ver foto ${i+1}" aria-pressed="${i===0}"><img src="${esc(src)}" alt="Foto ${i+1}"></button>`).join('')}</div>`:''}<p class="detail-note">${esc(p.imageNote||(!p.images.length?'Solicita fotos de este equipo al consultarnos.':''))}</p></div><div class="detail-copy"><span class="eyebrow muted">${esc(p.brand)}</span><h2 id="detail-title">${esc(p.name)}</h2><div class="detail-specs"><span>${esc(p.storage)}</span><span>${p.condition==='Consultar'?'Condición: consultar':esc(p.condition)}</span>${p.status==='soldout'?'<span>Agotado</span>':''}</div>${variants.length>1?`<div class="detail-variants">${variants.map(v=>`<button class="btn ${v.id===id?'active':''}" data-product="${v.id}">${esc(v.storage)}</button>`).join('')}</div>`:''}<div class="price">${money(p.price)}</div><p class="detail-note">Precios en pesos dominicanos. Confirma disponibilidad.</p><p>${esc(p.description)}</p><div class="detail-buttons">${url?`<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('chat')}${p.status==='soldout'?'Consultar reposición':'Me interesa'}</a>`:'<span>Consulta en nuestra tienda de Baní.</span>'}<button class="btn" id="share-product" aria-label="Compartir producto">${icon('share')}</button><button class="btn" data-favorite="${id}" aria-label="Guardar producto en favoritos" aria-pressed="${favorites.has(id)}">${icon('heart')}</button></div><p class="detail-note">${icon('shield')} ${esc(state.settings.warranty)}<br>${icon('truck')} ${esc(state.settings.shipping)}</p></div></div>`;
 photoIndex=0;photoSources=p.images.length>1?[...document.querySelectorAll('#product-detail [data-photo]')].map(b=>b.dataset.photo):p.images.length?[$('#detail-image').getAttribute('src')]:[];
 $('#open-photo')?.addEventListener('click',openPhoto);
 $('#share-product').onclick=()=>share(`${location.origin}/producto/${id}`,`${p.name} | YEREMICELL`);
 if(!dialog.open){lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden'}
 if(push){if(!location.pathname.startsWith('/producto/'))previousPath=location.pathname+location.search+location.hash;history.pushState({product:id},'',`/producto/${id}`)}document.title=`${p.name} · ${p.storage} | YEREMICELL`;
}
function closeProduct(update=true){if(photoViewer.open)photoViewer.close();dialog.close();currentProduct=null;document.body.style.overflow='';document.title='YEREMICELL · Tu próximo teléfono está aquí';if(update&&location.pathname.startsWith('/producto/'))history.replaceState({},'',previousPath);lastFocus?.focus()}
$('#close-product').onclick=()=>closeProduct();dialog.addEventListener('cancel',e=>{e.preventDefault();closeProduct()});dialog.addEventListener('click',e=>{if(e.target===dialog&&e.clientX>=0){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProduct()}});
window.addEventListener('popstate',()=>{if(photoViewer.open)photoViewer.close();const id=location.pathname.match(/^\/producto\/([^/]+)$/)?.[1];if(id)showProduct(id,false);else closeProduct(false)});
document.addEventListener('click',e=>{const fav=e.target.closest('[data-favorite]');if(fav){e.preventDefault();favorite(fav.dataset.favorite);return}const prod=e.target.closest('[data-product]');if(prod){if(e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();showProduct(prod.dataset.product);return}const brand=e.target.closest('[data-brand]');if(brand){setBrand(brand.dataset.brand);return}const budget=e.target.closest('[data-budget]');if(budget){state.budget=Number(budget.dataset.budget);$('#budget').value=state.budget;$('#budget-value').textContent=state.budget===80000?'Sin límite':money(state.budget);render();return}const clearButton=e.target.closest('[data-clear]');if(clearButton){const key=clearButton.dataset.clear;state[key]=key==='budget'?80000:key==='favorites'?false:'';if(key==='query')$('#search').value='';if(key==='budget'){$('#budget').value=80000;$('#budget-value').textContent='Sin límite'}render()}const photo=e.target.closest('[data-photo]');if(photo)selectPhoto(Number(photo.dataset.photoIndex))});
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
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!dialog.open){e.preventDefault();$('#search').focus()}});
async function load(){try{const data=await api('/api/catalog');state.products=data.products;state.settings=data.settings;const brands=[...new Set(data.products.map(p=>p.brand))];$('#brand-tabs').innerHTML=[['','Todos'],...brands.map(b=>[b,b==='Apple'?'iPhone':b])].map(([value,label])=>`<button class="brand-tab" data-brand="${esc(value)}"><span>${esc(label)}</span><small>${value?data.products.filter(p=>p.brand===value).length:data.products.length}</small></button>`).join('');$('#storage-filters').innerHTML=[...new Set(data.products.map(p=>p.storage))].sort((a,b)=>parseInt(a)-parseInt(b)).map(s=>`<label class="check-label"><input type="checkbox" data-storage="${esc(s)}">${esc(s)}</label>`).join('');document.querySelectorAll('[data-storage]').forEach(e=>e.onchange=()=>{e.checked?state.storage.add(e.dataset.storage):state.storage.delete(e.dataset.storage);state.limit=12;render()});const url=contact(data.settings);if(url){$('#main-contact').href=url;$('#filter-contact').href=url;$('#filter-contact').target='_blank';$('#filter-contact').rel='noopener noreferrer'}$('#contact-label').textContent=data.settings.whatsapp?'Escríbenos por WhatsApp':'Escríbenos por Instagram';$('#store-location').textContent=data.settings.location;$('#footer-logo').nextElementSibling.textContent=data.settings.tagline;$('#benefit-shipping').textContent=data.settings.shipping;$('#benefit-warranty').textContent=data.settings.warranty;$('#instagram-link').textContent=data.settings.instagram?'@'+data.settings.instagram+' ↗':'';$('#instagram-link').href=data.settings.instagram?`https://www.instagram.com/${data.settings.instagram}/`:'#contacto';render();const id=location.pathname.match(/^\/producto\/([^/]+)$/)?.[1];if(id)showProduct(id,false)}catch(e){$('#result-count').textContent='No se pudo cargar el catálogo';$('#product-grid').innerHTML=`<div class="empty-state"><h3>No pudimos cargar los teléfonos</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Volver a intentar</button></div>`;$('#retry').onclick=load}}
load();

$('#dock-favorites')?.addEventListener('click',()=>$('#favorites-button').click());
