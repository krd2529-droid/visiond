const roleLabel={boss:'Boss',admin:'Admin',user:'สมาชิก',customer:'สมาชิก'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initAccountNav(){
  const nav=document.querySelector('.topbar nav');
  if(!nav||nav.dataset.accountReady)return;
  nav.dataset.accountReady='1';
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
    const logout=document.createElement('button');
    logout.className='nav-logout';
    logout.type='button';
    logout.textContent='ออกจากระบบ';
    logout.onclick=async()=>{logout.disabled=true;await fetch('/api/auth/logout',{method:'POST'});location.href='/'};
    if(![...nav.querySelectorAll('a')].some(link=>link.getAttribute('href')==='/dashboard.html#my-products'))nav.append(products);
    nav.append(account,logout);
  }catch(error){console.warn('member navigation unavailable',error)}
}

initAccountNav();
