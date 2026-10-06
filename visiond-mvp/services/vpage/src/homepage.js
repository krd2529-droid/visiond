export const brandLogoSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 180" role="img" aria-labelledby="title description">
  <title id="title">SmartLinkPage</title>
  <desc id="description">สัญลักษณ์ตัวเอสสีขาวและสีฟ้า พร้อมชื่อ SmartLinkPage</desc>
  <defs>
    <linearGradient id="cyan" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#21dcff"/><stop offset="1" stop-color="#06b7df"/></linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g fill="none" stroke-linecap="round" stroke-width="22" filter="url(#glow)">
    <path d="M124 48C108 24 65 27 48 56c-17 29 5 48 36 61" stroke="#fff"/>
    <path d="M55 133c18 24 61 21 78-8 17-29-5-48-36-61" stroke="url(#cyan)"/>
  </g>
  <text x="172" y="112" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="700" letter-spacing="-2">SmartLinkPage</text>
</svg>`;

export const homepageHtml=`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="SmartLinkPage บริการสร้างเซลเพจออนไลน์สำหรับธุรกิจที่ต้องการนำเสนอสินค้าและเชื่อมลูกค้าไปยังช่องทางติดต่อได้อย่างชัดเจน">
  <meta name="theme-color" content="#041b49">
  <meta property="og:type" content="website">
  <meta property="og:title" content="SmartLinkPage | บริการสร้างเซลเพจออนไลน์">
  <meta property="og:description" content="เปลี่ยนเรื่องราวสินค้าให้เป็นหน้าขายที่เข้าใจง่ายและพร้อมส่งต่อ">
  <title>SmartLinkPage | บริการสร้างเซลเพจออนไลน์</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23041b49'/%3E%3Cpath d='M46 18C38 7 18 13 18 25c0 6 6 8 14 12m-14 9c8 11 28 5 28-7 0-6-6-8-14-12' fill='none' stroke='%2321dcff' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E">
  <style>
    :root{color-scheme:dark;--navy:#031538;--navy-2:#06265e;--cyan:#16d6f4;--cyan-soft:#9ceeff;--white:#f8fbff;--muted:#b9c9e9;--line:#ffffff1c;--panel:#ffffff0d}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--navy);color:var(--white);font-family:"Noto Sans Thai","Leelawadee UI",Tahoma,system-ui,sans-serif;line-height:1.65;overflow-x:hidden}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 82% 8%,#087cac3b,transparent 31%),radial-gradient(circle at 8% 34%,#0b4b8b30,transparent 28%),linear-gradient(155deg,#031538 0%,#061d49 47%,#020d25 100%);z-index:-2}
    a{color:inherit}
    .shell{width:min(1160px,calc(100% - 40px));margin:auto}
    .site-header{position:relative;border-bottom:1px solid var(--line)}
    .nav{min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand-logo{display:block;width:min(270px,54vw);height:auto}
    .nav-links{display:flex;align-items:center;gap:26px;font-size:.93rem;font-weight:700}
    .nav-links a{text-decoration:none;color:var(--muted);transition:color .2s ease}
    .nav-links a:hover,.nav-links a:focus-visible{color:var(--white)}
    .nav-line{padding:10px 18px;border:1px solid #32dff7;border-radius:999px!important;color:var(--white)!important}
    .hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);align-items:center;gap:clamp(42px,7vw,92px);min-height:680px;padding:78px 0 92px}
    .eyebrow{display:inline-flex;align-items:center;gap:9px;margin:0 0 22px;color:var(--cyan-soft);font-size:.88rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .eyebrow:before{content:"";width:34px;height:2px;background:var(--cyan)}
    h1,h2,h3,p{margin-top:0}
    h1{max-width:760px;margin-bottom:25px;font-size:clamp(2.7rem,5.7vw,5.4rem);line-height:1.06;letter-spacing:-.055em;text-wrap:balance}
    .accent{color:var(--cyan)}
    .hero-copy>p:not(.eyebrow){max-width:650px;margin-bottom:32px;color:var(--muted);font-size:clamp(1.06rem,1.6vw,1.24rem)}
    .offer-card{display:inline-flex;align-items:center;margin:0 0 25px;padding:12px 18px;border:1px solid #62e9fa70;border-radius:15px;background:#0b356dcc;box-shadow:inset 0 1px #ffffff1c,0 12px 32px #001a3f55;color:var(--white);font-size:clamp(1.08rem,1.6vw,1.3rem);font-weight:900;letter-spacing:.01em}
    .actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
    .button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:12px 24px;border-radius:15px;text-decoration:none;font-weight:900;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
    .button:hover,.button:focus-visible{transform:translateY(-2px)}
    .line-cta{background:linear-gradient(135deg,#17da79,#00b950);color:#021c12;box-shadow:0 14px 35px #00c85a30}
    .line-icon{display:grid;width:25px;height:25px;place-items:center;border-radius:50%;background:#fff;color:#00a947;font:900 11px/1 Arial,sans-serif}
    .button-secondary{border:1px solid #ffffff30;background:#ffffff08;color:var(--white)}
    .hero-visual{position:relative;min-height:480px;display:grid;place-items:center}
    .orbit{position:absolute;width:420px;max-width:100%;aspect-ratio:1;border:1px solid #39e4ff26;border-radius:50%;box-shadow:0 0 0 58px #1edbff08,0 0 0 116px #1edbff05}
    .sales-preview{position:relative;width:min(366px,88%);padding:16px;border:1px solid #83efff45;border-radius:32px;background:linear-gradient(145deg,#ffffff1c,#ffffff08);box-shadow:0 40px 100px #000a,0 0 54px #00cdec22;backdrop-filter:blur(18px);transform:rotate(3deg)}
    .preview-browser{display:flex;align-items:center;gap:6px;padding:2px 4px 13px}
    .preview-browser i{width:7px;height:7px;border-radius:50%;background:#ffffff45}
    .preview-browser span{margin-left:6px;color:#8ea9d6;font-size:.68rem}
    .preview-card{overflow:hidden;border-radius:21px;background:#f9fcff;color:#102247}
    .preview-image{height:190px;background:radial-gradient(circle at 68% 38%,#6af1ff 0 7%,transparent 8%),linear-gradient(140deg,#0a367a,#0ed0ea);position:relative}
    .preview-image:before,.preview-image:after{content:"";position:absolute;border-radius:999px;background:#ffffff25;transform:rotate(-24deg)}
    .preview-image:before{width:170px;height:56px;left:-24px;top:42px}.preview-image:after{width:220px;height:72px;right:-42px;bottom:24px}
    .preview-copy{padding:24px}.preview-copy small{font-weight:800;color:#1287a9}.preview-copy h3{margin:5px 0 8px;font-size:1.52rem;line-height:1.25}.preview-copy p{color:#60708e;font-size:.83rem}.preview-button{height:42px;border-radius:11px;background:#08cfe9}
    .mini-badge{position:absolute;padding:12px 16px;border:1px solid #ffffff24;border-radius:15px;background:#06265ee8;box-shadow:0 16px 45px #0007;font-size:.8rem;font-weight:800;backdrop-filter:blur(8px)}
    .mini-badge.one{left:-16px;top:86px}.mini-badge.two{right:-34px;bottom:72px}.mini-badge b{display:block;color:var(--cyan);font-size:1rem}
    .audience{border-block:1px solid var(--line);background:#ffffff05}
    .audience-row{display:grid;grid-template-columns:1.35fr repeat(3,1fr);align-items:center;gap:18px;min-height:108px}
    .audience strong{font-size:1rem}.audience span{color:var(--muted);font-size:.9rem}.audience-item{padding-left:20px;border-left:1px solid var(--line)}
    .section{padding:112px 0}
    .section-head{display:grid;grid-template-columns:.9fr 1.1fr;gap:70px;align-items:end;margin-bottom:52px}
    .section-tag{color:var(--cyan);font-size:.82rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    h2{margin:8px 0 0;font-size:clamp(2.15rem,4vw,3.7rem);line-height:1.16;letter-spacing:-.04em;text-wrap:balance}
    .section-head>p{margin:0;color:var(--muted);font-size:1.05rem}
    .feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .feature-card{min-height:285px;padding:30px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,#ffffff11,#ffffff05);box-shadow:inset 0 1px #ffffff12}
    .feature-no{display:block;margin-bottom:45px;color:#6feaff;font:800 .78rem/1.2 ui-monospace,monospace;letter-spacing:.12em}
    .feature-card h3{margin-bottom:12px;font-size:1.38rem}.feature-card p{margin:0;color:var(--muted);font-size:.95rem}
    .flow-section{position:relative;background:#020f2d80;border-block:1px solid var(--line)}
    .flow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;counter-reset:step}
    .step-card{position:relative;padding:4px 38px 8px 0;counter-increment:step}
    .step-card:not(:last-child){border-right:1px solid var(--line);margin-right:38px}
    .step-card:before{content:"0" counter(step);display:grid;width:50px;height:50px;margin-bottom:24px;place-items:center;border:1px solid #20dcf16b;border-radius:15px;color:var(--cyan);font:900 .86rem/1 ui-monospace,monospace}
    .step-card h3{margin-bottom:10px;font-size:1.3rem}.step-card p{margin:0;color:var(--muted);font-size:.94rem}
    .contact-wrap{padding:110px 0}
    .contact-panel{position:relative;overflow:hidden;display:grid;grid-template-columns:1.15fr auto;align-items:center;gap:40px;padding:clamp(38px,6vw,72px);border:1px solid #4ce6f749;border-radius:32px;background:linear-gradient(120deg,#0a3871,#075676);box-shadow:0 38px 110px #0005}
    .contact-panel:after{content:"S";position:absolute;right:7%;top:50%;color:#ffffff08;font:900 240px/1 Arial,sans-serif;transform:translateY(-50%);pointer-events:none}
    .contact-panel h2{position:relative;max-width:700px;margin:0 0 14px}.contact-panel p{position:relative;max-width:630px;margin:0;color:#cce8f2}.contact-panel .button{position:relative;z-index:1;white-space:nowrap}
    footer{padding:35px 0;border-top:1px solid var(--line);color:#8ea5cc;font-size:.85rem}.footer-row{display:flex;justify-content:space-between;gap:20px;align-items:center}.footer-row strong{color:#eef8ff}
    :focus-visible{outline:3px solid #86edff;outline-offset:4px}
    @media(max-width:860px){.nav-links a:not(.nav-line){display:none}.hero{grid-template-columns:1fr;padding:64px 0 82px}.hero-copy{text-align:center}.eyebrow{justify-content:center}.hero-copy>p:not(.eyebrow){margin-inline:auto}.offer-card{justify-content:center}.actions{justify-content:center}.hero-visual{min-height:430px}.section-head{grid-template-columns:1fr;gap:20px}.feature-grid{grid-template-columns:1fr}.feature-card{min-height:auto}.feature-no{margin-bottom:24px}.audience-row{grid-template-columns:1fr 1fr;padding:25px 0}.audience-row>strong{grid-column:1/-1}.contact-panel{grid-template-columns:1fr;text-align:center}.contact-panel p{margin-inline:auto}.contact-panel .button{justify-self:center}}
    @media(max-width:560px){.shell{width:min(100% - 28px,1160px)}.nav{min-height:72px}.brand-logo{width:205px}.nav-line{padding:8px 13px}.hero{min-height:auto;padding-top:52px;gap:34px}.hero h1{font-size:clamp(2.45rem,13vw,3.6rem)}.hero h1 br{display:none}.actions{display:grid}.button{width:100%}.hero-visual{min-height:390px}.sales-preview{width:84%;transform:none}.orbit{width:310px}.mini-badge.one{left:-4px;top:58px}.mini-badge.two{right:-6px;bottom:44px}.audience-row{grid-template-columns:1fr}.audience-row>strong{grid-column:auto}.audience-item{padding:9px 0 9px 16px}.section{padding:82px 0}.feature-card{padding:25px}.flow-grid{grid-template-columns:1fr;gap:34px}.step-card:not(:last-child){margin:0;padding-bottom:34px;border-right:0;border-bottom:1px solid var(--line)}.contact-wrap{padding:80px 0}.contact-panel{padding:36px 22px}.footer-row{align-items:flex-start;flex-direction:column}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button{transition:none}}
  </style>
</head>
<body>
  <header class="site-header">
    <nav class="nav shell" aria-label="เมนูหลัก">
      <a href="/" aria-label="SmartLinkPage หน้าหลัก"><img class="brand-logo" src="/smartlinkpage-logo.svg" alt="SmartLinkPage" width="640" height="180"></a>
      <div class="nav-links"><a href="#services">บริการ</a><a href="#process">ขั้นตอน</a><a class="nav-line" href="https://lin.ee/rUcWsJu" target="_blank" rel="noopener noreferrer">ติดต่อ LINE</a></div>
    </nav>
  </header>
  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">บริการเซลเพจเพื่อธุรกิจออนไลน์</p>
        <h1>สร้างหน้าขายที่เล่าเรื่องสินค้า<br>และพาลูกค้า<span class="accent">ไปต่อได้ทันที</span></h1>
        <p>SmartLinkPage ช่วยจัดข้อมูลสินค้า จุดเด่น และช่องทางติดต่อให้อยู่ในหน้าเดียว เพื่อให้ลูกค้าเข้าใจสิ่งที่คุณนำเสนอและเลือกขั้นตอนต่อไปได้ง่ายขึ้น</p>
        <div class="offer-card" aria-label="1 เซลเพจ / 30 วัน / 999 บาท">1 เซลเพจ / 30 วัน / 999 บาท</div>
        <div class="actions"><a class="button line-cta" href="https://lin.ee/rUcWsJu" target="_blank" rel="noopener noreferrer"><span class="line-icon" aria-hidden="true">LINE</span>คุยกับเราทาง LINE</a><a class="button button-secondary" href="#services">ดูบริการของเรา</a></div>
      </div>
      <div class="hero-visual" aria-label="ตัวอย่างหน้าเสนอสินค้า">
        <div class="orbit" aria-hidden="true"></div>
        <div class="sales-preview">
          <div class="preview-browser"><i></i><i></i><i></i><span>smartlinkpage.com/your-brand</span></div>
          <div class="preview-card"><div class="preview-image"></div><div class="preview-copy"><small>YOUR PRODUCT</small><h3>จุดเด่นชัดเจนในหน้าเดียว</h3><p>เรื่องราวสินค้า ภาพประกอบ และช่องทางที่ลูกค้าเลือกติดต่อได้</p><div class="preview-button"></div></div></div>
          <span class="mini-badge one"><b>อ่านง่าย</b>โครงสร้างชัดเจน</span><span class="mini-badge two"><b>พร้อมแชร์</b>รองรับทุกหน้าจอ</span>
        </div>
      </div>
    </section>
    <section class="audience" aria-label="กลุ่มธุรกิจที่เหมาะกับบริการ"><div class="audience-row shell"><strong>หน้าขายที่ยืดหยุ่นกับเรื่องราวของคุณ</strong><span class="audience-item">ร้านค้าออนไลน์</span><span class="audience-item">ธุรกิจบริการ</span><span class="audience-item">แบรนด์และครีเอเตอร์</span></div></section>
    <section class="section shell" id="services">
      <div class="section-head"><div><span class="section-tag">Smart sales presence</span><h2>ทุกองค์ประกอบสำคัญ<br>อยู่ในจังหวะที่พอดี</h2></div><p>เราให้ความสำคัญกับการสื่อสารที่ตรงประเด็น การใช้งานบนมือถือ และเส้นทางจากความสนใจไปสู่การติดต่อ โดยไม่ทำให้หน้าขายซับซ้อนเกินจำเป็น</p></div>
      <div class="feature-grid">
        <article class="feature-card"><span class="feature-no">01 / STORY</span><h3>เล่าเรื่องสินค้าอย่างมีลำดับ</h3><p>จัดภาพ รายละเอียด และเนื้อหาให้ลูกค้าทำความเข้าใจจุดเด่นได้โดยไม่ต้องค้นหาข้อมูลหลายที่</p></article>
        <article class="feature-card"><span class="feature-no">02 / ACTION</span><h3>เชื่อมสู่ช่องทางที่ใช้งานจริง</h3><p>วางลิงก์สินค้าและช่องทางติดต่ออย่างชัดเจน เพื่อให้ผู้สนใจเลือกดูข้อมูลหรือเริ่มบทสนทนาได้สะดวก</p></article>
        <article class="feature-card"><span class="feature-no">03 / MOBILE</span><h3>อ่านง่ายบนทุกหน้าจอ</h3><p>ออกแบบโครงสร้างแบบ responsive เพื่อให้ประสบการณ์ใช้งานต่อเนื่องทั้งโทรศัพท์ แท็บเล็ต และคอมพิวเตอร์</p></article>
      </div>
    </section>
    <section class="section flow-section" id="process"><div class="shell">
      <div class="section-head"><div><span class="section-tag">Simple process</span><h2>ขั้นตอนการเริ่มต้น</h2></div><p>เริ่มจากเป้าหมายและข้อมูลที่มี แล้วค่อยเรียบเรียงเป็นหน้าขายที่สื่อสารแบรนด์ของคุณได้ตรงที่สุด</p></div>
      <div class="flow-grid"><article class="step-card"><h3>คุยเป้าหมาย</h3><p>บอกประเภทสินค้า กลุ่มลูกค้า และสิ่งที่อยากให้ผู้ชมทำหลังอ่านหน้า</p></article><article class="step-card"><h3>เตรียมเนื้อหา</h3><p>รวบรวมชื่อร้าน ภาพ รายละเอียดสินค้า และช่องทางติดต่อที่ต้องการนำเสนอ</p></article><article class="step-card"><h3>จัดหน้าและตรวจทาน</h3><p>เรียบเรียงเนื้อหาให้พร้อมใช้งาน จากนั้นตรวจสอบภาพ ข้อความ และลิงก์ก่อนนำไปแชร์</p></article></div>
    </div></section>
    <section class="contact-wrap shell" id="contact"><div class="contact-panel"><div><span class="section-tag">Start a conversation</span><h2>อยากมีหน้าขายที่เป็นของแบรนด์คุณ?</h2><p>ส่งรายละเอียดเบื้องต้นมาคุยกันได้ทาง LINE แล้วเราจะช่วยมองภาพว่าข้อมูลของคุณควรถูกเล่าอย่างไรบน SmartLinkPage</p></div><a class="button line-cta" href="https://lin.ee/rUcWsJu" target="_blank" rel="noopener noreferrer"><span class="line-icon" aria-hidden="true">LINE</span>คุยกับเราทาง LINE</a></div></section>
  </main>
  <footer><div class="footer-row shell"><span><strong>SmartLinkPage</strong> · by VisionD</span><span>บริการสร้างเซลเพจสำหรับธุรกิจออนไลน์</span></div></footer>
</body>
</html>`;
