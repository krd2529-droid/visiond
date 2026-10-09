/* Attach the existing VisionD navigation to standalone feature pages. */
(() => {
  const mode = document.currentScript?.dataset.pageNav;
  if (mode !== 'front' && mode !== 'back') return;
  const mount = () => {
    if (document.querySelector('.vd-page-header')) return;
    const topbar = document.querySelector('body > .topbar');
    if (topbar && mode === 'front') return;
    if (topbar && topbar.querySelector('nav')) return;
    const header = document.createElement('header');
    header.className = `vd-page-header ${mode === 'front' ? 'vd-front-header topbar' : 'vd-back-header'}`;
    if (mode === 'front') {
      header.innerHTML = '<a class="brand" href="/">VISIOND <small>ONLINE</small></a><nav aria-label="เมนูหลัก"></nav>';
    } else {
      header.innerHTML = '<a class="brand" href="/admin.html">VISIOND <small>CONTROL</small></a><nav aria-label="เมนูหลังบ้าน"><a href="/admin.html">หลังบ้านหลัก</a><a href="/">ดูหน้าร้าน</a><a href="/dashboard.html">บัญชีของฉัน</a></nav>';
    }
    if (topbar) {
      topbar.classList.add('vd-page-header', 'vd-back-header');
      topbar.append(header.querySelector('nav'));
    } else document.body.prepend(header);
    if (mode === 'front') {
      const script = document.createElement('script');
      script.src = '/shared-nav.js?v=020176';
      document.head.append(script);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
