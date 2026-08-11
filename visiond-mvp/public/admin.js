import("/facebook-chat.js?v=014109");
const money = (n) =>
  new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const freshMedia = (url, version) =>
  url?.startsWith("/api/media/")
    ? `${url}?v=${encodeURIComponent(version || Date.now())}`
    : url;
const roleText = {
  boss: "Boss",
  admin: "Admin",
  user: "User",
  customer: "User",
};
let viewer = null,
  products = [],
  categories = [],
  users = [],
  bundleMode = false,
  vision2PendingProductFiles = null;
const bulkSelectedProducts = new Set();
const PRODUCTS_PER_PAGE = 10;
let productAdminPage = 1;

function setVision2PendingProductFiles(files) {
  vision2PendingProductFiles = files;
}
const starterCategorySlugs = new Set(["dinosaur", "paper-doll", "document"]);
const panels = {
  overview: overviewPanel,
  products: productsPanel,
  vision3: vision3Panel,
  categories: categoriesPanel,
  orders: ordersPanel,
  sales: salesPanel,
  promotion: promotionPanel,
  settings: settingsPanel,
  users: usersPanel,
  elon: elonPanel,
  health: healthPanel,
  trash: trashPanel,
};
let salesRows = [],
  filteredSalesRows = [], salesReportSummary = {}, salesProductRows = [],
  salesNextCursor = null, salesCursor = null, salesCursorHistory = [];
let lastEditorTrigger=null;
const mobileEditorQuery=matchMedia('(max-width:1040px)');
document.addEventListener('click',event=>{if(!document.body.classList.contains('product-editor-active'))lastEditorTrigger=event.target.closest('button,a')||lastEditorTrigger},{capture:true});
const syncEditorDialog=()=>{const open=document.body.classList.contains('product-editor-active')&&mobileEditorQuery.matches;if(open){productEditor.setAttribute('role','dialog');productEditor.setAttribute('aria-modal','true');productEditor.setAttribute('aria-label','แก้ไขสินค้า');requestAnimationFrame(()=>closeEditor.focus())}else{productEditor.removeAttribute('role');productEditor.removeAttribute('aria-modal');productEditor.removeAttribute('aria-label')}};
new MutationObserver(syncEditorDialog).observe(document.body,{attributes:true,attributeFilter:['class']});
mobileEditorQuery.addEventListener?.('change',syncEditorDialog);
document.addEventListener('keydown',event=>{const open=document.body.classList.contains('product-editor-active')&&mobileEditorQuery.matches;if(!open)return;if(event.key==='Escape'){event.preventDefault();resetProductForm();lastEditorTrigger?.focus?.();return}if(event.key==='Tab'){const focusable=[...productEditor.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled])')].filter(node=>node.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
for(const region of [profitDailyTable,usersTable])if(region){region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','ข้อมูลแบบเลื่อนหรือการ์ดตามขนาดหน้าจอ')}
function returnAdminHome(message = "บันทึกเรียบร้อย") {
  sessionStorage.setItem("visiond_admin_notice", message);
  location.href = "/admin?done=" + Date.now();
}
function showAdminNotice() {
  const message = sessionStorage.getItem("visiond_admin_notice");
  if (!message) return;
  sessionStorage.removeItem("visiond_admin_notice");
  const notice = document.createElement("div");
  notice.textContent = "✓ " + message;
  notice.style.cssText =
    "position:fixed;z-index:9999;top:18px;left:50%;transform:translateX(-50%);max-width:90vw;padding:12px 18px;border-radius:10px;background:#08756f;color:#fff;font-weight:900;box-shadow:0 8px 30px #0003";
  document.body.append(notice);
  setTimeout(() => notice.remove(), 3500);
}

document.querySelectorAll("[data-admin-tab]").forEach(
  (btn) =>
    (btn.onclick = () => {
      document
        .querySelectorAll("[data-admin-tab]")
        .forEach((x) => x.classList.toggle("active", x === btn));
      Object.entries(panels).forEach(
        ([name, panel]) => (panel.hidden = name !== btn.dataset.adminTab),
      );
      if (btn.dataset.adminTab === "overview") { loadProfitDashboard(); loadAdsIntelligence(); }
      if (btn.dataset.adminTab === "products") loadProducts();
      if (btn.dataset.adminTab === "categories") loadCategories();
      if (btn.dataset.adminTab === "orders") loadOrders();
      if (btn.dataset.adminTab === "sales") loadSalesReport();
      if (btn.dataset.adminTab === "promotion") loadPromotionSettings();
      if (btn.dataset.adminTab === "settings") loadPaymentSettings();
      if (btn.dataset.adminTab === "users") loadUsers();
      if (btn.dataset.adminTab === "elon") { loadElonControls(); loadElonConversations(); }
      if (btn.dataset.adminTab === "health") loadSystemHealth();
      if (btn.dataset.adminTab === "trash") loadTrash();
    }),
);
newProductButton.onclick = () => {
  resetProductForm();
  document.body.classList.add("product-editor-active");
  requestAnimationFrame(() =>
    productEditor.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
};
closeEditor.onclick = () => { resetProductForm(); if(mobileEditorQuery.matches)lastEditorTrigger?.focus?.(); };
productEditor.onsubmit = saveProduct;
deleteProductButton.onclick = deleteProduct;
paymentSettingsForm.onsubmit = savePaymentSettings;
promotionSettingsForm.onsubmit = savePromotionSettings;
firstOrderPromotionForm.onsubmit = saveFirstOrderPromotion;
newCategoryButton.onclick = resetCategoryForm;
categoryEditor.onsubmit = saveCategory;
deleteCategoryButton.onclick = deleteCategory;
downloadCategoryPreviews.onclick = downloadPreviewArchive;
previewExportCategory.onchange = loadPreviewBatches;
productSearchInput.oninput = () => { productAdminPage = 1; renderProductAdminList(productSearchInput.value); };
refreshTrashButton.onclick = loadTrash;
trashList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-trash-action]");
  if (!button) return;
  const action = button.dataset.trashAction,
    id = Number(button.dataset.trashId),
    type = button.dataset.trashType;
  if (action === "delete") {
    if (viewer?.role !== "boss") return alert("เฉพาะ Boss ลบถาวรได้");
    if (!confirm("ลบรายการนี้ถาวรทันทีหรือไม่? กู้คืนไม่ได้")) return;
    if (prompt("พิมพ์ DELETE เพื่อยืนยันลบถาวร") !== "DELETE") return;
  }
  button.disabled = true;
  const response = await fetch(
    action === "restore" ? "/api/admin/trash/restore" : `/api/admin/trash?type=${encodeURIComponent(type)}&id=${id}`,
    action === "restore"
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id }) }
      : { method: "DELETE" },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) alert(data.error || "ดำเนินการไม่สำเร็จ");
  await loadTrash();
});

async function loadTrash() {
  trashList.innerHTML = "<p>กำลังโหลดถังขยะ…</p>";
  const response = await fetch("/api/admin/trash", { cache: "no-store" }),
    data = await response.json().catch(() => ({}));
  if (!response.ok) return (trashList.innerHTML = `<p>${esc(data.error || "โหลดถังขยะไม่สำเร็จ")}</p>`);
  const labels = { product: "ตะกร้าสินค้า", product_image: "รูปสินค้า", product_file: "PDF/ZIP" };
  trashList.innerHTML = data.items?.length
    ? `<div class="trash-grid">${data.items.map((item) => `<article class="trash-card"><div><b>${esc(item.title)}</b><small>${labels[item.item_type] || esc(item.item_type)} · ลบเมื่อ ${new Date(item.deleted_at + "Z").toLocaleString("th-TH")}</small><small>ล้างอัตโนมัติ ${new Date(item.expires_at + "Z").toLocaleString("th-TH")}</small></div><div><button type="button" data-trash-action="restore" data-trash-type="${esc(item.item_type)}" data-trash-id="${item.id}">กู้คืน</button>${viewer?.role === "boss" ? `<button class="danger" type="button" data-trash-action="delete" data-trash-type="${esc(item.item_type)}" data-trash-id="${item.id}">ลบถาวร</button>` : ""}</div></article>`).join("")}</div>`
    : '<div class="admin-empty">ถังขยะว่าง</div>';
}
existingFiles.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-product-file]");
  if (button)
    deleteAttachedProductFile(Number(button.dataset.deleteProductFile));
});
existingProductImages.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-product-image]");
  if (button)
    deleteAttachedProductImage(Number(button.dataset.deleteProductImage));
});
productEditor.querySelectorAll('input[type="file"]').forEach((input) =>
  input.addEventListener("change", () => {
    const hasFile = Boolean(input.files?.length);
    productEditor
      .querySelectorAll(`[data-clear-upload="${input.name}"]`)
      .forEach((button) => (button.hidden = !hasFile));
    productEditor
      .querySelectorAll(`[data-upload-selected="${input.name}"]`)
      .forEach((button) => (button.disabled = !hasFile));
  }),
);
productEditor.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upload-selected]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  uploadSelectedFile(button.dataset.uploadSelected, button);
});
productEditor.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear-upload]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const input = productEditor.elements[button.dataset.clearUpload];
  if (input) input.value = "";
  productEditor
    .querySelectorAll(`[data-clear-upload="${button.dataset.clearUpload}"]`)
    .forEach((action) => (action.hidden = true));
  productEditor
    .querySelectorAll(`[data-upload-selected="${button.dataset.clearUpload}"]`)
    .forEach((action) => (action.disabled = true));
  setMessage("ลบไฟล์ที่เลือกออกแล้ว");
});
function clearPendingUploads() {
  productEditor
    .querySelectorAll('input[type="file"]')
    .forEach((input) => (input.value = ""));
  productEditor
    .querySelectorAll("[data-clear-upload]")
    .forEach((button) => (button.hidden = true));
  productEditor
    .querySelectorAll("[data-upload-selected]")
    .forEach((button) => (button.disabled = true));
}
async function uploadSelectedFile(name, button) {
  const id = Number(productEditor.elements.id.value),
    input = productEditor.elements[name],
    file = input?.files?.[0];
  if (!id)
    return alert("กรุณากดบันทึกสินค้าให้มีตะกร้าก่อน แล้วจึงอัปโหลดไฟล์แยกได้");
  if (!file) return alert("กรุณาเลือกไฟล์ก่อนอัปโหลด");
  const pending = [...productEditor.querySelectorAll('input[type="file"]')]
      .filter((item) => item.name !== name && item.files?.[0])
      .map((item) => [item.name, item.files[0]]),
    form = new FormData();
  form.set("file", file);
  button.disabled = true;
  button.textContent = "กำลังอัปโหลด…";
  let endpoint = "";
  if (name === "product_file") {
    endpoint = `/api/admin/product-upload/${id}`;
    form.set(
      "label",
      productEditor.elements.file_label.value || "ไฟล์สินค้าฉบับเต็ม",
    );
  } else {
    endpoint = `/api/admin/product-images/${id}`;
    form.set(
      "slot",
      String({ cover: 0, preview_2: 1, preview_3: 2 }[name] ?? 0),
    );
  }
  try {
    const response = await fetch(endpoint, { method: "POST", body: form }),
      data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
    await editProduct(id);
    pending.forEach(([fieldName, pendingFile]) => {
      const transfer = new DataTransfer();
      transfer.items.add(pendingFile);
      productEditor.elements[fieldName].files = transfer.files;
      productEditor.elements[fieldName].dispatchEvent(new Event("change"));
    });
    setMessage(
      name === "product_file"
        ? "อัปโหลด PDF/ZIP เรียบร้อยแล้ว"
        : "อัปโหลดรูปเรียบร้อยแล้ว",
    );
  } catch (error) {
    alert(error.message || "อัปโหลดไม่สำเร็จ");
  } finally {
    button.disabled = false;
    button.textContent =
      name === "cover"
        ? "อัปโหลดรูปปก"
        : name === "product_file"
          ? "อัปโหลดไฟล์ PDF/ZIP นี้"
          : "อัปโหลดรูปนี้";
  }
}
const nextProductSlug = (category) => {
  if (!category || category === "__custom__") return "";
  const prefix = `${category}-`,
    highest = products
      .filter(
        (product) =>
          product.category === category &&
          String(product.slug || "").startsWith(prefix),
      )
      .reduce(
        (max, product) =>
          Math.max(max, Number(String(product.slug).slice(prefix.length)) || 0),
        0,
      );
  return `${category}-${String(highest + 1).padStart(3, "0")}`;
};
const updateProductSlugPreview = () => {
  if (productEditor.elements.id.value) return;
  productEditor.elements.slug.value = nextProductSlug(
    productCategorySelect.value,
  );
};
productCategorySelect.onchange = () => {
  const category = categories.find(
    (item) => item.slug === productCategorySelect.value,
  );
  if (category)
    productEditor.elements.file_type.value = category.file_type || "PDF";
  const editing = Boolean(productEditor.elements.id.value),
    originalCategory = productEditor.dataset.originalCategory || "";
  if (!editing || productCategorySelect.value !== originalCategory)
    productEditor.elements.slug.value = nextProductSlug(productCategorySelect.value);
};
manualUnlockForm.onsubmit = unlockProductForUser;
applySalesFilter.onclick = () => { salesCursor = null; salesCursorHistory = []; loadSalesReport(); };
exportSalesCsv.onclick = downloadSalesCsv;
profitFilterForm.onsubmit = (event) => {
  event.preventDefault();
  loadProfitDashboard();
};
adCostForm.onsubmit = saveAdCost;
unlockProductSelect.multiple = true;
unlockProductSelect.size = 7;
unlockProductSelect.addEventListener("mousedown", (event) => {
  if (event.target.tagName !== "OPTION") return;
  event.preventDefault();
  event.target.selected = !event.target.selected;
  unlockProductSelect.dispatchEvent(new Event("change"));
});
unlockProductSelect.insertAdjacentHTML(
  "afterend",
  '<small class="multi-select-help">คลิก 1 ครั้งเพื่อเลือกทีละสินค้า · เลือกได้หลายรายการอย่างอิสระ</small><div class="package-category-picker"><select id="packageCategorySelect"><option value="">— เลือกสินค้าทั้งหมวด —</option></select><button id="selectCategoryProducts" type="button">เลือกหมวดนี้</button></div><div class="package-select-actions"><button id="selectAllProducts" type="button">เลือกสินค้าทั้งหมด</button><button id="clearAllProducts" type="button">ล้างที่เลือก</button><b id="selectedProductCount">เลือกแล้ว 0 รายการ</b></div>',
);
const updateSelectedProductCount = () =>
  (selectedProductCount.textContent = `เลือกแล้ว ${unlockProductSelect.selectedOptions.length} รายการ`);
