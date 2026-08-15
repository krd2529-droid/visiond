(()=>{
  const money=n=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2}).format((Number(n)||0)/100)+' บาท';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let panel;
  async function pay(ids){
    const note=prompt('ใส่เลขอ้างอิงหรือหลักฐานการโอน (จำเป็น)')||'';
    if(!note.trim())return;
    const response=await fetch('/api/admin/course-partner-payouts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids,note})});
    const data=await response.json().catch(()=>({}));
    alert(data.error||data.message||'บันทึกแล้ว');
    if(response.ok)load();
  }
  async function load(){
    if(!panel){
      panel=document.createElement('section');panel.className='payment-settings-card';
      panel.innerHTML='<h2>ยอดแบ่งคอร์สพาร์ตเนอร์ 50/50</h2><div data-summary>กำลังโหลด…</div><p><b>ค่าบริการ VisionD API 1 บาทเป็นรายได้ API แยกจากส่วนแบ่ง 50%</b></p><div data-batches></div><div class="table-wrap" data-rows></div>';
      document.querySelector('#paymentSettingsForm')?.after(panel);
    }
    if(!panel)return;
    const response=await fetch('/api/admin/course-partner-payouts',{cache:'no-store'}),data=await response.json().catch(()=>({}));
    if(!response.ok){panel.querySelector('[data-summary]').textContent=data.error||'โหลดไม่สำเร็จ';return}
    const summary=data.summary||{},items=data.items||[],groups=new Map();
    for(const item of items.filter(item=>item.status==='pending')){const key=String(item.owner_user_id),group=groups.get(key)||{name:item.seller_name||item.seller_email,ids:[],amount:0};group.ids.push(item.id);group.amount+=Number(item.seller_amount)||0;groups.set(key,group)}
    const companyTotal=(Number(summary.slip_fees)||0)+(Number(summary.visiond)||0);
    panel.querySelector('[data-summary]').innerHTML=`ยอดขาย ${money(summary.gross)} · ค่า VisionD API ${money(summary.slip_fees)} · ส่วนแบ่ง VisionD ${money(summary.visiond)} · บริษัทรับรวม ${money(companyTotal)} · รอจ่ายผู้สอน <b>${money(summary.pending)}</b>`;
    panel.querySelector('[data-batches]').innerHTML=[...groups].map(([owner,group])=>`<button type="button" data-pay-owner="${owner}">จ่าย ${esc(group.name)} ${money(group.amount)} (${group.ids.length} รายการ)</button>`).join(' ');
    panel.querySelectorAll('[data-pay-owner]').forEach(button=>button.onclick=()=>pay(groups.get(button.dataset.payOwner).ids));
    panel.querySelector('[data-rows]').innerHTML=`<table><thead><tr><th>ออเดอร์/คอร์ส</th><th>ผู้สอน</th><th>คำนวณ</th><th>สถานะ</th></tr></thead><tbody>${items.map(item=>`<tr><td>${esc(item.order_no)}<small>${esc(item.course_title)}</small></td><td>${esc(item.seller_name||item.seller_email)}</td><td>แบ่งยอด: VisionD ${money(item.visiond_amount)} / ผู้สอน ${money(Number(item.seller_amount)+Number(item.slip_fee))}<br>หัก VisionD API จากผู้สอน ${money(item.slip_fee)} → ผู้สอนรับ ${money(item.seller_amount)}<br><b>บริษัทรับรวม ${money(Number(item.slip_fee)+Number(item.visiond_amount))}</b></td><td>${item.status==='paid'?`จ่ายแล้ว · ${esc(item.payout_batch_no||'-')}<br><small>${esc(item.payment_note)}</small>`:`<button data-pay="${item.id}">จ่ายรายการนี้</button>`}</td></tr>`).join('')||'<tr><td colspan="4">ยังไม่มียอดพาร์ตเนอร์</td></tr>'}</tbody></table>`;
    panel.querySelectorAll('[data-pay]').forEach(button=>button.onclick=()=>pay([Number(button.dataset.pay)]));
  }
  document.querySelector('[data-admin-tab="settings"]')?.addEventListener('click',load);
})();
