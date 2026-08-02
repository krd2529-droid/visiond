const money=n=>new Intl.NumberFormat('th-TH').format((Number(n)||0)/100)+' บาท';
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const demoProduct={id:1,slug:'paper-doll-sample',title:'ชุดตุ๊กตากระดาษพร้อมพิมพ์',category:'สินค้าดิจิทัล',description:'ไฟล์ตัวอย่างสำหรับแสดงหน้าสินค้า ประกอบด้วยภาพปก ภาพตัวอย่าง รายละเอียดไฟล์ และสิทธิ์การใช้งาน',short_description:'ชุดกิจกรรมตุ๊กตากระดาษสำหรับพิมพ์ ตัด และเล่น',price:19900,cover_url:'/assets/product-placeholder.svg'};
let currentProduct=demoProduct;
let currentOrderNo='';
const paymentDialog=document.querySelector('#paymentDialog');
const closePayment=document.querySelector('#closePayment');
const paidButton=document.querySelector('#paidButton');

function galleryMarkup(product){
  const cover=product.cover_url||'/assets/product-placeholder.svg';
  const previews=[cover,product.preview_url,product.preview_url_2].filter(Boolean);
  while(previews.length<3)previews.push('/assets/product-placeholder.svg');
  return `<div class="product-gallery"><img class="product-main-image" id="mainProductImage" src="${escapeHtml(previews[0])}" alt="${escapeHtml(product.title)}"><div class="product-thumbs">${previews.slice(0,3).map((src,index)=>`<button type="button" class="product-thumb ${index===0?'active':''}" data-preview="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="ภาพตัวอย่าง ${index+1}"></button>`).join('')}</div></div>`;
}
function renderProduct(product){
  currentProduct=product;
  productPage.innerHTML=`<div class="product-layout direct-buy-layout">${galleryMarkup(product)}<section class="product-info"><p class="eyebrow dark">${escapeHtml(product.category||'VISIOND PRODUCT')}</p><h1>${escapeHtml(product.title)}</h1><p class="product-summary">${escapeHtml(product.description||product.short_description||'')}</p><div class="product-price-row"><div><small>ราคา</small><div class="price">${money(product.price)}</div></div><span class="instant-badge">ซื้อแล้วปลดล็อก</span></div><div class="product-benefits"><h2>สิ่งที่จะได้รับ</h2><ul><li>ไฟล์ดิจิทัลของสินค้านี้ตามรายละเอียด</li><li>สิทธิ์เข้าถึงผูกกับบัญชีสมาชิกของผู้ซื้อ</li><li>ดาวน์โหลดหรือเปิดใช้งานได้หลัง Admin อนุมัติสลิป</li><li>กลับมาใช้งานได้จากเมนู “สินค้าของฉัน”</li></ul></div><div id="purchaseActions" class="purchase-actions"><button class="primary wide" id="buyNowButton" type="button">ซื้อสินค้านี้</button><a class="line-outline wide center" href="https://lin.ee/rU7lTLb6" target="_blank" rel="noopener">สอบถามทาง LINE</a></div><div id="downloadBox" class="download-box"><b>สถานะสิทธิ์ใช้งาน</b><p>กำลังตรวจสอบบัญชีและการซื้อสินค้า…</p></div></section></div><section class="product-detail-sections"><article><h2>รายละเอียดสินค้า</h2><p>${escapeHtml(product.description||product.short_description||'รายละเอียดสินค้าจะถูกเพิ่มจากหลังบ้าน')}</p></article><article><h2>ขั้นตอนการซื้อ</h2><ol><li>เข้าสู่ระบบบัญชี VisionD</li><li>กดซื้อสินค้านี้และชำระผ่าน QR Code หรือบัญชีบริษัท</li><li>ส่งสลิปทาง LINE พร้อมแจ้งเลขออเดอร์</li><li>Admin ตรวจสอบและปลดล็อกสินค้า</li></ol></article><article><h2>สิทธิ์การใช้งาน</h2><p>สิทธิ์ใช้งานเป็นของบัญชีผู้ซื้อ ห้ามแจกต่อหรือขายต่อ เว้นแต่สินค้าระบุใบอนุญาตเชิงพาณิชย์ไว้โดยเฉพาะ</p></article></section>`;
  document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#mainProductImage').src=button.dataset.preview;document.querySelectorAll('.product-thumb').forEach(item=>item.classList.toggle('active',item===button));}));
  document.querySelector('#buyNowButton').addEventListener('click',beginPurchase);
  checkEntitlement(product.id);
}
async function loadProduct(){
  const slug=new URLSearchParams(location.search).get('slug')||demoProduct.slug;
  try{const response=await fetch('/api/products/'+encodeURIComponent(slug));if(!response.ok)throw new Error('not found');const data=await response.json();renderProduct(data.item||demoProduct);}catch(error){renderProduct(demoProduct);}
}
async function checkEntitlement(productId){
  const box=document.querySelector('#downloadBox');
  try{const response=await fetch('/api/downloads/product/'+productId);const data=await response.json().catch(()=>({}));if(response.ok&&data.allowed){box.classList.add('unlocked');box.innerHTML=`<b>ซื้อแล้ว — พร้อมใช้งาน</b><p>สินค้านี้ถูกปลดล็อกในบัญชีของคุณแล้ว</p>${(data.files||[]).map(file=>`<a class="file-link" href="/api/downloads/file/${file.id}">ดาวน์โหลด ${escapeHtml(file.label)} · เวอร์ชัน ${escapeHtml(file.version)}</a>`).join('')}<a class="secondary-button center" href="/dashboard.html#my-products">ไปที่สินค้าของฉัน</a>`;document.querySelector('#purchaseActions').hidden=true;}else{box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>กดซื้อและแจ้งสลิป เมื่อ Admin อนุมัติแล้วจะใช้งานได้จากหน้านี้และสินค้าของฉัน</p>';}}catch(error){box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>เข้าสู่ระบบเพื่อเช็กสิทธิ์ หรือกดซื้อสินค้านี้</p>';}
}
async function beginPurchase(){
  const button=document.querySelector('#buyNowButton');button.disabled=true;button.textContent='กำลังสร้างคำสั่งซื้อ…';
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productIds:[currentProduct.id]})});
    if(response.status===401){sessionStorage.setItem('vd_return_to',location.href);location.href='/login.html';return;}
    const data=await response.json().catch(()=>({}));
    if(response.ok)currentOrderNo=data.orderNo||data.order_no||'';
    else if(response.status!==404)throw new Error(data.error||'สร้างคำสั่งซื้อไม่สำเร็จ');
  }catch(error){console.warn(error);}
  finally{button.disabled=false;button.textContent='ซื้อสินค้านี้';}
  paymentProduct.textContent=currentProduct.title;paymentAmount.textContent=money(currentProduct.price);paymentOrder.textContent=currentOrderNo?'เลขออเดอร์: '+currentOrderNo:'ระบบจะสร้างเลขออเดอร์เมื่อเชื่อมฐานข้อมูลเรียบร้อย';paymentDialog.showModal();
}
closePayment.addEventListener('click',()=>paymentDialog.close());
paymentDialog.addEventListener('click',event=>{if(event.target===paymentDialog)paymentDialog.close();});
paidButton.addEventListener('click',()=>{paidButton.textContent='รอตรวจสอบสลิป';paidButton.disabled=true;setTimeout(()=>{paymentDialog.close();location.href='/dashboard.html#my-products';},700);});
loadProduct();
