if (!document.querySelector('link[data-visiond-mouse-ui]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/mouse-ui.css?v=014223';
  stylesheet.dataset.visiondMouseUi = 'true';
  document.head.append(stylesheet);
}

document.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  const control = event.target.closest('a,button,[role="button"],input,select,textarea');
  if (!control) return;
  if (control.matches('a[href]') && !control.hasAttribute('download') && !control.target) {
    const rawHref = control.getAttribute('href') || '';
    if (rawHref && rawHref !== '#' && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(control.href);
      return;
    }
  }
  control.classList.add('vd-mouse-pressed');
  const clear = () => control.classList.remove('vd-mouse-pressed');
  window.addEventListener('mouseup', clear, { once: true });
  window.addEventListener('blur', clear, { once: true });
}, true);

document.addEventListener('dragstart', (event) => {
  if (event.target.closest('img, a')) event.preventDefault();
}, true);
