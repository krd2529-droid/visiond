const $ = id => document.getElementById(id);
const apiBase = '/api/admin/toy-post-';
const state = {lines:[],lineCursor:null,products:[],cursor:null,selectedLine:null,cache:new Map(),pending:new Map()};

async function api(path, options={}) {
  const response = await fetch(apiBase+path,{credentials:'same-origin',cache:'no-store',...options});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
const body = value => ({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
function requestOnce(key,run) { if(state.pending.has(key)) return state.pending.get(key); const task=run().finally(()=>state.pending.delete(key));state.pending.set(key,task);return task; }
function invalidate(lineIds=[]) { for(const id of lineIds) for(const key of state.cache.keys()) if(key.startsWith(`${id}:`)) state.cache.delete(key); }
function option(select,id,label) { const node=document.createElement('option');node.value=id;node.textContent=label;select.append(node); }
function message(id,error) { $(id).textContent=error?.message || String(error || ''); }
function showLines() {
  $('moreLines').hidden=!state.lineCursor;
  for(const id of ['composeLine','productLine']) { const select=$(id),selected=select.value;select.replaceChildren();for(const line of state.lines)option(select,line.id,line.name);if(state.lines.some(line=>String(line.id)===selected))select.value=selected;select.disabled=!state.lines.length; }
  renderLines();
}

async function loadLines(append=false) {
  const cursor=append?state.lineCursor:0;
  if(append&&!cursor)return;
  const result=await requestOnce(`lines:${cursor}`,()=>api(`lines?cursor=${cursor}`));
  state.lines=append?[...state.lines,...result.items.filter(item=>!state.lines.some(line=>line.id===item.id))]:result.items;
  state.lineCursor=result.next_cursor;
  showLines();
  if(state.lines.length) await selectProducts();
  else $('productRows').replaceChildren();
}

function renderLines() {
  const root=$('lineRows');root.replaceChildren();
  for(const line of state.lines) {
    const row=document.createElement('div');row.className='row';
    const title=document.createElement('strong');title.textContent=line.name;row.append(title);
    const form=document.createElement('form');
    const name=document.createElement('input');name.value=line.name;name.required=true;name.maxLength=100;name.setAttribute('aria-label','ชื่อไลน์');form.append(name);
    const hint=document.createElement('small');hint.textContent='ปลายทาง Facebook: 1 บรรทัดต่อรายการ รูปแบบ เพจหรือกลุ่ม | ชื่อ | URL';form.append(hint);
    const targets=document.createElement('textarea');targets.rows=3;targets.setAttribute('aria-label','ปลายทาง');targets.value=line.destinations.map(x=>`${x.type==='group'?'กลุ่ม':'เพจ'} | ${x.name} | ${x.url}`).join('\n');form.append(targets);
    const save=document.createElement('button');save.textContent='บันทึกไลน์และปลายทาง';form.append(save);
    form.onsubmit=async event=>{event.preventDefault();try{const destinations=targets.value.split(/\r?\n/).filter(x=>x.trim()).map(x=>{const parts=x.split('|').map(v=>v.trim());if(parts.length!==3||!['เพจ','กลุ่ม'].includes(parts[0]))throw Error('รูปแบบปลายทางต้องเป็น เพจหรือกลุ่ม | ชื่อ | URL');return {type:parts[0]==='กลุ่ม'?'group':'page',name:parts[1],url:parts[2]};});const result=await api(`lines/${line.id}`,{method:'PUT',...body({name:name.value,destinations})});Object.assign(line,result.item);showLines();}catch(error){alert(error.message)}};
    row.append(form);root.append(row);
  }
}

async function productPage(lineId,cursor=0) {
  const key=`${lineId}:${cursor}`;
  if(state.cache.has(key))return state.cache.get(key);
  const data=await requestOnce(key,()=>api(`products?line_id=${lineId}&cursor=${cursor}`));
  state.cache.set(key,data);setTimeout(()=>{if(state.cache.get(key)===data)state.cache.delete(key)},30000);return data;
}
async function selectProducts() {
  const lineId=Number($('productLine').value);state.selectedLine=lineId;state.products=[];state.cursor=null;
  if (!lineId) return;
  const page=await productPage(lineId);if(state.selectedLine!==lineId)return;
  state.products=page.items;state.cursor=page.next_cursor;renderProducts();
}
async function moreProducts() {if(!state.cursor)return;const lineId=state.selectedLine,page=await productPage(lineId,state.cursor);if(state.selectedLine!==lineId)return;state.products.push(...page.items);state.cursor=page.next_cursor;renderProducts();}
function renderProducts() {
  const root=$('productRows');root.replaceChildren();$('moreProducts').hidden=!state.cursor;
  for(const product of state.products){
    const row=document.createElement('div');row.className='row';
    if(product.photo_url){const img=document.createElement('img');img.className='product-photo';img.src=product.photo_url+`?v=${Date.now()}`;img.alt='รูปสินค้า';row.append(img)}
    const form=document.createElement('form');
    const detail=document.createElement('textarea');detail.value=product.detail;detail.required=true;detail.rows=4;detail.setAttribute('aria-label','รายละเอียดสินค้า');form.append(detail);
    const line=document.createElement('select');line.setAttribute('aria-label','ไลน์สินค้า');for(const item of state.lines)option(line,item.id,item.name);line.value=product.line_id;form.append(line);
    const photo=document.createElement('input');photo.type='file';photo.accept='image/jpeg,image/png,image/webp';photo.setAttribute('aria-label','เปลี่ยนรูปสินค้า');form.append(photo);
    const actions=document.createElement('div');actions.className='row-actions';const save=document.createElement('button');save.textContent='บันทึก';actions.append(save);const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='นำออกจากคลัง';actions.append(remove);form.append(actions);
    form.onsubmit=async event=>{event.preventDefault();try{await api(`products/${product.id}`,{method:'PUT',...body({line_id:Number(line.value),expected_line_id:product.line_id,detail:detail.value})});const uploaded=photo.files[0]?await uploadPhoto(product.id,photo.files[0]):null;invalidate([product.line_id,Number(line.value)]);await selectProducts();message('productStatus',uploaded?.warning||'บันทึกแล้ว')}catch(error){invalidate([product.line_id,Number(line.value)]);await selectProducts();message('productStatus',error)}};
    remove.onclick=async()=>{if(!confirm('นำสินค้านี้ออกจากคลังโพสต์? รายการจะไม่อยู่ในโพสต์ใหม่'))return;try{await api(`products/${product.id}?line_id=${product.line_id}`,{method:'DELETE'});invalidate([product.line_id]);await selectProducts();message('productStatus','นำออกจากคลังแล้ว')}catch(error){invalidate([product.line_id]);await selectProducts();message('productStatus',error)}};
    row.append(form);root.append(row);
  }
}
async function uploadPhoto(id,file){const form=new FormData();form.append('file',file);return api(`products/${id}/photo`,{method:'POST',body:form});}

$('lineForm').onsubmit=async event=>{event.preventDefault();try{const result=await api('lines',{method:'POST',...body({name:$('lineName').value})});$('lineName').value='';state.lines.push(result.item);showLines();$('composeLine').value=String(result.item.id);$('productLine').value=String(result.item.id);await selectProducts()}catch(error){alert(error.message)}};
$('moreLines').onclick=()=>loadLines(true).catch(error=>alert(error.message));
$('productLine').onchange=()=>selectProducts().catch(error=>message('productStatus',error));
$('moreProducts').onclick=()=>moreProducts().catch(error=>message('productStatus',error));
$('productForm').onsubmit=async event=>{event.preventDefault();const lineId=Number($('productLine').value);let created;try{created=await api('products',{method:'POST',...body({line_id:lineId,detail:$('productDetail').value})});await uploadPhoto(created.item.id,$('productPhoto').files[0]);$('productDetail').value='';$('productPhoto').value='';invalidate([lineId]);await selectProducts();message('productStatus','เพิ่มสินค้าและรูปแล้ว')}catch(error){message('productStatus',created?`${error.message} · รายการถูกสร้างแล้ว โปรดอัปโหลดรูปอีกครั้งในรายการด้านล่าง`:error);invalidate([lineId]);await selectProducts()}};
$('composeForm').onsubmit=async event=>{event.preventDefault();$('preview').hidden=true;message('composeStatus','กำลังเตรียมโพสต์…');try{const result=await api('compose',{method:'POST',...body({line_id:Number($('composeLine').value),heading:$('heading').value})});$('previewText').textContent=result.text;$('previewDestinations').textContent=result.line.destinations.length?`ปลายทางที่ตั้งไว้: ${result.line.destinations.map(x=>`${x.type==='group'?'กลุ่ม':'เพจ'} ${x.name} (${x.url})`).join(' · ')}`:'ยังไม่ได้ตั้งปลายทาง Facebook';const photos=$('previewPhotos');photos.replaceChildren();for(const item of result.photos){const img=document.createElement('img');img.src=item.url;img.alt=`รูปสินค้า ${item.product_id}`;photos.append(img)}$('preview').hidden=false;message('composeStatus',`เตรียมโพสต์ ${result.count} สินค้าแล้ว · ยังไม่ได้เผยแพร่`)}catch(error){message('composeStatus',error)}};

try{const me=await fetch('/api/auth/me',{cache:'no-store'});const data=await me.json();if(!me.ok||!['boss','admin'].includes(data.user?.role))throw Error('denied');$('app').hidden=false;await loadLines()}catch{$('denied').hidden=false;}
