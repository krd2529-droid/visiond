import('/facebook-chat.js?v=014284');
const authMessage=document.querySelector('#pageAuthMsg');
const returnTo=()=>{
  const saved=String(sessionStorage.getItem('vd_return_to')||'').trim();
  if(!/^\/(?!\/)/.test(saved)) return '/dashboard.html';
  try{
    const target=new URL(saved,location.origin);
    if(target.origin!==location.origin) return '/dashboard.html';
    return `${target.pathname}${target.search}${target.hash}`;
  }catch{
    return '/dashboard.html';
  }
};

async function submitAuth(form,endpoint,loadingText){
  const button=form.querySelector('button[type="submit"]');
  const original=button.textContent;
  button.disabled=true;
  button.textContent=loadingText;
  if(authMessage) authMessage.textContent='';
  try{
    const payload=Object.fromEntries(new FormData(form));
    if(form.id==='registerPageForm'){
      payload.firstName=String(payload.firstName||'').trim();
      payload.lastName=String(payload.lastName||'').trim();
      payload.email=String(payload.email||'').trim();
      payload.phone=String(payload.phone||'').replace(/\D/g,'');
      if(!payload.firstName||!payload.lastName||!payload.email||!payload.phone) throw new Error('กรุณากรอกชื่อ นามสกุล เบอร์โทรศัพท์ และอีเมลให้ครบ');
      if(!/^\S+@\S+\.\S+$/.test(payload.email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
      if(!/^0\d{8,9}$/.test(payload.phone)) throw new Error('กรุณากรอกเบอร์โทรศัพท์ไทย 9–10 หลัก โดยขึ้นต้นด้วย 0');
      if(payload.password!==payload.confirmPassword) throw new Error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      delete payload.confirmPassword;
      payload.termsAccepted=payload.termsAccepted==='true';
    }
    if(form.id==='loginPageForm') payload.remember=payload.remember==='on';
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||`เซิร์ฟเวอร์เข้าสู่ระบบขัดข้อง (${response.status}) กรุณาลองใหม่`);
    window.visiondTrack?.(form.id==='registerPageForm'?'signup_complete':'login_success');
    const destination=returnTo();
    sessionStorage.removeItem('vd_return_to');
    location.href=destination;
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
  window.visiondTrack?.('signup_start');
  submitAuth(event.currentTarget,'/api/auth/register','กำลังสมัครสมาชิก…');
});

document.querySelector('#forgotForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),original=button.textContent;
  button.disabled=true;button.textContent='กำลังส่งลิงก์…';if(authMessage)authMessage.textContent='';
  try{
    const fields=new FormData(form),email=String(fields.get('email')||'').trim(),turnstile_token=String(fields.get('turnstile_token')||'');
    const response=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,turnstile_token})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
    if(authMessage)authMessage.textContent=data.message;
    form.reset();
  }catch(error){if(authMessage)authMessage.textContent=error.message}
  finally{button.disabled=false;button.textContent=original}
});
