const form=document.querySelector('#splusOwnerForm');
const state=document.querySelector('#splusOwnerState');
const keyLine=document.querySelector('#splusOwnerKey');
form?.addEventListener('submit',async event=>{
  event.preventDefault();keyLine.hidden=true;state.textContent='กำลังตรวจและออกคีย์…';
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
    const body={email:form.elements.email.value.trim(),machine_id:form.elements.machine_id.value.trim().toUpperCase()};
    const response=await fetch('/api/admin/vision7/splus-owner',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'ออกคีย์ไม่สำเร็จ');
    keyLine.querySelector('code').textContent=data.key;
    keyLine.hidden=false;state.textContent=`ออกคีย์ให้ ${data.recipient_email} แล้ว${data.existing?' (คีย์เดิม)':''}`;
  }catch(error){state.textContent=error.message||'เชื่อมต่อไม่สำเร็จ'}finally{button.disabled=false}
});
keyLine?.querySelector('button')?.addEventListener('click',async()=>{
  await navigator.clipboard.writeText(keyLine.querySelector('code').textContent);
  state.textContent='คัดลอกคีย์แล้ว';
});
