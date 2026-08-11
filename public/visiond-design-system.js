(()=>{
  const disabledAnchor=target=>target?.closest?.('a.vds-btn[aria-disabled="true"]');
  const lock=anchor=>{anchor.setAttribute('tabindex','-1');anchor.setAttribute('data-vds-disabled-locked','1')};
  const scan=root=>{if(root?.matches?.('a.vds-btn[aria-disabled="true"]'))lock(root);root?.querySelectorAll?.('a.vds-btn[aria-disabled="true"]').forEach(lock)};
  scan(document);
  document.addEventListener('click',event=>{const anchor=disabledAnchor(event.target);if(anchor){event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('keydown',event=>{const anchor=disabledAnchor(event.target);if(anchor&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation()}},true);
  new MutationObserver(records=>records.forEach(record=>{if(record.type==='attributes')scan(record.target);record.addedNodes.forEach(scan)})).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-disabled','class']});
})();
