const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Date(v.replace(' ','T')+'Z').toLocaleString('th-TH');
async function loadVtools(){
  const plans=document.querySelector('#vxPlans'),access=document.querySelector('#vxAccess'),notice=document.querySelector('#vxNotice');
  try{
    const response=await fetch('/api/vtools',{cache:'no-store'});if(!response.ok)throw new Error('โหลดแพ็กเกจไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    const data=await response.json();
    access.textContent=data.access?.admin?'บัญชีผู้ดูแลระบบ · ใช้งาน VX ได้':data.access?.active?`สิทธิ์ปัจจุบัน: ${data.access.account_limit} บัญชี · หมดอายุ ${date(data.access.expires_at)}`:data.access?'ยังไม่มีสิทธิ์ VX ที่ใช้งานอยู่ เลือกแพ็กเกจด้านล่างได้เลย':'เข้าสู่ระบบด้วยบัญชี VisionD ก่อนชำระเงิน สิทธิ์ VX จะผูกกับบัญชีที่ซื้อ';
    for(const item of data.scheduled||[]){const line=document.createElement('div');line.textContent=`รอบถัดไป: ${item.account_limit} บัญชี · ${date(item.starts_at)} ถึง ${date(item.expires_at)}`;access.append(line)}
    plans.innerHTML=data.items.map(p=>`<article class="plan"><p class="eyebrow">VX ACCESS</p><h3>${p.account_limit} บัญชี</h3><small>อายุสิทธิ์ ${p.duration_days} วัน</small><p class="price">฿${(p.price/100).toLocaleString('th-TH')}</p><p>เชื่อมและจัดการช่อง TikTok<br>สูงสุด ${p.account_limit} บัญชี</p><button data-plan="${esc(p.slug)}">เพิ่มลงตะกร้า</button></article>`).join('')||'ยังไม่มีแพ็กเกจเปิดขาย';
    const requestedPlan=new URLSearchParams(location.search).get('plan');
    if(requestedPlan){
      const selected=plans.querySelector(`[data-plan="${CSS.escape(requestedPlan)}"]`)?.closest('.plan');
      if(selected){selected.classList.add('plan-highlighted');requestAnimationFrame(()=>selected.scrollIntoView({behavior:'smooth',block:'center'}))}
    }
    plans.addEventListener('click',event=>{
      const button=event.target.closest('[data-plan]');if(!button)return;
      const plan=data.items.find(p=>p.slug===button.dataset.plan);if(!plan)return;
      try{
        const saved=JSON.parse(localStorage.getItem('vd_cart')||'[]'),cart=Array.isArray(saved)?saved:[];
        if(cart.some(p=>p.slug!==plan.slug)){notice.textContent='VX ต้องชำระแยกครั้งละ 1 แพ็กเกจ กรุณาจัดการรายการเดิมในตะกร้าก่อน';return}
        localStorage.setItem('vd_cart',JSON.stringify([{...plan,quantity:1}]));location.assign('/cart');
      }catch{notice.textContent='บันทึกตะกร้าไม่สำเร็จ กรุณาอนุญาตการจัดเก็บข้อมูลของเว็บไซต์'}
    });
  }catch(error){plans.textContent=error.message;access.textContent='ยังตรวจสอบสิทธิ์ไม่ได้'}
}
loadVtools();
