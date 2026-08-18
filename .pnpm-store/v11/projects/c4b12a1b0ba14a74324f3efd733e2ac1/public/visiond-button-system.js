(()=>{
  const legacyAnchors='a.primary,a.primary-button,a.secondary,a.secondary-button,a.secondary-action,a.download-primary,a.line-outline,a[role="button"]';
  const unstyled=/\b(?:mobile-preview-dismiss|mobile-nav-toggle|mobile-nav-backdrop|hub-menu-backdrop|lesson-menu-backdrop|boss-mobile-away)\b/;
  const danger=/(?:danger|delete|remove|reject|trash|logout|ลบ|ปฏิเสธ|ออกจากระบบ)/i;
  const promotion=/(?:add.?cart|buy|purchase|offer|promotion|ใส่.*(?:รถเข็น|ตะกร้า)|ซื้อ)/i;
  const tonal=/(?:tab|filter|page|pagination|toggle|menu|refresh|reload|retry|clear|prev|next)/i;
  const identity=node=>`${node.className||''} ${node.id||''} ${[...node.attributes].filter(x=>x.name.startsWith('data-')).map(x=>`${x.name} ${x.value}`).join(' ')} ${node.textContent||''}`;
  const hasVariant=node=>[...node.classList].some(name=>/^vds-btn--(?:primary|secondary|tonal|text|promotion|danger|unstyled)$/.test(name));
  const classify=node=>{
    if(!(node instanceof Element)||(!node.matches('button')&&!node.matches(legacyAnchors)))return;
    const key=identity(node);
    if(unstyled.test(key)){node.dataset.vdsExempt='layout-control';return}
    node.classList.add('vds-btn');
    if(!hasVariant(node)){
      if(danger.test(key))node.classList.add('vds-btn--danger');
      else if(promotion.test(key))node.classList.add('vds-btn--promotion');
      else if(node.matches('button[type="submit"],.primary,.primary-button,.download-primary'))node.classList.add('vds-btn--primary');
      else if(tonal.test(key)||node.closest('[role="tablist"],.tabs,.admin-tabs,.catalog-filter-row,.product-admin-pagination'))node.classList.add('vds-btn--tonal');
      else node.classList.add('vds-btn--secondary');
    }
    const label=(node.getAttribute('aria-label')||node.title||'').trim(),text=(node.textContent||'').trim();
    if((label&&text.length<=2)||/^[×✕↻↗‹›←→☰🔔]$/.test(text))node.classList.add('vds-btn--icon');
  };
  const scan=root=>{if(root instanceof Element)classify(root);root?.querySelectorAll?.(`button,${legacyAnchors}`).forEach(classify)};
  const start=()=>{scan(document);new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(scan))).observe(document.documentElement,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
