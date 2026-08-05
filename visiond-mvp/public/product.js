import('/facebook-chat.js?v=01144');
const money=n=>new Intl.NumberFormat('th-TH').format((Number(n)||0)/100)+' บาท';
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const freshMedia=(url,version)=>url?.startsWith('/api/media/')?`${url}?v=${encodeURIComponent(version||Date.now())}`:url;
const categoryLabels={dinosaur:'ภาพระบายสีไดโนเสาร์','digital-product':'สินค้าดิจิทัล','coloring':'ภาพระบายสี','paper-doll':'ตุ๊กตากระดาษ','document':'เอกสารและแบบฟอร์ม'};
const categoryLabel=product=>product.category_label||categoryLabels[product.category]||product.category||'สินค้าดิจิทัล';
const fileTypeLabel=product=>product.file_type||(/pdf/i.test(product.description||'')||product.category==='dinosaur'?'PDF พร้อมพิมพ์':'ไฟล์ดิจิทัล');
const demoProduct={id:1,slug:'paper-doll-sample',title:'ชุดตุ๊กตากระดาษพร้อมพิมพ์',category:'สินค้าดิจิทัล',description:'ไฟล์ตัวอย่างสำหรับแสดงหน้าสินค้า ประกอบด้วยภาพปก ภาพตัวอย่าง รายละเอียดไฟล์ และสิทธิ์การใช้งาน',short_description:'ชุดกิจกรรมตุ๊กตากระดาษสำหรับพิมพ์ ตัด และเล่น',price:19900,cover_url:'/assets/product-placeholder.svg'};
let currentProduct=demoProduct;
let currentOrderNo='';
let activeOrder=null;
const paymentDialog=document.querySelector('#paymentDialog');
const closePayment=document.querySelector('#closePayment');

