(()=>{
  const money=n=>new Intl.NumberFormat('th-TH').format((Number(n)||0)/100)+' บาท';
  fetch('/api/first-order-promotion',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(({item})=>{
    if(!item||item.stage==='none'||item.stage==='finished')return;
    const offer=item.stage==='offer'&&item.active;
    const wrap=document.createElement('aside');wrap.className='first-order-nudge '+(offer?'is-offer':'is-teaser');wrap.dataset.feature='FIRST-ORDER-INCENTIVE-001';
    wrap.innerHTML=offer?`<button class="first-order-close" aria-label="ปิด">×</button><span class="first-order-icon">🎁</span><div><b>ส่วนลดพิเศษของคุณมาแล้ว!</b><p>ซื้อครั้งแรก ยอดสินค้าที่ร่วมรายการ <strong>${money(item.minimum)}ขึ้นไป</strong> ลด 50% สูงสุด ${money(item.cap)} <em data-promo-clock></em></p><small>ระบบใช้ให้อัตโนมัติ · ไม่รวมสิทธิ์ลงขายคอร์สออนไลน์</small></div><a href="/digital-products.html">ใช้สิทธิ์ตอนนี้</a>`:`<button class="first-order-close" aria-label="ปิด">×</button><span class="first-order-icon">🔔</span><div><b>มีของขวัญสมาชิกใหม่รออยู่</b><p>กลับมาอีกครั้งเพื่อรับสิทธิพิเศษสำหรับการซื้อครั้งแรก</p></div><a href="/digital-products.html">เลือกดูสินค้า</a>`;
    const target=document.querySelector('.visiond-visit-strip')||document.querySelector('.topbar');target?.insertAdjacentElement('afterend',wrap);
    wrap.querySelector('.first-order-close').onclick=()=>wrap.remove();
    if(offer){const tick=()=>{const left=Math.max(0,Date.parse(item.expires_at)-Date.now()),h=Math.floor(left/3600000),m=Math.floor(left%3600000/60000),s=Math.floor(left%60000/1000),clock=wrap.querySelector('[data-promo-clock]');if(clock)clock.textContent=left?`เหลือ ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:'สิทธิ์หมดอายุแล้ว';if(!left)setTimeout(()=>wrap.remove(),1500)};tick();setInterval(tick,1000)}
  }).catch(()=>{});
})();
