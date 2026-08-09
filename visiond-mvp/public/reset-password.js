(()=>{
  const form=document.querySelector('#resetPasswordForm'),message=document.querySelector('#pageAuthMsg');
  const params=new URLSearchParams(location.hash.slice(1)),token=String(params.get('token')||'');
  history.replaceState(null,'',`${location.pathname}${location.search}`);
  if(!/^[A-Za-z0-9_-]{40,100}$/.test(token)){form.hidden=true;message.textContent='ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง กรุณาขอลิงก์ใหม่';return}
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]'),original=button.textContent,data=Object.fromEntries(new FormData(form));
    message.textContent='';if(data.password!==data.confirm_password){message.textContent='รหัสผ่านใหม่และคำยืนยันไม่ตรงกัน';return}
    button.disabled=true;button.textContent='กำลังบันทึก…';
    try{const response=await fetch('/api/auth/reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...data,token})}),result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'ตั้งรหัสผ่านไม่สำเร็จ');form.hidden=true;message.textContent=result.message;setTimeout(()=>location.replace('/login.html'),1800)}
    catch(error){message.textContent=error.message;button.disabled=false;button.textContent=original}
  });
})();
