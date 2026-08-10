import('/facebook-chat.js?v=014108');
const money=n=>new Intl.NumberFormat('th-TH').format((Number(n)||0)/100)+' บาท';
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const freshMedia=(url,version)=>url?.startsWith('/api/media/')?`${url}?v=${encodeURIComponent(version||Date.now())}`:url;
const categoryLabels={tattoo:'แบบรอยสัก',dinosaur:'ภาพระบายสีไดโนเสาร์','digital-product':'สินค้าดิจิทัล','coloring':'ภาพระบายสี',worksheet:'แบบฝึกหัด','development-game':'เกมเสริมพัฒนาการ','paper-doll':'ตุ๊กตากระดาษ','document':'เอกสารและแบบฟอร์ม','resale-rights':'สิทธิ์ลงขายคอร์สออนไลน์'};
const categoryLabel=product=>product.category_label||categoryLabels[product.category]||product.category||'สินค้าดิจิทัล';
const fileTypeLabel=product=>product.file_type||(/pdf/i.test(product.description||'')||product.category==='dinosaur'?'PDF พร้อมพิมพ์':'ไฟล์ดิจิทัล');
let currentProduct=null;
let currentOrderNo='';
let activeOrder=null;
const paymentDialog=document.querySelector('#paymentDialog');
const closePayment=document.querySelector('#closePayment');
const isRightsItem=item=>item?.category==='resale-rights'||item?.slug==='course-selling-rights';
const getCart=()=>{try{const saved=JSON.parse(localStorage.getItem('vd_cart')||'[]'),unique=new Map();let remaining=30;for(const raw of Array.isArray(saved)?saved:[]){if(!raw?.slug||unique.has(raw.slug)||remaining<1)continue;const quantity=isRightsItem(raw)?Math.min(remaining,Math.max(1,Math.floor(Number(raw.quantity)||1))):1;unique.set(raw.slug,{...raw,quantity});remaining-=quantity}return [...unique.values()]}catch{return[]}};
const updateCartCount=()=>{const count=getCart().reduce((sum,item)=>sum+(Number(item.quantity)||1),0);document.querySelectorAll('[data-cart-count]').forEach(node=>node.textContent=count)};
function syncProductCartButton(){const button=document.querySelector('#addProductToCart');if(!button||!currentProduct)return;const added=getCart().some(item=>item.slug===currentProduct.slug);button.textContent=added?'อยู่ในรถเข็นแล้ว ✓':'ใส่รถเข็น';button.classList.toggle('in-cart',added)}
function addCurrentProductToCart(){if(!currentProduct)return;const cart=getCart(),rights=currentProduct.category==='resale-rights',requested=rights?Math.min(30,Math.max(1,Math.floor(Number(document.querySelector('#courseRightsQuantity')?.value)||1))):1,existing=cart.find(item=>item.slug===currentProduct.slug),otherCount=cart.reduce((sum,item)=>sum+(item===existing?0:Number(item.quantity)||1),0),quantity=Math.min(requested,30-otherCount);if(quantity<1){alert('เลือกสินค้าได้สูงสุดรวม 30 ชิ้นต่อคำสั่งซื้อ');return}if(existing){if(rights){existing.quantity=quantity;localStorage.setItem('vd_cart',JSON.stringify(cart));updateCartCount();syncProductCartButton()}else syncProductCartButton();return}if(otherCount+quantity>30){alert('เลือกสินค้าได้สูงสุดรวม 30 ชิ้นต่อคำสั่งซื้อ');return}const sale=Number(currentProduct.sale_price??currentProduct.price)||0;cart.push({id:currentProduct.id,slug:currentProduct.slug,title:currentProduct.title,category:currentProduct.category,category_label:categoryLabel(currentProduct),price:sale,original_price:Number(currentProduct.original_price??currentProduct.price)||sale,promotion_percent:Number(currentProduct.promotion_percent)||0,cover_url:currentProduct.cover_url||'/assets/product-placeholder.svg',quantity});localStorage.setItem('vd_cart',JSON.stringify(cart));window.visiondPixel?.track('AddToCart',{content_ids:[String(currentProduct.id||currentProduct.slug)],content_name:currentProduct.title,content_type:'product',value:(sale*quantity)/100,currency:'THB'});updateCartCount();syncProductCartButton()}

function renderProductError(message){
  currentProduct=null;
  document.title='ไม่พบสินค้า | VisionD Online';
  productPage.innerHTML=`<section class="product-loading product-load-error"><b>${escapeHtml(message)}</b><p>หน้านี้ไม่เปิดให้สั่งซื้อจนกว่าจะโหลดข้อมูลสินค้าจริงสำเร็จ</p><div class="actions"><a class="primary" href="/digital-products">กลับไปเลือกสินค้า</a><button class="secondary-button" type="button" onclick="location.reload()">ลองโหลดอีกครั้ง</button></div></section>`;
  updateCartCount();
}

