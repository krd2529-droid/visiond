(async()=>{
  try{
    const response=await fetch('/api/course-seller',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json(),balance=Number(data.credit_balance)||0,identity=document.querySelector('#dashIdentity');
    if(!identity||identity.parentElement.querySelector('.owner-credit-card'))return;
    const card=document.createElement('div');
    card.className='owner-credit-card';
    card.innerHTML=`<small>เจ้าของคอร์ส</small><strong>เครดิตคงเหลือ ${balance} แต้ม</strong><a href="${balance>0?'/course-seller.html?create=1':'/product.html?slug=course-selling-rights-30-days'}">${balance>0?'สร้างตะกร้าคอร์สใหม่':'ซื้อเครดิตเพิ่ม'}</a>`;
    identity.parentElement.querySelector('.member-course-owner-badge')?.insertAdjacentElement('afterend',card) || identity.insertAdjacentElement('afterend',card);
  }catch(error){console.warn('course owner dashboard unavailable',error)}
})();