unlockProductSelect.addEventListener("change", updateSelectedProductCount);
selectAllProducts.onclick = () => {
  [...unlockProductSelect.options].forEach(
    (option) => (option.selected = true),
  );
  updateSelectedProductCount();
};
clearAllProducts.onclick = () => {
  [...unlockProductSelect.options].forEach(
    (option) => (option.selected = false),
  );
  updateSelectedProductCount();
};
selectCategoryProducts.onclick = () => {
  const category = packageCategorySelect.value;
  if (!category) return;
  [...unlockProductSelect.options].forEach((option) => {
    if (option.dataset.category === category) option.selected = true;
  });
  updateSelectedProductCount();
};
manualUnlockForm.insertAdjacentHTML(
  "afterend",
  '<section class="unlock-history-section"><div class="section-head"><div><h3>ประวัติการปลดล็อก</h3><p>บันทึกวันเวลา ลูกค้า สินค้า และผู้ดำเนินการ</p></div><button id="refreshUnlockHistory" type="button">รีเฟรช</button></div><div id="unlockHistoryList" class="unlock-history-list"><p>กำลังโหลดประวัติ…</p></div></section>',
);
refreshUnlockHistory.onclick = loadUnlockHistory;

async function init() {
  const me = await fetch("/api/auth/me");
  if (!me.ok) {
    deny("กรุณาเข้าสู่ระบบก่อน");
    return;
  }
  viewer = (await me.json()).user;
  document.body.classList.toggle("viewer-is-boss", viewer.role === "boss");
  adminIdentity.innerHTML = `เข้าสู่ระบบเป็น <b>${esc(viewer.name)}</b> · <span class="role-badge ${esc(viewer.role)}">${roleText[viewer.role] || esc(viewer.role)}</span>`;
  if (!["boss", "admin"].includes(viewer.role)) {
    deny("บัญชี User ไม่มีสิทธิ์เข้าหลังบ้าน");
    return;
  }
  setupBossMobilePreview();
  adminPanel.hidden = false;
  Object.entries(panels).forEach(
    ([name, panel]) => (panel.hidden = name !== "orders"),
  );
  const today = new Date().toISOString().slice(0, 10),
    from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  profitDateFrom.value = from;
  profitDateTo.value = today;
  adSpendDate.value = today;
  await loadCategories(false);
  loadOrders();
  openRequestedPreviewTab();
}

function setupBossMobilePreview() {
  const launcher = document.querySelector("#mobilePreviewLauncher"),
    shell = document.querySelector("#mobilePreviewShell"),
    route = document.querySelector("#mobilePreviewRoute"),
    frame = document.querySelector("#mobilePreviewFrame"),
    newTab = document.querySelector("#mobilePreviewNewTab");
  if (!launcher || viewer?.role !== "boss" || new URLSearchParams(location.search).has("mobile_preview")) return;
  launcher.hidden = false;
  const loadRoute = () => {
    frame.src = route.value;
    newTab.href = route.value;
  };
  const close = () => {
    shell.hidden = true;
    document.body.style.overflow = "";
  };
  launcher.onclick = () => {
    shell.hidden = false;
    document.body.style.overflow = "hidden";
    if (!frame.getAttribute("src")) loadRoute();
  };
  route.onchange = loadRoute;
  document.querySelector("#mobilePreviewReload").onclick = () => frame.contentWindow?.location.reload();
  document.querySelector("#mobilePreviewClose").onclick = close;
  shell.querySelector(".mobile-preview-dismiss").onclick = close;
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shell.hidden) close();
  });
}

function openRequestedPreviewTab() {
  const requested = new URLSearchParams(location.search).get("preview_tab");
  if (!requested || !panels[requested]) return;
  document.querySelector(`[data-admin-tab="${requested}"]`)?.click();
}
function deny(text) {
  accessDenied.innerHTML = `<div class="admin-card"><b>เข้าไม่ได้</b><p>${esc(text)}</p><a class="primary" href="/account.html">เข้าสู่ระบบหรือกลับหน้าบัญชี</a></div>`;
}

