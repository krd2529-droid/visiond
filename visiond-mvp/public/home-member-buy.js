const lifetimeMemberButton=document.querySelector('#buyLifetimeMember');
if(lifetimeMemberButton)lifetimeMemberButton.addEventListener('click',async()=>{
  lifetimeMemberButton.disabled=true;
  lifetimeMemberButton.textContent='กำลังสร้างออเดอร์…';
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productSlugs:['member-3-categories-lifetime']})});
    if(response.status===401){sessionStorage.setItem('vd_return_to','/member');location.href='/login.html';return}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'สร้างออเดอร์ไม่สำเร็จ');
    location.href='/dashboard.html#orders';
  }catch(error){alert(error.message||'สร้างออเดอร์ไม่สำเร็จ');lifetimeMemberButton.disabled=false;lifetimeMemberButton.textContent='ซื้อสินค้านี้'}
});
