import('/i18n.js?v=014300');
(()=>{
  const PAGE_URL=window.VISIOND_FACEBOOK_PAGE_URL||'https://m.me/61592882337230';
  const LINE_URL=window.VISIOND_LINE_URL||'https://lin.ee/RJZwr1p';
  const STORAGE_KEY='visiond_facebook_chat_open';
  const mount=()=>{
    if(document.querySelector('[data-visiond-contact-dock]'))return;
    const root=document.createElement('aside');
    root.className='vd-contact-dock';
    root.dataset.visiondContactDock='';
    root.innerHTML=`<section class="vd-facebook-chat-panel" aria-label="แชทเพจ VisionD">
      <header><span class="vd-facebook-chat-avatar" aria-hidden="true">f</span><span><b>VisionD Online</b><small>Facebook Messenger</small></span><button type="button" data-chat-min aria-label="ย่อหน้าต่างแชท" title="ย่อ">−</button><button type="button" data-chat-close aria-label="ปิดหน้าต่างแชท" title="ปิด">×</button></header>
      <div class="vd-facebook-chat-body"><p><b>สวัสดีครับ 👋</b></p><p>สอบถามสินค้า การชำระเงิน หรือแจ้งปัญหาการดาวน์โหลดกับเพจ VisionD ได้ที่นี่</p><a href="${PAGE_URL}" target="_blank" rel="noopener noreferrer">เปิดแชท Facebook</a><small>ระบบจะเปิด Messenger หรือ Facebook ในแท็บใหม่</small></div>
    </section><nav class="vd-contact-actions" aria-label="ช่องทางติดต่อ VisionD">
      <a class="vd-line-launcher" href="${LINE_URL}" target="_blank" rel="noopener noreferrer" aria-label="ติดต่อ VisionD ทาง LINE"><span aria-hidden="true">LINE</span><b>ติดต่อ LINE</b></a>
      <button type="button" class="vd-facebook-chat-launcher" aria-label="เปิดแชทเพจ VisionD" title="แชทเพจ VisionD"><span aria-hidden="true">f</span><b>แชทเพจ</b></button>
    </nav>`;
    document.body.append(root);
    const panel=root.querySelector('.vd-facebook-chat-panel');
    const launcher=root.querySelector('.vd-facebook-chat-launcher');
    const setOpen=open=>{root.classList.toggle('is-open',open);panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));try{localStorage.setItem(STORAGE_KEY,open?'1':'0')}catch{}};
    launcher.addEventListener('click',()=>setOpen(true));
    root.querySelector('[data-chat-min]').addEventListener('click',()=>setOpen(false));
    root.querySelector('[data-chat-close]').addEventListener('click',()=>setOpen(false));
    let saved='0';try{saved=localStorage.getItem(STORAGE_KEY)||'0'}catch{}setOpen(saved==='1');
  };
  if(!document.querySelector('#visiond-contact-dock-style')){
    const style=document.createElement('style');
    style.id='visiond-contact-dock-style';
    style.textContent=`.vd-contact-dock{position:fixed;right:22px;bottom:20px;z-index:10000;font-family:Arial,"Noto Sans Thai",sans-serif;color:#102f2e}.vd-contact-dock *{box-sizing:border-box}.vd-facebook-chat-panel{width:min(360px,calc(100vw - 28px));overflow:hidden;border:1px solid #bfe5e2;border-radius:18px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.24);margin:0 0 12px auto}.vd-facebook-chat-panel[hidden]{display:none}.vd-facebook-chat-panel header{display:grid;grid-template-columns:42px 1fr 34px 34px;align-items:center;gap:8px;padding:13px 12px;background:linear-gradient(135deg,#0866ff,#0756d7);color:#fff}.vd-facebook-chat-panel header span:nth-child(2){display:grid;line-height:1.2}.vd-facebook-chat-panel header small{font-size:11px;color:#e9f1ff;margin-top:3px}.vd-facebook-chat-avatar,.vd-facebook-chat-launcher>span{display:grid;place-items:center;background:#fff;color:#0866ff;font-family:Arial,sans-serif;font-weight:900}.vd-facebook-chat-avatar{width:38px;height:38px;border-radius:50%;font-size:25px}.vd-facebook-chat-panel header button{width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:23px;line-height:1;cursor:pointer}.vd-facebook-chat-panel header button:hover{background:rgba(255,255,255,.28)}.vd-facebook-chat-body{padding:18px;background:#f7fbff}.vd-facebook-chat-body p{margin:0 0 9px;line-height:1.55;font-size:14px}.vd-facebook-chat-body a{display:block;margin-top:15px;padding:12px 15px;border-radius:11px;background:#0866ff;color:#fff;text-align:center;text-decoration:none;font-weight:800}.vd-facebook-chat-body a:hover{background:#0756d7}.vd-facebook-chat-body>small{display:block;margin-top:9px;text-align:center;color:#657b7a;font-size:11px}.vd-contact-actions{display:flex;justify-content:flex-end;align-items:center;gap:9px}.vd-line-launcher,.vd-facebook-chat-launcher{min-height:50px;display:flex;align-items:center;gap:8px;padding:8px 15px 8px 8px;border:0;border-radius:999px;color:#fff!important;text-decoration:none!important;box-shadow:0 9px 28px rgba(0,0,0,.22);cursor:pointer;font:inherit;font-weight:800}.vd-line-launcher{background:#06c755}.vd-line-launcher:hover{background:#05b84d}.vd-line-launcher>span{display:grid;place-items:center;min-width:38px;height:34px;padding:0 5px;border-radius:9px;background:#fff;color:#06a944;font-size:10px;font-weight:900}.vd-facebook-chat-launcher{background:#0866ff}.vd-facebook-chat-launcher:hover{background:#0756d7}.vd-facebook-chat-launcher>span{width:34px;height:34px;border-radius:50%;font-size:23px}.vd-line-launcher b,.vd-facebook-chat-launcher b{font-size:14px;white-space:nowrap}.vd-contact-dock.is-open .vd-facebook-chat-launcher{display:none}@media(max-width:560px){.vd-contact-dock{right:12px;bottom:12px}.vd-facebook-chat-panel{width:calc(100vw - 24px)}.vd-contact-actions{gap:7px}.vd-line-launcher,.vd-facebook-chat-launcher{min-height:46px;padding:6px 11px 6px 6px}.vd-line-launcher b,.vd-facebook-chat-launcher b{display:none}.vd-line-launcher,.vd-facebook-chat-launcher{width:48px;min-width:48px;min-height:48px;padding:6px;justify-content:center}}`;
    document.head.append(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
import('/mouse-ui.js?v=014300');
import('/boss-mobile-preview.js?v=014300');
