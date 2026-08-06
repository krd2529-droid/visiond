import("/facebook-chat.js?v=01195");
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
    if (item?.slug && !unique.has(item.slug)) unique.set(item.slug, item);
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
const discountRate = (count) =>
  count >= 30 ? 20 : count >= 20 ? 15 : count >= 10 ? 10 : count >= 5 ? 5 : 0;
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
    subtotal = items.reduce((sum, x) => sum + Number(x.price || 0), 0),
    rate = discountRate(items.length),
    discount = Math.round((subtotal * rate) / 100),
    next =
      items.length < 5
        ? 5
        : items.length < 10
          ? 10
          : items.length < 20
            ? 20
            : items.length < 30
              ? 30
              : null;
  document
    .querySelectorAll("[data-cart-count]")
    .forEach((x) => (x.textContent = items.length));
  cartQty.textContent = items.length + " รายการ";
  cartSubtotal.textContent = money(subtotal);
  cartDiscountLabel.textContent = `ส่วนลด ${rate}%`;
  cartDiscount.textContent = "- " + money(discount);
  cartTotal.textContent = money(subtotal - discount);
  cartNextDiscount.textContent = next
    ? `⚠ เลือกเพิ่มอีก ${next - items.length} ตะกร้า จะได้รับส่วนลด ${discountRate(next)}%`
    : "✓ ครบ 30 ตะกร้า · ได้รับส่วนลดสูงสุด 20% แล้ว";
  cartNextDiscount.classList.toggle("complete", !next);
  cartItems.innerHTML = items.length
    ? items
        .map(
          (p, i) =>
            `<article class="cart-product"><img src="${esc(p.cover_url || "/assets/product-placeholder.svg")}" alt="รูป ${esc(p.title)}"><div><small>${esc(p.category_label || p.category || "ไฟล์ดิจิทัล")}</small><h2>${esc(p.title)}</h2><p>ไฟล์ดิจิทัลพร้อมดาวน์โหลด • ${esc(p.pages || "-")} แผ่น</p><a href="/product.html?slug=${encodeURIComponent(p.slug)}">ดูรายละเอียด</a></div><div class="cart-product-price"><b>${money(p.price)}</b><button data-remove="${i}" type="button">ลบออกจากตะกร้า</button></div></article>`,
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
  checkoutButton.disabled = !items.length;
}
checkoutButton.onclick = checkout;
closeCheckout.onclick = () => checkoutDialog.close();
checkoutDialog.onclick = (e) => {
  if (e.target === checkoutDialog) checkoutDialog.close();
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
      for (const item of order.items || []) blocked.add(item.slug);
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
removeUnavailableCartItems();
import("/nav-account.js?v=01176").then((module) => module.initAccountNav());
