(()=>{
  const PAGE_URL=window.VISIOND_FACEBOOK_PAGE_URL||'https://m.me/visiondonline';
  const STORAGE_KEY='visiond_facebook_chat_open';
  const mount=()=>{
    if(document.querySelector('[data-visiond-facebook-chat]'))return;
    const root=document.createElement('aside');
    root.className='vd-facebook-chat';
    root.dataset.visiondFacebookChat='';
    root.innerHTML=`<section class="vd-facebook-chat-panel" aria-label="แชทเพจ VisionD">
      <header><span class="vd-facebook-chat-avatar" aria-hidden="true">f</span><span><b>VisionD</b><small>Facebook Messenger</small></span><button type="button" data-chat-min aria-label="ย่อหน้าต่างแชท" title="ย่อ">−</button><button type="button" data-chat-close aria-label="ปิดหน้าต่างแชท" title="ปิด">×</button></header>
      <div class="vd-facebook-chat-body"><p><b>สวัสดีครับ 👋</b></p><p>สอบถามสินค้า การชำระเงิน หรือแจ้งปัญหาการดาวน์โหลดกับเพจ VisionD ได้ที่นี่</p><a href="${PAGE_URL}" target="_blank" rel="noopener noreferrer">เปิดแชท Facebook</a><small>ระบบจะเปิด Messenger หรือ Facebook ในแท็บใหม่</small></div>
    </section><button type="button" class="vd-facebook-chat-launcher" aria-label="เปิดแชทเพจ VisionD" title="แชทเพจ VisionD"><span aria-hidden="true">f</span><b>แชท</b></button>`;
    document.body.append(root);
    const panel=root.querySelector('.vd-facebook-chat-panel');
    const launcher=root.querySelector('.vd-facebook-chat-launcher');
    const setOpen=open=>{root.classList.toggle('is-open',open);panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));try{localStorage.setItem(STORAGE_KEY,open?'1':'0')}catch{}};
    launcher.addEventListener('click',()=>setOpen(true));
    root.querySelector('[data-chat-min]').addEventListener('click',()=>setOpen(false));
    root.querySelector('[data-chat-close]').addEventListener('click',()=>setOpen(false));
    let saved='0';try{saved=localStorage.getItem(STORAGE_KEY)||'0'}catch{}setOpen(saved==='1');
  };
  const style=document.createElement('style');
  style.textContent=`.vd-facebook-chat{position:fixed;right:22px;bottom:20px;z-index:10000;font-family:Arial,"Noto Sans Thai",sans-serif;color:#102f2e}.vd-facebook-chat *{box-sizing:border-box}.vd-facebook-chat-panel{width:min(360px,calc(100vw - 28px));overflow:hidden;border:1px solid #bfe5e2;border-radius:18px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.24);margin:0 0 12px auto}.vd-facebook-chat-panel[hidden]{display:none}.vd-facebook-chat-panel header{display:grid;grid-template-columns:42px 1fr 34px 34px;align-items:center;gap:8px;padding:13px 12px;background:linear-gradient(135deg,#0866ff,#0756d7);color:#fff}.vd-facebook-chat-panel header span:nth-child(2){display:grid;line-height:1.2}.vd-facebook-chat-panel header small{font-size:11px;color:#e9f1ff;margin-top:3px}.vd-facebook-chat-avatar,.vd-facebook-chat-launcher>span{display:grid;place-items:center;background:#fff;color:#0866ff;font-family:Arial,sans-serif;font-weight:900}.vd-facebook-chat-avatar{width:38px;height:38px;border-radius:50%;font-size:25px}.vd-facebook-chat-panel header button{width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:23px;line-height:1;cursor:pointer}.vd-facebook-chat-panel header button:hover{background:rgba(255,255,255,.28)}.vd-facebook-chat-body{padding:18px;background:#f7fbff}.vd-facebook-chat-body p{margin:0 0 9px;line-height:1.55;font-size:14px}.vd-facebook-chat-body a{display:block;margin-top:15px;padding:12px 15px;border-radius:11px;background:#0866ff;color:#fff;text-align:center;text-decoration:none;font-weight:800}.vd-facebook-chat-body a:hover{background:#0756d7}.vd-facebook-chat-body>small{display:block;margin-top:9px;text-align:center;color:#657b7a;font-size:11px}.vd-facebook-chat-launcher{display:flex;align-items:center;gap:8px;margin-left:auto;padding:9px 15px 9px 9px;border:0;border-radius:999px;background:#0866ff;color:#fff;box-shadow:0 9px 28px rgba(8,102,255,.36);cursor:pointer;font:inherit}.vd-facebook-chat-launcher>span{width:34px;height:34px;border-radius:50%;font-size:23px}.vd-facebook-chat-launcher b{font-size:14px}.vd-facebook-chat.is-open .vd-facebook-chat-launcher{display:none}@media(max-width:560px){.vd-facebook-chat{right:14px;bottom:14px}.vd-facebook-chat-panel{width:calc(100vw - 28px)}}`;
  document.head.append(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