function galleryMarkup(product){
  const cover=product.cover_url||'/assets/product-placeholder.svg';
  let saved=[];try{saved=Array.isArray(product.preview_urls)?product.preview_urls:JSON.parse(product.preview_urls||'[]')}catch(error){saved=[]}const previews=[...new Set([cover,...saved].filter(Boolean))].slice(0,30).map(url=>freshMedia(url,product.updated_at));
  return `<div class="product-gallery"><img class="product-main-image" id="mainProductImage" src="${escapeHtml(previews[0])}" alt="${escapeHtml(product.title)}"><div class="product-thumbs ${previews.length===1?'single-thumb':''}">${previews.map((src,index)=>`<button type="button" class="product-thumb ${index===0?'active':''}" data-preview="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="ภาพตัวอย่าง ${index+1}"></button>`).join('')}</div></div>`;
}
function renderProduct(product){
  currentProduct=product;
  productPage.innerHTML=`<div class="product-layout direct-buy-layout">${galleryMarkup(product)}<section class="product-info"><p class="eyebrow dark">VISIOND DIGITAL PRODUCT</p><div class="product-classification"><span><small>หมวดหมู่</small><b>${escapeHtml(categoryLabel(product))}</b></span><span><small>ประเภทไฟล์</small><b>${escapeHtml(fileTypeLabel(product))}</b></span></div><h1>${escapeHtml(product.title)}</h1><p class="product-summary">${escapeHtml(product.description||product.short_description||'')}</p><div class="product-price-row"><div><small>ราคา</small><div class="price">${money(product.price)}</div></div><span class="instant-badge">ซื้อแล้วปลดล็อก</span></div><div class="product-benefits"><h2>สิ่งที่จะได้รับ</h2><ul><li>ไฟล์ดิจิทัลของสินค้านี้ตามรายละเอียด</li><li>สิทธิ์เข้าถึงผูกกับบัญชีสมาชิกของผู้ซื้อ</li><li>ดาวน์โหลดหรือเปิดใช้งานได้หลัง Admin อนุมัติสลิป</li><li>กลับมาใช้งานได้จากเมนู “สินค้าของฉัน”</li></ul></div><div id="purchaseActions" class="purchase-actions"><button class="primary wide" id="buyNowButton" type="button">ซื้อสินค้านี้</button><a class="line-outline wide center" href="https://lin.ee/rU7lTLb6" target="_blank" rel="noopener">สอบถามทาง LINE</a></div><div id="downloadBox" class="download-box"><b>สถานะสิทธิ์ใช้งาน</b><p>กำลังตรวจสอบบัญชีและการซื้อสินค้า…</p></div></section></div><section class="product-detail-sections"><article><h2>รายละเอียดสินค้า</h2><p>${escapeHtml(product.description||product.short_description||'รายละเอียดสินค้าจะถูกเพิ่มจากหลังบ้าน')}</p></article><article><h2>ขั้นตอนการซื้อ</h2><ol><li>เข้าสู่ระบบบัญชี VisionD</li><li>กดซื้อสินค้านี้และชำระผ่าน QR Code หรือบัญชีบริษัท</li><li>ส่งสลิปทาง LINE พร้อมแจ้งเลขออเดอร์</li><li>Admin ตรวจสอบและปลดล็อกสินค้า</li></ol></article><article><h2>สิทธิ์การใช้งาน</h2><p>สิทธิ์ใช้งานเป็นของบัญชีผู้ซื้อ ห้ามแจกต่อหรือขายต่อ เว้นแต่สินค้าระบุใบอนุญาตเชิงพาณิชย์ไว้โดยเฉพาะ</p></article></section>`;
  document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#mainProductImage').src=button.dataset.preview;document.querySelectorAll('.product-thumb').forEach(item=>item.classList.toggle('active',item===button));}));
  document.querySelector('#buyNowButton').addEventListener('click',beginPurchase);
  checkEntitlement(product.id);
}
async function loadProduct(){
  const slug=new URLSearchParams(location.search).get('slug')||demoProduct.slug;
  try{const response=await fetch('/api/products/'+encodeURIComponent(slug),{cache:'no-store'});if(!response.ok)throw new Error('not found');const data=await response.json();renderProduct(data.item||demoProduct);}catch(error){renderProduct(demoProduct);}
}
async function checkEntitlement(productId){
  const box=document.querySelector('#downloadBox');
  try{const response=await fetch('/api/downloads/product/'+productId);const data=await response.json().catch(()=>({}));if(response.ok&&data.allowed){const files=data.files||[];box.classList.add('unlocked');box.innerHTML=`<div class="unlocked-head"><div><b>ปลดล็อกแล้ว — พร้อมดาวน์โหลด</b><p>ไฟล์ของสินค้านี้พร้อมใช้งานในบัญชีของคุณ</p></div><span>UNLOCKED</span></div>${files.length?files.map(file=>`<section class="unlocked-file"><div class="unlocked-file-title"><b>${escapeHtml(file.label)}</b><small>เวอร์ชัน ${escapeHtml(file.version)}${file.file_size?' · '+new Intl.NumberFormat('th-TH').format(file.file_size/1048576)+' MB':''}</small></div>${file.mime_type==='application/pdf'?`<div class="pdf-preview"><iframe src="/api/downloads/file/${file.id}?view=1" title="ตัวอย่าง ${escapeHtml(file.label)}"></iframe></div>`:''}<a class="download-primary" href="/api/downloads/file/${file.id}">ดาวน์โหลด${file.mime_type==='application/pdf'?' PDF':''}</a></section>`).join(''):'<div class="file-waiting"><b>สิทธิ์ได้รับอนุมัติแล้ว</b><p>แอดมินกำลังเพิ่มไฟล์ดาวน์โหลด กรุณาตรวจสอบอีกครั้งภายหลัง</p></div>'}<a class="secondary-button center" href="/dashboard.html#my-products">ดูสินค้าทั้งหมดของฉัน</a>`;document.querySelector('#purchaseActions').hidden=true;}else{box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>กดซื้อและแจ้งสลิป เมื่อ Admin อนุมัติแล้วจะใช้งานได้จากหน้านี้และสินค้าของฉัน</p>';}}catch(error){box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>เข้าสู่ระบบเพื่อเช็กสิทธิ์ หรือกดซื้อสินค้านี้</p>';}
}
async function beginPurchase(){
  const button=document.querySelector('#buyNowButton');button.disabled=true;button.textContent='กำลังสร้างคำสั่งซื้อ…';
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productSlugs:[currentProduct.slug]})});
    if(response.status===401){sessionStorage.setItem('vd_return_to',location.href);location.href='/login.html';return;}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'สร้างคำสั่งซื้อไม่สำเร็จ');
    activeOrder=data;currentOrderNo=data.orderNo||data.order_no||'';
    const bank=data.bank||{};
    productBankName.textContent=bank.bank_name||'-';
    productAccountName.textContent=bank.account_name||'-';
    productAccountNumber.textContent=bank.account_number||'-';
    paymentProduct.textContent=currentProduct.title;paymentAmount.textContent=money(data.total||currentProduct.price);paymentOrder.textContent='เลขออเดอร์: '+currentOrderNo;paymentDialog.showModal();
  }catch(error){alert(error.message);}
  finally{button.disabled=false;button.textContent='ซื้อสินค้านี้';}
}
closePayment.addEventListener('click',()=>paymentDialog.close());
paymentDialog.addEventListener('click',event=>{if(event.target===paymentDialog)paymentDialog.close();});
productCopyAccount.addEventListener('click',async()=>{const number=productAccountNumber.textContent.trim();if(!number||number==='-')return;await navigator.clipboard.writeText(number);productCopyAccount.textContent='คัดลอกแล้ว ✓';setTimeout(()=>productCopyAccount.textContent='คัดลอกเลขบัญชี',1600)});
productSlipForm.addEventListener('submit',async event=>{event.preventDefault();if(!activeOrder?.id)return;const button=productSlipForm.querySelector('button');button.disabled=true;productSlipMessage.textContent='กำลังอัปโหลดสลิป…';try{const response=await fetch(`/api/orders/${activeOrder.id}/slip`,{method:'POST',body:new FormData(productSlipForm)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'ส่งสลิปไม่สำเร็จ');productSlipMessage.textContent=activeOrder.bank?.payment_message||'ส่งสลิปเรียบร้อย กรุณารอแอดมินตรวจสอบ';setTimeout(()=>location.href='/dashboard.html#orders',900)}catch(error){productSlipMessage.textContent=error.message;button.disabled=false;}});
loadProduct();
import('/nav-account.js?v=0819').then(module=>module.initAccountNav());
