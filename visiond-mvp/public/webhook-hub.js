document.body.dataset.feature='WEBHOOK-HUB-001';
const $=selector=>document.querySelector(selector),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let data={shops:[],items:[],events:[],pagination:{}};

async function api(method='GET',body,url='/api/admin/webhook-hub'){
  const response=await fetch(url,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(response.status===401||response.status===403){location.href='/login.html?return_to=%2Fwebhook-hub.html';throw Error('กรุณาเข้าสู่ระบบแอดมิน')}
  const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'ดำเนินการไม่สำเร็จ');return result;
}
const merge=(current,next,key='id')=>{const seen=new Set(current.map(item=>String(item[key])));return current.concat((next||[]).filter(item=>!seen.has(String(item[key]))))};
function render(){
  $('#moreShops')?.remove();
  const shop=$('#shop'),current=shop.value;shop.innerHTML='<option value="">— เลือกร้าน —</option>'+data.shops.map(item=>`<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.slug||'ยังไม่มี slug')}</option>`).join('');shop.value=current;
  $('#list').innerHTML=(data.items.length?data.items.map(item=>`<article class="endpoint"><div class="endpoint-top"><div><b>${esc(item.shop_name)} · ${esc(item.provider.toUpperCase())}</b><br><small>สร้าง ${esc(item.created_at)}</small></div><span class="badge ${esc(item.status)}">${esc(item.status)} · adapter ${esc(item.adapter_state)}</span></div><div class="url"><code>${esc(item.webhook_url)}</code><button data-copy="${esc(item.webhook_url)}">คัดลอก</button></div><div class="actions">${item.status==='paused'?`<button data-action="resume" data-id="${esc(item.id)}">เปิดอีกครั้ง</button>`:`<button data-action="pause" data-id="${esc(item.id)}">พักลิงก์</button>`}<button data-action="rotate" data-id="${esc(item.id)}">ออก URL ใหม่</button><button class="danger" data-action="revoke" data-id="${esc(item.id)}">ยกเลิกถาวร</button></div></article>`).join(''):'<p>ยังไม่มีลิงก์ Webhook</p>')+(data.pagination.endpoints?.has_more?'<button type="button" data-more="endpoints">โหลดลิงก์เก่ากว่า</button>':'');
  $('#events').innerHTML=(data.events.length?data.events.map(item=>`<p><b>${esc(item.provider)}</b> · ${esc(item.processing_status)} · ${esc(item.created_at)}</p>`).join(''):'<p>ยังไม่มีเหตุการณ์</p>')+(data.pagination.events?.has_more?'<button type="button" data-more="events">โหลดเหตุการณ์เก่ากว่า</button>':'');
  if(data.pagination.shops?.has_more)shop.insertAdjacentHTML('afterend','<button id="moreShops" type="button" data-more="shops">โหลดร้านเพิ่ม</button>');
}
async function load(){try{data=await api();render()}catch(error){setState(error.message,true)}}
async function loadMore(resource){const page=data.pagination?.[resource],cursor=page?.next_cursor;if(!cursor)return;const key={shops:'shop_cursor',endpoints:'endpoint_cursor',events:'event_cursor'}[resource],params=new URLSearchParams({limit:'24',[key]:cursor}),next=await api('GET',null,`/api/admin/webhook-hub?${params}`);data.shops=merge(data.shops,next.shops);data.items=merge(data.items,next.items);data.events=merge(data.events,next.events);data.pagination[resource]=next.pagination?.[resource]||{};render()}
function setState(message,error=false){const element=$('#state');element.textContent=message;element.className=error?'error':'success'}
$('#create').onclick=async()=>{if(!$('#shop').value)return setState('กรุณาเลือกร้าน',true);try{await api('POST',{shop_id:$('#shop').value,provider:$('#provider').value});setState('ออกลิงก์แล้ว — ยังรอติดตั้ง Provider Adapter');await load()}catch(error){setState(error.message,true)}};
$('#reload').onclick=load;
document.body.addEventListener('click',event=>{const button=event.target.closest('[data-more]');if(button){button.disabled=true;loadMore(button.dataset.more).catch(error=>setState(error.message,true))}});
$('#list').onclick=async event=>{const copy=event.target.closest('[data-copy]');if(copy){await navigator.clipboard.writeText(copy.dataset.copy);setState('คัดลอกลิงก์แล้ว');return}const button=event.target.closest('[data-action]');if(!button)return;if(['rotate','revoke'].includes(button.dataset.action)&&!confirm(button.dataset.action==='rotate'?'URL เดิมจะใช้ไม่ได้ทันที ต้องการออก URL ใหม่หรือไม่?':'ยกเลิกลิงก์ถาวรหรือไม่?'))return;try{await api('PATCH',{id:button.dataset.id,action:button.dataset.action});setState('อัปเดตลิงก์แล้ว');await load()}catch(error){setState(error.message,true)}};
load();
