import('/facebook-chat.js?v=01142');
const authMessage=document.querySelector('#pageAuthMsg');
const returnTo=()=>sessionStorage.getItem('vd_return_to')||'/dashboard.html';

async function submitAuth(form,endpoint,loadingText){
  const button=form.querySelector('button[type="submit"]');
  const original=button.textContent;
  button.disabled=true;
  button.textContent=loadingText;
  if(authMessage) authMessage.textContent='';
  try{
    const payload=Object.fromEntries(new FormData(form));
    if(form.id==='registerPageForm'){
      if(payload.password!==payload.confirmPassword) throw new Error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      payload.name=`${payload.firstName||''} ${payload.lastName||''}`.trim();
      delete payload.confirmPassword;
      payload.termsAccepted=payload.termsAccepted==='true';
    }
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||'ดำเนินการไม่สำเร็จ');
    sessionStorage.removeItem('vd_return_to');
    location.href=returnTo();
  }catch(error){
    if(authMessage) authMessage.textContent=error.message;
  }finally{
    button.disabled=false;
    button.textContent=original;
  }
}

document.querySelector('#loginPageForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  submitAuth(event.currentTarget,'/api/auth/login','กำลังเข้าสู่ระบบ…');
});

document.querySelector('#registerPageForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  submitAuth(event.currentTarget,'/api/auth/register','กำลังสมัครสมาชิก…');
});

document.querySelector('#forgotForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(authMessage) authMessage.textContent='ระบบตั้งรหัสผ่านใหม่จะเปิดใช้งานเมื่อเชื่อมอีเมลของ VisionD';
});
