const roleLabel={boss:'Boss',admin:'Admin',user:'สมาชิก',customer:'สมาชิก'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initAccountNav(){
  document.querySelectorAll('a[href="/cart.html"]').forEach(link=>link.setAttribute('href','/cart'));
  const nav=document.querySelector('.topbar nav');
  if(!nav||nav.dataset.accountReady)return;
  nav.dataset.accountReady='1';
  if(!document.querySelector('#visiond-admin-nav-style'))document.head.insertAdjacentHTML('beforeend','<style id="visiond-admin-nav-style">.topbar nav .nav-admin-link{display:inline-flex!important;align-items:center;justify-content:center;padding:9px 13px;border:1px solid #ffe39a;border-radius:10px;background:#fff3c8;color:#07524e!important;font-weight:1000!important;box-shadow:0 3px 10px #003b3826}.topbar nav .nav-admin-link:hover{background:#fff;color:#073f3d!important}.topbar nav .nav-member-account{flex:0 0 auto}@media(max-width:800px){.topbar nav .nav-admin-link{display:inline-flex!important;min-width:max-content;padding:8px 11px}.topbar nav{flex-wrap:nowrap!important;overflow-x:auto}}</style>');
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store'});
    if(!response.ok)return;
    const {user}=await response.json();
    if(!user)return;
    nav.querySelectorAll('a[href="/login.html"],a[href="/register.html"]').forEach(link=>link.remove());
    const account=document.createElement('a');
    account.className='nav-member-account';
    account.href='/dashboard.html';
    account.innerHTML=`<span class="nav-member-dot"></span><span><small>กำลังใช้งาน</small><b>${esc(user.username||user.name||'สมาชิก')}</b></span><em>${esc(roleLabel[user.role]||user.role)}</em>`;
    const products=document.createElement('a');
    products.href='/dashboard.html#my-products';
    products.textContent='สินค้าของฉัน';
    const isStaff=['boss','admin'].includes(user.role);
    let adminLink=nav.querySelector('.nav-admin-link');
    if(isStaff&&!adminLink)adminLink=nav.querySelector('a[href="/admin"],a[href="/admin.html"]');
    if(isStaff&&!adminLink)adminLink=document.createElement('a');
    if(isStaff&&adminLink){adminLink.hidden=false;adminLink.classList.add('nav-admin-link');adminLink.href='/admin';adminLink.textContent='⚙ หลังบ้าน'}
    const logout=document.createElement('button');
    logout.className='nav-logout';
    logout.type='button';
    logout.textContent='ออกจากระบบ';
    logout.onclick=async()=>{logout.disabled=true;await fetch('/api/auth/logout',{method:'POST'});location.href='/'};
    if(![...nav.querySelectorAll('a')].some(link=>link.getAttribute('href')==='/dashboard.html#my-products'))nav.append(products);
    if(adminLink)nav.append(adminLink);
    nav.append(account,logout);
  }catch(error){console.warn('member navigation unavailable',error)}
}

initAccountNav();
