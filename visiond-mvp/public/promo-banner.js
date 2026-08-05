(()=>{
  if(document.querySelector('[data-visiond-promo]'))return;
  const banner=document.createElement('a');
  banner.href='/digital-products.html';
  banner.className='visiond-promo-banner';
  banner.dataset.visiondPromo='bundle-discount';
  banner.setAttribute('aria-label','โปรจัดชุดสินค้า เลือก 5 ถึง 30 ตะกร้า รับส่วนลดสูงสุด 20 เปอร์เซ็นต์');
  banner.innerHTML='<img src="/assets/visiond-bundle-promo.gif?v=01180" alt="โปรจัดชุด: 5 ตะกร้าลด 5% · 10 ตะกร้าลด 10% · 20 ตะกร้าลด 15% · 30 ตะกร้าลด 20%">';
  document.head.insertAdjacentHTML('beforeend','<style>.visiond-promo-banner{display:block;position:relative;z-index:1;width:100%;overflow:hidden;background:#043f3d}.visiond-promo-banner img{display:block;width:100%;height:auto;object-fit:contain;object-position:center top}.visiond-promo-banner:hover img{filter:brightness(1.08)}@media(max-width:600px){.visiond-promo-banner img{width:640px;max-width:none;height:auto;position:relative;left:50%;transform:translateX(-50%)}}</style>');
  const header=document.querySelector('.topbar');
  if(header)header.insertAdjacentElement('afterend',banner);else document.body.prepend(banner)
})();
