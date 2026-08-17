import("/facebook-chat.js?v=014248");
const bundlePromoImage=document.querySelector('.cart-promo-gif');if(bundlePromoImage){bundlePromoImage.src=`/assets/visiond-bundle-promo.gif?motion=${Date.now()}`;bundlePromoImage.classList.add('cart-promo-banner')}
if(!document.querySelector('link[href^="/promotion.css"]'))document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/promotion.css?v=014248">');
if(!document.querySelector('#rights-quantity-style'))document.head.insertAdjacentHTML('beforeend','<style id="rights-quantity-style">.rights-quantity,.vbot-key-choice{display:grid;gap:4px;color:#315f5b;font-size:12px;font-weight:900}.rights-quantity input{width:76px;padding:8px;border:1px solid #39aaa4;border-radius:8px;text-align:center;font-weight:900}.vbot-key-choice{max-width:330px;margin:10px 0}.vbot-key-choice select{width:100%;min-height:44px;padding:9px 11px;border:1px solid #39aaa4;border-radius:10px;background:#fff;color:#063d3b;font:inherit}</style>');
const money = (n) =>
  new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const normalizeCart = (items) => {
  const unique = new Map();
  let remaining=30;
  for (const item of Array.isArray(items) ? items : []) {
    if(!item?.slug||unique.has(item.slug)||remaining<1)continue;
    const rights=item.category==='resale-rights'||item.slug==='course-selling-rights',quantity=rights?Math.min(remaining,Math.max(1,Math.floor(Number(item.quantity)||1))):1;
    unique.set(item.slug,{...item,quantity});remaining-=quantity;
  }
  return [...unique.values()];
};
const cartSignature = (items) =>
  normalizeCart(items)
    .map((item) => `${String(item.slug)}:${Number(item.quantity) || 1}`)
    .sort()
    .join("|");
let activeOrder = null;
const getCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("vd_cart") || "[]"),
      clean = normalizeCart(saved);
    if (clean.length !== (Array.isArray(saved) ? saved.length : 0))
      localStorage.setItem("vd_cart", JSON.stringify(clean));
    return clean;
  } catch {
    return [];
  }
};
const saveCart = (items) => {
  resetActiveOrder();
  localStorage.setItem("vd_cart", JSON.stringify(normalizeCart(items)));
  render();
};
async function refreshCartPrices(){
  if(!getCart().length)return;
  try{
    const [productsResponse,coursesResponse,vbotResponse]=await Promise.all([fetch('/api/products',{cache:'no-store'}),fetch('/api/courses',{cache:'no-store'}),fetch('/api/vision7/apps',{cache:'no-store'})]);if(!productsResponse.ok||!coursesResponse.ok||!vbotResponse.ok)return;
    const [products,courses,vbot]=await Promise.all([productsResponse.json(),coursesResponse.json(),vbotResponse.json()]);
    const publicPlans=new Set(['monthly','yearly','lifetime']),vbotOffers=[];
    for(const app of vbot.items||[]){let offers=app.offers||[];if(typeof offers==='string'){try{offers=JSON.parse(offers)}catch{offers=[]}}offers=(Array.isArray(offers)?offers:[]).filter(offer=>publicPlans.has(String(offer.code||offer.plan_code))&&Number(offer.price)>0&&offer.product_slug&&Number(offer.product_id)>0).map(offer=>({id:Number(offer.product_id),slug:offer.product_slug,title:`${app.name||app.code} · คีย์ ${offer.name||''}`,price:Number(offer.price),cover_url:app.cover_url,category:'vbot-key',category_label:'โปรแกรม VBot พร้อมคีย์',product_kind:'vision7-key',vision7_plan_id:Number(offer.id),vbot_plan_code:String(offer.code||offer.plan_code),vbot_duration_days:offer.duration_days,vbot_app_code:app.code,vbot_platform_type:app.platform_type}));for(const offer of offers)vbotOffers.push({...offer,vbot_offers:offers})}
    const available=[...(products.items||[]),...(courses.items||[]).map(course=>({...course,id:course.product_id,course_id:course.id,product_kind:'course',category:'online-course'})),...vbotOffers],bySlug=new Map(available.map(item=>[item.slug,item])),before=getCart(),fresh=before.flatMap(item=>{const product=bySlug.get(item.slug);if(!product)return [];return [{...item,...product,id:product.id,course_id:product.course_id||item.course_id,price:Number(product.sale_price??product.price),original_price:Number(product.original_price??product.price),promotion_percent:Number(product.promotion_percent)||0,cover_url:product.cover_url||item.cover_url}]});
    if(fresh.length!==before.length)resetActiveOrder();
    localStorage.setItem('vd_cart',JSON.stringify(fresh));render();
    if(fresh.length!==before.length)alert(`นำสินค้า ${before.length-fresh.length} รายการออกจากตะกร้าแล้ว เพราะสินค้าปิดขายหรือถูกลบ`);
  }catch{}
}
const discountRate = (count) =>
  count >= 30 ? 30 : count >= 20 ? 20 : count >= 10 ? 10 : count >= 5 ? 5 : 0;
