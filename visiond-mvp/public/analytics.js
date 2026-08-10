(()=>{
  const params=new URLSearchParams(location.search),slug=params.get('slug')||'',payload={path:location.pathname,product_slug:slug};
  const number=value=>new Intl.NumberFormat('th-TH').format(Number(value)||0);
  const paint=data=>{document.querySelectorAll('[data-site-views]').forEach(node=>node.textContent=number(data.site_views));document.querySelectorAll('[data-product-views]').forEach(node=>node.textContent=number(data.product_views))};
  const attrKey='vd_attribution_v1';
  const readAttr=()=>{try{return JSON.parse(sessionStorage.getItem(attrKey)||'{}')}catch{return {}}};
  const incoming={source:params.get('utm_source')||'',medium:params.get('utm_medium')||'',campaign:params.get('utm_campaign')||'',content:params.get('utm_content')||'',referrer:document.referrer||''};
  if(incoming.source||incoming.medium||incoming.campaign||incoming.content||incoming.referrer){try{sessionStorage.setItem(attrKey,JSON.stringify(incoming))}catch{}}
  window.visiondTrack=(event,extra={})=>fetch('/api/analytics/event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,path:location.pathname,product_slug:extra.product_slug||slug,attribution:readAttr(),metadata:extra.metadata||{}}),keepalive:true}).catch(()=>{});
  fetch('/api/analytics/view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{window.__visiondAnalytics=data;paint(data);document.dispatchEvent(new CustomEvent('visiond:analytics-counted',{detail:data}));document.addEventListener('visiond:product-rendered',()=>paint(data),{once:true})}).catch(()=>{});
  const event=location.pathname==='/product.html'?(document.body?.dataset?.course==='1'?'course_view':'product_view'):'landing_view';window.visiondTrack(event);
  document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el)return;const id=el.id||'',text=(el.textContent||'').trim();if(id==='addProductToCart'||/ใส่รถเข็น/.test(text))window.visiondTrack('add_to_cart');if(id==='checkoutButton'||/ชำระเงิน/.test(text))window.visiondTrack('checkout_start');if(el.matches('[download],a[href*="/download"]'))window.visiondTrack('download')},{capture:true});
})();
