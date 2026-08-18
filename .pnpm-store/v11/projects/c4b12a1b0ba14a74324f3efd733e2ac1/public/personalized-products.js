(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('th-TH').format((Number(n)||0)/100)+' บาท';
  const capKey='vd_recommendation_seen_v1';
  fetch('/api/recommendations',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
    const items=Array.isArray(data.items)?data.items:[];if(!items.length)return;
    const host=document.createElement('section');host.className='vd-personalized-products';host.innerHTML=`<div class="vd-rec-head"><div><small>เลือกจากสิ่งที่คุณสนใจ</small><h2>สินค้าแนะนำสำหรับคุณ</h2></div><span>อิงจากการดูสินค้าล่าสุดบนอุปกรณ์นี้</span></div><div class="vd-rec-grid">${items.slice(0,4).map(x=>`<a class="vd-rec-card" href="/product.html?slug=${encodeURIComponent(x.slug)}" data-rec-slug="${esc(x.slug)}"><img src="${esc(x.cover_url||'/assets/product-placeholder.svg')}" alt=""><div><b>${esc(x.title)}</b><small>${esc(x.reason||'สินค้าใกล้เคียง')}</small><strong>${money(x.sale_price??x.price)}</strong></div></a>`).join('')}</div>`;
    const target=document.querySelector('main');if(!target)return;target.append(host);
    if(!sessionStorage.getItem(capKey)){sessionStorage.setItem(capKey,'1');items.slice(0,4).forEach(x=>window.visiondTrack?.('recommendation_view',{product_slug:x.slug,metadata:{value:Number(x.sale_price??x.price)||0}}))}
    host.addEventListener('click',e=>{const a=e.target.closest('[data-rec-slug]');if(a)window.visiondTrack?.('recommendation_click',{product_slug:a.dataset.recSlug})});
  }).catch(()=>{});
})();