function categoryOptions(includeInactive = false) {
  return (
    categories
      .filter((c) => includeInactive || Number(c.active))
      .map(
        (c) =>
          `<option value="${esc(c.slug)}">${c.parent_slug ? "↳ " : ""}${esc(c.name)} (${esc(c.slug)})</option>`,
      )
      .join("") + '<option value="__custom__">+ ระบุหมวดหมู่ใหม่</option>'
  );
}
function productCategoryOptions() {
  return categories
    .filter(
      (c) =>
        Number(c.active) &&
        !starterCategorySlugs.has(c.slug) &&
        !["set-coloring", "set-tattoo"].includes(c.slug),
    )
    .map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`)
    .join("");
}
async function loadCategories(render = true) {
  if (render)
    categoryAdminList.innerHTML =
      '<div class="admin-empty">กำลังโหลดหมวดหมู่…</div>';
  const r = await fetch("/api/admin/categories");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (render)
      categoryAdminList.innerHTML = `<div class="admin-empty">${esc(d.error || "โหลดหมวดไม่สำเร็จ")}</div>`;
    return;
  }
  categories = d.items || [];
  const exportCategories=categories.filter((c)=>Number(c.product_count)>0);
  previewExportCategory.innerHTML = '<option value="">ทุกหมวด</option>' + exportCategories.map((c) => `<option value="${esc(c.slug)}">${c.parent_slug ? "↳ " : ""}${esc(c.name)} (${Number(c.product_count)||0} สินค้า)</option>`).join("");
  await loadPreviewBatches();
  productCategorySelect.innerHTML = productCategoryOptions();
  if (!productEditor.elements.id.value) {
    productCategorySelect.value = [...productCategorySelect.options].some(
      (option) => option.value === "tattoo",
    )
      ? "tattoo"
      : productCategorySelect.options[0]?.value || "";
    updateProductSlugPreview();
  }
  parentCategorySelect.innerHTML =
    '<option value="">— หมวดหลัก —</option>' + categoryOptions(true);
  if (!render) return;
  categoryAdminList.innerHTML =
    categories
      .filter((c) => !starterCategorySlugs.has(c.slug))
      .map(
        (c) =>
          `<article class="category-admin-card"><div><b>${c.parent_slug ? "↳ " : ""}${esc(c.name)}</b><small>${esc(c.slug)} · ${esc(c.file_type)}</small></div><div><span>${Number(c.product_count) || 0} สินค้า</span><span class="${Number(c.active) ? "category-on" : "category-off"}">${Number(c.active) ? "เปิด" : "ปิด"}</span><button type="button" data-edit-category="${c.id}">แก้ไข</button></div></article>`,
      )
      .join("") ||
    '<div class="admin-empty">ยังไม่มีหมวดหมู่ กดปุ่มเพิ่มหมวดเพื่อสร้างหมวดใหม่</div>';
  document
    .querySelectorAll("[data-edit-category]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          editCategory(Number(button.dataset.editCategory))),
    );
}
async function loadPreviewBatches(){
  const category=previewExportCategory.value;
  previewExportBatch.disabled=true;previewExportBatch.innerHTML='<option>กำลังนับรูป…</option>';
  try{
    const response=await fetch('/api/admin/product-previews.zip?info=1'+(category?'&category='+encodeURIComponent(category):'')),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'นับรูปไม่สำเร็จ');
    previewExportBatch.innerHTML=data.batches.map(item=>`<option value="${item.batch}">ชุดที่ ${item.batch} · รูป ${item.from}–${item.to} (${item.count} รูป)</option>`).join('');
    previewExportMessage.textContent=`หมวดนี้มี ${data.total_images} รูป · ${data.total_batches} ชุด · เลือกโหลดได้ทีละชุด`;
  }catch(error){previewExportBatch.innerHTML='<option value="1">ยังไม่มีชุดรูป</option>';previewExportMessage.textContent=error.message}finally{previewExportBatch.disabled=false}
}
async function downloadPreviewArchive(){
  const category=previewExportCategory.value,batch=previewExportBatch.value,button=downloadCategoryPreviews;
  button.disabled=true;button.textContent='กำลังรวมรูป…';previewExportMessage.textContent='กำลังสร้าง ZIP กรุณารอสักครู่';
  try{
    const query=new URLSearchParams({batch});if(category)query.set('category',category);
    const response=await fetch('/api/admin/product-previews.zip?'+query.toString());
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'รวมรูปไม่สำเร็จ')}
    const blob=await response.blob(),disposition=response.headers.get('content-disposition')||'',match=disposition.match(/filename\*=UTF-8''([^;]+)/i),name=match?decodeURIComponent(match[1]):`visiond-previews-${category||'all'}.zip`,url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    previewExportMessage.textContent=`ดาวน์โหลดสำเร็จ ${(blob.size/1024/1024).toFixed(1)} MB`;
  }catch(error){previewExportMessage.textContent=error.message;alert(error.message)}finally{button.disabled=false;button.textContent='ดาวน์โหลดชุดที่เลือก'}
}
function resetCategoryForm() {
  categoryEditor.reset();
  categoryEditor.elements.id.value = "";
  categoryEditor.elements.file_type.value = "PDF";
  categoryEditor.elements.sort_order.value = 0;
  categoryEditor.elements.active.checked = true;
  categoryEditorTitle.textContent = "เพิ่มหมวดใหม่";
  deleteCategoryButton.hidden = true;
  categoryFormMessage.textContent = "";
}
function editCategory(id) {
  const c = categories.find((item) => item.id === id);
  if (!c) return;
  categoryEditor.elements.id.value = c.id;
  categoryEditor.elements.name.value = c.name;
  categoryEditor.elements.slug.value = c.slug;
  categoryEditor.elements.parent_slug.value = c.parent_slug || "";
  categoryEditor.elements.file_type.value = c.file_type || "PDF";
  categoryEditor.elements.sort_order.value = c.sort_order || 0;
  categoryEditor.elements.active.checked = Boolean(Number(c.active));
  categoryEditorTitle.textContent = "แก้ไขหมวด";
  deleteCategoryButton.hidden = viewer?.role !== "boss";
  categoryFormMessage.textContent = "";
  categoryEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function saveCategory(event) {
  event.preventDefault();
  categoryFormMessage.textContent = "กำลังบันทึก…";
  const form = new FormData(categoryEditor),
    id = form.get("id");
  const body = {
    name: form.get("name"),
    slug: form.get("slug"),
    parent_slug: form.get("parent_slug"),
    file_type: form.get("file_type"),
    sort_order: Number(form.get("sort_order")) || 0,
    active: categoryEditor.elements.active.checked,
  };
  const r = await fetch(
    id ? "/api/admin/categories/" + id : "/api/admin/categories",
    {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    categoryFormMessage.textContent = d.error || "บันทึกไม่สำเร็จ";
    categoryFormMessage.classList.add("error");
    return;
  }
  returnAdminHome("บันทึกหมวดหมู่เรียบร้อย");
}
async function deleteCategory() {
  const id = categoryEditor.elements.id.value;
  if (!id || !confirm("ลบหมวดนี้หรือไม่?")) return;
  const r = await fetch("/api/admin/categories/" + id, { method: "DELETE" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    categoryFormMessage.textContent = d.error || "ลบไม่สำเร็จ";
    categoryFormMessage.classList.add("error");
    return;
  }
  resetCategoryForm();
  loadCategories();
}

async function loadProducts() {
  productAdminList.innerHTML =
    '<div class="admin-empty">กำลังโหลดสินค้า…</div>';
  await loadCategories(false);
  const r = await fetch("/api/admin/products");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    productAdminList.innerHTML = `<div class="admin-empty">${esc(d.error || "โหลดสินค้าไม่สำเร็จ")}</div>`;
    return;
  }
  products = d.items || [];
  for(const id of [...bulkSelectedProducts])if(!products.some(product=>Number(product.id)===Number(id)))bulkSelectedProducts.delete(id);
  updateProductSlugPreview();
  renderProductAdminList(productSearchInput.value);
}
function renderProductAdminList(search = "") {
  const query = String(search || "").trim().toLocaleLowerCase("th-TH"),
    visible = products.filter((p) =>
      !query || [p.id, p.title, p.slug, p.category].some((value) =>
        String(value || "").toLocaleLowerCase("th-TH").includes(query),
      ),
    );
  const totalPages=Math.max(1,Math.ceil(visible.length/PRODUCTS_PER_PAGE));
  productAdminPage=Math.min(Math.max(1,productAdminPage),totalPages);
  const pageItems=visible.slice((productAdminPage-1)*PRODUCTS_PER_PAGE,productAdminPage*PRODUCTS_PER_PAGE);
  productSearchCount.textContent = `${query ? `พบ ${visible.length} จาก ${products.length}` : `ทั้งหมด ${products.length}`} ตะกร้า · หน้า ${productAdminPage}/${totalPages}`;
  productAdminList.innerHTML = pageItems.map((p) => {
    const fileLabel = p.latest_file_mime === "application/zip" ? "ดาวน์โหลด ZIP" : "ดาวน์โหลด PDF",
      fileAction = p.latest_file_id
        ? `<a class="product-download-action" href="/api/admin/product-files/${p.latest_file_id}?mode=download">${fileLabel}</a>`
        : '<span class="product-download-unavailable">ยังไม่มี PDF/ZIP</span>';
    const checked=bulkSelectedProducts.has(Number(p.id));
    return `<article class="product-admin-card${checked?' bulk-selected':''}"><label class="product-select-box" title="เลือกตะกร้านี้เพื่อลบ"><input type="checkbox" data-select-product="${p.id}" ${checked?'checked':''} aria-label="เลือก ${esc(p.title)}"></label><img src="${esc(p.cover_url || "/assets/product-placeholder.svg")}" alt=""><div><h3>${esc(p.title)}</h3><p>เลข ${p.id} · ${esc(p.slug)} · ${esc(p.category || "ไม่ระบุหมวด")}</p><div class="product-meta"><span>${money(p.price)}</span><span>${p.status === "published" ? "เปิดขาย" : "แบบร่าง"}</span><span>${Number(p.file_count) || 0} ไฟล์</span></div><div class="product-card-downloads"><a class="product-download-action" href="/api/admin/product-previews.zip?product_id=${p.id}">ดาวน์โหลดรูปปก + รูปตัวอย่าง</a>${fileAction}</div></div><button type="button" data-edit-product="${p.id}">แก้ไข</button></article>`;
  }).join("") || (products.length ? '<div class="admin-empty">ไม่พบตะกร้าที่ตรงกับคำค้นหา</div>' : '<div class="admin-empty">ยังไม่มีสินค้า กด “เพิ่มสินค้า” เพื่อเริ่มต้น</div>');
  document
    .querySelectorAll("#productAdminList [data-edit-product]")
    .forEach(
      (b) => (b.onclick = () => editProduct(Number(b.dataset.editProduct))),
    );
  productAdminList.querySelectorAll('[data-select-product]').forEach(input=>input.onchange=()=>{const id=Number(input.dataset.selectProduct);input.checked?bulkSelectedProducts.add(id):bulkSelectedProducts.delete(id);input.closest('.product-admin-card')?.classList.toggle('bulk-selected',input.checked);updateBulkProductBar()});
  renderProductPagination(totalPages,visible.length);
  updateBulkProductBar();
}
function renderProductPagination(totalPages,totalItems){const nav=document.getElementById('productAdminPagination');if(!nav)return;if(totalItems<=PRODUCTS_PER_PAGE){nav.innerHTML='';nav.hidden=true;return}nav.hidden=false;const pages=[];for(let page=1;page<=totalPages;page++)if(page===1||page===totalPages||Math.abs(page-productAdminPage)<=2)pages.push(page);let previous=0,html=`<button type="button" data-product-page="${productAdminPage-1}" ${productAdminPage===1?'disabled':''}>ก่อนหน้า</button>`;for(const page of pages){if(previous&&page-previous>1)html+='<span>…</span>';html+=`<button type="button" data-product-page="${page}" class="${page===productAdminPage?'active':''}" ${page===productAdminPage?'aria-current="page"':''}>${page}</button>`;previous=page}html+=`<button type="button" data-product-page="${productAdminPage+1}" ${productAdminPage===totalPages?'disabled':''}>ถัดไป</button>`;nav.innerHTML=html;nav.querySelectorAll('[data-product-page]:not([disabled])').forEach(button=>button.onclick=()=>{productAdminPage=Number(button.dataset.productPage);renderProductAdminList(productSearchInput.value);productAdminList.scrollIntoView({behavior:'smooth',block:'start'})})}
function updateBulkProductBar(){const count=bulkSelectedProducts.size,output=document.getElementById('bulkProductCount'),button=document.getElementById('bulkDeleteProducts');if(output)output.textContent=`เลือกแล้ว ${count} ตะกร้า`;if(button)button.disabled=!count}
async function bulkDeleteSelectedProducts(){const ids=[...bulkSelectedProducts];if(!ids.length)return;if(!confirm(`ย้ายตะกร้าที่เลือก ${ids.length} รายการไปถังขยะ 30 วันหรือไม่?`))return;const button=document.getElementById('bulkDeleteProducts');button.disabled=true;let deleted=0,failed=0;for(const id of ids){const response=await fetch('/api/admin/products/'+id,{method:'DELETE'});if(response.ok){deleted++;bulkSelectedProducts.delete(id)}else failed++}await loadProducts();alert(`ย้ายไปถังขยะแล้ว ${deleted} ตะกร้า${failed?` · ลบไม่สำเร็จ ${failed} ตะกร้า`:''}`)}
document.getElementById('bulkClearProducts')?.addEventListener('click',()=>{bulkSelectedProducts.clear();renderProductAdminList(productSearchInput.value)});
document.getElementById('bulkDeleteProducts')?.addEventListener('click',bulkDeleteSelectedProducts);
function setBundleMode(active) {
  bundleMode = active;
  bundleBuilder.hidden = !active;
  productEditor.elements.bundle_mode.value = active ? "1" : "0";
  productEditor.querySelector(".product-preview-fields").hidden = active;
  productEditor.elements.product_file.closest("label").hidden = active;
  productEditor.elements.file_label.closest("label").hidden = active;
  if (active) {
    productCategorySelect.innerHTML =
      '<option value="set-coloring">คละแบบระบายสี</option><option value="set-tattoo">คละแบบรอยสัก</option>';
    productEditor.elements.file_type.value = "ชุด PDF";
    productEditor.elements.pages.value = 5;
  } else productCategorySelect.innerHTML = productCategoryOptions();
}
function renderBundlePicker(selected = []) {
  const selectedSet = new Set(selected.map(Number)),
    currentId = Number(productEditor.elements.id.value) || 0,
    candidates = products.filter(
      (p) =>
        p.status === "published" &&
        p.id !== currentId &&
        !["set-coloring", "set-tattoo"].includes(p.category),
    );
  bundleProductPicker.innerHTML =
    candidates
      .map(
        (p) =>
          `<label class="bundle-pick"><input type="checkbox" name="bundle_product_ids" value="${p.id}" ${selectedSet.has(Number(p.id)) ? "checked" : ""}><img src="${esc(p.cover_url || "/assets/product-placeholder.svg")}" alt=""><span><b>${esc(p.title)}</b><small>${esc(p.slug)} · ${esc(categories.find((c) => c.slug === p.category)?.name || p.category)}</small></span></label>`,
      )
      .join("") ||
    '<div class="admin-empty">ยังไม่มีสินค้าที่เปิดขายสำหรับนำมาจัดชุด</div>';
  bundleProductPicker.querySelectorAll("input").forEach(
    (input) =>
      (input.onchange = () => {
        const limit = Number(productEditor.elements.bundle_size.value) || 5,
          checked = [...bundleProductPicker.querySelectorAll("input:checked")];
        if (checked.length > limit) {
          input.checked = false;
          alert(`ชุดนี้เลือกได้ ${limit} ตะกร้าเท่านั้น`);
        }
        updateBundleCount();
      }),
  );
  updateBundleCount();
}
function productPreviewUrls(product) {
  let saved = [];
  try {
    saved = JSON.parse(product?.preview_urls || "[]");
  } catch (error) {
    saved = [];
  }
  return [...new Set([product?.cover_url, ...saved].filter(Boolean))].slice(
    0,
    3,
  );
}
function updateBundleCount() {
  const limit = Number(productEditor.elements.bundle_size.value) || 5,
    selected = [...bundleProductPicker.querySelectorAll("input:checked")]
      .map((input) =>
        products.find((product) => Number(product.id) === Number(input.value)),
      )
      .filter(Boolean),
    count = selected.length,
    previews = selected.flatMap((product, basketIndex) =>
      productPreviewUrls(product).map((url, imageIndex) => ({
        url,
        title: product.title,
        basketIndex,
        imageIndex,
      })),
    );
  bundleSelectedCount.textContent = `เลือกแล้ว ${count}/${limit}`;
  bundleSelectedCount.style.color = count === limit ? "#08756f" : "#b23b35";
  bundlePreviewCount.textContent = `${previews.length} รูป${count === limit ? " · พร้อมใช้เป็นสไลด์" : ""}`;
  bundlePreviewGallery.innerHTML =
    previews
      .map(
        (item) =>
          `<figure><img src="${esc(item.url)}" alt="${esc(item.title)} รูป ${item.imageIndex + 1}"><figcaption>ตะกร้า ${item.basketIndex + 1} · รูป ${item.imageIndex + 1}</figcaption></figure>`,
      )
      .join("") || "<small>เลือกรายการด้านบนเพื่อดูรูปตัวอย่าง</small>";
}
productEditor.querySelectorAll('[name="bundle_size"]').forEach(
  (radio) =>
    (radio.onchange = () => {
      const limit = Number(radio.value),
        checked = [...bundleProductPicker.querySelectorAll("input:checked")];
      checked.slice(limit).forEach((input) => (input.checked = false));
      productEditor.elements.pages.value = limit;
      updateBundleCount();
    }),
);
function openBundleBuilder() {
  resetProductForm();
  setBundleMode(true);
  productEditor.elements.category.value = "set-coloring";
  productEditor.elements.title.value = "";
  productEditor.elements.short_description.value =
    "ชุดคละ 5 ตะกร้า พร้อมไฟล์ PDF ครบทุกชุด";
  editorTitle.textContent = "สร้างตะกร้าชุดคละ";
  renderBundlePicker();
  updateProductSlugPreview();
  document.body.classList.add("product-editor-active");
  requestAnimationFrame(() =>
    productEditor.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}
function resetProductForm() {
  vision2PendingProductFiles = null;
  document.body.classList.remove("product-editor-active");
  productEditor.reset();
  clearPendingUploads();
  setBundleMode(false);
  productEditor.elements.id.value = "";
  productEditor.dataset.originalCategory = "";
  productEditor.elements.price.value = 29;
  productEditor.elements.pages.value = 30;
  productEditor.elements.category.value = [...productCategorySelect.options].some(
    (option) => option.value === "tattoo",
  )
    ? "tattoo"
    : productCategorySelect.options[0]?.value || "";
  productEditor.elements.file_type.value = "PDF";
  productEditor.elements.status.value = "published";
  productEditor.elements.file_label.value = "ไฟล์สินค้าฉบับเต็ม";
  updateProductSlugPreview();
  requestAnimationFrame(updateProductSlugPreview);
  editorTitle.textContent = "เพิ่มสินค้าใหม่";
  deleteProductButton.hidden = true;
  editProductWithVision2.hidden = true;
  existingProductImages.innerHTML = "<span>ยังไม่ได้เลือกรูปตัวอย่าง</span>";
  existingFiles.innerHTML = "";
  setMessage("");
}
async function editProduct(id) {
  clearPendingUploads();
  const r = await fetch("/api/admin/products/" + id, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return alert(d.error || "โหลดสินค้าไม่สำเร็จ");
  document.body.classList.add("product-editor-active");
  const p = d.item,
    isBundle =
      ["set-coloring", "set-tattoo"].includes(p.category) ||
      d.bundle_items?.length;
  productEditor.elements.id.value = p.id;
  setBundleMode(Boolean(isBundle));
  productEditor.elements.title.value = p.title || "";
  productEditor.elements.slug.value = p.slug || "";
  productEditor.elements.category.value = p.category || "";
  productEditor.dataset.originalCategory = p.category || "";
  productEditor.elements.file_type.value = p.file_type || "PDF";
  productEditor.elements.price.value = (Number(p.price) || 0) / 100;
  const bundleCount = d.bundle_items?.length || 0;
  productEditor.elements.pages.value =
    Number(p.pages) ||
    (p.short_description || "").match(/(\d+)\s*แผ่น/)?.[1] ||
    200;
  productEditor.elements.short_description.value = p.short_description || "";
  productEditor.elements.description.value = p.description || "";
  productEditor.elements.status.value = p.status || "draft";
  if (isBundle) {
    const size = bundleCount === 10 ? 10 : 5;
    productEditor.querySelector(
      `[name="bundle_size"][value="${size}"]`,
    ).checked = true;
    renderBundlePicker((d.bundle_items || []).map((x) => x.id));
  }
  let previews = [];
  try {
    previews = JSON.parse(p.preview_urls || "[]");
  } catch (error) {
    previews = [];
  }
  previews = isBundle
    ? [...new Set([p.cover_url, ...previews].filter(Boolean))].slice(0, 10)
    : [p.cover_url, previews[1], previews[2]];
  existingProductImages.innerHTML =
    previews
      .map((url, index) =>
        url
          ? `<article><img src="${esc(freshMedia(url, p.updated_at))}" alt="รูปตัวอย่าง ${index + 1}"><b>รูป ${index + 1}${index === 0 ? " · ปกสินค้า" : ""}</b>${isBundle ? "" : `<button type="button" class="delete-attached-image" data-delete-product-image="${index}">ลบรูป</button>`}</article>`
          : "",
      )
      .join("") || "<span>ยังไม่มีรูปตัวอย่าง</span>";
  editorTitle.textContent = isBundle ? "แก้ไขตะกร้าชุดคละ" : "แก้ไขสินค้า";
  deleteProductButton.hidden = false;
  editProductWithVision2.hidden = Boolean(isBundle);
  existingFiles.innerHTML = isBundle
    ? `<span>ชุดนี้เชื่อม PDF จากตะกร้าต้นทาง ${bundleCount} รายการอัตโนมัติ</span>`
    : (d.files || [])
        .map(
          (f) =>
            `<article class="attached-pdf-card"><b>✓ ${esc(f.label)}</b><span>${esc(f.file_name || "ไฟล์สินค้าฉบับเต็ม")}</span><small>เวอร์ชัน ${esc(f.version || "1.0")} · ${formatBytes(f.file_size)}</small><div><a href="/api/admin/product-files/${f.id}?mode=inline" target="_blank" rel="noopener">เปิดดูไฟล์จริง</a><a href="/api/admin/product-files/${f.id}?mode=download">ดาวน์โหลด</a><button type="button" class="delete-attached-file" data-delete-product-file="${f.id}">ลบไฟล์</button></div></article>`,
        )
        .join("") || "<span>ยังไม่ได้แนบไฟล์ดาวน์โหลด</span>";
  setMessage("");
  requestAnimationFrame(() =>
    productEditor.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}
editProductWithVision2.onclick=()=>{
  const id=Number(productEditor.elements.id.value);
  if(!id)return alert('กรุณาเลือกสินค้าที่ต้องการแก้ก่อน');
  if(typeof window.startVision2ProductEdit!=='function')return alert('Vision 2 ยังโหลดไม่พร้อม กรุณารีเฟรชหน้าแล้วลองใหม่');
  window.startVision2ProductEdit({id,title:productEditor.elements.title.value,slug:productEditor.elements.slug.value,pages:Number(productEditor.elements.pages.value)||0});
};
async function deleteAttachedProductFile(id) {
  if (
    !id ||
    !confirm(
      "ลบไฟล์นี้ออกจากสินค้าใช่หรือไม่? ลูกค้าจะดาวน์โหลดไม่ได้จนกว่าจะอัปโหลดไฟล์ใหม่",
    )
  )
    return;
  const response = await fetch("/api/admin/product-files/" + id, {
      method: "DELETE",
    }),
    data = await response.json().catch(() => ({}));
  if (!response.ok) return alert(data.error || "ลบไฟล์ไม่สำเร็จ");
  await editProduct(Number(productEditor.elements.id.value));
  setMessage("ลบไฟล์แล้ว เลือกไฟล์ใหม่และกดบันทึกสินค้าได้");
}
async function deleteAttachedProductImage(slot) {
  const labels = ["รูปปก", "รูปตัวอย่างที่ 2", "รูปตัวอย่างที่ 3"];
  if (!confirm(`ลบ${labels[slot] || "รูปนี้"}ใช่หรือไม่?`)) return;
  const id = Number(productEditor.elements.id.value),
    response = await fetch(`/api/admin/product-images/${id}?slot=${slot}`, {
      method: "DELETE",
    }),
    data = await response.json().catch(() => ({}));
  if (!response.ok) return alert(data.error || "ลบรูปไม่สำเร็จ");
  await editProduct(id);
  setMessage("ลบรูปแล้ว สามารถเลือกรูปใหม่ในช่องเดิมและกดบันทึกสินค้าได้");
}
function setMessage(text, error = false) {
  productFormMessage.textContent = text;
  productFormMessage.classList.toggle("error", error);
}
async function uploadVision2ReplacementFiles(id,files,label){
  const jobs=[['cover',0,'รูปปก'],['preview_2',1,'รูปตัวอย่าง 2'],['preview_3',2,'รูปตัวอย่าง 3'],['product_file',null,'PDF']];
  for(let index=0;index<jobs.length;index++){
    const [name,slot,text]=jobs[index],form=new FormData();
    form.set('file',files[name]);
    let endpoint=`/api/admin/product-images/${id}`;
    if(name==='product_file'){
      endpoint=`/api/admin/product-upload/${id}`;
      form.set('label',label||'ไฟล์ PDF ฉบับเต็ม');
    }else form.set('slot',String(slot));
    setMessage(`กำลังอัปโหลด ${text} · ${index+1}/${jobs.length}`);
    const response=await fetch(endpoint,{method:'POST',body:form}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`อัปโหลด ${text} ไม่สำเร็จ`);
  }
}
async function saveProduct(event) {
  event.preventDefault();
  setMessage("กำลังบันทึก…");
  const fd = new FormData(productEditor);
  if (vision2PendingProductFiles) {
    for (const name of ["cover", "preview_2", "preview_3", "product_file"]) {
      const selected = fd.get(name);
      if (!(selected instanceof File) || !selected.size)
        fd.set(name, vision2PendingProductFiles[name]);
    }
    const missing = ["cover", "preview_2", "preview_3", "product_file"].filter(
      (name) => !(fd.get(name) instanceof File) || !fd.get(name).size,
    );
    if (missing.length)
      return setMessage("ไฟล์จาก Vision 2 มาไม่ครบ กรุณากลับไปกดแนบ PDF และรูปตัวอย่างใหม่", true);
  }
  const id = fd.get("id"),separateVision2Files=vision2PendingProductFiles?{
    cover:fd.get('cover'),preview_2:fd.get('preview_2'),preview_3:fd.get('preview_3'),product_file:fd.get('product_file')
  }:null;
  if(separateVision2Files)for(const name of ['cover','preview_2','preview_3','product_file'])fd.delete(name);
  const pages = Number(fd.get("pages")) || 0;
  if (bundleMode) {
    const required = Number(fd.get("bundle_size")) || 5,
      selected = fd.getAll("bundle_product_ids");
    if (selected.length !== required)
      return setMessage(`กรุณาเลือกตะกร้าให้ครบ ${required} รายการ`, true);
    fd.set("bundle_product_ids", selected.join(","));
    fd.set("file_type", "ชุด PDF");
  }
  if (!fd.get("short_description"))
    fd.set(
      "short_description",
      bundleMode
        ? `ชุดคละ ${pages} ตะกร้า พร้อม PDF ครบทุกชุด`
        : `ชุดระบายสี · ${pages} แผ่น`,
    );
  fd.set(
    "price_cents",
    String(Math.round((Number(fd.get("price")) || 0) * 100)),
  );
  const r = await fetch(
    id ? "/api/admin/products/" + id : "/api/admin/products",
    { method: id ? "PUT" : "POST", body: fd },
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    setMessage(d.error || "บันทึกไม่สำเร็จ", true);
    return;
  }
  if(separateVision2Files){
    try{await uploadVision2ReplacementFiles(Number(id||d.item?.id),separateVision2Files,String(fd.get('file_label')||''))}
    catch(error){return setMessage(`${error.message} · ไฟล์เดิมของส่วนที่ยังไม่สำเร็จยังอยู่`,true)}
  }
  vision2PendingProductFiles = null;
  returnAdminHome(`บันทึกสินค้าเรียบร้อย · ${d.item.slug}`);
}
async function deleteProduct() {
  const id = productEditor.elements.id.value;
  if (
    !id ||
    !confirm(
      "ย้ายสินค้านี้พร้อมรูปและไฟล์ PDF/ZIP ไปถังขยะ 30 วันหรือไม่?",
    )
  )
    return;
  const r = await fetch("/api/admin/products/" + id, { method: "DELETE" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return setMessage(d.error || "ลบไม่สำเร็จ", true);
  resetProductForm();
  setMessage("ย้ายสินค้าไปถังขยะแล้ว สามารถกู้คืนได้ภายใน 30 วัน");
  loadProducts();
}
function formatBytes(n) {
  n = Number(n) || 0;
  if (!n) return "ไม่ระบุขนาด";
  if (n < 1024 * 1024) return Math.ceil(n / 1024) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
async function loadProfitDashboard() {
  loadVisitorStats();
loadCustomerAnalytics();
  loadAdsIntelligence();
  profitDailyTable.innerHTML = "<p>กำลังคำนวณยอดขายและค่าแอด…</p>";
  const params = new URLSearchParams({
      from: profitDateFrom.value,
      to: profitDateTo.value,
    }),
    r = await fetch("/api/admin/profit-dashboard?" + params, {
      cache: "no-store",
    }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    profitDailyTable.innerHTML = `<p>${esc(d.error || "โหลดแดชบอร์ดไม่สำเร็จ")}</p>`;
    return;
  }
  const s = d.summary || {},
    profit = Number(s.profit) || 0,
    roas = s.roas == null ? "—" : Number(s.roas).toFixed(2) + " เท่า";
  profitSummary.innerHTML = `<article><small>ยอดขายรวม</small><b>${money(s.sales)}</b></article><article><small>ค่าแอด Facebook รวม</small><b>${money(s.facebook_cost)}</b></article><article class="${profit >= 0 ? "profit-positive" : "profit-negative"}"><small>${profit >= 0 ? "กำไรรวม" : "ขาดทุนรวม"}</small><b>${profit < 0 ? "-" : ""}${money(Math.abs(profit))}</b></article><article><small>ROAS รวม</small><b>${roas}</b></article><article><small>ออเดอร์รวม</small><b>${Number(s.orders) || 0}</b></article>`;
  profitDailyTable.innerHTML = (d.items || []).length
    ? `<div class="profit-row profit-head"><b>วันที่</b><b>ยอดขาย</b><b>ค่าแอด</b><b>กำไร/ขาดทุน</b><b>ROAS</b><b>ออเดอร์</b><b>จัดการ</b></div>${d.items.map((item) => `<div class="profit-row"><time>${new Date(item.day + "T12:00:00").toLocaleDateString("th-TH", { dateStyle: "medium" })}</time><b>${money(item.sales)}</b><span>${money(item.facebook_cost)}</span><b class="${item.profit >= 0 ? "profit-text-positive" : "profit-text-negative"}">${item.profit < 0 ? "-" : ""}${money(Math.abs(item.profit))}</b><b>${item.roas == null ? "—" : Number(item.roas).toFixed(2) + "x"}</b><span>${item.orders}</span><button type="button" data-edit-ad="${esc(item.day)}" data-cost="${Number(item.facebook_cost) / 100}" data-note="${esc(item.note || "")}">ลง/แก้ค่าแอด</button></div>`).join("")}<div class="profit-row profit-total"><b>TOTAL<br><small>${new Date(d.from + "T12:00:00").toLocaleDateString("th-TH")} – ${new Date(d.to + "T12:00:00").toLocaleDateString("th-TH")}</small></b><b>${money(s.sales)}</b><b>${money(s.facebook_cost)}</b><b class="${profit >= 0 ? "profit-text-positive" : "profit-text-negative"}">${profit < 0 ? "-" : ""}${money(Math.abs(profit))}</b><b>${roas}</b><b>${Number(s.orders) || 0}</b><span>รวมช่วงที่เลือก</span></div>`
    : '<div class="admin-empty">ช่วงวันที่เลือกยังไม่มียอดขายหรือค่าแอด</div>';
  document.querySelectorAll("[data-edit-ad]").forEach(
    (button) =>
      (button.onclick = () => {
        adSpendDate.value = button.dataset.editAd;
        adCostForm.elements.facebook_cost.value = button.dataset.cost;
        adCostForm.elements.note.value = button.dataset.note;
        adCostForm.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
  );
}

async function loadCustomerAnalytics(){
  const funnel=document.querySelector('#customerFunnel'),products=document.querySelector('#customerProductPerformance'),journeys=document.querySelector('#customerJourneys');if(!funnel||!products||!journeys)return;
  const r=await fetch('/api/admin/customer-analytics?days=30',{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok){funnel.innerHTML=`<p>${esc(d.error||'โหลด Customer Intelligence ไม่สำเร็จ')}</p>`;return}
  const num=v=>new Intl.NumberFormat('th-TH').format(Number(v)||0),people=k=>Number(d.events?.[k]?.people)||0;
  const steps=[['เข้าหน้าเว็บ','landing_view'],['ดูสินค้า','product_view'],['ใส่ตะกร้า','add_to_cart'],['Checkout','checkout_start']];
  funnel.innerHTML=steps.map(([label,key],i)=>{const value=people(key),prev=i?people(steps[i-1][1]):0,rate=prev?Math.round(value/prev*100):0;return `<article><small>${label}</small><b>${num(value)}</b><em>${i?rate+'% จากขั้นก่อน':'ผู้ใช้/ผู้ชมไม่ซ้ำ'}</em></article>`}).join('')+`<article><small>ซื้อสำเร็จ</small><b>${num(d.purchase?.buyers)}</b><em>${num(d.purchase?.orders)} ออเดอร์ · ${money(d.purchase?.revenue)}</em></article>`;
  const diag=document.querySelector('#conversionDiagnostics'),c=d.conversion||{},rates=c.rates||{},mix=c.buyer_mix||{},bn=c.bottleneck;
  if(diag){const pct=v=>Math.round((Number(v)||0)*1000)/10;diag.innerHTML=`<div><b>Conversion Intelligence</b><small>ดู → Cart ${pct(rates.view_to_cart)}% · Cart → Checkout ${pct(rates.cart_to_checkout)}% · Checkout → Paid ${pct(rates.checkout_to_paid)}% · ดู → Paid ${pct(rates.view_to_paid)}%</small></div><div><b>${bn?'⚠️ จุดรั่วหลัก: '+esc(bn.label):'กำลังสะสมข้อมูลเพื่อหาจุดรั่ว'}</b><small>${bn?'Conversion '+pct(bn.rate)+'% จากฐาน '+num(bn.from)+' คน':'ต้องมีอย่างน้อย 5 คนในขั้นก่อนหน้าเพื่อไม่สรุปจากข้อมูลน้อยเกินไป'}</small></div><div><b>ผู้ซื้อใหม่ ${num(mix.new_buyers)} · กลับมาซื้อ ${num(mix.returning_buyers)}</b><small>ใช้พฤติกรรมรวม ไม่แสดง PII</small></div>`}
  products.innerHTML='<h4>สินค้าใน Funnel</h4>'+((d.products||[]).map(x=>`<div class="ci-row"><span><b>${esc(x.title)}</b><small>ดู ${num(x.views)} · ใส่ตะกร้า ${num(x.carts)}</small></span><strong>${x.views?Math.round(Number(x.carts||0)/Number(x.views)*100):0}%</strong></div>`).join('')||'<p>ยังไม่มีข้อมูล</p>');
  journeys.innerHTML='<h4>Customer Journey ล่าสุด</h4>'+((d.journeys||[]).map(x=>`<div class="ci-row"><span><b>${esc(x.name||x.username||('User #'+x.user_id))}</b><small>${esc(String(x.event_types||'').split(',').join(' → '))}</small></span><strong>${num(x.events)}</strong></div>`).join('')||'<p>ยังไม่มี Journey ของสมาชิก</p>');
  const demand=document.querySelector('#productDemandIntelligence');if(demand){const badge=x=>x==='PRODUCE'?'🔥 ผลิตเพิ่ม':x==='TEST'?'🧪 ทดสอบก่อน':'⏸ Hold';demand.innerHTML='<h4>Production Intelligence · Product Family</h4><p class="muted">รวมชุดชื่อเดิม เช่น ชุดที่ 2–7 เป็น Family เดียวกัน และแยกสต็อกเดิมออกจาก Demand-driven</p>'+((d.product_families||[]).map(x=>`<div class="ci-row demand-row"><span><b>${esc(x.family)}</b><small>${num(x.products)} ชุด · สูงสุดชุด ${num(x.max_series)} · Stock เดิม ${num(x.premade)} · Demand-driven ${num(x.demand_driven)}<br>View ${num(x.views)} · Cart ${num(x.carts)} · Paid ${num(x.purchases)} · Revenue ${money(x.revenue)}<br>${esc(x.reason)}</small></span><strong>${badge(x.recommendation)}${x.recommendation==='PRODUCE'?'<small> → ชุด '+num(x.next_series)+'</small>':''}</strong></div>`).join('')||'<p>ยังไม่มีข้อมูล Product Family เพียงพอ</p>')}
}
async function loadAdsIntelligence(){
  const summary=document.querySelector('#adsIntelligenceSummary'),table=document.querySelector('#adsIntelligenceTable');if(!summary||!table)return;
  const from=profitDateFrom?.value||'',to=profitDateTo?.value||'',r=await fetch(`/api/admin/ad-intelligence?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,{cache:'no-store'}),d=await r.json().catch(()=>({}));
  if(!r.ok){table.innerHTML=`<p>${esc(d.error||'โหลด Ads Intelligence ไม่สำเร็จ')}</p>`;return}
  const x=d.summary||{},roas=x.roas==null?'—':Number(x.roas).toFixed(2)+'x',profit=Number(x.profit)||0;
  summary.innerHTML=`<article><small>ค่าแอดระดับ Campaign</small><b>${money(x.spend)}</b></article><article><small>ยอดขาย Attribution</small><b>${money(x.revenue)}</b></article><article><small>กำไรหลังหักแอด</small><b class="${profit>=0?'positive':'negative'}">${profit<0?'-':''}${money(Math.abs(profit))}</b></article><article><small>ROAS</small><b>${roas}</b></article><article><small>Attributed Orders</small><b>${Number(x.orders)||0}</b></article>`;
  const rows=(d.performance||[]).map(item=>`<div class="ads-performance-row"><span><b>${esc(item.campaign||'(ไม่มี campaign)')}</b><small>${esc(item.source||'direct')}${item.creative?' · '+esc(item.creative):''}</small></span><b>${money(item.spend)}</b><b>${money(item.revenue)}</b><b>${Number(item.orders)||0}</b><b>${item.roas==null?'—':Number(item.roas).toFixed(2)+'x'}</b><b class="${Number(item.profit)>=0?'positive':'negative'}">${Number(item.profit)<0?'-':''}${money(Math.abs(Number(item.profit)||0))}</b></div>`).join('');
  const spend=(d.spend||[]).map(item=>`<div class="ads-spend-item"><span><b>${esc(item.campaign)}</b><small>${esc(item.spend_date)} · ${esc(item.platform)}${item.creative?' · '+esc(item.creative):''}</small></span><strong>${money(item.cost)}</strong><button type="button" data-delete-campaign-cost="${Number(item.id)||0}">ลบ</button></div>`).join('');
  table.innerHTML=`<div class="ads-performance-row head"><span>Campaign / Creative</span><b>Spend</b><b>Revenue</b><b>Orders</b><b>ROAS</b><b>กำไร</b></div>${rows||'<p>ยังไม่มีข้อมูล Campaign ที่จับคู่ได้</p>'}<div class="ads-spend-list"><h4>ค่าแอดที่บันทึก</h4>${spend||'<p>ยังไม่มีค่าแอดระดับ Campaign</p>'}</div>`;
  table.querySelectorAll('[data-delete-campaign-cost]').forEach(btn=>btn.onclick=async()=>{if(!confirm('ลบค่าแอดรายการนี้?'))return;const rr=await fetch('/api/admin/ad-intelligence?id='+encodeURIComponent(btn.dataset.deleteCampaignCost),{method:'DELETE'}),dd=await rr.json().catch(()=>({}));if(!rr.ok)return alert(dd.error||'ลบไม่สำเร็จ');loadAdsIntelligence()});
}
async function saveCampaignAdCost(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),message=document.querySelector('#campaignAdCostMessage'),body=Object.fromEntries(new FormData(form).entries());button.disabled=true;if(message)message.textContent='กำลังบันทึก…';const r=await fetch('/api/admin/ad-intelligence',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));button.disabled=false;if(!r.ok){if(message){message.textContent=d.error||'บันทึกไม่สำเร็จ';message.classList.add('error')}return}if(message){message.textContent='บันทึกเรียบร้อย';message.classList.remove('error')}loadAdsIntelligence();
}

