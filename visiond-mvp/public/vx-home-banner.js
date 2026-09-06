(()=>{
  const banner=document.querySelector('#vtools.vx-home-banner');if(!banner)return;
  const promo=document.querySelector('[data-visiond-promo="bundle-discount"]');
  if(promo)promo.before(banner);
})();
