const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=n=>`${Math.max(1,Math.ceil(Number(n||0)/1024/1024))} MB`;
const autoCard=x=>`<article class="card" data-auto-order-item="${Number(x.order_item_id)}"><h2>${esc(x.title||'Follow me')}</h2><p><span class="status">ชำระเงินแล้ว</span> · คีย์ ${x.plan_code==='monthly'?'30 วัน':'ตลอดชีพ'} · Windows 1 เครื่อง</p>
  ${x.release?`<section class="release"><b>ดาวน์โหลด Follow me · v${esc(x.release.version)}</b><p><small>${esc(x.release.file_name)} · ${size(x.release.file_size)}<br>SHA-256: <code>${esc(x.release.sha256)}</code></small></p><a class="download-button" href="${esc(x.release.download_url)}">⬇ ดาวน์โหลดตัวติดตั้ง</a></section>`:'<p class="notice">กำลังเตรียมตัวติดตั้ง กรุณาติดต่อ VisionD</p>'}
  ${x.machine_id&&x.key?`<p>ผูกกับรหัสเครื่อง <code>${esc(x.machine_id)}</code><br>หมดอายุ ${esc(x.expires_at||'ไม่หมดอายุ')}</p><p>คีย์ <code>${esc(x.key||'กรุณาติดต่อ VisionD เพื่อกู้คีย์')}</code>${x.key?` <button class="copy" data-key="${esc(x.key)}">คัดลอก</button>`:''}</p>`:
    `<p>${x.machine_id?'กำลังออกคีย์สำหรับเครื่องที่ระบุไว้ กดอีกครั้งเพื่อดำเนินการต่อ':'ติดตั้งและเปิด Follow me เพื่อดู “รหัสเครื่องของคุณ” บนหน้าใส่คีย์ แล้วคัดลอกรหัสเครื่องมากรอกด้านล่าง รหัสนี้ผูกคีย์กับ Windows เครื่องเดียว'}</p><form class="auto-claim"><label>รหัสเครื่อง <input name="machine_id" required maxlength="19" pattern="[0-9A-Fa-f]{4}(-[0-9A-Fa-f]{4}){3}" placeholder="1A2B-3C4D-5E6F-7A8B" autocomplete="off" value="${esc(x.machine_id||'')}" ${x.machine_id?'readonly':''}></label><button type="submit">${x.machine_id?'ดำเนินการออกคีย์ต่อ':'รับคีย์สำหรับเครื่องนี้'}</button><p class="auto-error" role="alert"></p></form>`}</article>`;
