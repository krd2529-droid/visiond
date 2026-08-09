const roleLabel={boss:'Boss',admin:'Admin',user:'สมาชิก',customer:'สมาชิก'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initAccountNav(){
  document.querySelectorAll('a[href="/cart.html"]').forEach(link=>link.setAttribute('href','/cart'));
  document.querySelectorAll('a[href^="/digital-products.html"]').forEach(link=>link.setAttribute('href',link.getAttribute('href').replace('/digital-products.html','/digital-products')));
  const nav=document.querySelector('.topbar nav');
  if(!nav||nav.dataset.accountReady)return;
  nav.dataset.accountReady='1';
  if(![...nav.querySelectorAll('a')].some(link=>['/member','/member.html'].includes(link.getAttribute('href')))){
    const memberStore=document.createElement('a');memberStore.href='/member';memberStore.textContent='Member รายหมวด';nav.append(memberStore);
  }
  if(!document.querySelector('#visiond-admin-nav-style'))document.head.insertAdjacentHTML('beforeend','<style id="visiond-admin-nav-style">.topbar nav .nav-admin-link{display:inline-flex!important;align-items:center;justify-content:center;padding:9px 13px;border:1px solid #ffe39a;border-radius:10px;background:#fff3c8;color:#07524e!important;font-weight:1000!important;box-shadow:0 3px 10px #003b3826}.topbar nav .nav-admin-link:hover{background:#fff;color:#073f3d!important}.topbar nav .nav-member-account{flex:0 0 auto}.course-owner-badge{display:inline-flex!important;align-items:center;justify-content:center;width:max-content;padding:6px 10px;border:2px solid #fff;border-radius:999px;background:#d71920!important;color:#fff!important;font-size:11px;font-weight:1000;line-height:1;box-shadow:0 3px 9px #74000655;white-space:nowrap}@media(max-width:800px){.topbar nav .nav-admin-link{display:inline-flex!important;min-width:max-content;padding:8px 11px}.topbar nav{flex-wrap:nowrap!important;overflow-x:auto}}</style>');
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store'});
    if(!response.ok)return;
    const {user}=await response.json();
    if(!user)return;
    nav.querySelectorAll('a[href="/login.html"],a[href="/register.html"]').forEach(link=>link.remove());
    const account=document.createElement('a');
    account.className='nav-member-account';
    account.href='/dashboard.html';
    account.innerHTML=`<span class="nav-member-dot"></span><span><small>ศูนย์บัญชี</small><b>ของฉัน</b></span><em>${esc(roleLabel[user.role]||user.role)}</em>`;
    const ownerBadge=user.is_course_owner?Object.assign(document.createElement('a'),{className:'course-owner-badge',href:'/course-seller.html',textContent:'เจ้าของคอร์ส'}):null;
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
    nav.append(account,...(ownerBadge?[ownerBadge]:[]),logout);
  }catch(error){console.warn('member navigation unavailable',error)}
}

initAccountNav();