function galleryMarkup(product){
  const cover=product.cover_url||'/assets/product-placeholder.svg';
  let saved=[];try{saved=Array.isArray(product.preview_urls)?product.preview_urls:JSON.parse(product.preview_urls||'[]')}catch(error){saved=[]}const previews=[...new Set([cover,...saved].filter(Boolean))].slice(0,30).map(url=>freshMedia(url,product.updated_at));
  return `<div class="product-gallery"><img class="product-main-image" id="mainProductImage" src="${escapeHtml(previews[0])}" alt="${escapeHtml(product.title)}"><div class="product-thumbs ${previews.length===1?'single-thumb':''}">${previews.map((src,index)=>`<button type="button" class="product-thumb ${index===0?'active':''}" data-preview="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="ภาพตัวอย่าง ${index+1}"></button>`).join('')}</div></div>`;
}
function renderProduct(product){
  currentProduct=product;
  window.visiondPixel?.track('ViewContent',{content_ids:[String(product.id||product.slug)],content_name:product.title,content_category:categoryLabel(product),content_type:'product',value:Number(product.sale_price??product.price??0)/100,currency:'THB'});
  document.title=`${product.title} | ${categoryLabel(product)} PDF | VisionD Online`;
  const description=(product.short_description||product.description||`${product.title} ดูภาพตัวอย่าง ราคา และดาวน์โหลดไฟล์ดิจิทัลหลังอนุมัติ`).replace(/\s+/g,' ').trim().slice(0,180);
  let metaDescription=document.querySelector('meta[name="description"]');
  if(!metaDescription){metaDescription=document.createElement('meta');metaDescription.name='description';document.head.append(metaDescription)}
  metaDescription.content=description;
  let canonical=document.querySelector('link[rel="canonical"]');
  if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}
  canonical.href=`https://visiondonline.com/product.html?slug=${encodeURIComponent(product.slug)}`;
  productPage.innerHTML=`<button class="product-back-button" id="productBackButton" type="button">← กลับ</button><div class="product-layout direct-buy-layout">${galleryMarkup(product)}<section class="product-info"><p class="eyebrow dark">VISIOND DIGITAL PRODUCT</p><div class="product-classification"><span><small>หมวดหมู่</small><b>${escapeHtml(categoryLabel(product))}</b></span><span><small>ประเภทไฟล์</small><b>${escapeHtml(fileTypeLabel(product))}</b></span><span><small>จำนวนผู้เข้าชม</small><b><span data-product-views>—</span> ครั้ง</b></span></div><h1>${escapeHtml(product.title)}</h1><p class="product-summary">${escapeHtml(product.description||product.short_description||'')}</p><div class="product-price-row"><div><small>ราคา</small><div class="price">${money(product.price)}</div></div><span class="instant-badge">ซื้อแล้วปลดล็อก</span></div><div class="product-benefits"><h2>สิ่งที่จะได้รับ</h2><ul><li>ไฟล์ดิจิทัลของสินค้านี้ตามรายละเอียด</li><li>สิทธิ์เข้าถึงผูกกับบัญชีสมาชิกของผู้ซื้อ</li><li>ดาวน์โหลดหรือเปิดใช้งานได้หลัง Admin อนุมัติสลิป</li><li>กลับมาใช้งานได้จากเมนู “สินค้าของฉัน”</li></ul></div><div id="purchaseActions" class="purchase-actions purchase-actions-clean"><button class="primary wide purchase-main" id="buyNowButton" type="button">ซื้อสินค้านี้</button><button class="secondary-button wide" id="addProductToCart" type="button">ใส่รถเข็น</button><div class="purchase-secondary-links"><a href="/digital-products">เลือกซื้อหลายตะกร้า</a><a href="https://lin.ee/RJZwr1p" target="_blank" rel="noopener">สอบถามทาง LINE</a></div></div><div id="downloadBox" class="download-box"><b>สถานะสิทธิ์ใช้งาน</b><p>กำลังตรวจสอบบัญชีและการซื้อสินค้า…</p></div></section></div><section class="product-detail-sections"><article><h2>รายละเอียดสินค้า</h2><p>${escapeHtml(product.description||product.short_description||'รายละเอียดสินค้าจะถูกเพิ่มจากหลังบ้าน')}</p></article><article><h2>ขั้นตอนการซื้อ</h2><ol><li>เข้าสู่ระบบบัญชี VisionD</li><li>กดซื้อสินค้านี้และโอนเข้าบัญชีที่ร้านแจ้ง</li><li>อัปโหลดสลิปพร้อมเลขออเดอร์</li><li>Admin ตรวจสอบและปลดล็อกสินค้า</li></ol></article><article><h2>สิทธิ์การใช้งาน</h2><p>สิทธิ์ใช้งานเป็นของบัญชีผู้ซื้อ ห้ามแจกต่อหรือขายต่อ เว้นแต่สินค้าระบุใบอนุญาตเชิงพาณิชย์ไว้โดยเฉพาะ</p></article></section>`;
  productPage.querySelector('.product-gallery')?.classList.add('vds-card','vds-card--information');
  productPage.querySelector('.product-info')?.classList.add('vds-card','vds-card--information');
  productPage.querySelectorAll('.product-detail-sections article').forEach(article=>article.classList.add('vds-card','vds-card--information'));
  const backButton=productPage.querySelector('#productBackButton');backButton?.classList.add('vds-btn','vds-btn--secondary');
  const buyButton=productPage.querySelector('#buyNowButton');buyButton?.classList.remove('primary','wide');buyButton?.classList.add('vds-btn','vds-btn--primary','vds-btn--large','vds-btn--wide');
  const cartButton=productPage.querySelector('#addProductToCart');cartButton?.classList.remove('secondary-button','wide');cartButton?.classList.add('vds-btn','vds-btn--promotion','vds-btn--large','vds-btn--wide');
  if(product.category==='resale-rights'){
    productPage.querySelector('.product-info>.eyebrow').textContent='VISIOND COURSE SELLER';
    productPage.querySelector('.product-benefits').innerHTML='<h2>สิ่งที่จะได้รับ</h2><ul><li>สิทธิ์สร้างตะกร้าขายคอร์สออนไลน์ 1 ตะกร้า</li><li>กำหนดราคา ช่องทางติดต่อ QR และบัญชีรับเงินของคุณเอง</li><li>เพิ่มคลิปและเอกสารประกอบแยกตาม EP</li><li>ดูยอดขาย จำนวนออเดอร์ และวันเวลาได้จากแดชบอร์ดผู้ขาย</li><li><b>ราคาพิเศษจาก 999 บาท เหลือ 499 บาท</b></li><li><b>ตะกร้านี้ไม่ร่วมโปรส่วนลดกับตะกร้าใด ๆ</b></li></ul>';
    productPage.querySelector('.instant-badge').textContent='ซื้อแล้วใช้สิทธิ์ได้หลังอนุมัติ';
    const detailSection=productPage.querySelector('.product-detail-sections');
    detailSection?.firstElementChild?.insertAdjacentHTML('afterend','<article class="course-cover-policy"><h2>กติกาภาพปกคอร์ส</h2><p><b>ใช้ชื่อแพลตฟอร์มเป็นข้อความธรรมดาได้ แต่ห้ามนำโลโก้หรือสื่อของแบรนด์อื่นมาใช้เป็นภาพปกโดยไม่มีหลักฐานอนุญาต</b></p><ul><li>ห้ามใช้โลโก้ เครื่องหมายการค้า ภาพหน้าจอ หรือสื่อประชาสัมพันธ์ของบุคคลและแบรนด์อื่นเป็นภาพปก</li><li>หากจำเป็นต้องใช้ ต้องมีหนังสืออนุญาตและส่งหลักฐานให้ VisionD ตรวจสอบก่อน</li><li>พิมพ์ชื่อแพลตฟอร์มเป็นข้อความธรรมดาได้ เช่น “สอนเปิดร้านบน Shopee” หรือ “เทคนิคขายสินค้าบน Lazada”</li><li>ห้ามใช้สี ตัวอักษร รูปแบบ หรือองค์ประกอบที่ทำให้เข้าใจว่าเป็นคอร์สทางการหรือได้รับการรับรองจากแบรนด์</li><li>VisionD มีสิทธิ์ขอให้เปลี่ยนหรือระงับภาพปกที่เสี่ยงละเมิดสิทธิ์</li></ul></article>');
  }else if(product.category==='online-course'){
    productPage.querySelector('.product-info>.eyebrow').textContent='VISIOND ONLINE COURSE';
    productPage.querySelector('.instant-badge').textContent='ตรวจผ่านแล้วเข้าเรียนทันที';
    productPage.querySelector('.product-benefits').innerHTML='<h2>สิ่งที่จะได้รับ</h2><ul><li>ดูวิดีโอแยกตาม EP</li><li>ดาวน์โหลดไฟล์ประกอบของแต่ละ EP</li><li>บันทึกบทที่เรียนจบและกลับมาเรียนต่อได้</li><li>ชำระเงินตรงเข้าบัญชีเจ้าของคอร์ส</li><li>ตรวจสลิปด้วย API ของเจ้าของคอร์ส หาก API อ่านไม่ได้เจ้าของคอร์สจะตรวจเอง</li></ul>';
    productPage.querySelector('#addProductToCart').hidden=true;
    const steps=productPage.querySelector('.product-detail-sections article:nth-child(2)');
    if(steps)steps.innerHTML='<h2>ขั้นตอนการซื้อคอร์ส</h2><ol><li>เข้าสู่ระบบบัญชี VisionD</li><li>กดซื้อและโอนเข้าบัญชีเจ้าของคอร์สที่ระบบแสดง</li><li>อัปโหลดสลิปเพื่อให้ API ของเจ้าของคอร์สตรวจ</li><li>เมื่อผ่าน คอร์สจะเข้า “คอร์สเรียนของฉัน” และเริ่มเรียนได้ทันที</li></ol>';
  }
  if(Number(product.promotion_percent)>0){
    const row=productPage.querySelector('.product-price-row'),priceBox=row?.firstElementChild,badge=row?.querySelector('.instant-badge');
    if(priceBox)priceBox.innerHTML=`<small>ราคาโปรโมชั่น</small><div class="product-promo-prices"><del>${money(product.original_price||product.price)}</del><div class="price">${money(product.sale_price)}</div></div>`;
    if(badge)badge.innerHTML=`โปรโมชั่น <b class="product-promo-pill">ลด ${Number(product.promotion_percent)}%</b>`;
  }
  document.dispatchEvent(new CustomEvent('visiond:product-rendered'));
  document.querySelectorAll('[data-preview]').forEach((button,index)=>{button.setAttribute('aria-pressed',index===0?'true':'false');button.addEventListener('click',()=>{document.querySelector('#mainProductImage').src=button.dataset.preview;document.querySelectorAll('.product-thumb').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',active?'true':'false')});})});
  document.querySelector('#buyNowButton').addEventListener('click',product.category==='resale-rights'?()=>{addCurrentProductToCart();location.href='/cart'}:beginPurchase);
  document.querySelector('#productBackButton').addEventListener('click',()=>{try{const referrer=new URL(document.referrer);if(referrer.origin===location.origin){history.back();return}}catch{}location.href='/digital-products.html'});
  document.querySelector('#addProductToCart').addEventListener('click',addCurrentProductToCart);
  syncProductCartButton();
  updateCartCount();
  checkEntitlement(product.id);
}
async function loadProduct(){
  const slug=String(new URLSearchParams(location.search).get('slug')||'').trim();
  if(!slug){renderProductError('ไม่พบรหัสสินค้า');return}
  try{const response=await fetch('/api/products/'+encodeURIComponent(slug),{cache:'no-store'});if(!response.ok){renderProductError(response.status===404?'ไม่พบสินค้านี้':'โหลดสินค้าไม่สำเร็จ');return}const data=await response.json();if(!data?.item?.id||!data.item.slug){renderProductError('ข้อมูลสินค้าไม่สมบูรณ์');return}renderProduct(data.item);}catch(error){renderProductError('เชื่อมต่อข้อมูลสินค้าไม่สำเร็จ');}
}
async function checkEntitlement(productId){
  const box=document.querySelector('#downloadBox');
  try{const response=await fetch('/api/downloads/product/'+productId);const data=await response.json().catch(()=>({}));if(response.ok&&data.allowed){if(currentProduct.category==='resale-rights'){box.classList.add('unlocked');box.innerHTML='<div class="unlocked-head"><div><b>ได้รับเครดิตสิทธิ์แล้ว</b><p>ไปต่อ Vision 5 เพื่อเลือกคอร์สร่างและผูกตะกร้า</p></div><span>UNLOCKED</span></div><a class="download-primary" href="/course-seller.html?vision5=1">ไปขั้นตอน Vision 5</a>';return}const files=data.files||[];box.classList.add('unlocked');box.innerHTML=`<div class="unlocked-head"><div><b>ปลดล็อกแล้ว — พร้อมดาวน์โหลด</b><p>ไฟล์ของสินค้านี้พร้อมใช้งานในบัญชีของคุณ</p></div><span>UNLOCKED</span></div>${files.length?files.map(file=>`<section class="unlocked-file"><div class="unlocked-file-title"><b>${escapeHtml(file.label)}</b><small>เวอร์ชัน ${escapeHtml(file.version)}${file.file_size?' · '+new Intl.NumberFormat('th-TH').format(file.file_size/1048576)+' MB':''}</small></div>${file.mime_type==='application/pdf'?`<div class="pdf-preview"><iframe src="/api/downloads/file/${file.id}?view=1" title="ตัวอย่าง ${escapeHtml(file.label)}"></iframe></div>`:''}<a class="download-primary" href="/api/downloads/file/${file.id}">ดาวน์โหลด${file.mime_type==='application/pdf'?' PDF':''}</a></section>`).join(''):'<div class="file-waiting"><b>สิทธิ์ได้รับอนุมัติแล้ว</b><p>แอดมินกำลังเพิ่มไฟล์ดาวน์โหลด กรุณาตรวจสอบอีกครั้งภายหลัง</p></div>'}<a class="secondary-button center" href="/dashboard.html#my-products">ดูสินค้าทั้งหมดของฉัน</a>`;document.querySelector('#purchaseActions').hidden=true;}else{box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>กดซื้อและแจ้งสลิป เมื่อ Admin อนุมัติแล้วจะใช้งานได้จากหน้านี้และสินค้าของฉัน</p>';}}catch(error){box.innerHTML='<b>ยังไม่ได้ปลดล็อก</b><p>เข้าสู่ระบบเพื่อเช็กสิทธิ์ หรือกดซื้อสินค้านี้</p>';}
}
async function beginPurchase(){
  if(!currentProduct)return;
  const button=document.querySelector('#buyNowButton');button.disabled=true;button.textContent='กำลังสร้างคำสั่งซื้อ…';
  try{
    const quantity=currentProduct.category==='resale-rights'?Math.min(30,Math.max(1,Number(document.querySelector('#courseRightsQuantity')?.value)||1)):1;
    const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productSlugs:[currentProduct.slug],quantities:{[currentProduct.slug]:quantity}})});
    if(response.status===401){sessionStorage.setItem('vd_return_to',location.href);location.href='/login.html';return;}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'สร้างคำสั่งซื้อไม่สำเร็จ');
    activeOrder=data;currentOrderNo=data.orderNo||data.order_no||'';window.visiondPixel?.track('InitiateCheckout',{content_ids:[String(currentProduct.id||currentProduct.slug)],content_name:currentProduct.title,content_type:'product',num_items:quantity,value:Number(data.total||currentProduct.price||0)/100,currency:'THB'});
    const bank=data.bank||{};
    productBankName.textContent=bank.bank_name||'-';
    productAccountName.textContent=bank.account_name||'-';
    productAccountNumber.textContent=bank.account_number||'-';
    productPaymentQr.hidden=!bank.qr_url;productPaymentQr.src=bank.qr_url||'';
    paymentProduct.textContent=currentProduct.title;paymentAmount.textContent=money(data.total||currentProduct.price);paymentOrder.textContent='เลขออเดอร์: '+currentOrderNo;paymentDialog.showModal();
  }catch(error){alert(error.message);}
  finally{button.disabled=false;button.textContent='ซื้อสินค้านี้';}
}
closePayment.addEventListener('click',()=>paymentDialog.close());
paymentDialog.addEventListener('click',event=>{if(event.target===paymentDialog)paymentDialog.close();});
productCopyAccount.addEventListener('click',async()=>{const number=productAccountNumber.textContent.trim();if(!number||number==='-')return;try{await navigator.clipboard.writeText(number);productCopyAccount.textContent='คัดลอกแล้ว ✓'}catch{const range=document.createRange();range.selectNode(productAccountNumber);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);productCopyAccount.textContent='เลือกเลขแล้ว กดคัดลอก'}setTimeout(()=>productCopyAccount.textContent='คัดลอกเลขบัญชี',1600)});
productSlipForm.addEventListener('submit',async event=>{event.preventDefault();if(!activeOrder?.id)return;const button=productSlipForm.querySelector('button');button.disabled=true;productSlipMessage.textContent='กำลังอัปโหลดและตรวจสลิป…';try{const response=await fetch(`/api/orders/${activeOrder.id}/slip`,{method:'POST',body:new FormData(productSlipForm)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'ส่งสลิปไม่สำเร็จ');productSlipMessage.textContent=data.message||'รับสลิปเรียบร้อย';setTimeout(()=>location.href=data.auto_approved&&currentProduct.category==='online-course'?'/my-courses.html':'/dashboard.html#orders',1400)}catch(error){productSlipMessage.textContent=error.message;button.disabled=false;}});
loadProduct();
import('/nav-account.js?v=014108').then(module=>module.initAccountNav());
