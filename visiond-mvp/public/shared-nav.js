import('/facebook-chat.js?v=014273');
document.addEventListener('DOMContentLoaded',async()=>{
  const year=document.querySelector('[data-year]');
  if(year)year.textContent=new Date().getFullYear();
  const nav=document.querySelector('.topbar nav');
  if(nav){
    // header-shell may have moved the static account/cart actions out of <nav>
    // before this initializer runs. Remove that stale utility container before
    // creating the canonical navigation, otherwise both sets remain visible.
    const staleUtility=nav.closest('.topbar')?.querySelector(':scope > .header-utility'),languageSwitcher=staleUtility?.querySelector('.vd-language-switcher')||nav.querySelector('.vd-language-switcher');
    languageSwitcher?.remove();staleUtility?.remove();
    const path=location.pathname.replace(/\.html$/,'')||'/';
    const links=[['nav-home-link','/','หน้าแรก'],['','/digital-products.html','สินค้าดิจิทัล'],['nav-course-basket','/course-center','ศูนย์จัดการคอร์ส'],['','/courses.html','ระบบ V-Learning'],['','/bots.html','VBot'],['','/blog.html','บทความ'],['','/about.html','เกี่ยวกับเรา']];
    nav.innerHTML=links.map(([className,href,label])=>{const target=href.replace(/\.html$/,'');const current=path===target;return `<a${className?` class="${className}"`:''} href="${href}"${current?' aria-current="page"':''}>${label}</a>`}).join('')+'<a id="navLogin" href="/login.html">เข้าสู่ระบบ</a><a id="navRegister" class="signup-link" href="/register.html">สมัครสมาชิก</a><a class="cart-nav" href="/cart.html"><span aria-hidden="true">🛒</span> รถเข็น <b data-cart-count>0</b></a>';
    if(languageSwitcher)nav.append(languageSwitcher);
  }
  try{const items=JSON.parse(localStorage.getItem('vd_cart')||'[]'),count=(Array.isArray(items)?items:[]).reduce((sum,item)=>sum+(Number(item?.quantity)||1),0);document.querySelectorAll('[data-cart-count]').forEach(x=>x.textContent=Math.min(30,count))}catch{}
  await import('/nav-account.js?v=014273');
});
import('/i18n.js?v=014273');
