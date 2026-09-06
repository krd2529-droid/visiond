(async()=>{
  const box=document.createElement('section');box.className='panel';box.setAttribute('aria-live','polite');
  const main=document.querySelector('main');if(!main)return;main.prepend(box);
  try{
    const response=await fetch('/api/vtools',{cache:'no-store'});if(!response.ok)throw new Error();
    const {access}=await response.json();
    if(access?.admin){box.remove();return}
    box.textContent=access?.active?`สิทธิ์ VX · สูงสุด ${access.account_limit} บัญชี · หมดอายุ ${new Date(access.expires_at.replace(' ','T')+'Z').toLocaleString('th-TH')} `:'ยังไม่มีสิทธิ์ VX ที่ใช้งานอยู่หรือสิทธิ์หมดอายุ ';
    const link=document.createElement('a');link.href='/vtools';link.textContent='ดูแพ็กเกจ / ต่ออายุที่ Vtools';box.append(link);
    if(!access){const login=document.createElement('a');login.href='/login';login.textContent=' · เข้าสู่ระบบ';box.append(login)}
    const back=document.querySelector('header > a');if(back){back.href='/vtools';back.textContent='← Vtools'}
  }catch{box.textContent='ตรวจสอบสิทธิ์ VX ไม่สำเร็จ กรุณาโหลดหน้าใหม่'}
})();
