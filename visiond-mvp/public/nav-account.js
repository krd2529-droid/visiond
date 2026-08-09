const roleLabel={boss:'Boss',admin:'Admin',user:'สมาชิก',customer:'สมาชิก'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initAccountNav(){
  document.querySelectorAll('a[href="/cart.html"]').forEach(link=>link.setAttribute('href','/cart'));
  document.querySelectorAll('a[href^="/digital-products.html"]').forEach(link=>link.setAttribute('href',link.getAttribute('href').replace('/digital-products.html','/digital-products')));
  const nav=document.querySelector('.topbar nav');
  if(!nav||nav.dataset.accountReady)return;
  nav.dataset.accountReady='1';
  nav.querySelectorAll('a[href="/dashboard.html#my-products"]').forEach(link=>link.remove());
  const cartLink=nav.querySelector('a[href="/cart"],a[href="/cart.html"]');
  if(cartLink){cartLink.classList.add('nav-quick-action','nav-cart-action');const count=cartLink.querySelector('[data-cart-count]')?.outerHTML||'<b data-cart-count>0</b>';cartLink.innerHTML=`<span aria-hidden="true">🛒</span><strong>รถเข็น</strong>${count}`}
  if(![...nav.querySelectorAll('a')].some(link=>['/member','/member.html'].includes(link.getAttribute('href')))){
    const memberStore=document.createElement('a');memberStore.href='/member';memberStore.textContent='Member รายหมวด';nav.append(memberStore);
  }
  if(!document.querySelector('#visiond-admin-nav-style'))document.head.insertAdjacentHTML('beforeend','<style id="visiond-admin-nav-style">.topbar nav .nav-quick-action{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 12px;border:1px solid rgba(255,255,255,.38);border-radius:12px;background:rgba(255,255,255,.13);color:#fff!important;font-weight:900!important;box-shadow:0 5px 14px rgba(0,55,52,.12)}.topbar nav .nav-quick-action>span{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.17);font-size:14px}.topbar nav .nav-quick-action:hover{transform:translateY(-1px);background:#fff;color:#06726e!important;box-shadow:0 8px 18px rgba(0,55,52,.18)}.topbar nav .nav-cart-action{background:#087d78}.topbar nav .nav-cart-action [data-cart-count]{margin-left:1px}.topbar nav .nav-admin-link{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;padding:9px 13px;border:1px solid #ffe39a;border-radius:12px;background:#fff3c8;color:#07524e!important;font-weight:1000!important;box-shadow:0 5px 14px #003b3826}.topbar nav .nav-admin-link:hover{transform:translateY(-1px);background:#fff;color:#073f3d!important}.topbar nav .nav-member-account{position:relative;flex:0 0 auto}.nav-notification-badge{position:absolute;top:-7px;right:-7px;display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 5px;border:2px solid #fff;border-radius:999px;background:#d71920;color:#fff;font-size:11px;font-style:normal;font-weight:1000}.course-owner-badge{display:inline-flex!important;align-items:center;justify-content:center;width:max-content;padding:6px 10px;border:2px solid #fff;border-radius:999px;background:#d71920!important;color:#fff!important;font-size:11px;font-weight:1000;line-height:1;box-shadow:0 3px 9px #74000655;white-space:nowrap}@media(max-width:800px){.topbar nav .nav-quick-action,.topbar nav .nav-admin-link{display:inline-flex!important;min-width:max-content;padding:8px 11px}.topbar nav{flex-wrap:nowrap!important;overflow-x:auto}}</style>');
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store'});
    if(!response.ok)return;
    const {user}=await response.json();
    if(!user)return;
    nav.querySelectorAll('a[href="/login.html"],a[href="/register.html"]').forEach(link=>link.remove());
    const account=document.createElement('a');
    account.className='nav-member-account';
    account.href='/dashboard.html';
    nav.querySelectorAll('#navMember,.member-nav-status').forEach(link=>link.remove());
    account.innerHTML=`<span class="nav-member-dot"></span><span><b>บัญชีของฉัน</b></span><em>${esc(roleLabel[user.role]||user.role)}</em>`;
    const ownerBadge=user.is_course_owner?Object.assign(document.createElement('a'),{className:'course-owner-badge',href:'/course-seller.html',textContent:'เจ้าของคอร์ส'}):null;
    const isStaff=['boss','admin'].includes(user.role);
    let adminLink=nav.querySelector('.nav-admin-link');
    if(isStaff&&!adminLink)adminLink=nav.querySelector('a[href="/admin"],a[href="/admin.html"]');
    if(isStaff&&!adminLink)adminLink=document.createElement('a');
    if(isStaff&&adminLink){adminLink.hidden=false;adminLink.classList.add('nav-admin-link');adminLink.href='/admin';adminLink.innerHTML='<span aria-hidden="true">⚙</span><b>หลังบ้าน</b>'}
    const logout=document.createElement('button');
    logout.className='nav-logout';
    logout.type='button';
    logout.innerHTML='<span aria-hidden="true">↪</span> ออกจากระบบ';
    logout.onclick=async()=>{logout.disabled=true;await fetch('/api/auth/logout',{method:'POST'});location.href='/'};
    if(adminLink)nav.append(adminLink);
    nav.append(account,...(ownerBadge?[ownerBadge]:[]),logout);
    fetch('/api/notifications',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{const count=Number(d?.count)||0;if(!count)return;const badge=document.createElement('i');badge.className='nav-notification-badge';badge.textContent=count>99?'99+':count;account.append(badge);account.href='/dashboard.html#notifications';account.title=`มีการแจ้งเตือน ${count} รายการ`}).catch(()=>{});
  }catch(error){console.warn('member navigation unavailable',error)}
}

initAccountNav();
