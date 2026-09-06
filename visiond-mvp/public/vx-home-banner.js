(()=>{
  const banner=document.querySelector('#vtools.vx-home-banner');if(!banner)return;
  const promo=document.querySelector('[data-visiond-promo="bundle-discount"]');
  if(promo)promo.before(banner);
  const toggle=banner.querySelector('#vxMotionToggle');
  toggle?.addEventListener('click',()=>{
    const paused=banner.classList.toggle('vx-motion-paused');
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.textContent=paused?'เล่นภาพเคลื่อนไหว':'หยุดภาพเคลื่อนไหว';
  });
})();