async function loadVisitorStats() {
  const summary = document.querySelector("#visitorStatsSummary"),
    productsBox = document.querySelector("#topViewedProducts");
  if (!summary || !productsBox) return;
  const r = await fetch("/api/admin/visitor-stats", { cache: "no-store" }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    productsBox.innerHTML = `<p>${esc(d.error || "โหลดสถิติผู้เข้าชมไม่สำเร็จ")}</p>`;
    return;
  }
  const number = (value) =>
    new Intl.NumberFormat("th-TH").format(Number(value) || 0);
  summary.innerHTML = `<article><small>เข้าชมวันนี้</small><b>${number(d.today)}</b></article><article><small>7 วันล่าสุด</small><b>${number(d.last7)}</b></article><article><small>30 วันล่าสุด</small><b>${number(d.last30)}</b></article>`;
  productsBox.innerHTML = d.products?.length
    ? `<h4>สินค้าที่มีคนดูมากที่สุด</h4>${d.products.map((product, index) => `<a href="/product.html?slug=${encodeURIComponent(product.slug)}" target="_blank" rel="noopener"><span>${index + 1}</span><b>${esc(product.title)}</b><strong>${number(product.views)} ครั้ง</strong></a>`).join("")}`
    : "<p>ยังไม่มีข้อมูลการเข้าชมสินค้า</p>";
}
async function saveAdCost(event) {
  event.preventDefault();
  const form = new FormData(adCostForm),
    button = adCostForm.querySelector('button[type="submit"]');
  button.disabled = true;
  adCostMessage.textContent = "กำลังบันทึก…";
  const body = {
      spend_date: form.get("spend_date"),
      facebook_cost: form.get("facebook_cost"),
      note: form.get("note"),
    },
    r = await fetch("/api/admin/profit-dashboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    d = await r.json().catch(() => ({}));
  button.disabled = false;
  if (!r.ok) {
    adCostMessage.textContent = d.error || "บันทึกค่าแอดไม่สำเร็จ";
    adCostMessage.classList.add("error");
    return;
  }
  returnAdminHome(
    `บันทึกค่าแอดวันที่ ${new Date(d.spend_date + "T12:00:00").toLocaleDateString("th-TH")} เรียบร้อย`,
  );
}
async function loadSalesReport() {
  salesReportTable.innerHTML = "<p>กำลังโหลดรายงาน…</p>";
  const params = salesReportParams(); if (salesCursor) params.set("cursor", salesCursor);
  const r = await fetch("/api/admin/sales-report?" + params, { cache: "no-store" }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    salesReportTable.innerHTML = `<p>${esc(d.error || "โหลดรายงานไม่สำเร็จ")}</p>`;
    return;
  }
  salesRows = d.items || [];
  filteredSalesRows = salesRows; salesReportSummary = d.summary || salesReportSummary || {};
  salesProductRows = d.products || salesProductRows || [];
  salesNextCursor = d.pagination?.next_cursor || null;
  renderSalesReport();
}
function salesReportParams() { const params = new URLSearchParams({limit:"50"}); if(salesDateFrom.value)params.set("from",salesDateFrom.value);if(salesDateTo.value)params.set("to",salesDateTo.value);if(salesTypeFilter.value!=="all")params.set("sale_type",salesTypeFilter.value);return params; }
function renderSalesReport() {
  const s=salesReportSummary;
  salesSummary.innerHTML=`<article><b>${money(s.visiond_total)}</b><span>รายได้เข้า VisionD</span></article><article><b>${money(s.seller_course_total)}</b><span>ยอดคอร์สเข้าเจ้าของคอร์ส</span></article><article><b>${money(s.total)}</b><span>ยอดผ่านระบบทั้งหมด</span></article><article><b>${Number(s.order_count)||0}</b><span>คำสั่งซื้อ</span></article><article><b>${Number(s.item_quantity)||0}</b><span>จำนวนชิ้น</span></article><article><b>${Number(s.slip_count)||0}</b><span>สลิปที่เก็บไว้</span></article>`;
  salesProductSummary.innerHTML=salesProductRows.map(item=>`<span><b>${esc(item.product_title)}</b><small>${Number(item.quantity)||0} ชิ้น · ${money(item.total)}</small></span>`).join("");
  salesReportTable.innerHTML = filteredSalesRows.length
    ? `<div class="sales-row sales-head"><b>วันเวลา</b><b>สินค้า/ราคา</b><b>ลูกค้า</b><b>ออเดอร์</b><b>ผู้อนุมัติ</b><b>สลิป</b></div>${filteredSalesRows.map(row=>`<div class="sales-row"><time>${new Date(row.paid_at+"Z").toLocaleString("th-TH")}</time><div><b>${esc(row.product_title)}${Number(row.quantity)>1?` × ${Number(row.quantity)}`:""}</b><small>${row.sale_price_recorded===0?"ยังไม่ลงราคา":`${money(row.unit_price)} ต่อชิ้น · รวม ${money(row.line_total)}`}</small><small>${row.revenue_channel==='seller_course'?'เงินเข้าเจ้าของคอร์ส':'รายได้ VisionD'}</small></div><div><b>${esc(row.customer_name)}</b><small>${esc(row.customer_email)}</small><small>โทร ${esc(row.customer_phone||"ไม่ได้ระบุ")}</small></div><div><b>${esc(row.order_no)}</b><small>${row.sale_type==="manual"?"ปลดล็อกโดยตรง":"ยอดขายจากสลิป"}</small></div><span>${esc(row.approved_by||"-")}</span><div>${row.slip_url?`<a class="slip-report-link" href="${esc(row.slip_url)}" target="_blank">เปิดสลิป</a>`:'<span class="no-slip-label">ยังไม่มีสลิป</span>'}</div></div>`).join("")}<div class="sales-page-controls"><button type="button" data-sales-page="previous" ${salesCursorHistory.length?"":"disabled"}>หน้าก่อน</button><span>หน้านี้ ${new Set(filteredSalesRows.map(row=>row.order_id)).size} ออเดอร์</span><button type="button" data-sales-page="next" ${salesNextCursor?"":"disabled"}>หน้าถัดไป</button></div>`
    : "<p>ไม่พบยอดขายตามตัวกรอง</p>";
  salesReportTable.querySelector('[data-sales-page="previous"]')?.addEventListener("click",()=>{salesCursor=salesCursorHistory.pop()||null;loadSalesReport()});
  salesReportTable.querySelector('[data-sales-page="next"]')?.addEventListener("click",()=>{salesCursorHistory.push(salesCursor);salesCursor=salesNextCursor;loadSalesReport()});
}
async function downloadSalesCsv() {
  const originalText=exportSalesCsv.textContent;exportSalesCsv.disabled=true;exportSalesCsv.textContent="กำลังเตรียม CSV…";const allRows=[],seenCursors=new Set();let cursor=null;
  try{do{const params=salesReportParams();params.set("export","1");params.set("limit","200");if(cursor){if(seenCursors.has(cursor))throw new Error("ระบบแบ่งหน้ารายงานส่งเคอร์เซอร์ซ้ำ กรุณาลองใหม่");seenCursors.add(cursor);params.set("cursor",cursor)}const response=await fetch("/api/admin/sales-report?"+params,{cache:"no-store"}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"ดาวน์โหลดรายงานไม่สำเร็จ");allRows.push(...(data.items||[]));cursor=data.pagination?.next_cursor||null}while(cursor)}catch(error){alert(error.message);return}finally{exportSalesCsv.disabled=false;exportSalesCsv.textContent=originalText}
  if(!allRows.length)return alert("ไม่มีข้อมูลสำหรับดาวน์โหลด");
  const q = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"',
    header = [
      "วันเวลา",
      "สินค้า",
      "จำนวน (ชิ้น)",
      "ราคาต่อชิ้น (บาท)",
      "รวมรายการ (บาท)",
      "ลูกค้า",
      "อีเมล",
      "เบอร์โทร",
      "เลขออเดอร์",
      "ประเภท",
      "ช่องทางเงิน",
      "ผู้อนุมัติ",
      "ลิงก์สลิป",
    ],
    rows = allRows.map((row) => [
      new Date(row.paid_at + "Z").toLocaleString("th-TH"),
      row.product_title,
      Number(row.quantity)||0,
      row.sale_price_recorded === 0
        ? ""
        : (Number(row.unit_price || 0) / 100).toFixed(2),
      row.sale_price_recorded === 0
        ? ""
        : (Number(row.line_total || 0) / 100).toFixed(2),
      row.customer_name,
      row.customer_email,
      row.customer_phone || "",
      row.order_no,
      row.sale_type === "manual" ? "ปลดล็อกโดยตรง" : "ยอดขายจากสลิป",
      row.revenue_channel === "seller_course" ? "เข้าบัญชีเจ้าของคอร์ส" : "เข้า VisionD",
      row.approved_by || "",
      row.slip_url ? location.origin + row.slip_url : "",
    ]);
  const csv =
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(q).join(",")).join("\n"),
    blob = new Blob([csv], { type: "text/csv;charset=utf-8" }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `visiond-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
async function loadPaymentSettings() {
  settingsMessage.textContent = "กำลังโหลด…";
  const r = await fetch("/api/admin/payment-settings");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    settingsMessage.textContent = d.error || "โหลดการตั้งค่าไม่สำเร็จ";
    return;
  }
  const p = d.item || {};
  const profiles = p.profiles || {};
  if(!paymentSettingsForm.elements.vision3_auto_verify){
    const box=document.createElement('div');box.className='settings-status';box.innerHTML='<div><b>Vision 3 ตรวจสลิปอัตโนมัติ</b><small>ปิดแล้วลูกค้ายังอัปโหลดสลิปได้ แต่ Boss/Admin ต้องตรวจและปลดล็อกด้วยคน</small></div><label class="switch-line"><input name="vision3_auto_verify" type="checkbox" value="1"><span>เปิด Vision 3</span></label>';
    paymentSettingsForm.querySelector('.payment-account-switch').before(box);
  }
  if(!paymentSettingsForm.elements.vision5_rights_auto_verify){
    const box=document.createElement('div');box.className='settings-status vision5-rights-switch';box.innerHTML='<div><b>EasySlip ตะกร้าสิทธิ์ Vision 5</b><small>เปิด: ตรวจอัตโนมัติก่อน · ปิด: ส่งสลิปให้ Boss อนุมัติเพื่อให้งานเดินต่อ</small></div><label class="switch-line"><input name="vision5_rights_auto_verify" type="checkbox" value="1"><span>เปิด EasySlip</span></label>';
    paymentSettingsForm.querySelector('.payment-account-switch').before(box);
  }
  paymentSettingsForm.elements.active_account.value = p.active_account || "personal";
  paymentSettingsForm.elements.personal_bank_name.value = profiles.personal?.bank_name || "ธนาคารกรุงศรีอยุธยา";
  paymentSettingsForm.elements.personal_account_name.value = profiles.personal?.account_name || "รัฐสิทธิ ดำรงรถการ";
  paymentSettingsForm.elements.personal_account_number.value = profiles.personal?.account_number || "444-118-118-1";
  paymentSettingsForm.elements.company_bank_name.value = profiles.company?.bank_name || "";
  paymentSettingsForm.elements.company_account_name.value = profiles.company?.account_name || "";
  paymentSettingsForm.elements.company_account_number.value = profiles.company?.account_number || "";
  paymentSettingsForm.querySelectorAll('[name="active_account"]').forEach(input => input.disabled = viewer?.role !== "boss");
  paymentSettingsForm.querySelector('button[type="submit"]').textContent = viewer?.role === "boss" ? "บันทึกและสลับบัญชี" : "บันทึกการตั้งค่า";
  paymentSettingsForm.elements.accepting_orders.checked =
    p.accepting_orders !== false;
  paymentSettingsForm.elements.vision3_auto_verify.checked = p.vision3_auto_verify !== false;
  paymentSettingsForm.elements.vision3_auto_verify.disabled = viewer?.role !== "boss";
  paymentSettingsForm.elements.vision5_rights_auto_verify.checked = p.vision5_rights_auto_verify !== false;
  paymentSettingsForm.elements.vision5_rights_auto_verify.disabled = viewer?.role !== "boss";
  paymentSettingsForm.elements.payment_message.value = p.payment_message || "";
  currentQr.innerHTML = p.qr_url
    ? `<img src="${esc(p.qr_url)}" alt="QR ชำระเงิน"><small>QR ที่ใช้งานอยู่ในขณะนี้</small>`
    : "<small>ยังไม่ได้อัปโหลดรูป QR</small>";
  settingsMessage.textContent = "";
}
async function loadPromotionSettings(){
  promotionSettingsMessage.textContent='กำลังโหลดโปรโมชั่น…';
  const r=await fetch('/api/admin/promotion-settings',{cache:'no-store'}),d=await r.json().catch(()=>({}));
  if(!r.ok){promotionSettingsMessage.textContent=d.error||'โหลดโปรโมชั่นไม่สำเร็จ';return}
  const item=d.item||{},selected=new Set(item.scopes||[item.scope||'all']),options=document.getElementById('promotionCategoryOptions');
  options.innerHTML=(d.categories||[]).map(category=>`<label><input name="promotion_scope" type="checkbox" value="${esc(category.slug)}" ${selected.has(category.slug)?'checked':''}/> ${esc(category.name)} (${Number(category.product_count)||0} สินค้า)</label>`).join('');
  const allBox=promotionSettingsForm.querySelector('[name="promotion_scope"][value="all"]');allBox.checked=selected.has('all');
  const syncScopes=event=>{if(event?.target===allBox&&allBox.checked)options.querySelectorAll('input').forEach(input=>input.checked=false);else if(event?.target!==allBox&&event?.target?.checked)allBox.checked=false};
  promotionSettingsForm.querySelectorAll('[name="promotion_scope"]').forEach(input=>input.onchange=syncScopes);
  promotionSettingsForm.elements.enabled.checked=item.enabled===true;
  promotionSettingsForm.elements.percent.value=item.percent||10;
  promotionSettingsMessage.textContent=item.enabled?`กำลังลด ${item.percent}% สำหรับ ${selected.has('all')?'ทุกหมวด':`${selected.size} หมวดที่เลือก`}`:'โปรโมชั่นปิดอยู่';
  const first=d.first_order||{},stats=first.stats||{};firstOrderPromotionForm.elements.enabled.checked=first.enabled!==false;
  firstOrderPromotionStats.innerHTML=`<article><small>ติดตามแล้ว</small><b>${Number(stats.tracked_users)||0}</b></article><article><small>ได้รับข้อความสะกิด</small><b>${Number(stats.teased_users)||0}</b></article><article><small>ได้รับสิทธิ์</small><b>${Number(stats.granted_users)||0}</b></article><article><small>ใช้สิทธิ์</small><b>${Number(stats.used_users)||0}</b></article>`;
  firstOrderPromotionMessage.textContent=first.enabled!==false?'โปรลูกค้าใหม่เปิดอยู่':'โปรลูกค้าใหม่ปิดอยู่';
}
async function savePromotionSettings(event){
  event.preventDefault();promotionSettingsMessage.textContent='กำลังบันทึก…';
  const scopes=[...promotionSettingsForm.querySelectorAll('[name="promotion_scope"]:checked')].map(input=>input.value);if(!scopes.length){promotionSettingsMessage.textContent='กรุณาเลือกอย่างน้อย 1 หมวดสินค้า';return}
  const body={enabled:promotionSettingsForm.elements.enabled.checked,scopes,percent:Number(promotionSettingsForm.elements.percent.value),first_order_enabled:firstOrderPromotionForm.elements.enabled.checked};
  const r=await fetch('/api/admin/promotion-settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));
  if(!r.ok){promotionSettingsMessage.textContent=d.error||'บันทึกโปรโมชั่นไม่สำเร็จ';return}
  returnAdminHome(body.enabled?`เปิดโปรโมชั่นลด ${body.percent}% แล้ว`:'ปิดโปรโมชั่นแล้ว');
}
async function saveFirstOrderPromotion(event){event.preventDefault();firstOrderPromotionMessage.textContent='กำลังบันทึก…';const scopes=[...promotionSettingsForm.querySelectorAll('[name="promotion_scope"]:checked')].map(input=>input.value);if(!scopes.length){firstOrderPromotionMessage.textContent='กรุณาเลือกหมวดโปรโมชั่นหลักอย่างน้อย 1 หมวด';return}const body={enabled:promotionSettingsForm.elements.enabled.checked,scopes,percent:Number(promotionSettingsForm.elements.percent.value),first_order_enabled:firstOrderPromotionForm.elements.enabled.checked};const r=await fetch('/api/admin/promotion-settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));if(!r.ok){firstOrderPromotionMessage.textContent=d.error||'บันทึกไม่สำเร็จ';return}returnAdminHome(body.first_order_enabled?'เปิดโปรโมชั่นลูกค้าใหม่แล้ว':'ปิดโปรโมชั่นลูกค้าใหม่แล้ว')}
async function savePaymentSettings(e) {
  e.preventDefault();
  settingsMessage.textContent = "กำลังบันทึก…";
  const fd = new FormData(paymentSettingsForm);
  fd.set(
    "accepting_orders",
    paymentSettingsForm.elements.accepting_orders.checked ? "1" : "0",
  );
  fd.set("vision3_auto_verify",paymentSettingsForm.elements.vision3_auto_verify.checked ? "1" : "0");
  fd.set("vision5_rights_auto_verify",paymentSettingsForm.elements.vision5_rights_auto_verify.checked ? "1" : "0");
  const r = await fetch("/api/admin/payment-settings", {
    method: "PUT",
    body: fd,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    settingsMessage.textContent = d.error || "บันทึกไม่สำเร็จ";
    return;
  }
  returnAdminHome("บันทึกการตั้งค่าชำระเงินเรียบร้อย");
}

async function loadOrders() {
  const r = await fetch("/api/admin/orders");
  const d = await r.json();
  if (!r.ok) {
    deny(d.error || "ไม่มีสิทธิ์");
    return;
  }
  adminOrders.innerHTML =
    (d.items || [])
      .map((o) => {
        const waiting = o.status === "awaiting_payment";
        const review = !o.vision5_managed && o.status === "pending_review" && o.slip_url && o.slip_verification_status === "manual";
        const rightsReview = o.boss_can_review_rights === true;
        const slipWarning = o.has_resale_rights && o.slip_verification_code && o.slip_verification_code !== "VISION5_RIGHTS_MANUAL_MODE"
          ? `<div class="order-wait-note rejected"><b>⚠️ EasySlip ส่งเข้าตรวจโดย Boss</b><span>รหัส ${esc(o.slip_verification_code)} — ตรวจยอด ชื่อบัญชี และรายการซ้ำก่อนอนุมัติ</span></div>` : "";
        const actionMarkup = o.vision5_managed
          ? `<div class="order-wait-note"><b>ออเดอร์ Vision 5 — VisionD อนุมัติแทนไม่ได้</b><span>${esc(o.vision5_reason || "จัดการผ่านระบบ Vision 5")}</span></div>`
          : rightsReview
          ? `${slipWarning}<div class="order-wait-note"><b>ตะกร้าสิทธิ์ — รอ Boss ตัดสินใจ</b><span>อนุมัติแล้วระบบจะเพิ่ม ${Number(o.item_count)||0} เครดิตเพียงครั้งเดียว</span></div><div class="actions review-actions"><button class="primary" data-act="approve" data-rights="1" data-id="${o.id}">✓ Boss อนุมัติและเพิ่มเครดิต</button><button class="danger" data-act="reject" data-rights="1" data-id="${o.id}">✕ ปฏิเสธสลิป</button></div>`
          : review
          ? `<div class="actions review-actions"><button class="primary" data-act="approve" data-id="${o.id}">✓ อนุมัติและปลดล็อกไฟล์</button><button class="danger" data-act="reject" data-id="${o.id}">✕ ไม่อนุมัติสลิป</button></div>`
          : o.has_resale_rights && o.status === "pending_review"
            ? `<div class="order-wait-note"><b>ตะกร้าสิทธิ์ — เฉพาะ Boss ตรวจได้</b><span>${esc(o.vision5_reason || "รอ Boss ตรวจสลิป")}</span></div>`
          : waiting
            ? '<div class="order-wait-note"><b>ยังไม่ต้องตรวจสอบ</b><span>ลูกค้ายังไม่ได้ส่งสลิป ระบบจะแสดงปุ่มอนุมัติหลังได้รับสลิปแล้ว</span></div>'
            : '<div class="order-wait-note rejected"><b>สลิปไม่ผ่าน</b><span>กำลังรอลูกค้าส่งสลิปใหม่</span></div>';
        return `<article class="admin-card order-admin-card ${esc(o.status)}"><label class="order-select-line"><input type="checkbox" data-order-select="${o.id}"> เลือกออเดอร์นี้เพื่อล้าง</label><div class="section-head"><div><b>${esc(o.order_no)}</b><p>${esc(o.customer_name)} · ${esc(o.customer_email)} · โทร ${esc(o.customer_phone || "ไม่ได้ระบุ")}</p></div><span class="status ${esc(o.status)}">${esc(o.status_label)}</span></div><div class="order-admin-items"><b>${Number(o.item_count) || o.items.length} สินค้าในรถเข็น</b>${o.items.map((item, index) => `<span><i>${index + 1}</i><strong>${esc(item.title)}${Number(item.quantity)>1?` × ${Number(item.quantity)}`:''}</strong><em>${money(item.line_total??item.price)}</em></span>`).join("")}</div><b class="order-admin-total">ยอดรวม ${money(o.total)}</b>${o.slip_url ? `<div class="submitted-slip"><b>สลิปที่ลูกค้าส่ง</b><a href="${esc(o.slip_url)}" target="_blank"><img class="slip-preview" src="${esc(o.slip_url)}" alt="สลิปโอนเงิน"></a></div>` : '<p class="no-slip">ยังไม่มีสลิปจากลูกค้า</p>'}${actionMarkup}</article>`;
      })
      .join("") || "<p>ยังไม่มีคำสั่งซื้อ</p>";
  document
    .querySelectorAll("[data-act]")
    .forEach((b) => (b.onclick = () => act(b.dataset.id, b.dataset.act, b.dataset.rights === "1")));
  const selected=()=>[...document.querySelectorAll('[data-order-select]:checked')].map(input=>Number(input.dataset.orderSelect));
  const syncSelected=()=>{const count=selected().length;selectedOrderCount.textContent=`เลือกแล้ว ${count} ออเดอร์`;clearSelectedOrders.disabled=count===0;document.querySelectorAll('[data-order-select]').forEach(input=>input.closest('.order-admin-card')?.classList.toggle('order-selected',input.checked))};
  document.querySelectorAll('[data-order-select]').forEach(input=>input.onchange=syncSelected);
  clearSelectedOrders.onclick=()=>clearOldOrders('selected',selected());
  clearAllOrders.onclick=()=>clearOldOrders('all',[]);
  syncSelected();
}
async function clearOldOrders(mode,ids){
  const count=mode==='all'?'ทั้งหมด':`${ids.length} รายการที่เลือก`;
  if(!confirm(`ยืนยันล้างออเดอร์เก่า ${count}?\nข้อมูลออเดอร์และสลิปของรายการนี้จะถูกลบถาวร`))return;
  if(!confirm('ยืนยันครั้งสุดท้ายว่าต้องการล้างออเดอร์จริง'))return;
  const button=mode==='all'?clearAllOrders:clearSelectedOrders;button.disabled=true;
  const response=await fetch('/api/admin/orders/clear',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,ids})}),data=await response.json().catch(()=>({}));
  alert(data.error||data.message||'ล้างออเดอร์เรียบร้อย');
  if(response.ok)await loadOrders();else button.disabled=false;
}
async function act(id, action, rights = false) {
  if(rights&&!confirm(action === "approve" ? "เปิดดูสลิปและตรวจยอดเงิน ชื่อบัญชี และเวลาแล้วใช่ไหม?\nยืนยันเพิ่มเครดิตตะกร้าสิทธิ์ให้ลูกค้า" : "เปิดดูสลิปแล้วใช่ไหม?\nยืนยันปฏิเสธและให้ลูกค้าส่งสลิปใหม่"))return;
  const entered=prompt(action === "approve" ? (rights ? "หมายเหตุการอนุมัติของ Boss" : "หมายเหตุการอนุมัติ (ไม่บังคับ)") : "เหตุผลที่ปฏิเสธ","");
  if(entered===null)return;
  const note=entered.trim();
  if(rights&&action==="reject"&&!note)return alert("กรุณาระบุเหตุผลที่ปฏิเสธสลิป");
  const r = await fetch("/api/admin/orders/" + id + "/" + action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note, confirmed: rights }),
  });
  const d = await r.json();
  if (!r.ok) return alert(d.error);
  returnAdminHome(
    action === "approve"
      ? (d.message || "อนุมัติคำสั่งซื้อเรียบร้อย")
      : "บันทึกการไม่อนุมัติเรียบร้อย",
  );
}
async function loadUsers() {
  const [userResponse, productResponse] = await Promise.all([
    fetch("/api/admin/users"),
    products.length ? Promise.resolve(null) : fetch("/api/admin/products"),
  ]);
  const d = await userResponse.json();
  if (!userResponse.ok) {
    usersTable.innerHTML = `<p>${esc(d.error || "โหลดสมาชิกไม่สำเร็จ")}</p>`;
    return;
  }
  if (productResponse) {
    const productData = await productResponse.json().catch(() => ({}));
    if (productResponse.ok) products = productData.items || [];
  }
  users = d.items || [];
  unlockUserSelect.innerHTML = users
    .filter((u) => ["user", "customer"].includes(u.role))
    .map(
      (u) =>
        `<option value="${u.id}">${esc(u.name)} · ${esc(u.username || u.email)}</option>`,
    )
    .join("");
  const published = products.filter((p) => p.status === "published");
  unlockProductSelect.innerHTML = published
    .map(
      (p) =>
        `<option value="${p.id}" data-category="${esc(p.category || "other")}">${esc(p.title)}</option>`,
    )
    .join("");
  const usedCategories = [
    ...new Set(published.map((p) => p.category || "other")),
  ];
  packageCategorySelect.innerHTML =
    '<option value="">— เลือกสินค้าทั้งหมวด —</option>' +
    usedCategories
      .map((slug) => {
        const category = categories.find((item) => item.slug === slug);
        return `<option value="${esc(slug)}">${esc(category?.name || slug)}</option>`;
      })
      .join("");
  selectedProductCount.textContent = "เลือกแล้ว 0 รายการ";
  const userRow=u=>{const editable=viewer.role==='boss'&&u.role!=='boss',type=Number(u.is_test_user)===1?'test':u.role==='admin'?'admin':'user';return `<div class="user-row" data-user-row="${u.id}"><div><span data-user-view><b>${esc(u.name)}</b><small>${esc(u.email)}</small></span>${editable?`<span class="user-edit-fields" data-user-edit hidden><input name="name" value="${esc(u.name)}" aria-label="ชื่อ–นามสกุล"><input name="email" type="email" value="${esc(u.email)}" aria-label="อีเมล"></span>`:''}</div><span><span data-user-view>${esc(u.username||'-')}</span>${editable?`<input data-user-edit name="username" value="${esc(u.username||'')}" aria-label="Username" hidden>`:''}</span><span><a data-user-view href="tel:${esc(u.phone||'')}">${esc(u.phone||'ไม่ได้ระบุ')}</a>${editable?`<input data-user-edit name="phone" value="${esc(u.phone||'')}" inputmode="tel" aria-label="เบอร์โทร" hidden>`:''}</span><div class="user-status-stack"><span data-user-view class="role-badge ${esc(u.role)}">${type==='test'?'ยูสเทส':roleText[u.role]||esc(u.role)}</span>${Number(u.is_test_user)===1?'<span data-user-view class="test-user-badge">ยูสเทสระบบเว็บ</span>':''}${editable?`<select data-user-edit name="account_type" aria-label="ประเภทบัญชี" hidden><option value="user" ${type==='user'?'selected':''}>User</option><option value="test" ${type==='test'?'selected':''}>ยูสเทส</option><option value="admin" ${type==='admin'?'selected':''}>Admin</option></select>`:''}<span class="course-credit-count">เครดิตคงเหลือ ${Number(u.course_credit_balance)||0}</span>${u.is_course_owner?'<span class="course-owner-badge">เจ้าของคอร์ส</span>':''}</div><div class="user-manage-actions">${editable?`<button data-edit-user="${u.id}" type="button">แก้ไขทั้งแถว</button><button data-save-user="${u.id}" type="button" hidden>บันทึกใหม่</button><button data-cancel-user="${u.id}" type="button" hidden>ยกเลิก</button>`:'<span class="muted">ดูอย่างเดียว</span>'}${viewer.role==='boss'&&['user','customer'].includes(u.role)?`<button class="add-course-credit-button" data-add-course-credit="${u.id}" data-user-name="${esc(u.name||u.username||u.email)}">+ เพิ่มเครดิต</button>`:''}</div></div>`};
  usersTable.innerHTML = `${viewer.role==="boss"?"<div class=\"admin-user-toolbar\"><button id=\"createTestUser\" type=\"button\">+ สร้างยูสเทส</button><small>ชื่อกลาง: รัฐสิทธิ ดำรงรถการ · Username และอีเมลต้องไม่ซ้ำ</small></div>":""}<div class="user-table"><div class="user-row user-head"><b>สมาชิก</b><b>Username</b><b>เบอร์โทร</b><b>ประเภท/เครดิต</b><b>จัดการ</b></div>${users.map(userRow).join('')}</div>`;
  document.querySelectorAll('[data-edit-user]').forEach(button=>button.onclick=()=>toggleUserEdit(button.dataset.editUser,true));
  document.querySelectorAll('[data-cancel-user]').forEach(button=>button.onclick=()=>loadUsers());
  document.querySelectorAll('[data-save-user]').forEach(button=>button.onclick=()=>saveUserRow(button.dataset.saveUser));
  document.querySelector('#createTestUser')?.addEventListener('click',createTestUser);
  document.querySelectorAll('[data-add-course-credit]').forEach(button=>button.onclick=()=>addCourseCredits(button));
  loadUnlockHistory();
}
function toggleUserEdit(id,editing){
  const row=document.querySelector(`[data-user-row="${id}"]`);if(!row)return;
  row.classList.toggle('editing',editing);
  row.querySelectorAll('[data-user-view]').forEach(element=>element.hidden=editing);
  row.querySelectorAll('[data-user-edit]').forEach(element=>element.hidden=!editing);
  row.querySelector('[data-edit-user]').hidden=editing;
  row.querySelector('[data-save-user]').hidden=!editing;
  row.querySelector('[data-cancel-user]').hidden=!editing;
  if(editing)row.querySelector('[name="name"]')?.focus();
}
async function saveUserRow(id){
  const row=document.querySelector(`[data-user-row="${id}"]`),button=row?.querySelector('[data-save-user]');if(!row||!button)return;
  const value=name=>row.querySelector(`[name="${name}"]`)?.value||'',body={name:value('name'),email:value('email'),username:value('username'),phone:value('phone'),account_type:value('account_type')};
  if(!confirm(`บันทึกข้อมูลใหม่ของ ${body.name||body.username} หรือไม่?`))return;
  button.disabled=true;button.textContent='กำลังบันทึก…';
  const response=await fetch(`/api/admin/users/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));
  if(!response.ok){alert(data.error||'บันทึกข้อมูลผู้ใช้ไม่สำเร็จ');button.disabled=false;button.textContent='บันทึกใหม่';return}
  alert(data.message||'บันทึกข้อมูลผู้ใช้ใหม่แล้ว');await loadUsers();
}
async function createTestUser(){
  const username=prompt('Username ยูสเทส (อย่างน้อย 4 ตัว)','test-user-');if(username===null)return;
  const email=prompt('อีเมลยูสเทส','');if(email===null)return;
  const phone=prompt('เบอร์โทรศัพท์ไทย','');if(phone===null)return;
  const password=prompt('รหัสผ่านอย่างน้อย 10 ตัว','');if(password===null)return;
  if(!confirm(`สร้างยูสเทส ${username}\nชื่อ: รัฐสิทธิ ดำรงรถการ\nยืนยันหรือไม่?`))return;
  const response=await fetch('/api/admin/users/test-user',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,email,phone,password})}),data=await response.json().catch(()=>({}));
  alert(data.error||data.message||'สร้างยูสเทสแล้ว');if(response.ok)await loadUsers();
}
async function addCourseCredits(button){
  const raw=prompt(`เพิ่มแต้มสิทธิ์ให้ ${button.dataset.userName}\nกรอกจำนวนแต้ม (1–100)`,`1`);if(raw===null)return;
  const credits=Math.floor(Number(raw));if(!Number.isInteger(credits)||credits<1||credits>100)return alert('กรุณากรอกจำนวน 1–100 แต้ม');
  if(!confirm(`ยืนยันเพิ่ม ${credits} แต้มสิทธิ์ให้ ${button.dataset.userName}?\nเมื่อเพิ่มครั้งแรก User จะได้รับป้ายเจ้าของคอร์สทันที`))return;
  const note=prompt('หมายเหตุการเพิ่มแต้ม (ไม่บังคับ)','')||'';button.disabled=true;
  try{const response=await fetch(`/api/admin/users/${button.dataset.addCourseCredit}/course-credits`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credits,note})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'เพิ่มแต้มไม่สำเร็จ');alert(`เพิ่ม ${data.credits_added} แต้มสำเร็จ\nแต้มคงเหลือ ${data.credit_balance} แต้ม`);await loadUsers()}catch(error){alert(error.message);button.disabled=false}
}
async function loadUnlockHistory() {
  unlockHistoryList.innerHTML = "<p>กำลังโหลดประวัติ…</p>";
  const r = await fetch("/api/admin/unlock-history", { cache: "no-store" }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    unlockHistoryList.innerHTML = `<p>${esc(d.error || "โหลดประวัติไม่สำเร็จ")}</p>`;
    return;
  }
  unlockHistoryList.innerHTML =
    (d.items || [])
      .map(
        (item) =>
          `<article class="unlock-history-row"><div><b>${esc(item.product_title)}</b><span>ให้ ${esc(item.target_name)}</span></div><div><span>${item.method === "slip_approval" ? "อนุมัติจากสลิป" : "ปลดล็อกโดยตรง"}</span><small>${esc(item.order_no)}</small></div><div class="history-slot"><small>ราคาขาย</small><b>${item.sale_price_recorded === 0 ? "ยังไม่ลงราคา" : money(item.sale_total)}</b></div><div class="history-slot"><small>สลิปโอน</small>${item.slip_url ? `<a class="slip-report-link" href="${esc(item.slip_url)}" target="_blank">เปิดสลิป</a>` : '<span class="no-slip-label">ยังไม่มีสลิป</span>'}</div><div><b>${esc(item.actor_name)}</b><span class="role-badge ${esc(item.actor_role)}">${esc(roleText[item.actor_role] || item.actor_role)}</span></div><time>${new Date(item.created_at + "Z").toLocaleString("th-TH")}</time></article>`,
      )
      .join("") || "<p>ยังไม่มีประวัติการปลดล็อก</p>";
}

