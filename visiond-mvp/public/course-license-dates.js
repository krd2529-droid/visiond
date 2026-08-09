const licenseDate=value=>{
  if(!value)return 'ตลอดอายุระบบ';
  const raw=String(value).replace(' ','T');
  const parsed=new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');
  return Number.isNaN(parsed.getTime())?'-':parsed.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
};

function showLicenseDates(){
  if(typeof state==='undefined'||!state?.licenses)return;
  licenseList.querySelectorAll('.license-row').forEach((row,index)=>{
    const license=state.licenses[index];
    if(!license||row.querySelector('.license-dates'))return;
    const details=document.createElement('div');
    details.className='license-dates';
    details.innerHTML=`<span><small>ซื้อและได้รับอนุมัติสิทธิ์</small><strong>${licenseDate(license.purchased_at||license.granted_at)}</strong></span><span><small>แก้ไขคอร์สได้ถึง</small><strong>${Number(license.license_edit_days)===0?'ตลอดอายุระบบ':licenseDate(license.expires_at)}</strong></span>`;
    row.querySelector('div')?.append(details);
  });
}

new MutationObserver(showLicenseDates).observe(licenseList,{childList:true});
showLicenseDates();
