(function () {
  'use strict';

  if (window.__visiondElonChatLoaded) return;
  window.__visiondElonChatLoaded = true;

  const API = '/api/elon/chat';
  const PUBLIC_API = '/api/elon/public-chat';
  const AUTH_API = '/api/auth/me';
  const STATUS_API = '/api/elon/status';
  const STORAGE_PREFIX = 'visiond_elon_conversation_id';
  // Fail closed: ELON is a member-facing helper, so it may mount only on an
  // explicitly reviewed frontend surface. A newly added internal page never
  // inherits the widget merely because someone copied the script tag.
  const FRONTEND_SURFACES = new Set([
    '/', '/about', '/account', '/blog', '/bots', '/cart', '/contact',
    '/course-basket-edit', '/course-rights-terms', '/course-center', '/courses',
    '/dashboard', '/digital-products', '/forgot-password', '/index', '/learn',
    '/login', '/my-courses', '/product', '/register', '/reset-password'
  ]);
  let storageKey = '';
  let conversationId = '';
  let isSending = false;
  let activeController = null;
  let generation = 0;
  let authenticated = false;
  const chatApi = () => authenticated ? API : PUBLIC_API;

  const validConversationId = (value) => /^ew_[a-f0-9-]{20,64}$/i.test(String(value || '')) ? String(value) : '';
  function frontendSurface(pathname) {
    let path = String(pathname || '/').toLowerCase().replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/$/, '').replace(/\.html$/, '');
    if (path.startsWith('/blog/')) return true;
    return FRONTEND_SURFACES.has(path);
  }
  function readStoredConversation() {
    if (!storageKey) return '';
    try { return validConversationId(localStorage.getItem(storageKey)); } catch (_) { return ''; }
  }
  function storeConversation(value) {
    if (!storageKey) return;
    try {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch (_) {
      // Storage can be unavailable in private/restricted browser modes.
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function getContext() {
    const params = new URLSearchParams(location.search);
    const productCard = document.querySelector('[data-product-id], [data-product-slug], [data-course-id], [data-course-slug]');
    const path = location.pathname.toLowerCase();
    const isProductPage = path === '/product' || path === '/product.html';
    const isCoursePage = path === '/learn' || path === '/learn.html' || path === '/courses' || path === '/courses.html';
    return {
      // Never send the query string. Password-reset tokens, email addresses and
      // other private values can legitimately live there on public pages.
      path: location.pathname,
      title: document.title || '',
      product_slug: isProductPage ? (params.get('slug') || (productCard && productCard.dataset.productSlug) || '') : '',
      product_id: isProductPage ? ((productCard && productCard.dataset.productId) || '') : '',
      course_id: isCoursePage ? (params.get('course') || params.get('courseId') || (productCard && productCard.dataset.courseId) || '') : ''
    };
  }

  function quickQuestions() {
    const path = location.pathname.toLowerCase();
    if (path.includes('checkout') || path.includes('cart')) return ['ชำระเงินอย่างไร', 'อัปโหลดสลิปตรงไหน', 'ตรวจสถานะคำสั่งซื้อ'];
    if (path.includes('product')) return ['สินค้านี้ได้ไฟล์อะไรบ้าง', 'ซื้อสินค้านี้อย่างไร', 'ซื้อแล้วดาวน์โหลดตรงไหน'];
    if (path.includes('learn') || path.includes('my-courses')) return ['เริ่มเรียนตรงไหน', 'ดูความคืบหน้าคอร์ส', 'เข้าเรียนไม่ได้ทำอย่างไร'];
    if (path.includes('course-seller') || path.includes('course-draft')) return ['สร้างคอร์สอย่างไร', 'อัปโหลดบทเรียนตรงไหน', 'สิทธิ์ลงขายคอร์สคืออะไร'];
    if (path.includes('course')) return ['สมัครเรียนอย่างไร', 'ซื้อแล้วเข้าเรียนตรงไหน', 'คอร์สนี้มีอะไรบ้าง'];
    if (path.includes('dashboard')) return ['ตรวจสถานะออเดอร์', 'สินค้าที่ซื้ออยู่ตรงไหน', 'แก้ไขข้อมูลบัญชี'];
    return ['VisionD มีสินค้าอะไรบ้าง', 'ซื้อสินค้าอย่างไร', 'คอร์สออนไลน์อยู่ตรงไหน'];
  }

  function mount() {
    const root = el('div', 'elon-chat');
    root.dataset.feature = 'ELON-CHAT-001';
    root.hidden = true;

    const launcher = el('button', 'elon-launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'เปิดแชท ELON AI ผู้ช่วย VisionD');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'elon-chat-panel');
    launcher.innerHTML = '<span class="elon-launcher-mark" aria-hidden="true">E</span><span>ถาม ELON AI</span>';

    const panel = el('section', 'elon-panel');
    panel.id = 'elon-chat-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'ELON AI ทีมขาย VisionD');
    const header = el('header', 'elon-header');
    const identity = el('div', 'elon-identity');
    const avatar = el('span', 'elon-avatar', 'E');
    avatar.setAttribute('aria-hidden', 'true');
    const headingBox = el('div');
    headingBox.append(el('strong', '', 'ELON AI'), el('small', '', 'ทีมขาย VisionD'));
    identity.append(avatar, headingBox);
    const controls = el('div', 'elon-controls');
    const reset = el('button', '', 'แชทใหม่');
    reset.type = 'button';
    reset.title = 'ล้างบทสนทนาและเริ่มใหม่';
    const close = el('button', 'elon-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'ปิดแชท');
    controls.append(reset, close);
    header.append(identity, controls);

    const messages = el('div', 'elon-messages');
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    const quick = el('div', 'elon-quick');
    const composer = el('form', 'elon-composer');
    const input = el('textarea', 'elon-input');
    input.rows = 1;
    input.maxLength = 1000;
    input.placeholder = 'ถามเกี่ยวกับ VisionD…';
    input.setAttribute('aria-label', 'ข้อความถึง ELON AI');
    const send = el('button', 'elon-send', 'ส่ง');
    send.type = 'submit';
    composer.append(input, send);
    const footer = el('div', 'elon-footer');
    footer.append('ELON ทีมขายและผู้ช่วยลูกค้า VisionD · ', makeLineLink());
    panel.append(header, messages, quick, composer, footer);
    root.append(panel, launcher);
    document.body.append(root);

    const welcome = authenticated
      ? 'สวัสดีครับ ผม ELON AI ทีมขาย VisionD บอกสิ่งที่กำลังหา งบประมาณ หรือปัญหาที่อยากแก้ได้เลย ผมช่วยแนะนำสินค้าและพาไปขั้นตอนซื้อให้ครับ'
      : 'สวัสดีครับ ผม ELON AI ทีมขาย VisionD ถามสินค้า ราคา วิธีซื้อ หรือบอกสิ่งที่กำลังหาได้เลยครับ ใช้งานแบบผู้เยี่ยมชมได้ทันที';
    addMessage(messages, 'bot', welcome);
    if (authenticated) {
      renderQuick(quick, input, composer);
      loadHistory(messages, welcome);
    } else {
      renderQuick(quick, input, composer);
      const registerLink = el('a', 'elon-guest-register', 'สมัครสมาชิก');
      registerLink.href = '/register.html';
      const loginLink = el('a', 'elon-guest-login', 'เข้าสู่ระบบ');
      loginLink.href = '/login.html';
      quick.append(registerLink, loginLink);
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.hidden = open;
      launcher.setAttribute('aria-expanded', String(open));
      if (open) setTimeout(() => input.focus(), 30);
    }
    launcher.addEventListener('click', () => setOpen(true));
    close.addEventListener('click', () => { setOpen(false); launcher.focus(); });
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        launcher.focus();
      }
    });
    reset.addEventListener('click', async () => {
      generation += 1;
      activeController?.abort();
      activeController = null;
      isSending = false;
      send.disabled = false;
      reset.disabled = true;
      const previousId = conversationId;
      conversationId = '';
      storeConversation('');
      messages.replaceChildren();
      addMessage(messages, 'bot', 'เริ่มบทสนทนาใหม่แล้วครับ ถามผมเกี่ยวกับ VisionD ได้เลย');
      quick.hidden = false;
      input.focus();
      if (authenticated && previousId) {
        try {
          await fetch('/api/elon/clear', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: previousId }), signal: AbortSignal.timeout(12000) });
        } catch (error) {
          console.warn(
            '[ELON-CHAT-CLEAR-001] ล้างประวัติฝั่งเซิร์ฟเวอร์ไม่สำเร็จ แต่เริ่มแชทใหม่ในหน้าเว็บแล้ว',
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      reset.disabled = false;
    });
    composer.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value || isSending) return;
      input.value = '';
      await sendMessage(value, messages, input, send, quick);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        composer.requestSubmit();
      }
    });
    return root;
  }

  function makeLineLink() {
    const link = el('a', '', 'ติดต่อเจ้าหน้าที่ VisionD');
    link.href = '/contact.html';
    return link;
  }

  function renderQuick(container, input, form, suggestions) {
    container.replaceChildren();
    (suggestions && suggestions.length ? suggestions : quickQuestions()).slice(0, 3).forEach((question) => {
      const button = el('button', '', String(question).slice(0, 80));
      button.type = 'button';
      button.addEventListener('click', () => {
        input.value = button.textContent;
        form.requestSubmit();
      });
      container.append(button);
    });
  }

  function addMessage(container, role, text) {
    const row = el('div', 'elon-message elon-' + role);
    row.append(el('div', 'elon-bubble', text));
    container.append(row);
    container.scrollTop = container.scrollHeight;
    return row;
  }

  async function loadHistory(messages, welcome) {
    if (!conversationId) return;
    const historyGeneration = generation;
    try {
      const response = await fetch(`${API}?conversation_id=${encodeURIComponent(conversationId)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000)
      });
      if (response.status === 404) {
        conversationId = '';
        storeConversation('');
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      if (generation !== historyGeneration || !Array.isArray(data.messages) || !data.messages.length) return;
      messages.replaceChildren();
      data.messages.forEach((item) => addMessage(messages, item.role === 'user' ? 'user' : 'bot', String(item.content || '')));
    } catch (_) {
      if (!messages.children.length) addMessage(messages, 'bot', welcome);
    }
  }

  async function sendMessage(message, messages, input, send, quick) {
    const sendGeneration = ++generation;
    isSending = true;
    send.disabled = true;
    quick.hidden = true;
    addMessage(messages, 'user', message);
    const loading = addMessage(messages, 'bot elon-loading', 'ELON กำลังหาคำตอบ…');
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    try {
      let response;
      let data;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(chatApi(), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversation_id: conversationId || undefined, page_context: getContext() }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])
        });
        data = await response.json().catch(() => ({}));
        if (response.status === 404 && conversationId && attempt === 0) {
          conversationId = '';
          storeConversation('');
          continue;
        }
        break;
      }
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถเชื่อมต่อ ELON ได้');
      if (generation !== sendGeneration) return;
      if (data.conversation_id) {
        conversationId = validConversationId(data.conversation_id);
        storeConversation(conversationId);
      }
      loading.remove();
      addMessage(messages, 'bot', data.reply || data.message?.content || (typeof data.message === 'string' ? data.message : '') || 'ขออภัยครับ ผมหาคำตอบเรื่องนี้ไม่พบ กรุณาติดต่อเจ้าหน้าที่ VisionD');
      // Keep customer prompts deterministic. Provider-generated suggestions
      // must never advertise an internal or higher-privilege function.
      renderQuick(quick, input, input.form);
    } catch (error) {
      if (generation !== sendGeneration || error?.name === 'AbortError') return;
      loading.remove();
      const row = addMessage(messages, 'bot elon-error', 'ขออภัยครับ ระบบ ELON ยังตอบไม่ได้ในขณะนี้');
      const link = makeLineLink();
      link.className = 'elon-error-link';
      row.querySelector('.elon-bubble').append(document.createElement('br'), link);
    } finally {
      if (generation === sendGeneration) {
        isSending = false;
        activeController = null;
        send.disabled = false;
        quick.hidden = false;
        input.focus();
      }
    }
  }

  async function start() {
    if (!frontendSurface(location.pathname)) return;
    try { const statusResponse=await fetch(STATUS_API,{cache:'no-store',headers:{Accept:'application/json'}}),status=await statusResponse.json(); if(!status.enabled)return; } catch (_) { return; }
    try {
      const response = await fetch(AUTH_API, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = response.ok ? await response.json().catch(() => null) : null;
      const user = data && (data.user || data.member || data.data || (data.authenticated && data));
      authenticated = Boolean(user && data.authenticated !== false && data.loggedIn !== false);
      if (authenticated) {
        const userKey = String(user.id || user.username || user.email || '').replace(/[^a-zA-Z0-9_.@-]/g, '').slice(0, 120);
        if (!userKey) authenticated = false;
        else {
          storageKey = `${STORAGE_PREFIX}:${userKey}`;
          conversationId = readStoredConversation();
        }
      }
      if (!authenticated) {
        storageKey = `${STORAGE_PREFIX}:guest`;
        conversationId = readStoredConversation();
      }
      mount().hidden = false;
    } catch (_) {
      // Auth lookup failure remains a safe anonymous storefront session.
      authenticated = false;
      storageKey = `${STORAGE_PREFIX}:guest`;
      conversationId = readStoredConversation();
      mount().hidden = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