const isVLearningOrder = (order) =>
  Boolean(
    order?.items?.some(
      (item) =>
        item?.category === "online-course" || item?.product_kind === "course",
    ),
  );
copyAccountButton.onclick = async () => {
  const account = bankAccountNumber.textContent.trim();
  if (!account || account === "-") return;
  try {
    await navigator.clipboard.writeText(account);
    copyAccountButton.textContent = "คัดลอกแล้ว ✓";
  } catch {
    const range = document.createRange();
    range.selectNode(bankAccountNumber);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let copied = false;
    try { copied = document.execCommand("copy"); } catch {}
    copyAccountButton.textContent = copied ? "คัดลอกแล้ว ✓" : "เลือกเลขแล้ว แตะค้างเพื่อคัดลอก";
  }
  setTimeout(() => (copyAccountButton.textContent = "คัดลอกเลขบัญชี"), 1800);
};
const vbotDuration=(offer)=>offer.vbot_plan_code==='monthly'||Number(offer.vbot_duration_days)===30?'30 วัน':offer.vbot_plan_code==='yearly'||Number(offer.vbot_duration_days)===365?'1 ปี':offer.vbot_plan_code==='lifetime'||offer.vbot_duration_days==null?'ตลอดชีพ':offer.title?.split('· คีย์ ')[1]||'แพ็กเกจคีย์';
const vbotControls=(item,index)=>item.product_kind==='vision7-key'?`<label class="vbot-key-choice">เลือกอายุคีย์<select data-vbot-plan="${index}">${(item.vbot_offers||[item]).map(offer=>`<option value="${Number(offer.vision7_plan_id)}" ${Number(offer.vision7_plan_id)===Number(item.vision7_plan_id)?'selected':''}>${esc(vbotDuration(offer))} · ${money(offer.price)}</option>`).join('')}</select></label>${item.vbot_platform_type==='veasy'?'<small class="cart-no-promo-note">V Easy · 1 คีย์ = 1 ร้าน</small>':''}<strong class="cart-no-promo-note">รับไฟล์ติดตั้งและคีย์หลังอนุมัติการชำระเงิน · ไม่ร่วมส่วนลดหลายตะกร้า</strong>`:'';
function render() {
  const items = getCart(),
    itemCount=items.reduce((sum,x)=>sum+(Number(x.quantity)||1),0),
    subtotal = items.reduce((sum, x) => sum + Number(x.price || 0)*(Number(x.quantity)||1), 0),
    discountableItems = items.filter((item) => item.category !== "resale-rights" && item.category !== "bundle-deals" && item.category !== "vbot-key" && item.product_kind !== "vision7-key" && item.slug !== "course-selling-rights" && (!item.product_kind || item.product_kind === "product")),
    discountableCount = discountableItems.length,
    discountableSubtotal = discountableItems.reduce((sum, x) => sum + Number(x.price || 0), 0),
    rate = discountRate(discountableCount),
    discount = Math.round((discountableSubtotal * rate) / 100),
    next =
      discountableCount < 5
        ? 5
        : discountableCount < 10
          ? 10
          : discountableCount < 20
            ? 20
            : discountableCount < 30
              ? 30
              : null;
  document
    .querySelectorAll("[data-cart-count]")
    .forEach((x) => (x.textContent = itemCount));
  cartQty.textContent = itemCount + " ชิ้น";
  cartSubtotal.textContent = money(subtotal);
  cartDiscountLabel.textContent = `ส่วนลด ${rate}%`;
  cartDiscount.textContent = "- " + money(discount);
  cartTotal.textContent = money(subtotal - discount);
  cartNextDiscount.textContent = next
    ? `⚠ เลือกสินค้าโปรเพิ่มอีก ${next - discountableCount} ตะกร้า จะได้รับส่วนลด ${discountRate(next)}%`
    : "✓ ครบ 30 ตะกร้า · ได้รับส่วนลดสูงสุด 30% แล้ว";
  cartNextDiscount.classList.toggle("complete", !next);
  cartItems.innerHTML = items.length
    ? items
        .map(
          (p, i) =>
            `<article class="cart-product${p.category==='bundle-deals'||p.category==='resale-rights'||p.slug==='course-selling-rights'||p.product_kind==='course'||p.product_kind==='vision7-key'?' no-bundle-discount':''}"><img src="${esc(p.cover_url || "/assets/product-placeholder.svg")}" alt="รูป ${esc(p.title)}"><div><small>${esc(p.category_label || p.category || "ไฟล์ดิจิทัล")}</small><h2>${esc(p.title)}</h2><p>${p.product_kind==='vision7-key'?'โปรแกรม VBot พร้อมคีย์ตามอายุที่เลือก':p.category==='resale-rights'||p.slug==='course-selling-rights'?'1 ชิ้น = 1 เครดิตสำหรับเปิดตะกร้าคอร์ส 1 ตะกร้า':p.product_kind==='course'?`คอร์ส V-Learning • ${esc(p.pages || '-')} EP`:'ไฟล์ดิจิทัลพร้อมดาวน์โหลด • '+esc(p.pages || '-')+' แผ่น'}</p>${vbotControls(p,i)}${p.category==='bundle-deals'?'<strong class="cart-no-promo-note">ราคาพิเศษแล้ว · ไม่ร่วมส่วนลดหลายตะกร้าและโปรโมชั่นอื่น</strong>':p.category==='resale-rights'||p.slug==='course-selling-rights'?'<strong class="cart-no-promo-note">ไม่ร่วมโปรส่วนลด · ไม่คืนเงิน เว้นแต่ระบบยังใช้งานไม่ได้ภายใน 7 วันและ VisionD ตรวจสอบว่าเกิดจากระบบจริง</strong>':p.product_kind==='course'?'<strong class="cart-no-promo-note">คอร์สไม่ร่วมโปรส่วนลดหลายตะกร้า</strong>':''}<a href="${p.product_kind==='vision7-key'?`/bots.html?app=${encodeURIComponent(p.vbot_app_code||'')}`:p.product_kind==='course'?`/course.html?id=${encodeURIComponent(p.course_id||'')}`:`/product.html?slug=${encodeURIComponent(p.slug)}`}">ดูรายละเอียด</a></div><div class="cart-product-price">${Number(p.promotion_percent)>0?`<span class="vd-promo-price"><del>${money(p.original_price)}</del><strong>${money(p.price)}</strong></span>`:`<b>${money(p.price)}</b>`}${p.category==='resale-rights'||p.slug==='course-selling-rights'?`<label class="rights-quantity">จำนวนสิทธิ์<input data-rights-quantity="${i}" type="number" min="1" max="30" value="${Number(p.quantity)||1}"></label><small>ได้รับ ${Number(p.quantity)||1} เครดิต · รวม ${money(Number(p.price)*(Number(p.quantity)||1))}</small>`:''}<button data-remove="${i}" type="button">ลบออกจากตะกร้า</button></div></article>`,
        )
        .join("")
    : `<div class="cart-empty"><b>ตะกร้ายังว่าง</b><p>เลือกสินค้าที่ชอบ แล้วเพิ่มลงตะกร้าได้เลย</p><a class="primary" href="/digital-products.html">เลือกดูสินค้า</a></div>`;
  cartItems.querySelectorAll('.cart-product').forEach(card=>card.classList.add('vds-card','vds-card--product'));
  cartItems.querySelectorAll('[data-remove]').forEach(button=>{button.classList.add('vds-btn','vds-btn--danger','vds-btn--small');const title=button.closest('.cart-product')?.querySelector('h2')?.textContent?.trim()||'สินค้า';button.setAttribute('aria-label',`ลบ ${title} ออกจากตะกร้า`)});
  cartItems.querySelectorAll('.rights-quantity').forEach(label=>label.classList.add('vds-field'));
  cartItems.querySelector('.cart-empty')?.classList.add('vds-card','vds-card--status');
  cartItems.querySelector('.cart-empty a')?.classList.add('vds-btn','vds-btn--primary');
  document
    .querySelectorAll("[data-remove]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          saveCart(items.filter((_, i) => i !== Number(b.dataset.remove)))),
    );
  document.querySelectorAll('[data-rights-quantity]').forEach(input=>input.onchange=()=>{const next=[...items],index=Number(input.dataset.rightsQuantity),otherCount=next.reduce((sum,item,i)=>sum+(i===index?0:Number(item.quantity)||1),0);next[index].quantity=Math.min(30-otherCount,Math.max(1,Number(input.value)||1));saveCart(next)});
  document.querySelectorAll('[data-vbot-plan]').forEach(select=>select.onchange=()=>{const next=[...items],index=Number(select.dataset.vbotPlan),current=next[index],offer=(current.vbot_offers||[]).find(value=>Number(value.vision7_plan_id)===Number(select.value));if(!offer)return;next[index]={...current,...offer,quantity:1,vbot_offers:current.vbot_offers,original_price:Number(offer.price),promotion_percent:0};saveCart(next)});
  checkoutButton.disabled = !items.length;
}
checkoutButton.onclick = checkout;
closeCheckout.setAttribute('aria-label','ปิดหน้าชำระเงิน');
slipMessage.setAttribute('role','status');
slipMessage.setAttribute('aria-live','polite');
document.querySelector('.cart-summary')?.classList.add('vds-card','vds-card--information');
checkoutButton.classList.remove('primary','wide');checkoutButton.classList.add('vds-btn','vds-btn--primary','vds-btn--large','vds-btn--wide');
document.querySelector('.cart-summary>a')?.classList.add('vds-btn','vds-btn--secondary','vds-btn--wide');
copyAccountButton.classList.add('vds-btn','vds-btn--tonal','vds-btn--small');
slipForm.querySelector('button[type="submit"]')?.classList.add('vds-btn','vds-btn--primary','vds-btn--large','vds-btn--wide');
function resetActiveOrder() {
  activeOrder = null;
  slipForm.reset();
  slipMessage.textContent = "";
  slipForm.classList.remove("checkout-working");
  sellerPaymentQr.hidden = true;
  sellerPaymentQr.removeAttribute("src");
  if (checkoutDialog.open) checkoutDialog.close();
}
closeCheckout.onclick = () => resetActiveOrder();
checkoutDialog.onclick = (e) => {
  if (e.target === checkoutDialog) resetActiveOrder();
};
checkoutDialog.addEventListener("close", resetActiveOrder);
checkoutDialog.addEventListener("cancel", () => resetActiveOrder());
addEventListener("storage", (event) => {
  if (event.key !== "vd_cart") return;
  resetActiveOrder();
  render();
});
async function checkout() {
  const items = getCart();
  if (!items.length) return;
  const sellerCourses=items.filter(item=>item.product_kind==='course'&&item.course_origin==='seller_rights');
  if(sellerCourses.length&&(items.length!==1||sellerCourses.length!==1)){
    alert('คอร์สจากผู้ขายต้องชำระแยกครั้งละ 1 คอร์ส กรุณาลบรายการอื่นออกก่อน');
    return;
  }
  if (activeOrder) {
    checkoutDialog.showModal();
    return;
  }
  checkoutButton.disabled = true;
  checkoutButton.textContent = "กำลังสร้างคำสั่งซื้อ…";
  try {
    const me = await fetch("/api/auth/me");
    if (!me.ok) {
      sessionStorage.setItem("vd_return_to", "/cart");
      location.href = "/login.html";
      return;
    }
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productSlugs: items.map((x) => x.slug),
        productIds: items.map((x) => x.id),
        quantities:Object.fromEntries(items.map(item=>[item.slug,Number(item.quantity)||1])),
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.slug) saveCart(items.filter((item) => item.slug !== d.slug));
      throw new Error(d.error || "สร้างคำสั่งซื้อไม่สำเร็จ");
    }
    activeOrder = { ...d, cart_signature: cartSignature(items) };
    window.visiondTrack?.("checkout_start",{metadata:{value:Number(d.total)||0}});
    window.visiondPixel?.track("InitiateCheckout", {
      content_ids: (d.items || []).map((item) => String(item.id || item.slug)),
      content_type: "product",
      num_items: (d.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 1),
        0,
      ),
      value: Number(d.total || 0) / 100,
      currency: "THB",
    });
    checkoutOrderNo.textContent = "เลขคำสั่งซื้อ " + d.orderNo;
    checkoutTotal.textContent = money(d.total);
    bankName.textContent = d.bank?.bank_name || "ยังไม่ได้ตั้งค่า";
    bankAccountName.textContent = d.bank?.account_name || "กรุณาติดต่อ VisionD";
    bankAccountNumber.textContent = d.bank?.account_number || "-";
    sellerPaymentQr.hidden = !d.bank?.qr_url;
    sellerPaymentQr.src = d.bank?.qr_url || "";
    checkoutDialog.showModal();
  } catch (error) {
    alert(error.message);
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.textContent = "ชำระเงิน";
  }
}
slipForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!activeOrder?.id || slipForm.classList.contains("checkout-working")) return;
  const order = activeOrder;
  if (cartSignature(getCart()) !== order.cart_signature) {
    resetActiveOrder();
    alert("ตะกร้ามีการเปลี่ยนแปลง กรุณากดชำระเงินเพื่อสร้างคำสั่งซื้อใหม่");
    return;
  }
  const file = slipInput.files[0];
  if (!file) return;
  slipMessage.textContent = "กำลังอัปโหลดสลิป…";
  slipForm.classList.add("checkout-working");
  const fd = new FormData(slipForm);
  try {
    const r = await fetch(`/api/orders/${order.id}/slip`, {
      method: "POST",
      body: fd,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { window.visiondTrack?.("payment_failed"); throw new Error(d.error || "ส่งสลิปไม่สำเร็จ"); }
    window.visiondTrack?.("payment_submit",{metadata:{value:Number(order.total)||0}});
    localStorage.removeItem("vd_cart");
    const learningOrder = isVLearningOrder(order);
    slipMessage.textContent = d.auto_approved
      ? learningOrder
        ? "ชำระเงินสำเร็จ ปลดล็อกแล้ว กำลังเข้าสู่ระบบ V-Learning"
        : d.message || "ชำระเงินสำเร็จ ปลดล็อกสินค้าแล้ว"
      : learningOrder
        ? d.message || "รับสลิปแล้ว คอร์สกำลังรอตรวจสอบ ยังไม่ปลดล็อก"
        : d.message || "รับสลิปแล้ว กำลังรอตรวจสอบ";
    const courseId = order.items?.find(
      (item) =>
        item?.category === "online-course" || item?.product_kind === "course",
    )?.seller_course_id;
    const destination = learningOrder
      ? `/my-courses.html?payment=${d.auto_approved ? "verified" : "pending"}${courseId ? `&course=${encodeURIComponent(courseId)}` : ""}`
      : "/dashboard.html#orders";
    setTimeout(() => (location.href = destination), 1100);
  } catch (error) {
    slipMessage.textContent = error.message;
    slipForm.classList.remove("checkout-working");
  }
};
async function removeUnavailableCartItems() {
  const orders=[];let cursor='';
  for(let page=0;page<20;page++){
    const query=cursor?`?limit=100&cursor=${encodeURIComponent(cursor)}`:'?limit=100',response=await fetch(`/api/orders${query}`,{cache:'no-store'}).catch(()=>null);
    if(!response?.ok)return;
    const data=await response.json().catch(()=>({items:[],pagination:{}}));orders.push(...(data.items||[]));
    if(!data.pagination?.has_more||!data.pagination?.next_cursor)break;
    cursor=String(data.pagination.next_cursor);
  }
  const blocked = new Set();
  for (const order of orders)
    if (["paid", "pending_review", "awaiting_payment"].includes(order.status))
      for (const item of order.items || []) if(item.slug!=='course-selling-rights')blocked.add(item.slug);
  const before = getCart(),
    after = before.filter((item) => !blocked.has(item.slug));
  if (after.length !== before.length) {
    saveCart(after);
    alert(
      `นำสินค้า ${before.length - after.length} รายการออกจากตะกร้าแล้ว เพราะซื้อแล้วหรือมีคำสั่งซื้อค้างอยู่`,
    );
  }
}
render();
(async()=>{await removeUnavailableCartItems();await refreshCartPrices()})();
import("/nav-account.js?v=014248").then((module) => module.initAccountNav());