const freeCard=x=>{
  const active=!x.expires_at || Date.parse(x.expires_at)>Date.now();
  return `<article class="card"><h2>Follow me · คีย์ฟรี</h2><p><span class="status">${active?'ใช้งานได้':'หมดอายุ'}</span> · ${x.duration_days?`${Number(x.duration_days)} วัน`:'ตลอดชีพ'} · Windows 1 เครื่อง</p>
    <p>รหัสเครื่อง <code>${esc(x.machine_id)}</code><br>หมดอายุ ${esc(x.expires_at||'ไม่หมดอายุ')}</p>
    ${x.key?`<p>คีย์ <code>${esc(x.key)}</code> <button class="copy" data-key="${esc(x.key)}">คัดลอก</button></p>`:'<p class="notice">กำลังเตรียมคีย์ กรุณาติดต่อ VisionD</p>'}
    ${x.release&&active?`<section class="release"><b>ดาวน์โหลด Follow me · v${esc(x.release.version)}</b><p><small>${esc(x.release.file_name)} · ${size(x.release.file_size)}<br>SHA-256: <code>${esc(x.release.sha256)}</code></small></p><a class="download-button" href="${esc(x.release.download_url)}">⬇ ดาวน์โหลดตัวติดตั้ง</a></section>`:''}</article>`;
};
function bindAuto(){
  document.querySelectorAll('.auto-claim').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();const card=form.closest('[data-auto-order-item]'),button=form.querySelector('button'),error=form.querySelector('.auto-error');
    button.disabled=true;error.textContent='';
    try{const r=await fetch('/api/vision7/auto-invite/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_item_id:Number(card.dataset.autoOrderItem),machine_id:form.elements.machine_id.value})});const d=await r.json();if(!r.ok){error.textContent=d.error||'ออกคีย์ไม่สำเร็จ';return}await load()}
    catch{error.textContent='เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'}finally{button.disabled=false}
  });
  document.querySelectorAll('[data-key]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.key);b.textContent='คัดลอกแล้ว'});
}
function addAutoMore(cursor){
  if(!cursor)return;
  const more=document.createElement('button');more.textContent='ดูรายการ Follow me เพิ่ม';
  more.onclick=async()=>{
    more.disabled=true;
    try{const r=await fetch(`/api/vision7/my-programs?auto_invite_cursor=${encodeURIComponent(cursor)}`),next=await r.json();
      if(!r.ok)throw new Error('load');
      more.remove();document.querySelector('#items').insertAdjacentHTML('beforeend',(next.auto_invite_items||[]).map(autoCard).join(''));
      bindAuto();addAutoMore(next.auto_invite_next_cursor);
    }catch{more.disabled=false;more.textContent='โหลดไม่สำเร็จ · กดเพื่อลองใหม่'}
  };
  document.querySelector('#items').append(more);
}
function addFreeMore(cursor){
  if(!cursor)return;
  const more=document.createElement('button');more.textContent='ดูคีย์ฟรี Follow me เพิ่ม';
  more.onclick=async()=>{
    more.disabled=true;
    try{const r=await fetch(`/api/vision7/my-programs?free_invite_cursor=${encodeURIComponent(cursor)}`),next=await r.json();
      if(!r.ok)throw new Error('load');more.remove();
      document.querySelector('#items').insertAdjacentHTML('beforeend',(next.free_invite_items||[]).map(freeCard).join(''));
      bindAuto();addFreeMore(next.free_invite_next_cursor);
    }catch{more.disabled=false;more.textContent='โหลดไม่สำเร็จ · กดเพื่อลองใหม่'}
  };document.querySelector('#items').append(more);
}
async function load(){
  const r=await fetch('/api/vision7/my-programs'),d=await r.json();
  if(r.status===401){location.href='/login.html?next=/my-programs.html';return}
  document.querySelector('#items').innerHTML=(d.items||[]).map(x=>{
    const active=['active','trial'].includes(x.status),release=x.release;
    const devices=x.devices.map(y=>`<p>${esc(y.device_name||y.platform||'อุปกรณ์')}${x.code==='sms-mix'?` · รหัสท้าย ${esc(y.hash_suffix||'')} · ผูกเมื่อ ${esc(y.activated_at||'')}`:` <button class="danger" data-id="${y.id}">ปิดเครื่องนี้</button>`}</p>`).join('')||'<p class="muted">ยังไม่มีเครื่องที่เปิดใช้งาน</p>';
    return `<article class="card"><h2>${esc(x.title||x.code)}</h2><p><span class="status">${esc(x.status)}</span> · ${esc(x.plan_name||'ทดลอง')}</p><p>คีย์ <code>${esc(x.key||x.key_masked)}</code>${x.key?` <button class="copy" data-key="${esc(x.key)}">คัดลอก</button>`:''}<br>หมดอายุ ${esc(x.expires_at||(x.code==='sms-mix'&&!x.smsmix_first_activated_at?'รอผูกเครื่อง/ยังไม่เริ่มนับวัน':'ไม่หมดอายุ'))}<br>เวอร์ชันล่าสุด ${esc(x.current_version)}</p>${release?`<section class="release ${release.mandatory?'mandatory':''}"><b>${release.mandatory?'ต้องอัปเดต':'ดาวน์โหลดโปรแกรม'} · v${esc(release.version)}</b><p>${esc(release.release_notes||'ตัวติดตั้งเวอร์ชันล่าสุด')}<br><small>${esc(release.file_name)} · ${size(release.file_size)}<br>SHA-256: <code>${esc(release.sha256)}</code></small></p>${active?`<a class="download-button" href="${esc(release.download_url)}">⬇ ดาวน์โหลดตัวติดตั้ง</a>`:'<p class="muted">ต่ออายุสิทธิ์ก่อนดาวน์โหลด</p>'}</section>`:'<p class="notice">ยังไม่มีตัวติดตั้งเผยแพร่สำหรับโปรแกรมนี้</p>'}<h3>เครื่อง (${x.devices.length}/${x.code==='sms-mix'?1:x.max_devices})</h3>${devices}</article>`;
  }).join('')+(d.auto_invite_items||[]).map(autoCard).join('')+(d.free_invite_items||[]).map(freeCard).join('')+(!(d.items||[]).length&&!(d.auto_invite_items||[]).length&&!(d.free_invite_items||[]).length?'<article class="card">ยังไม่มีโปรแกรมในบัญชีนี้</article>':'');
  addAutoMore(d.auto_invite_next_cursor);
  addFreeMore(d.free_invite_next_cursor);
  document.querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{if(!confirm('ปิดสิทธิ์เครื่องนี้ใช่ไหม?'))return;await fetch('/api/vision7/activate',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({device_id:Number(b.dataset.id)})});load()});
  bindAuto();
}
load();
