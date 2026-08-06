(()=>{
  const slug=new URLSearchParams(location.search).get('slug')||'',payload={path:location.pathname,product_slug:slug};
  const number=value=>new Intl.NumberFormat('th-TH').format(Number(value)||0);
  const paint=data=>{
    document.querySelectorAll('[data-site-views]').forEach(node=>node.textContent=number(data.site_views));
    document.querySelectorAll('[data-product-views]').forEach(node=>node.textContent=number(data.product_views));
  };
  fetch('/api/analytics/view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{window.__visiondAnalytics=data;paint(data);document.dispatchEvent(new CustomEvent('visiond:analytics-counted',{detail:data}));document.addEventListener('visiond:product-rendered',()=>paint(data),{once:true})}).catch(()=>{});
})();