let elonSelectedConversation = "";
const elonWebToggle=document.getElementById('elonWebEnabled'),elonV7Toggle=document.getElementById('elonV7Enabled'),elonControlMessage=document.getElementById('elonControlMessage');
function paintElonControl(toggle,item){const web=toggle===elonWebToggle,card=document.getElementById(web?'elonWebControl':'elonV7Control'),label=document.getElementById(web?'elonWebState':'elonV7State'),configured=item?.configured===true;toggle.checked=configured&&item?.enabled===true;toggle.disabled=!configured;card.dataset.state=!configured?'disabled':toggle.checked?'on':'off';label.textContent=!configured?`ยังไม่ได้ตั้งฐาน ${web?'ELON_WEB_DB':'ELON_V7_DB'}`:toggle.checked?'● เปิดใช้งานอยู่':'○ ปิดใช้งานอยู่';toggle.title=configured?'':label.textContent}
async function loadElonControls(){
  if(viewer?.role!=='boss'){document.getElementById('elonControlCard')?.setAttribute('hidden','');return}
  const response=await fetch('/api/admin/elon-controls',{cache:'no-store'}),data=await response.json().catch(()=>({}));
  if(!response.ok){elonControlMessage.textContent=data.error||'โหลดสวิตช์ ELON ไม่สำเร็จ';return}
  for(const [toggle,item] of [[elonWebToggle,data.items?.web],[elonV7Toggle,data.items?.v7]])paintElonControl(toggle,item);
  elonControlMessage.textContent='ELON เว็บและ ELON V7 แยกฐานและแยกสวิตช์เรียบร้อย';
}
async function changeElonControl(target,toggle){
  toggle.disabled=true;elonControlMessage.textContent='กำลังบันทึก…';
  const response=await fetch('/api/admin/elon-controls',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({target,enabled:toggle.checked})}),data=await response.json().catch(()=>({}));
  if(!response.ok){toggle.checked=!toggle.checked;elonControlMessage.textContent=data.error||'บันทึกไม่สำเร็จ'}else{elonControlMessage.textContent=`${target==='web'?'ELON เว็บ':'ELON V7'} ${toggle.checked?'เปิดแล้ว':'ปิดแล้ว'}`}
  await loadElonControls();
}
if(elonWebToggle)elonWebToggle.onchange=()=>changeElonControl('web',elonWebToggle);
if(elonV7Toggle)elonV7Toggle.onchange=()=>changeElonControl('v7',elonV7Toggle);
let elonSearchTimer = null;
let elonPage = 1;
let elonItems = [];
const elonTime = (value) => value ? new Date(String(value).endsWith("Z") ? value : value + "Z").toLocaleString("th-TH") : "—";
function elonBadges(item) {
  const statusLabel = item.status === "archived" ? "เก็บแล้ว" : item.status === "ended" ? "จบการสนทนา" : "กำลังใช้งาน";
  const badges = [`<span class="elon-flag ${esc(item.status)}">${statusLabel}</span>`];
  if (Number(item.out_of_scope_count)) badges.push('<span class="elon-flag out-of-scope">นอกขอบเขต</span>');
  if (Number(item.error_count)) badges.push('<span class="elon-flag error">ข้อผิดพลาด</span>');
  return badges.join("");
}
async function loadElonConversations(append = false) {
  if (!append) { elonPage = 1; elonItems = []; }
  elonConversationList.innerHTML = "<p>กำลังโหลดบทสนทนา…</p>";
  const query = new URLSearchParams({q: elonSearchInput?.value || "", status: elonStatusFilter?.value || "", page:String(elonPage)});
  const r = await fetch(`/api/admin/elon?${query}`, {cache:"no-store"}), d = await r.json().catch(() => ({}));
  if (!r.ok) { elonConversationList.innerHTML = `<div class="elon-empty">${esc(d.error || "โหลดข้อมูล ELON ไม่สำเร็จ")}</div>`; return; }
  const s = d.stats || {};
  elonStats.innerHTML = `<div><small>บทสนทนาทั้งหมด</small><b>${Number(s.total)||0}</b></div><div><small>กำลังใช้งาน</small><b>${Number(s.active)||0}</b></div><div><small>นอกขอบเขต</small><b>${Number(s.out_of_scope)||0}</b></div><div><small>พบข้อผิดพลาด</small><b>${Number(s.errors)||0}</b></div>`;
  const boss = d.can_view_transcripts === true;
  elonBossWorkspace.hidden = !boss; elonAdminRestricted.hidden = boss;
  if (!boss) { elonPrivacyNote.textContent = "เก็บประวัติ 60 วัน · Admin เห็นเฉพาะจำนวนรวม บทสนทนาเต็มเปิดได้ด้วยบัญชี Boss เท่านั้น"; return; }
  elonItems = append ? elonItems.concat(d.items || []) : (d.items || []);
  elonConversationList.innerHTML = elonItems.map(item => `<button type="button" class="elon-conversation-card ${item.id===elonSelectedConversation?'active':''}" data-elon-conversation="${esc(item.id)}"><div class="elon-conversation-card-head"><b>${esc(item.member_name || item.username || "สมาชิก")}</b><small>@${esc(item.username || "-")}</small></div><p>${esc(item.last_message || "ยังไม่มีข้อความ")}</p><div class="elon-conversation-meta"><span>${Number(item.message_count)||0} ข้อความ</span><time>${elonTime(item.updated_at)}</time>${elonBadges(item)}</div></button>`).join("") || '<div class="elon-empty">ยังไม่มีบทสนทนาที่ตรงกับตัวกรอง</div>';
  const pagination=d.pagination||{}; elonLoadMore.hidden=Number(pagination.page||1)>=Number(pagination.total_pages||1);
  elonConversationList.querySelectorAll("[data-elon-conversation]").forEach(button => button.onclick = () => openElonTranscript(button.dataset.elonConversation));
}
function safeElonContext(raw) {
  try { const x = typeof raw === "string" ? JSON.parse(raw) : raw || {}; return [x.path || x.pathname, x.page_title || x.title, x.product_slug || x.slug].filter(Boolean).map(esc).join(" · "); } catch { return ""; }
}
async function openElonTranscript(id) {
  elonSelectedConversation = id; elonTranscript.innerHTML = '<div class="elon-transcript-empty"><b>กำลังเปิดบทสนทนา…</b></div>';
  const r = await fetch(`/api/admin/elon/${encodeURIComponent(id)}`, {cache:"no-store"}), d = await r.json().catch(() => ({}));
  if (!r.ok) { elonTranscript.innerHTML = `<div class="elon-empty">${esc(d.error || "เปิดบทสนทนาไม่สำเร็จ")}</div>`; return; }
  const c = d.conversation, messages = d.messages || [];
  elonTranscript.innerHTML = `<div class="elon-transcript-head"><div><h3>${esc(c.member_name || c.username || "สมาชิก")}</h3><p>@${esc(c.username || "-")} · ${esc(c.email || "-")} · เริ่ม ${elonTime(c.created_at)}</p></div><button class="elon-archive-button" type="button" data-elon-archive>${c.status === "archived" ? "นำกลับมาใช้งาน" : "เก็บบทสนทนา"}</button></div>${messages.map(m => { const context=safeElonContext(m.page_context); return `<article class="elon-message ${esc(m.role)}"><div class="elon-message-role"><span>${m.role === "user" ? "สมาชิก" : "ELON"}</span><time>${elonTime(m.created_at)}</time></div><div class="elon-message-content">${esc(m.content)}</div>${context ? `<div class="elon-message-context">หน้าที่ใช้งาน: ${context}</div>` : ""}</article>`; }).join("") || '<div class="elon-empty">บทสนทนานี้ยังไม่มีข้อความ</div>'}`;
  elonTranscript.querySelector("[data-elon-archive]").onclick = () => archiveElonConversation(c.id, c.status !== "archived");
  elonConversationList.querySelectorAll("[data-elon-conversation]").forEach(button => button.classList.toggle("active", button.dataset.elonConversation === id));
}
async function archiveElonConversation(id, archive) {
  if (!confirm(archive ? "เก็บบทสนทนานี้หรือไม่?" : "นำบทสนทนานี้กลับมาใช้งานหรือไม่?")) return;
  const r = await fetch(`/api/admin/elon/${encodeURIComponent(id)}`, {method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({archived:archive})}), d = await r.json().catch(()=>({}));
  if (!r.ok) return alert(d.error || "เปลี่ยนสถานะไม่สำเร็จ");
  await loadElonConversations();
  await openElonTranscript(id);
}
if (typeof refreshElonButton !== "undefined") refreshElonButton.onclick = loadElonConversations;
if (typeof elonSearchInput !== "undefined") elonSearchInput.oninput = () => { clearTimeout(elonSearchTimer); elonSearchTimer=setTimeout(loadElonConversations,250); };
if (typeof elonStatusFilter !== "undefined") elonStatusFilter.onchange = loadElonConversations;
if (typeof elonLoadMore !== "undefined") elonLoadMore.onclick = () => { elonPage += 1; loadElonConversations(true); };
function healthGroup(title,group,required){
  const items=group?.items||[];
  return `<section class="health-group"><div class="health-group-head"><h3>${esc(title)}</h3><b>${Number(group?.ready)||0}/${Number(group?.total)||0} พร้อม</b></div><div class="health-list">${items.map(item=>`<article class="health-item ${item.status==='ready'?'ready':'missing'}"><span class="health-icon" aria-hidden="true">${item.status==='ready'?'✓':'!'}</span><div><b>${esc(item.label)}</b>${item.detail?`<small>${esc(item.detail)}</small>`:''}<p>${esc(item.action)}</p></div><span class="health-badge">${item.status==='ready'?'พร้อม':required?'ต้องแก้':'แนะนำ'}</span></article>`).join('')}</div></section>`;
}
async function loadSystemHealth(){
  if(viewer?.role!=='boss'){systemHealthContent.innerHTML='<div class="admin-empty">เฉพาะ Boss ตรวจสถานะระบบได้</div>';return}
  refreshSystemHealth.disabled=true;systemHealthContent.innerHTML='<p>กำลังตรวจสถานะระบบ…</p>';
  const response=await fetch('/api/admin/system-health',{cache:'no-store'}),data=await response.json().catch(()=>({}));
  refreshSystemHealth.disabled=false;
  if(!response.ok){systemHealthContent.innerHTML=`<div class="admin-empty">${esc(data.error||'ตรวจระบบไม่สำเร็จ')}</div>`;return}
  systemHealthChecked.textContent=`ตรวจล่าสุด ${new Date(data.checked_at).toLocaleString('th-TH')}`;
  systemHealthContent.innerHTML=healthGroup('จำเป็นต่อการทำงาน',data.required,true)+healthGroup('แนะนำให้ตั้งค่า',data.recommended,false);
}
if(typeof refreshSystemHealth!=='undefined')refreshSystemHealth.onclick=loadSystemHealth;
async function unlockProductForUser(event) {
  event.preventDefault();
  const form = new FormData(manualUnlockForm),
    userId = form.get("user_id"),
    productIds = [...unlockProductSelect.selectedOptions].map((option) =>
      Number(option.value),
    );
  if (!userId || !productIds.length) {
    manualUnlockMessage.textContent =
      "กรุณาเลือกลูกค้าและสินค้าอย่างน้อย 1 รายการ";
    return;
  }
  const user = users.find((item) => String(item.id) === String(userId));
  if (
    !confirm(
      `ปลดล็อก ${productIds.length} สินค้าให้ ${user?.name || "ลูกค้า"} เป็นแพ็กเกจหรือไม่?`,
    )
  )
    return;
  const button = manualUnlockForm.querySelector('button[type="submit"]');
  button.disabled = true;
  manualUnlockMessage.textContent = `กำลังบันทึกการขายและปลดล็อก ${productIds.length} สินค้า…`;
  form.delete("product_id");
  productIds.forEach((id) => form.append("product_id", String(id)));
  const r = await fetch(`/api/admin/users/${userId}/unlock`, {
    method: "POST",
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  button.disabled = false;
  if (!r.ok) {
    manualUnlockMessage.textContent = d.error || "ปลดล็อกไม่สำเร็จ";
    manualUnlockMessage.classList.add("error");
    return;
  }
  returnAdminHome(`บันทึกการขายและปลดล็อก ${d.count} สินค้าเรียบร้อย`);
}
async function saveRole(id) {
  const select = document.querySelector(`[data-role-id="${id}"]`);
  if (!confirm(`เปลี่ยนระดับสมาชิกเป็น ${select.value.toUpperCase()} หรือไม่?`))
    return;
  const r = await fetch(`/api/admin/users/${id}/role`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: select.value }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return alert(d.error || "บันทึกไม่สำเร็จ");
  returnAdminHome("บันทึกระดับสมาชิกเรียบร้อย");
}
showAdminNotice();
init();
import('/mouse-ui.js?v=014109');
import('/i18n.js?v=014109');

document.querySelector('#refreshCustomerAnalytics')?.addEventListener('click',loadCustomerAnalytics);

const campaignAdCostForm=document.querySelector('#campaignAdCostForm');if(campaignAdCostForm){campaignAdCostForm.elements.spend_date.value=new Date().toISOString().slice(0,10);campaignAdCostForm.addEventListener('submit',saveCampaignAdCost)}
document.querySelector('#refreshAdsIntelligence')?.addEventListener('click',loadAdsIntelligence);
