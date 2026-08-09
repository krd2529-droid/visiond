const roleLabel={boss:'Boss',admin:'Admin',user:'สมาชิก',customer:'สมาชิก'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initAccountNav(){
  document.querySelectorAll('a[href="/cart.html"]').forEach(link=>link.setAttribute('href','/cart'));
  document.querySelectorAll('a[href^="/digital-products.html"]').forEach(link=>link.setAttribute('href',link.getAttribute('href').replace('/digital-products.html','/digital-products')));
  const nav=document.querySelector('.topbar nav');
  if(!nav||nav.dataset.accountReady)return;
  nav.dataset.accountReady='1';
  nav.querySelectorAll('a[href="/member"],a[href="/member.html"]').forEach(link=>link.remove());
  nav.querySelectorAll('a[href^="/dashboard"]').forEach(link=>link.remove());
  let cartLink=nav.querySelector('a[href="/cart"],a[href="/cart.html"]');
  if(!cartLink){cartLink=document.createElement('a');cartLink.href='/cart';nav.append(cartLink)}
  if(cartLink){cartLink.classList.add('nav-quick-action','nav-cart-action');const count=cartLink.querySelector('[data-cart-count]')?.outerHTML||'<b data-cart-count>0</b>';cartLink.innerHTML=`<span aria-hidden="true">🛒</span><strong>รถเข็น</strong>${count}`}
  if(!document.querySelector('#visiond-admin-nav-style'))document.head.insertAdjacentHTML('beforeend','<style id="visiond-admin-nav-style">.topbar nav .nav-quick-action{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 12px;border:1px solid rgba(255,255,255,.38);border-radius:12px;background:rgba(255,255,255,.13);color:#fff!important;font-weight:900!important;box-shadow:0 5px 14px rgba(0,55,52,.12)}.topbar nav .nav-quick-action>span{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.17);font-size:14px}.topbar nav .nav-quick-action:hover{transform:translateY(-1px);background:#fff;color:#06726e!important;box-shadow:0 8px 18px rgba(0,55,52,.18)}.topbar nav .nav-cart-action{background:#087d78}.topbar nav .nav-cart-action [data-cart-count]{margin-left:1px}.topbar nav .nav-admin-link{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;padding:9px 13px;border:1px solid #ffe39a;border-radius:12px;background:#fff3c8;color:#07524e!important;font-weight:1000!important;box-shadow:0 5px 14px #003b3826}.topbar nav .nav-admin-link:hover{transform:translateY(-1px);background:#fff;color:#073f3d!important}.topbar nav .nav-member-account{position:relative;flex:0 0 auto}.nav-notification-badge{position:absolute;top:-7px;right:-7px;display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 5px;border:2px solid #fff;border-radius:999px;background:#d71920;color:#fff;font-size:11px;font-style:normal;font-weight:1000}.course-owner-badge{display:inline-flex!important;align-items:center;justify-content:center;width:max-content;padding:6px 10px;border:2px solid #fff;border-radius:999px;background:#d71920!important;color:#fff!important;font-size:11px;font-weight:1000;line-height:1;box-shadow:0 3px 9px #74000655;white-space:nowrap}@media(max-width:800px){.topbar nav .nav-quick-action,.topbar nav .nav-admin-link{display:inline-flex!important;min-width:max-content;padding:8px 11px}.topbar nav{flex-wrap:nowrap!important;overflow-x:auto}}</style>');
  if(!document.querySelector('#visiond-unified-account-actions'))document.head.insertAdjacentHTML('beforeend','<style id="visiond-unified-account-actions">.topbar nav .nav-cart-action,.topbar nav .nav-admin-link,.topbar nav .nav-member-account,.topbar nav .nav-logout{box-sizing:border-box!important;width:155px!important;min-width:155px!important;height:46px!important;min-height:46px!important;margin:0!important;padding:8px 12px!important;border:1px solid rgba(255,255,255,.36)!important;border-radius:13px!important;background:rgba(255,255,255,.12)!important;color:#fff!important;box-shadow:0 5px 14px rgba(0,55,52,.12)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;font:inherit!important;font-size:13px!important;font-weight:900!important;line-height:1!important;text-decoration:none!important}.topbar nav .nav-cart-action:hover,.topbar nav .nav-admin-link:hover,.topbar nav .nav-member-account:hover,.topbar nav .nav-logout:hover{transform:translateY(-1px)!important;background:rgba(255,255,255,.2)!important;color:#fff!important;box-shadow:0 8px 18px rgba(0,55,52,.18)!important}.topbar nav .nav-admin-link{border-color:rgba(255,227,154,.75)!important}.topbar nav .nav-cart-action>span,.topbar nav .nav-admin-link>span:first-child,.topbar nav .nav-logout>span{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;flex:0 0 24px!important;border-radius:7px!important;background:rgba(255,255,255,.16)!important}.topbar nav .nav-member-account b{font-size:13px!important;white-space:nowrap!important}.topbar nav .nav-member-account em{margin-left:auto!important}.topbar nav .nav-member-dot{flex:0 0 8px!important}.topbar nav .nav-cart-action [data-cart-count]{display:grid!important;place-items:center!important;min-width:23px!important;height:23px!important;margin-left:auto!important;padding:0 4px!important;border-radius:999px!important;background:#f2c85b!important;color:#134542!important;font-size:11px!important}@media(max-width:800px){.topbar nav .nav-cart-action,.topbar nav .nav-admin-link,.topbar nav .nav-member-account,.topbar nav .nav-logout{width:145px!important;min-width:145px!important}}</style>');
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
