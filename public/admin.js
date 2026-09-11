import {$,esc,icon,logo,money,api,toast,share} from './shared.js';
import {preparePhoto} from './photo-upload.js';
for(const id of ['login-brand','admin-brand'])$('#'+id).innerHTML=logo();document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
let products=[],settings={},editing=null,images=[],uploading=false,saving=false,dirty=false,deleteId=null;
const editor=$('#editor'),form=$('#product-form');
const error=(id,message)=>{const el=$('#'+id);el.textContent=message;el.hidden=!message};
function loggedOut(){ $('#login-screen').hidden=false;$('#admin-screen').hidden=true;$('#password').value='';if(editor.open)editor.close();dirty=false;products=[]; }
async function boot(){try{if((await api('/api/session')).authenticated)await enter();else loggedOut()}catch(e){error('login-error',e.message)}}
async function enter(){const [p,c]=await Promise.all([api('/api/admin/products'),api('/api/catalog')]);products=p;settings=c.settings;$('#login-screen').hidden=true;$('#admin-screen').hidden=false;error('login-error','');for(const [key,value] of Object.entries(settings)){const field=$('#settings-form').elements.namedItem(key);if(field)field.value=value}render()}
$('#show-password').onchange=e=>$('#password').type=e.target.checked?'text':'password';
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=$('button[type=submit]',e.target);button.disabled=true;error('login-error','');try{await api('/api/login',{method:'POST',body:JSON.stringify({password:$('#password').value})});await enter()}catch(e){error('login-error',e.message)}finally{button.disabled=false}};
$('#logout').onclick=async()=>{try{await api('/api/logout',{method:'POST'});loggedOut();toast('Sesión cerrada')}catch(e){toast(e.message)}};
$('#mobile-logout').onclick=()=>$('#logout').click();
$('#admin-share').onclick=()=>share(location.origin,'YEREMICELL · Catálogo de teléfonos');
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));for(const tab of ['products','settings','security'])$('#'+tab+'-section').hidden=tab!==b.dataset.tab;$('#section-name').textContent=b.textContent.trim()});
function render(){
 const query=$('#admin-search').value.toLowerCase(),status=$('#admin-status').value;
 const rows=products.filter(p=>(p.name+' '+p.brand+' '+p.storage).toLowerCase().includes(query)&&(!status||(status==='no-photo'?!p.images.length:p.status===status)));
 $('#stats').innerHTML=[['Total de productos',products.length,'phone'],['En catálogo',products.filter(p=>p.status==='available').length,'grid'],['Destacados',products.filter(p=>p.featured).length,'check'],['Pendientes de foto',products.filter(p=>!p.images.length).length,'image']].map(([label,n,i])=>`<div class="stat"><span>${label}${icon(i)}</span><strong>${n}</strong></div>`).join('');
 $('#admin-products').innerHTML=rows.length?rows.map(p=>`<tr><td><div class="table-product"><div class="table-photo">${p.images.length?`<img src="${esc(p.images[0])}" alt="" loading="lazy">`:icon('phone')}</div><div><strong>${esc(p.name)}</strong><small>${esc(p.brand)} · ${esc(p.storage)}${p.featured?' · Destacado':''}</small>${!p.images.length?'<span class=missing-photo>Sin fotos</span>':''}</div></div></td><td><b>${money(p.price)}</b></td><td><span class="table-status ${p.status}">${{available:'En catálogo',soldout:'Agotado',hidden:'Oculto'}[p.status]}</span></td><td>${p.images.length} / 6</td><td><div class="table-actions"><button class="icon-button" data-edit="${p.id}" aria-label="Editar ${esc(p.name)} ${esc(p.storage)}">${icon('edit')}<span>Editar</span></button><button class="icon-button delete-button" data-delete="${p.id}" aria-label="Eliminar ${esc(p.name)} ${esc(p.storage)}">${icon('trash')}</button></div></td></tr>`).join(''):'<tr><td colspan="5" class="admin-empty">No hay productos con estos filtros.</td></tr>';
 $('#table-count').textContent=`${rows.length} de ${products.length} productos`;
 $('#brands-list').innerHTML=[...new Set(products.map(p=>p.brand))].map(b=>`<option>${esc(b)}</option>`).join('');
}
$('#admin-search').oninput=render;$('#admin-status').onchange=render;
function photos(){
 $('#photo-count').textContent=`${images.length} / 6`;
 $('#image-previews').innerHTML=images.map((url,i)=>`<div class="photo-preview"><img src="${esc(url)}" alt="Foto ${i+1}"><span>${i===0?'Portada':'Foto '+(i+1)}</span><button type="button" class="icon-button" data-remove-image="${i}" aria-label="Quitar foto ${i+1}" ${uploading||saving?'disabled':''}>${icon('close')}</button></div>`).join('');
 for(const id of ['image-upload','camera-upload','take-photo','choose-photos'])$('#'+id).disabled=uploading||saving||images.length>=6;
 $('#image-previews').hidden=!images.length;
}
function saveState(){
 const status=form.elements.status.value;
 $('#save-label').textContent=saving?'Guardando…':uploading?'Subiendo fotos…':editing?'Guardar cambios':status==='hidden'?'Guardar oculto':'Publicar artículo';
 $('#save-hint').textContent=status==='hidden'?'Solo tú podrás ver este artículo.':status==='soldout'?'Se mostrará como agotado en tu catálogo.':'Se mostrará a tus clientes al guardar.';
 $('#save-product').disabled=uploading||saving;
 $('.editor-content').disabled=saving;
 $('#close-editor').disabled=uploading||saving;$('#cancel-edit').disabled=uploading||saving;
}
function fitEditor(){
 if(!editor.open)return;
 const viewport=window.visualViewport;
 editor.style.setProperty('--editor-height',`${viewport?.height||innerHeight}px`);
 editor.style.setProperty('--editor-top',`${viewport?.offsetTop||0}px`);
}
window.visualViewport?.addEventListener('resize',fitEditor);
window.visualViewport?.addEventListener('scroll',fitEditor);
window.addEventListener('resize',fitEditor);
function openEditor(id){
 editing=id?products.find(p=>p.id===id):null;form.reset();images=editing?[...editing.images]:[];dirty=false;
 $('#product-details').open=false;error('editor-error','');$('#upload-status').textContent='';
 $('#editor-title').textContent=editing?'Editar artículo':'Nuevo artículo';
 if(editing)for(const [k,v] of Object.entries(editing)){const el=form.elements.namedItem(k);if(el){if(el.type==='checkbox')el.checked=!!v;else el.value=v??''}}
 photos();saveState();editor.showModal();document.body.style.overflow='hidden';fitEditor();$('.editor-content').scrollTop=0;
}
function closeEditor(){
 if(uploading||saving){toast('Espera a que termine de guardar.');return}
 if(dirty&&!confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?'))return;
 dirty=false;editor.close();
}
editor.addEventListener('close',()=>document.body.style.overflow='');
$('#new-product').onclick=()=>openEditor();$('#close-editor').onclick=closeEditor;$('#cancel-edit').onclick=closeEditor;
editor.addEventListener('cancel',e=>{e.preventDefault();closeEditor()});form.addEventListener('input',()=>dirty=true);
form.elements.status.onchange=saveState;
form.addEventListener('invalid',e=>{if(e.target.closest('details'))$('#product-details').open=true},true);
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-edit]');if(edit)openEditor(edit.dataset.edit);
 const del=e.target.closest('[data-delete]');if(del){deleteId=del.dataset.delete;const p=products.find(x=>x.id===deleteId);$('#delete-description').textContent=`${p.brand} ${p.name} · ${p.storage} · ${money(p.price)}`;$('#delete-dialog').showModal()}
 const remove=e.target.closest('[data-remove-image]');if(remove&&!uploading&&!saving){images.splice(Number(remove.dataset.removeImage),1);dirty=true;photos()}
});
$('#take-photo').onclick=()=>$('#camera-upload').click();
$('#choose-photos').onclick=()=>$('#image-upload').click();
async function uploadPhotos(e){
 const files=[...e.target.files];if(!files.length)return;
 if(files.length+images.length>6){error('editor-error','Puedes subir hasta 6 fotos por artículo.');e.target.value='';return}
 uploading=true;photos();saveState();error('editor-error','');
 try{
  for(let i=0;i<files.length;i++){
   const file=await preparePhoto(files[i],message=>$('#upload-status').textContent=`Foto ${i+1} de ${files.length}: ${message}`);
   $('#upload-status').textContent=`Subiendo foto ${i+1} de ${files.length}…`;
   const data=await api('/api/admin/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});images.push(data.url);dirty=true;photos();
  }
  $('#upload-status').textContent='Fotos listas. Guarda el artículo para terminar.';
 }catch(e){error('editor-error',e.message);$('#upload-status').textContent=images.length?'Las fotos que ya subiste se conservan.':''}
 finally{uploading=false;e.target.value='';photos();saveState()}
}
$('#image-upload').onchange=uploadPhotos;$('#camera-upload').onchange=uploadPhotos;
form.onsubmit=async e=>{
 e.preventDefault();if(uploading||saving)return;error('editor-error','');
 const raw=Object.fromEntries(new FormData(form));
 const data={...raw,name:raw.name.trim(),brand:raw.brand.trim()||'Otros',storage:raw.storage.trim()||'Consultar',price:raw.price===''?null:Number(raw.price),featured:form.elements.featured.checked,images:[...images]};
 if(!data.name){error('editor-error','Escribe el nombre del artículo.');form.elements.name.focus();return}
 saving=true;saveState();photos();
 try{
  const p=await api(editing?'/api/admin/products/'+editing.id:'/api/admin/products',{method:editing?'PUT':'POST',body:JSON.stringify(data)});
  if(editing)products=products.map(x=>x.id===p.id?p:x);
  else{products.unshift(p);$('#admin-search').value='';$('#admin-status').value=''}
  dirty=false;editor.close();render();toast(p.status==='hidden'?'Artículo guardado. Solo tú puedes verlo.':'Artículo guardado. Tu catálogo ya está actualizado.');
 }catch(e){error('editor-error',e.message)}finally{saving=false;saveState();photos()}
};
$('#cancel-delete').onclick=()=>$('#delete-dialog').close();$('#confirm-delete').onclick=async()=>{const button=$('#confirm-delete');button.disabled=true;try{await api('/api/admin/products/'+deleteId,{method:'DELETE'});products=products.filter(p=>p.id!==deleteId);$('#delete-dialog').close();render();toast('Producto eliminado.')}catch(e){toast(e.message)}finally{button.disabled=false}};
$('#settings-form').onsubmit=async e=>{e.preventDefault();const button=$('button[type=submit]',e.target);button.disabled=true;error('settings-error','');try{settings=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Información de la tienda actualizada.')}catch(e){error('settings-error',e.message)}finally{button.disabled=false}};
$('#password-form').onsubmit=async e=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target));error('password-error','');if(raw.password!==raw.confirm){error('password-error','Las contraseñas nuevas no coinciden.');return}const button=$('button[type=submit]',e.target);button.disabled=true;try{await api('/api/admin/password',{method:'PUT',body:JSON.stringify(raw)});e.target.reset();loggedOut();toast('Contraseña actualizada. Inicia sesión con tu nueva contraseña.')}catch(e){error('password-error',e.message)}finally{button.disabled=false}};
$('#export-products').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),products,settings},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='YEREMICELL-catalogo-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Respaldo descargado.')};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});boot();
