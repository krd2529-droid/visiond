export const demoHtml=`<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="หน้าสาธิต SmartLinkPage ด้วยแบรนด์และสินค้าสมมติสำหรับแสดงรูปแบบเซลเพจเท่านั้น">
  <meta name="theme-color" content="#17372d">
  <title>ตัวอย่างเซลเพจ | ละมุนเดย์ สตูดิโอ</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%2317372d'/%3E%3Cpath d='M20 42c9-2 20-10 25-23-15 3-25 11-25 23Z' fill='%23f7c8a5'/%3E%3C/svg%3E">
  <style>
    :root{color-scheme:light;--ink:#17372d;--ink-soft:#385c51;--cream:#fffaf1;--paper:#fffdf8;--peach:#f3b88c;--rose:#c86c6b;--sage:#b7cdb6;--line:#17372d1f}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--cream);color:var(--ink);font-family:"Noto Sans Thai","Leelawadee UI",Tahoma,system-ui,sans-serif;line-height:1.7;overflow-x:hidden}
    a{color:inherit}
    .demo-shell{width:min(1120px,calc(100% - 40px));margin-inline:auto}
    .demo-top{border-bottom:1px solid var(--line);background:#fffaf1e8;backdrop-filter:blur(12px)}
    .demo-nav{min-height:80px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .demo-brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:-.02em}
    .demo-brand-mark{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;background:var(--ink);color:#fff;font:900 1.1rem/1 Georgia,serif}
    .demo-nav-tag{padding:7px 13px;border:1px solid #c86c6b66;border-radius:999px;background:#fff0eb;color:#8d4343;font-size:.78rem;font-weight:900}
    .demo-disclosure{position:relative;z-index:1;margin:0;padding:11px 18px;border:1px solid #c86c6b55;border-radius:13px;background:#fff0eb;color:#7a3838;font-size:.88rem;font-weight:800}
    .demo-disclosure strong{color:#642929}
    .demo-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.9fr);align-items:center;gap:clamp(44px,8vw,100px);min-height:720px;padding:52px 0 90px}
    .demo-kicker{margin:30px 0 14px;color:#9a4e4d;font-size:.78rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    h1,h2,h3,p{margin-top:0}
    h1{max-width:650px;margin-bottom:20px;font:700 clamp(3.5rem,7.2vw,6.8rem)/.98 Georgia,"Noto Serif Thai",serif;letter-spacing:-.055em;text-wrap:balance}
    .demo-lead{max-width:625px;margin-bottom:28px;color:var(--ink-soft);font-size:clamp(1.05rem,1.7vw,1.25rem)}
    .demo-actions{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px}
    .demo-button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;padding:11px 21px;border:1px solid var(--ink);border-radius:999px;text-decoration:none;font-weight:900;transition:transform .2s ease,box-shadow .2s ease}
    .demo-button:hover,.demo-button:focus-visible{transform:translateY(-2px);box-shadow:0 12px 30px #17372d1f}
    .demo-product-action{background:var(--ink);color:#fff}.demo-contact-action{background:transparent;color:var(--ink)}
    .demo-action-note{display:inline-block;padding:8px 12px;font-size:.78rem;font-weight:700}
    .product-stage{position:relative;min-height:540px;display:grid;place-items:center}
    .product-stage:before{content:"";position:absolute;width:min(460px,95%);aspect-ratio:1;border-radius:48% 52% 40% 60%;background:linear-gradient(145deg,#f7c8a5,#e69879);transform:rotate(8deg);box-shadow:0 40px 100px #6a2e2329}
    .product-stage:after{content:"";position:absolute;width:220px;height:100px;bottom:30px;border-radius:50%;background:#17372d20;filter:blur(20px)}
    .product-art{position:relative;z-index:1;width:min(350px,78vw);height:430px;margin:0;display:grid;place-items:center}
    .candle{position:absolute;bottom:45px;width:230px;height:270px;border:8px solid #f9ecda;border-radius:36px 36px 64px 64px;background:linear-gradient(90deg,#f4e2cc,#fffaf0 48%,#ead1b7);box-shadow:inset -22px -10px 35px #ae745127,0 32px 55px #5c241f36}
    .candle:before{content:"";position:absolute;left:50%;top:-54px;width:42px;height:68px;border-radius:60% 40% 55% 45%;background:linear-gradient(#fff8ba,#ed9857 55%,#c85c42);box-shadow:0 0 28px #ffd083;transform:translateX(-50%) rotate(6deg)}
    .candle:after{content:"";position:absolute;left:50%;top:64px;width:122px;height:94px;border:2px solid #96524a4d;border-radius:50%;background:#fff9edb8;transform:translateX(-50%)}
    .candle-label{position:absolute;z-index:2;left:50%;bottom:146px;width:110px;text-align:center;color:#7b4842;font:700 1rem/1.2 Georgia,"Noto Serif Thai",serif;transform:translateX(-50%)}
    .leaf{position:absolute;z-index:2;width:130px;height:54px;border-radius:100% 0 100% 0;background:#799878;box-shadow:inset 14px -10px #5f7f65}.leaf.one{left:2px;bottom:70px;transform:rotate(22deg)}.leaf.two{right:-2px;bottom:102px;transform:scaleX(-1) rotate(6deg)}
    .demo-chip{position:absolute;z-index:3;right:-8px;top:82px;padding:10px 14px;border:1px solid #fff9;border-radius:14px;background:#fffaf1d9;box-shadow:0 12px 38px #4f2b2530;color:#814a45;font-size:.78rem;font-weight:900;backdrop-filter:blur(9px)}
    .demo-section{padding:105px 0;scroll-margin-top:30px}
    .demo-section-head{display:grid;grid-template-columns:.85fr 1.15fr;gap:60px;align-items:end;margin-bottom:48px}
    .demo-section-tag{color:#a04f4e;font-size:.76rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    h2{margin:7px 0 0;font:700 clamp(2.4rem,4.4vw,4.2rem)/1.08 Georgia,"Noto Serif Thai",serif;letter-spacing:-.035em;text-wrap:balance}
    .demo-section-head>p{margin:0;color:var(--ink-soft);font-size:1.02rem}
    .benefit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px}
    .benefit{min-height:245px;padding:28px;border:1px solid var(--line);border-radius:26px;background:var(--paper);box-shadow:0 18px 50px #4d31210d}
    .benefit-no{display:block;margin-bottom:40px;color:#a04f4e;font:900 .75rem/1 ui-monospace,monospace}.benefit h3{margin-bottom:12px;font-size:1.25rem}.benefit p{margin:0;color:var(--ink-soft);font-size:.94rem}
    .story-band{background:var(--ink);color:#fff}
    .story-layout{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
    .story-layout h2{color:#fff}.story-layout p{color:#d8e5df}.story-swatch{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    .swatch{min-height:160px;padding:23px;border:1px solid #ffffff20;border-radius:24px;background:#ffffff0c;display:flex;flex-direction:column;justify-content:flex-end}.swatch i{width:48px;height:48px;margin-bottom:24px;border-radius:50%;background:var(--peach)}.swatch:nth-child(2) i{background:var(--sage)}.swatch b{font-size:1.05rem}.swatch span{color:#bcd0c8;font-size:.85rem}
    .contact-panel{display:grid;grid-template-columns:1fr auto;align-items:center;gap:40px;padding:clamp(34px,6vw,66px);border:1px solid #dca18366;border-radius:32px;background:linear-gradient(135deg,#fff3e7,#f7d8c6)}
    .contact-panel h2{max-width:680px;margin-bottom:12px}.contact-panel p{max-width:650px;margin:0;color:#5b4a43}.contact-stamp{display:grid;width:150px;aspect-ratio:1;place-items:center;border:2px dashed #9b514f;border-radius:50%;color:#803f3e;text-align:center;font-size:.78rem;font-weight:900;transform:rotate(5deg)}
    .demo-footer{padding:32px 0;border-top:1px solid var(--line);color:#5d746d;font-size:.82rem}.footer-row{display:flex;justify-content:space-between;gap:20px}.footer-row strong{color:var(--ink)}
    :focus-visible{outline:3px solid #d36e69;outline-offset:4px}
    @media(max-width:820px){.demo-hero{grid-template-columns:1fr;padding-top:34px}.demo-copy{text-align:center}.demo-lead{margin-inline:auto}.demo-actions{justify-content:center}.product-stage{min-height:500px}.demo-section-head,.story-layout{grid-template-columns:1fr;gap:24px}.benefit-grid{grid-template-columns:1fr}.benefit{min-height:auto}.benefit-no{margin-bottom:20px}.contact-panel{grid-template-columns:1fr;text-align:center}.contact-panel h2,.contact-panel p{margin-inline:auto}.contact-stamp{justify-self:center}}
    @media(max-width:520px){.demo-shell{width:min(100% - 28px,1120px)}.demo-nav{min-height:70px}.demo-brand{font-size:.86rem}.demo-brand-mark{width:34px;height:34px}.demo-nav-tag{font-size:.7rem}.demo-hero{min-height:auto;padding-bottom:70px}.demo-disclosure{font-size:.8rem}.demo-kicker{margin-top:25px}h1{font-size:clamp(3.3rem,17vw,4.7rem)}.demo-actions{display:grid}.demo-button{width:100%}.demo-action-note{display:block}.product-stage{min-height:420px}.product-stage:before{width:330px}.product-art{height:380px}.candle{width:195px;height:235px}.candle-label{bottom:128px}.leaf{width:105px}.demo-chip{right:0;top:60px}.demo-section{padding:78px 0}.story-swatch{grid-template-columns:1fr}.swatch{min-height:140px}.contact-panel{padding:34px 20px}.footer-row{flex-direction:column}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.demo-button{transition:none}}
  </style>
</head>
<body>
  <header class="demo-top"><nav class="demo-nav demo-shell" aria-label="หน้าสาธิต"><span class="demo-brand"><span class="demo-brand-mark" aria-hidden="true">ล</span>ละมุนเดย์ สตูดิโอ</span><span class="demo-nav-tag">หน้าสาธิต</span></nav></header>
  <main data-content-set="1">
    <section class="demo-hero demo-shell" aria-labelledby="demo-title">
      <div class="demo-copy">
        <p class="demo-disclosure"><strong>ตัวอย่างสาธิต</strong> · แบรนด์และสินค้าสมมติ ไม่ใช่ข้อเสนอจากผู้ขายจริง</p>
        <p class="demo-kicker">Fictional product story</p>
        <h1 id="demo-title">เทียนหอม<br>แสงเช้า</h1>
        <p class="demo-lead">เรื่องราวตัวอย่างของเทียนหอมโทนอุ่น ที่ถ่ายทอดบรรยากาศเช้าอันเรียบง่ายผ่านสี วัสดุ และภาษาของแบรนด์สมมติ “ละมุนเดย์ สตูดิโอ”</p>
        <div class="demo-actions" aria-label="การทำงานตัวอย่าง"><a class="demo-button demo-product-action" href="#demo-details">ดูรายละเอียดตัวอย่าง</a><a class="demo-button demo-contact-action" href="#demo-contact">ดูช่องทางติดต่อจำลอง</a></div>
        <p class="demo-disclosure demo-action-note">ปุ่มตัวอย่างเท่านั้น · ไม่มีการสั่งซื้อหรือส่งข้อความจริง</p>
      </div>
      <div class="product-stage"><figure class="product-art" role="img" aria-label="ภาพประกอบเทียนหอมในภาชนะสีครีม รายล้อมด้วยใบไม้โทนเขียว"><span class="leaf one"></span><span class="leaf two"></span><span class="candle"></span><span class="candle-label">morning<br>glow</span><span class="demo-chip">ภาพสินค้าจำลอง</span></figure></div>
    </section>
    <section class="demo-section demo-shell" id="demo-details" aria-labelledby="details-title">
      <div class="demo-section-head"><div><span class="demo-section-tag">Sample details</span><h2 id="details-title">รายละเอียดที่ช่วยเล่า<br>คาแรกเตอร์สินค้า</h2></div><p>ตัวอย่างนี้แสดงการจัดเนื้อหาแบบหนึ่งชุด ตั้งแต่แนวคิดสินค้าไปจนถึงรายละเอียดสำคัญ โดยไม่มีข้อมูลจากลูกค้าและไม่มีระบบแก้ไขในหน้านี้</p></div>
      <div class="benefit-grid"><article class="benefit"><span class="benefit-no">01 / MOOD</span><h3>โทนเรื่องราวอบอุ่น</h3><p>ใช้ถ้อยคำ สี และพื้นที่ว่างเพื่อสื่อบุคลิกเรียบง่ายของสินค้าสมมติอย่างต่อเนื่อง</p></article><article class="benefit"><span class="benefit-no">02 / MATERIAL</span><h3>ภาพวัสดุที่มองเห็นชัด</h3><p>นำเสนอภาชนะสีครีม ฉลากเรียบ และองค์ประกอบธรรมชาติผ่านภาพประกอบที่สร้างเพื่อการสาธิต</p></article><article class="benefit"><span class="benefit-no">03 / PATH</span><h3>ลำดับการอ่านไม่ซับซ้อน</h3><p>พาผู้ชมจากเรื่องราวหลัก ไปยังรายละเอียด และจบที่ช่องทางติดต่อจำลองภายในหน้าเดียว</p></article></div>
    </section>
    <section class="demo-section story-band"><div class="demo-shell story-layout"><div><span class="demo-section-tag">Visual direction</span><h2>หนึ่งคอนเซปต์<br>หนึ่งชุดเนื้อหา</h2><p>งานสาธิตนี้ใช้เพียงชุดเนื้อหาเดียว ไม่มีปุ่มสลับชุด ไม่มีสถานะแก้ไข และไม่บันทึกข้อมูลใด ๆ</p></div><div class="story-swatch" aria-label="แนวทางภาพตัวอย่าง"><div class="swatch"><i aria-hidden="true"></i><b>Peach morning</b><span>โทนส้มพีชสำหรับความอบอุ่น</span></div><div class="swatch"><i aria-hidden="true"></i><b>Quiet sage</b><span>โทนเขียวหม่นสำหรับความเรียบสงบ</span></div></div></div></section>
    <section class="demo-section demo-shell" id="demo-contact" aria-labelledby="contact-title"><div class="contact-panel"><div><span class="demo-section-tag">Demo contact ending</span><h2 id="contact-title">ปลายทางตัวอย่างที่บอกเจตนาอย่างตรงไปตรงมา</h2><p>ข้อมูลทั้งหมดในหน้านี้สร้างขึ้นเพื่อสาธิตเท่านั้น ช่องทางติดต่อเป็นเพียงส่วนประกอบจำลอง และไม่มีการสั่งซื้อหรือส่งข้อความจริง</p></div><div class="contact-stamp" aria-label="ตราหน้าสาธิต ไม่ใช่ร้านค้าจริง">DEMO ONLY<br>ไม่ใช่ร้านค้าจริง</div></div></section>
  </main>
  <footer class="demo-footer"><div class="footer-row demo-shell"><span><strong>ละมุนเดย์ สตูดิโอ</strong> · แบรนด์สมมติ</span><span>ตัวอย่างหน้าเดียวโดย SmartLinkPage</span></div></footer>
</body>
</html>`;
