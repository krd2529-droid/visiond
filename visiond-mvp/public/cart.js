import("/facebook-chat.js?v=01195");
if(!document.querySelector('link[href^="/promotion.css"]'))document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/promotion.css?v=01336">');
if(!document.querySelector('#rights-quantity-style'))document.head.insertAdjacentHTML('beforeend','<style id="rights-quantity-style">.rights-quantity{display:grid;gap:4px;color:#315f5b;font-size:11px;font-weight:900}.rights-quantity input{width:76px;padding:8px;border:1px solid #39aaa4;border-radius:8px;text-align:center;font-weight:900}</style>');
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
  for (const item of Array.isArray(items) ? items : [])
    if (item?.slug && !unique.has(item.slug)) unique.set(item.slug, {...item,quantity:item.category==='resale-rights'||item.slug==='course-selling-rights'?Math.min(30,Math.max(1,Number(item.quantity)||1)):1});
  return [...unique.values()].slice(0, 30);
};
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
  localStorage.setItem("vd_cart", JSON.stringify(normalizeCart(items)));
  render();
};
async function refreshCartPrices(){
  const current=getCart();if(!current.length)return;
  try{
    const response=await fetch('/api/products',{cache:'no-store'});if(!response.ok)return;
    const data=await response.json(),bySlug=new Map((data.items||[]).map(item=>[item.slug,item]));
    const fresh=current.map(item=>{const product=bySlug.get(item.slug);if(!product)return item;return {...item,id:product.id,price:Number(product.sale_price??product.price),original_price:Number(product.original_price??product.price),promotion_percent:Number(product.promotion_percent)||0,category:product.category,category_label:product.category_label,pages:product.pages,cover_url:product.cover_url||item.cover_url}});
    localStorage.setItem('vd_cart',JSON.stringify(fresh));render();
  }catch{}
}
const discountRate = (count) =>
  count >= 30 ? 30 : count >= 20 ? 20 : count >= 10 ? 10 : count >= 5 ? 5 : 0;
let activeOrder = null;
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
    copyAccountButton.textContent = "เลือกเลขแล้ว กด Ctrl+C";
  }
  setTimeout(() => (copyAccountButton.textContent = "คัดลอกเลขบัญชี"), 1800);
};
function render() {
  const items = getCart(),
    itemCount=items.reduce((sum,x)=>sum+(Number(x.quantity)||1),0),
    subtotal = items.reduce((sum, x) => sum + Number(x.price || 0)*(Number(x.quantity)||1), 0),
    discountableItems = items.filter((item) => item.category !== "resale-rights" && item.slug !== "course-selling-rights"),
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
            `<article class="cart-product${p.category==='resale-rights'||p.slug==='course-selling-rights'?' no-bundle-discount':''}"><img src="${esc(p.cover_url || "/assets/product-placeholder.svg")}" alt="รูป ${esc(p.title)}"><div><small>${esc(p.category_label || p.category || "ไฟล์ดิจิทัล")}</small><h2>${esc(p.title)}</h2><p>${p.category==='resale-rights'||p.slug==='course-selling-rights'?'1 ชิ้น = 1 เครดิตสำหรับเปิดตะกร้าคอร์ส 1 ตะกร้า':'ไฟล์ดิจิทัลพร้อมดาวน์โหลด • '+esc(p.pages || '-')+' แผ่น'}</p>${p.category==='resale-rights'||p.slug==='course-selling-rights'?'<strong class="cart-no-promo-note">ไม่ร่วมโปรส่วนลด · ไม่คืนเงิน เว้นแต่ระบบยังใช้งานไม่ได้ภายใน 7 วันและ VisionD ตรวจสอบว่าเกิดจากระบบจริง</strong>':''}<a href="/product.html?slug=${encodeURIComponent(p.slug)}">ดูรายละเอียด</a></div><div class="cart-product-price">${Number(p.promotion_percent)>0?`<span class="vd-promo-price"><del>${money(p.original_price)}</del><strong>${money(p.price)}</strong></span>`:`<b>${money(p.price)}</b>`}${p.category==='resale-rights'||p.slug==='course-selling-rights'?`<label class="rights-quantity">จำนวนสิทธิ์<input data-rights-quantity="${i}" type="number" min="1" max="30" value="${Number(p.quantity)||1}"></label><small>ได้รับ ${Number(p.quantity)||1} เครดิต · รวม ${money(Number(p.price)*(Number(p.quantity)||1))}</small>`:''}<button data-remove="${i}" type="button">ลบออกจากตะกร้า</button></div></article>`,
        )
        .join("")
    : `<div class="cart-empty"><b>ตะกร้ายังว่าง</b><p>เลือกสินค้าที่ชอบ แล้วเพิ่มลงตะกร้าได้เลย</p><a class="primary" href="/digital-products.html">เลือกดูสินค้า</a></div>`;
  document
    .querySelectorAll("[data-remove]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          saveCart(items.filter((_, i) => i !== Number(b.dataset.remove)))),
    );
  document.querySelectorAll('[data-rights-quantity]').forEach(input=>input.onchange=()=>{const next=[...items],index=Number(input.dataset.rightsQuantity),otherCount=next.reduce((sum,item,i)=>sum+(i===index?0:Number(item.quantity)||1),0);next[index].quantity=Math.min(30-otherCount,Math.max(1,Number(input.value)||1));saveCart(next)});
  checkoutButton.disabled = !items.length;
}
checkoutButton.onclick = checkout;
closeCheckout.onclick = () => { checkoutDialog.close(); sellerPaymentQr.hidden=true; };
checkoutDialog.onclick = (e) => {
  if (e.target === checkoutDialog) { checkoutDialog.close(); sellerPaymentQr.hidden=true; }
};
async function checkout() {
  const items = getCart();
  if (!items.length) return;
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
    activeOrder = d;
    window.visiondPixel?.track("InitiateCheckout", {
      content_ids: (d.items || []).map((item) => String(item.id || item.slug)),
      content_type: "product",
      num_items: (d.items || []).length,
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
  if (!activeOrder?.id) return;
  const file = slipInput.files[0];
  if (!file) return;
  slipMessage.textContent = "กำลังอัปโหลดสลิป…";
  slipForm.classList.add("checkout-working");
  const fd = new FormData(slipForm);
  try {
    const r = await fetch(`/api/orders/${activeOrder.id}/slip`, {
      method: "POST",
      body: fd,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "ส่งสลิปไม่สำเร็จ");
    localStorage.removeItem("vd_cart");
    slipMessage.textContent =
      activeOrder.bank?.payment_message ||
      "ส่งสลิปเรียบร้อย กำลังไปหน้าคำสั่งซื้อ";
    setTimeout(() => (location.href = "/dashboard.html#orders"), 900);
  } catch (error) {
    slipMessage.textContent = error.message;
    slipForm.classList.remove("checkout-working");
  }
};
async function removeUnavailableCartItems() {
  const response = await fetch("/api/orders", { cache: "no-store" }).catch(
    () => null,
  );
  if (!response?.ok) return;
  const data = await response.json().catch(() => ({ items: [] }));
  const blocked = new Set();
  for (const order of data.items || [])
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
refreshCartPrices();
removeUnavailableCartItems();
import("/nav-account.js?v=01411").then((module) => module.initAccountNav());
