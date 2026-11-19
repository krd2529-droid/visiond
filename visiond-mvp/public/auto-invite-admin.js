const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=document.querySelector('#autoInviteIssues'),more=document.querySelector('#autoInviteMore');
let cursor=null;
async function load(){
  more.disabled=true;
  try{
    const r=await fetch(`/api/admin/vision7/auto-invite-issues${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`),d=await r.json();
    if(!r.ok)throw new Error(d.error||'โหลดรายการไม่สำเร็จ');
    const html=(d.items||[]).map(x=>`<section class="license-row"><div><b>${esc(x.user_name||x.email||`#${x.user_id}`)}</b> · ออเดอร์ ${esc(x.order_no||x.order_id)}<br><small>${Number(x.price)/100} บาท · ${x.plan_code==='monthly'?'30 วัน':'ตลอดชีพ'}${x.expires_at?' · หมดอายุ '+esc(x.expires_at):''} · สถานะออเดอร์ ${esc(x.order_status)} · ${x.machine_id?`เครื่อง ${esc(x.machine_id)} · คีย์ลงท้าย ${esc(x.key_last4)} · ออกเมื่อ ${esc(x.issued_at)}`:'รอลูกค้าระบุรหัสเครื่อง'}</small></div></section>`).join('');
    if(cursor)list.insertAdjacentHTML('beforeend',html);
    else list.innerHTML=html||'<p class="muted">ยังไม่มีออเดอร์ Follow me ที่ชำระเงิน</p>';
    cursor=d.next_cursor;more.hidden=!cursor;
  }catch(error){if(!cursor)list.textContent=error.message;more.textContent='โหลดไม่สำเร็จ · กดเพื่อลองใหม่';more.hidden=false}
  finally{more.disabled=false}
}
more.onclick=load;load();
const setup=document.querySelector('#autoInviteSetupForm'),setupState=document.querySelector('#autoInviteSetupState');
setup.onsubmit=async event=>{
  event.preventDefault();
  const file=setup.elements.installer.files[0],submit=setup.querySelector('button[type=submit]');
  if(!file||file.name!=='FollowMe-Setup-1.7.6.exe'||file.size!==45258047){setupState.textContent='กรุณาเลือกตัวติดตั้งลูกค้า FollowMe-Setup-1.7.6.exe ที่ถูกต้อง';return}
  const body=new FormData();body.set('code','auto-invite');body.set('name','Follow me');body.set('description',setup.elements.description.value);body.set('platform_type','windows');body.set('current_version','1.7.6');body.set('minimum_version','1.7.6');body.set('plans',JSON.stringify([{plan_code:'monthly',name:'คีย์ 30 วัน · Windows 1 เครื่อง',price:590},{plan_code:'lifetime',name:'คีย์ตลอดชีพ · Windows 1 เครื่อง',price:1590}]));body.set('installer',file);
  submit.disabled=true;setupState.textContent='กำลังตรวจและอัปโหลดตัวติดตั้ง…';
  try{const r=await fetch('/api/admin/vision7/programs',{method:'POST',body}),d=await r.json();if(!r.ok)throw new Error(d.error||'เพิ่มโปรแกรมไม่สำเร็จ');setupState.textContent='เพิ่ม Follow me พร้อมแพ็กเกจ 590 และ 1,590 บาทแล้ว';setup.reset();window.location.reload()}
  catch(error){setupState.textContent=error.message}finally{submit.disabled=false}
};
