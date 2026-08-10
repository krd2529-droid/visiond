import('/facebook-chat.js?v=014104');
document.addEventListener('DOMContentLoaded',async()=>{
  const year=document.querySelector('[data-year]');
  if(year)year.textContent=new Date().getFullYear();
  const nav=document.querySelector('.topbar nav');
  if(nav)nav.innerHTML='<a class="nav-home-link" href="/">หน้าแรก</a><a href="/digital-products.html">สินค้าดิจิทัล</a><a class="nav-course-basket" href="/course-seller.html">สร้างตะกร้าคอร์ส</a><a href="/courses.html">ระบบ V-Learning</a><a href="/login.html">เข้าสู่ระบบ</a><a class="cart-nav" href="/cart.html"><span aria-hidden="true">🛒</span> รถเข็น <b data-cart-count>0</b></a>';
  try{const items=JSON.parse(localStorage.getItem('vd_cart')||'[]'),count=(Array.isArray(items)?items:[]).reduce((sum,item)=>sum+(Number(item?.quantity)||1),0);document.querySelectorAll('[data-cart-count]').forEach(x=>x.textContent=Math.min(30,count))}catch{}
  await import('/nav-account.js?v=014104');
});
import('/i18n.js?v=014104');
