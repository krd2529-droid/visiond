const target=document.querySelector('#splusItems');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tier={accounts30:30,accounts50:50,accounts100:100};
let release=null,nextCursor=null;
const download=()=>release?`<p><a class="download-button" href="${esc(release.download_url)}">⬇ ดาวน์โหลด SP+ v${esc(release.version)}</a><br><small>${esc(release.file_name)} · SHA-256: <code>${esc(release.sha256)}</code></small></p>`:'';
const keyView=(key,machine)=>key?`<p>รหัสเครื่อง <code>${esc(machine)}</code><br>คีย์ <code>${esc(key)}</code> <button type="button" class="splus-copy" data-key="${esc(key)}">คัดลอก</button></p>`:'';
const claimForm=(kind,id)=>`<form class="splus-claim" data-kind="${kind}" ${id?`data-id="${Number(id)}"`:''}>
  <p>ติดตั้งและเปิด SP+ เพื่อดูรหัสเครื่อง แล้วกรอกเพื่อรับคีย์สำหรับ Windows เครื่องนี้</p>
  <label>รหัสเครื่อง <input name="machine_id" required maxlength="19" pattern="[0-9A-Fa-f]{4}(-[0-9A-Fa-f]{4}){3}" placeholder="1A2B-3C4D-5E6F-7A8B" autocomplete="off"></label>
  <button type="submit">${kind==='trial'?'เริ่มทดลองใช้ 3 วัน':'รับคีย์'}</button><p class="splus-error" role="alert"></p></form>`;
const paidCard=x=>`<article class="card"><h2>SP+ · ${tier[x.plan_code]} บัญชี</h2><p>ตลอดชีพ · จัดการบัญชีพร้อมกันสูงสุด ${tier[x.plan_code]} บัญชี · Windows 1 เครื่อง</p>${download()}
  ${x.key?keyView(x.key,x.machine_id):claimForm('paid',x.order_item_id)}</article>`;
const ownerCard=x=>`<article class="card"><h2>SP+ OWNER</h2><p>ตลอดชีพ · ไม่จำกัดบัญชี · Windows 1 เครื่อง</p>${download()}${keyView(x.key,x.machine_id)}</article>`;
function addOwnerMore(cursor){
  target.querySelector('#splusOwnerMore')?.remove();if(!cursor)return;
  const more=document.createElement('button');more.id='splusOwnerMore';more.textContent='ดูคีย์ OWNER เพิ่ม';
  more.onclick=async()=>{more.disabled=true;try{
    const response=await fetch(`/api/vision7/splus/entitlements?owner_cursor=${encodeURIComponent(cursor)}`,{cache:'no-store'});
    if(!response.ok)throw new Error();const data=await response.json();more.remove();
    target.insertAdjacentHTML('beforeend',(data.owner||[]).map(ownerCard).join(''));bind();addOwnerMore(data.owner_next_cursor);
  }catch{more.disabled=false;more.textContent='โหลดคีย์ OWNER ไม่สำเร็จ · กดเพื่อลองใหม่'}};target.append(more);
}
function bind(){
  target.querySelectorAll('.splus-copy').forEach(button=>button.onclick=async()=>{await navigator.clipboard.writeText(button.dataset.key);button.textContent='คัดลอกแล้ว'});
  target.querySelectorAll('.splus-claim').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('button'),error=form.querySelector('.splus-error');button.disabled=true;error.textContent='';
    try{
      const body={kind:form.dataset.kind,machine_id:form.elements.machine_id.value,...(form.dataset.id?{order_item_id:Number(form.dataset.id)}:{})};
      const response=await fetch('/api/vision7/splus/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'รับคีย์ไม่สำเร็จ');await load();
    }catch(e){error.textContent=e.message||'เชื่อมต่อไม่สำเร็จ'}finally{button.disabled=false}
  });
}
async function load(cursor){
  const url='/api/vision7/splus/entitlements'+(cursor?`?cursor=${encodeURIComponent(cursor)}`:'');
  const response=await fetch(url,{cache:'no-store'});if(response.status===401)return;
  const data=await response.json();if(!response.ok)throw new Error(data.error||'โหลดสิทธิ์ SP+ ไม่สำเร็จ');
  if(!cursor){release=data.release;target.innerHTML='';if(!data.ready&&!data.paid?.length&&!data.owner?.length&&!data.trial)return;
    target.insertAdjacentHTML('beforeend','<h2>SP+ · คีย์และตัวติดตั้ง</h2>');
    if(data.ready){
      const trial=data.trial;
      target.insertAdjacentHTML('beforeend',`<article class="card"><h2>ทดลอง SP+ ฟรี</h2><p>3 วัน · จัดการบัญชีพร้อมกันสูงสุด 10 บัญชี · Windows 1 เครื่อง</p>${download()}
        ${trial?`<p>สิทธิ์ทดลอง${Date.parse(trial.expires_at)>Date.now()?'':'หมดอายุ'} · ถึง ${esc(trial.expires_at)}</p>${keyView(trial.key,trial.machine_id)}`:claimForm('trial')}</article>`);
    }
    for(const owner of data.owner||[])target.insertAdjacentHTML('beforeend',ownerCard(owner));
  }
  for(const paid of data.paid||[])target.insertAdjacentHTML('beforeend',paidCard(paid));
  nextCursor=data.next_cursor;
  target.querySelector('#splusMore')?.remove();
  if(nextCursor){const more=document.createElement('button');more.id='splusMore';more.textContent='ดูออเดอร์ SP+ เพิ่ม';more.onclick=async()=>{more.disabled=true;try{await load(nextCursor)}catch{more.disabled=false;more.textContent='โหลดออเดอร์ไม่สำเร็จ · กดเพื่อลองใหม่'}};target.append(more)}
  if(!cursor)addOwnerMore(data.owner_next_cursor);
  bind();
}
load().catch(error=>{target.innerHTML=`<article class="card"><p role="alert">${esc(error.message||'โหลดสิทธิ์ SP+ ไม่สำเร็จ')}</p><button type="button" id="splusRetry">ลองใหม่</button></article>`;target.querySelector('#splusRetry').onclick=()=>load().catch(()=>{});});
