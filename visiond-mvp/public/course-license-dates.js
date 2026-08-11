const licenseDate=value=>{
  if(!value)return 'ตลอดอายุระบบ';
  const raw=String(value).replace(' ','T');
  const parsed=new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');
  return Number.isNaN(parsed.getTime())?'-':parsed.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
};

function showLicenseDates(){
  if(typeof state==='undefined'||!state?.licenses)return;
  let summary=licenseList.parentElement.querySelector('.credit-summary');
  if(!summary){
    summary=document.createElement('div');
    summary.className='credit-summary';
    licenseList.before(summary);
  }
  summary.innerHTML=`<span><small>เครดิตคงเหลือ</small><strong>${Number(state.credit_balance)||0} เครดิต</strong></span><span><small>ใช้สร้างตะกร้าแล้ว</small><strong>${Number(state.credit_used)||0} เครดิต</strong></span><p>1 เครดิต = สร้างตะกร้าคอร์สได้ 1 ตะกร้า · หักเมื่อสร้างสำเร็จเท่านั้น · เครดิตไม่คืนเงินหรือแลกเป็นเงินสด เว้นแต่ระบบยังใช้งานไม่ได้ภายใน 7 วันและ VisionD ตรวจสอบว่าเกิดจากระบบจริง</p>`;
  licenseList.querySelectorAll('.license-row').forEach((row,index)=>{
    const license=state.licenses[index];
    if(!license||row.querySelector('.license-dates'))return;
    if(license.credit_used&&!license.bound_course_id){const pill=row.querySelector('.pill');if(pill)pill.textContent='ใช้เครดิตแล้ว'}
    const details=document.createElement('div');
    details.className='license-dates';
    details.innerHTML=`<span><small>ซื้อและได้รับอนุมัติสิทธิ์</small><strong>${licenseDate(license.purchased_at||license.granted_at)}</strong></span><span><small>ระยะเวลาแก้ไข</small><strong>${license.credit&&license.available?'ยังไม่เริ่มนับ — เริ่มเมื่อสร้างสำเร็จ':Number(license.license_edit_days)===0?'ตลอดอายุระบบ':license.expires_at?`แก้ไขได้ถึง ${licenseDate(license.expires_at)}`:'ใช้เครดิตแล้ว'}</strong></span>`;
    row.querySelector('div')?.append(details);
  });
}

new MutationObserver(showLicenseDates).observe(licenseList,{childList:true});
showLicenseDates();
