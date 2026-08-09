import('/facebook-chat.js?v=01195');
document.addEventListener('DOMContentLoaded',async()=>{
  const year=document.querySelector('[data-year]');
  if(year)year.textContent=new Date().getFullYear();
  const nav=document.querySelector('.topbar nav');
  if(nav)nav.innerHTML='<a class="nav-home-link" href="/">หน้าแรก</a><a href="/digital-products">สินค้า</a><a href="/courses.html">คอร์ส</a><a href="/login.html">เข้าสู่ระบบ</a><a class="cart-nav" href="/cart"><span aria-hidden="true">🛒</span> รถเข็น <b data-cart-count>0</b></a>';
  try{const count=JSON.parse(localStorage.getItem('vd_cart')||'[]').length;document.querySelectorAll('[data-cart-count]').forEach(x=>x.textContent=count)}catch{}
  await import('/nav-account.js?v=01414');
});
import('/i18n.js?v=01331');
