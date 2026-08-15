(()=>{
  const utilitySelector='.nav-cart-action,.cart-nav,.nav-admin-link,.nav-member-account,.course-owner-badge,.nav-logout,.vd-language-switcher,.vd-notification-bell,.signup-link,.member-nav-status,#navLogin,#navRegister,#navMember,#navAdmin';
  let syncing=false,queued=false;
  const isMobile=()=>matchMedia('(max-width: 800px)').matches;
  const cartCount=()=>{try{const saved=JSON.parse(localStorage.getItem('vd_cart')||'[]'),unique=new Map();let total=0;for(const item of Array.isArray(saved)?saved:[]){const key=String(item?.slug||item?.id||'');if(!key||unique.has(key)||total>=30)continue;const rights=item?.category==='resale-rights'||item?.slug==='course-selling-rights',quantity=rights?Math.max(1,Math.floor(Number(item?.quantity)||1)):1;unique.set(key,true);total+=Math.min(quantity,30-total)}return total}catch{return 0}};
  globalThis.VisionDCartCountValue=cartCount;
  function syncCart(header){
    const links=[...header.querySelectorAll('a[href="/cart"],a[href="/cart.html"]')],canonical=links.find(link=>link.classList.contains('nav-cart-action'))||links[0];
    links.forEach(link=>{if(link!==canonical)link.remove()});
    if(!canonical)return;
    canonical.href='/cart';canonical.classList.add('cart-nav','nav-cart-action');
    let badge=canonical.querySelector('[data-cart-count]');if(!badge){badge=document.createElement('b');badge.dataset.cartCount='';canonical.append(badge)}
    const next=String(cartCount());if(badge.textContent!==next)badge.textContent=next;
  }
  const later=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync()})};
  function unwrap(nav,utility){
    nav.querySelectorAll(':scope > .nav-primary-group').forEach(group=>{while(group.firstChild)nav.insertBefore(group.firstChild,group);group.remove()});
    nav.querySelectorAll(':scope > .nav-utility-group').forEach(group=>{while(group.firstChild)utility.append(group.firstChild);group.remove()});
  }
  function sync(){
    if(syncing)return;const header=document.querySelector('.topbar'),nav=header?.querySelector(':scope > nav');if(!header||!nav)return;
    syncing=true;syncCart(header);
    document.querySelector('#visiond-admin-nav-style')?.remove();document.querySelector('#visiond-unified-account-actions')?.remove();
    header.classList.add('header-shell-ready');
    let utility=header.querySelector(':scope > .header-utility');if(!utility){utility=document.createElement('div');utility.className='header-utility';utility.setAttribute('aria-label','บัญชีและเครื่องมือ');header.insertBefore(utility,nav)}
    unwrap(nav,utility);
    [...header.children].filter(item=>item!==utility&&item!==nav&&item.matches?.(utilitySelector)).forEach(item=>utility.append(item));
    if(isMobile()){while(utility.firstChild)nav.append(utility.firstChild);utility.hidden=true}
    else{utility.hidden=false;[...nav.children].filter(item=>item.matches?.(utilitySelector)).forEach(item=>utility.append(item));[...utility.children].filter(item=>!item.matches?.(utilitySelector)).forEach(item=>nav.append(item))}
    syncing=false;
  }
  const start=()=>{window.VisionDCartCount=cartCount;window.VisionDSyncCartHeader=()=>syncCart(document.querySelector('.topbar'));sync();new MutationObserver(later).observe(document.documentElement,{subtree:true,childList:true});matchMedia('(max-width: 800px)').addEventListener?.('change',later);document.addEventListener('visiond:language',later);document.addEventListener('visiond:cartchange',later);addEventListener('storage',event=>{if(event.key==='vd_cart')later()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
