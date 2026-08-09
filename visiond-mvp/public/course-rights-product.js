(()=>{
  if(new URLSearchParams(location.search).get('slug')!=='course-selling-rights-30-days')return;
  let applied=false;
  const apply=()=>{
    const page=document.querySelector('#productPage'),info=page?.querySelector('.product-info');
    if(!info||applied)return;applied=true;
    const eyebrow=info.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='VISIOND COURSE SELLING RIGHTS';
    const labels=info.querySelectorAll('.product-classification span');if(labels[1])labels[1].innerHTML='<small>ประเภทสินค้า</small><b>เครดิตสิทธิ์</b>';
    const benefits=info.querySelector('.product-benefits');if(benefits)benefits.innerHTML=`<h2>สิ่งที่จะได้รับ</h2><ul><li>ซื้อ 1 ชิ้น ได้รับ 1 เครดิตสิทธิ์ และซื้อหลายชิ้นได้</li><li>ใช้ 1 เครดิตเพื่อเปิดตะกร้าคอร์สออนไลน์ 1 ตะกร้า</li><li>หักเครดิตเมื่อสร้างตะกร้าคอร์สสำเร็จเท่านั้น</li><li>แก้ไขคอร์สได้ 30 วัน โดยเริ่มนับจากเวลาที่สร้างตะกร้าสำเร็จ</li><li>รับยอดขายคอร์สเต็ม VisionD ไม่หักเปอร์เซ็นต์ยอดขาย</li><li>สินค้านี้ไม่ร่วมโปรโมชั่นส่วนลดกับสินค้าอื่น</li></ul><p class="rights-refund-note"><b>การคืนเงิน:</b> เครดิตไม่สามารถแลกเป็นเงินสดได้ และไม่คืนเงิน เว้นแต่ระบบยังใช้งานไม่ได้ภายใน 7 วันนับจากวันที่ได้รับอนุมัติ และ VisionD ตรวจสอบว่าเกิดจากระบบจริง</p><p><a href="/course-rights-terms.html" target="_blank" rel="noopener">อ่านเงื่อนไขสิทธิ์ฉบับเต็ม</a></p>`;
    const buy=info.querySelector('#buyNowButton');if(buy){buy.textContent='ไปที่รถเข็น';buy.onclick=()=>{document.querySelector('#addProductToCart')?.click();location.href='/cart';}}
    const add=info.querySelector('#addProductToCart');if(add)add.textContent='ใส่รถเข็น';
    const multi=info.querySelector('#multiCartButton');if(multi){multi.textContent='ดูสินค้าอื่น';multi.href='/digital-products.html';}
    const download=info.querySelector('#downloadBox');if(download)download.innerHTML='<b>การรับสิทธิ์</b><p>หลัง Admin ตรวจสอบและอนุมัติสลิป ระบบจะเพิ่มเครดิตสิทธิ์ในบัญชีของคุณ</p>';
    document.head.insertAdjacentHTML('beforeend','<style>.rights-refund-note{padding:13px;border:1px solid #d59a23;border-radius:12px;background:#fff8df;line-height:1.65}.product-info .product-benefits a{font-weight:900;color:#08756f;text-decoration:underline}</style>');
  };
  new MutationObserver(apply).observe(document.querySelector('#productPage')||document.body,{childList:true,subtree:true});apply();
})();
