(()=>{
  const utilitySelector='.nav-cart-action,.cart-nav,.nav-admin-link,.nav-member-account,.course-owner-badge,.nav-logout,.vd-language-switcher,.vd-notification-bell,.signup-link,.member-nav-status,#navLogin,#navRegister,#navMember,#navAdmin';
  let syncing=false,queued=false;
  const isMobile=()=>matchMedia('(max-width: 800px)').matches;
  const later=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync()})};
  function unwrap(nav,utility){
    nav.querySelectorAll(':scope > .nav-primary-group').forEach(group=>{while(group.firstChild)nav.insertBefore(group.firstChild,group);group.remove()});
    nav.querySelectorAll(':scope > .nav-utility-group').forEach(group=>{while(group.firstChild)utility.append(group.firstChild);group.remove()});
  }
  function sync(){
    if(syncing)return;const header=document.querySelector('.topbar'),nav=header?.querySelector(':scope > nav');if(!header||!nav)return;
    syncing=true;
    document.querySelector('#visiond-admin-nav-style')?.remove();document.querySelector('#visiond-unified-account-actions')?.remove();
    header.classList.add('header-shell-ready');
    let utility=header.querySelector(':scope > .header-utility');if(!utility){utility=document.createElement('div');utility.className='header-utility';utility.setAttribute('aria-label','บัญชีและเครื่องมือ');header.insertBefore(utility,nav)}
    unwrap(nav,utility);
    if(isMobile()){while(utility.firstChild)nav.append(utility.firstChild);utility.hidden=true}
    else{utility.hidden=false;[...nav.children].filter(item=>item.matches?.(utilitySelector)).forEach(item=>utility.append(item));[...utility.children].filter(item=>!item.matches?.(utilitySelector)).forEach(item=>nav.append(item))}
    syncing=false;
  }
  const start=()=>{sync();new MutationObserver(later).observe(document.documentElement,{subtree:true,childList:true});matchMedia('(max-width: 800px)').addEventListener?.('change',later);document.addEventListener('visiond:language',later)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
