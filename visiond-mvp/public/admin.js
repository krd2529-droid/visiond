import("/facebook-chat.js?v=01144");
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
  members: membersPanel,
  orders: ordersPanel,
  sales: salesPanel,
  promotion: promotionPanel,
  settings: settingsPanel,
  users: usersPanel,
  trash: trashPanel,
};
let salesRows = [],
  filteredSalesRows = [];
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
      if (btn.dataset.adminTab === "overview") loadProfitDashboard();
      if (btn.dataset.adminTab === "products") loadProducts();
      if (btn.dataset.adminTab === "categories") loadCategories();
      if (btn.dataset.adminTab === "members") loadMemberPlans();
      if (btn.dataset.adminTab === "orders") loadOrders();
      if (btn.dataset.adminTab === "sales") loadSalesReport();
      if (btn.dataset.adminTab === "promotion") loadPromotionSettings();
      if (btn.dataset.adminTab === "settings") loadPaymentSettings();
      if (btn.dataset.adminTab === "users") loadUsers();
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
closeEditor.onclick = resetProductForm;
productEditor.onsubmit = saveProduct;
deleteProductButton.onclick = deleteProduct;
paymentSettingsForm.onsubmit = savePaymentSettings;
promotionSettingsForm.onsubmit = savePromotionSettings;
newCategoryButton.onclick = resetCategoryForm;
categoryEditor.onsubmit = saveCategory;
deleteCategoryButton.onclick = deleteCategory;
downloadCategoryPreviews.onclick = downloadPreviewArchive;
previewExportCategory.onchange = loadPreviewBatches;
productSearchInput.oninput = () => { productAdminPage = 1; renderProductAdminList(productSearchInput.value); };
memberPlanForm.onsubmit = saveMemberPlan;
refreshTrashButton.onclick = loadTrash;
trashList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-trash-action]");
  if (!button) return;
  const action = button.dataset.trashAction,
    id = Number(button.dataset.trashId),
    type = button.dataset.trashType;
  if (action === "delete" && !confirm("ลบรายการนี้ถาวรทันทีหรือไม่? กู้คืนไม่ได้")) return;
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
    ? `<div class="trash-grid">${data.items.map((item) => `<article class="trash-card"><div><b>${esc(item.title)}</b><small>${labels[item.item_type] || esc(item.item_type)} · ลบเมื่อ ${new Date(item.deleted_at + "Z").toLocaleString("th-TH")}</small><small>ล้างอัตโนมัติ ${new Date(item.expires_at + "Z").toLocaleString("th-TH")}</small></div><div><button type="button" data-trash-action="restore" data-trash-type="${esc(item.item_type)}" data-trash-id="${item.id}">กู้คืน</button><button class="danger" type="button" data-trash-action="delete" data-trash-type="${esc(item.item_type)}" data-trash-id="${item.id}">ลบถาวร</button></div></article>`).join("")}</div>`
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
applySalesFilter.onclick = renderSalesReport;
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
  adminIdentity.innerHTML = `เข้าสู่ระบบเป็น <b>${esc(viewer.name)}</b> · <span class="role-badge ${esc(viewer.role)}">${roleText[viewer.role] || esc(viewer.role)}</span>`;
  if (!["boss", "admin"].includes(viewer.role)) {
    deny("บัญชี User ไม่มีสิทธิ์เข้าหลังบ้าน");
    return;
  }
  setupBossMobilePreview();
  adminPanel.hidden = false;
  Object.entries(panels).forEach(
    ([name, panel]) => (panel.hidden = name !== "overview"),
  );
  const today = new Date().toISOString().slice(0, 10),
    from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  profitDateFrom.value = from;
  profitDateTo.value = today;
  adSpendDate.value = today;
  await loadCategories(false);
  loadProfitDashboard();
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
  deleteCategoryButton.hidden = false;
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
  const r = await fetch("/api/admin/sales-report", { cache: "no-store" }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    salesReportTable.innerHTML = `<p>${esc(d.error || "โหลดรายงานไม่สำเร็จ")}</p>`;
    return;
  }
  salesRows = d.items || [];
  renderSalesReport();
}
function renderSalesReport() {
  const from = salesDateFrom.value
      ? new Date(salesDateFrom.value + "T00:00:00")
      : null,
    to = salesDateTo.value ? new Date(salesDateTo.value + "T23:59:59") : null,
    type = salesTypeFilter.value;
  filteredSalesRows = salesRows.filter((row) => {
    const date = new Date(row.paid_at + "Z");
    return (
      (!from || date >= from) &&
      (!to || date <= to) &&
      (type === "all" || row.sale_type === type)
    );
  });
  const orderCount = new Set(filteredSalesRows.map((row) => row.order_id)).size,
    total = filteredSalesRows.reduce(
      (sum, row) =>
        sum + (row.sale_price_recorded === 0 ? 0 : Number(row.sale_price || 0)),
      0,
    ),
    slipCount = new Set(
      filteredSalesRows
        .filter((row) => row.slip_url)
        .map((row) => row.order_id),
    ).size;
  salesSummary.innerHTML = `<article><b>${money(total)}</b><span>ยอดรวมที่ลงราคาแล้ว</span></article><article><b>${orderCount}</b><span>คำสั่งซื้อ</span></article><article><b>${filteredSalesRows.length}</b><span>สินค้าที่ขาย</span></article><article><b>${slipCount}</b><span>สลิปที่เก็บไว้</span></article>`;
  const productMap = new Map();
  filteredSalesRows.forEach((row) => {
    const item = productMap.get(row.product_title) || { qty: 0, total: 0 };
    item.qty++;
    if (row.sale_price_recorded !== 0)
      item.total += Number(row.sale_price || 0);
    productMap.set(row.product_title, item);
  });
  salesProductSummary.innerHTML = [...productMap.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 8)
    .map(
      ([title, item]) =>
        `<span><b>${esc(title)}</b><small>${item.qty} ชุด · ${money(item.total)}</small></span>`,
    )
    .join("");
  salesReportTable.innerHTML = filteredSalesRows.length
    ? `<div class="sales-row sales-head"><b>วันเวลา</b><b>สินค้า/ราคา</b><b>ลูกค้า</b><b>ออเดอร์</b><b>ผู้อนุมัติ</b><b>สลิป</b></div>${filteredSalesRows.map((row) => `<div class="sales-row"><time>${new Date(row.paid_at + "Z").toLocaleString("th-TH")}</time><div><b>${esc(row.product_title)}</b><small>${row.sale_price_recorded === 0 ? "ยังไม่ลงราคา" : money(row.sale_price)}</small></div><div><b>${esc(row.customer_name)}</b><small>${esc(row.customer_email)}</small><small>โทร ${esc(row.customer_phone || "ไม่ได้ระบุ")}</small></div><div><b>${esc(row.order_no)}</b><small>${row.sale_type === "manual" ? "ปลดล็อกโดยตรง" : "ยอดขายจากสลิป"}</small></div><span>${esc(row.approved_by || "-")}</span><div>${row.slip_url ? `<a class="slip-report-link" href="${esc(row.slip_url)}" target="_blank">เปิดสลิป</a>` : '<span class="no-slip-label">ยังไม่มีสลิป</span>'}</div></div>`).join("")}`
    : "<p>ไม่พบยอดขายตามตัวกรอง</p>";
}
function downloadSalesCsv() {
  if (!filteredSalesRows.length) return alert("ไม่มีข้อมูลสำหรับดาวน์โหลด");
  const q = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"',
    header = [
      "วันเวลา",
      "สินค้า",
      "ราคาขาย (บาท)",
      "ลูกค้า",
      "อีเมล",
      "เบอร์โทร",
      "เลขออเดอร์",
      "ประเภท",
      "ผู้อนุมัติ",
      "ลิงก์สลิป",
    ],
    rows = filteredSalesRows.map((row) => [
      new Date(row.paid_at + "Z").toLocaleString("th-TH"),
      row.product_title,
      row.sale_price_recorded === 0
        ? ""
        : (Number(row.sale_price || 0) / 100).toFixed(2),
      row.customer_name,
      row.customer_email,
      row.customer_phone || "",
      row.order_no,
      row.sale_type === "manual" ? "ปลดล็อกโดยตรง" : "ยอดขายจากสลิป",
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
  const item=d.item||{},select=promotionSettingsForm.elements.scope;
  select.innerHTML='<option value="all">ทุกหมวดสินค้า</option>'+((d.categories||[]).map(category=>`<option value="${esc(category.slug)}">${esc(category.name)} (${Number(category.product_count)||0} สินค้า)</option>`).join(''));
  promotionSettingsForm.elements.enabled.checked=item.enabled===true;
  select.value=item.scope||'all';
  promotionSettingsForm.elements.percent.value=item.percent||10;
  promotionSettingsMessage.textContent=item.enabled?`กำลังลด ${item.percent}% สำหรับ ${item.scope==='all'?'ทุกหมวด':'หมวดที่เลือก'}`:'โปรโมชั่นปิดอยู่';
}
async function savePromotionSettings(event){
  event.preventDefault();promotionSettingsMessage.textContent='กำลังบันทึก…';
  const body={enabled:promotionSettingsForm.elements.enabled.checked,scope:promotionSettingsForm.elements.scope.value,percent:Number(promotionSettingsForm.elements.percent.value)};
  const r=await fetch('/api/admin/promotion-settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));
  if(!r.ok){promotionSettingsMessage.textContent=d.error||'บันทึกโปรโมชั่นไม่สำเร็จ';return}
  returnAdminHome(body.enabled?`เปิดโปรโมชั่นลด ${body.percent}% แล้ว`:'ปิดโปรโมชั่นแล้ว');
}
async function savePaymentSettings(e) {
  e.preventDefault();
  settingsMessage.textContent = "กำลังบันทึก…";
  const fd = new FormData(paymentSettingsForm);
  fd.set(
    "accepting_orders",
    paymentSettingsForm.elements.accepting_orders.checked ? "1" : "0",
  );
  fd.set("vision3_auto_verify",paymentSettingsForm.elements.vision3_auto_verify.checked ? "1" : "0");
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
        const review = o.status === "pending_review" && o.slip_url;
        const actionMarkup = review
          ? `<div class="actions review-actions"><button class="primary" data-act="approve" data-id="${o.id}">✓ อนุมัติและปลดล็อกไฟล์</button><button class="danger" data-act="reject" data-id="${o.id}">✕ ไม่อนุมัติสลิป</button></div>`
          : waiting
            ? '<div class="order-wait-note"><b>ยังไม่ต้องตรวจสอบ</b><span>ลูกค้ายังไม่ได้ส่งสลิป ระบบจะแสดงปุ่มอนุมัติหลังได้รับสลิปแล้ว</span></div>'
            : '<div class="order-wait-note rejected"><b>สลิปไม่ผ่าน</b><span>กำลังรอลูกค้าส่งสลิปใหม่</span></div>';
        return `<article class="admin-card order-admin-card ${esc(o.status)}"><div class="section-head"><div><b>${esc(o.order_no)}</b><p>${esc(o.customer_name)} · ${esc(o.customer_email)} · โทร ${esc(o.customer_phone || "ไม่ได้ระบุ")}</p></div><span class="status ${esc(o.status)}">${esc(o.status_label)}</span></div><div class="order-admin-items"><b>${Number(o.item_count) || o.items.length} สินค้าในรถเข็น</b>${o.items.map((item, index) => `<span><i>${index + 1}</i><strong>${esc(item.title)}</strong><em>${money(item.price)}</em></span>`).join("")}</div><b class="order-admin-total">ยอดรวม ${money(o.total)}</b>${o.slip_url ? `<div class="submitted-slip"><b>สลิปที่ลูกค้าส่ง</b><a href="${esc(o.slip_url)}" target="_blank"><img class="slip-preview" src="${esc(o.slip_url)}" alt="สลิปโอนเงิน"></a></div>` : '<p class="no-slip">ยังไม่มีสลิปจากลูกค้า</p>'}${actionMarkup}</article>`;
      })
      .join("") || "<p>ยังไม่มีคำสั่งซื้อ</p>";
  document
    .querySelectorAll("[data-act]")
    .forEach((b) => (b.onclick = () => act(b.dataset.id, b.dataset.act)));
}
async function act(id, action) {
  const note =
    prompt(
      action === "approve"
        ? "หมายเหตุการอนุมัติ (ไม่บังคับ)"
        : "เหตุผลที่ปฏิเสธ",
    ) || "";
  const r = await fetch("/api/admin/orders/" + id + "/" + action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note }),
  });
  const d = await r.json();
  if (!r.ok) return alert(d.error);
  returnAdminHome(
    action === "approve"
      ? "อนุมัติคำสั่งซื้อเรียบร้อย"
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
  usersTable.innerHTML = `<div class="user-table"><div class="user-row user-head"><b>สมาชิก</b><b>ไอดี</b><b>เบอร์โทร</b><b>ระดับ</b><b>จัดการ</b></div>${users.map((u) => `<div class="user-row"><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><span>${esc(u.username || "-")}</span><a href="tel:${esc(u.phone || "")}">${esc(u.phone || "ไม่ได้ระบุ")}</a><span class="role-badge ${esc(u.role)}">${roleText[u.role] || esc(u.role)}</span><div>${viewer.role === "boss" && u.role !== "boss" ? `<select data-role-id="${u.id}"><option value="user" ${["user", "customer"].includes(u.role) ? "selected" : ""}>User</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option></select><button data-save-role="${u.id}">บันทึก</button>` : '<span class="muted">ดูอย่างเดียว</span>'}</div></div>`).join("")}</div>`;
  document
    .querySelectorAll("[data-save-role]")
    .forEach((b) => (b.onclick = () => saveRole(b.dataset.saveRole)));
  loadUnlockHistory();
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
async function loadMemberPlans(){
  memberPlanList.innerHTML='<p>กำลังโหลดแพ็กเกจ…</p>';
  const response=await fetch('/api/admin/member-plans',{cache:'no-store'}),data=await response.json().catch(()=>({}));
  if(!response.ok){memberPlanList.innerHTML=`<p>${esc(data.error||'โหลดแพ็กเกจไม่สำเร็จ')}</p>`;return}
  memberPlanCategory.innerHTML='<option value="">— เลือกหมวดสินค้า —</option>'+data.categories.map(category=>`<option value="${esc(category.slug)}">${esc(category.name)}</option>`).join('');
  memberPlanList.innerHTML=data.plans.length?data.plans.map(plan=>`<article class="member-plan-admin-card"><div><b>${esc(plan.category_name||plan.category_slug)}</b><span>${Number(plan.duration_months)===12?'รายปี · 1 ปี':'รายเดือน · 1 เดือน'}</span></div><strong>${money(plan.price)}</strong><span class="${plan.status==='published'?'category-on':'category-off'}">${plan.status==='published'?'เปิดขาย':'ปิดขาย'}</span><small>สมาชิกที่ยังมีสิทธิ์ ${Number(plan.active_members)||0} คน</small><button type="button" data-edit-member="${plan.id}">แก้ไข</button></article>`).join(''):'<div class="admin-empty">ยังไม่มีตะกร้า Member เลือกหมวด ระยะเวลา และราคาเพื่อสร้างแพ็กเกจ</div>';
  memberPlanList.querySelectorAll('[data-edit-member]').forEach(button=>button.onclick=()=>{const plan=data.plans.find(item=>String(item.id)===button.dataset.editMember);if(!plan)return;memberPlanForm.elements.category_slug.value=plan.category_slug;memberPlanForm.elements.duration_months.value=String(plan.duration_months);memberPlanForm.elements.price_baht.value=Number(plan.price)/100;memberPlanForm.elements.active.checked=plan.status==='published';memberPlanForm.scrollIntoView({behavior:'smooth',block:'center'})});
}
async function saveMemberPlan(event){
  event.preventDefault();const button=memberPlanForm.querySelector('button[type="submit"]'),form=new FormData(memberPlanForm);button.disabled=true;memberPlanMessage.textContent='กำลังบันทึก…';
  const response=await fetch('/api/admin/member-plans',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category_slug:form.get('category_slug'),duration_months:Number(form.get('duration_months')),price_baht:Number(form.get('price_baht')),active:memberPlanForm.elements.active.checked})}),data=await response.json().catch(()=>({}));button.disabled=false;
  if(!response.ok){memberPlanMessage.textContent=data.error||'บันทึกไม่สำเร็จ';memberPlanMessage.classList.add('error');return}
  memberPlanMessage.classList.remove('error');memberPlanMessage.textContent='บันทึกแพ็กเกจเรียบร้อย';loadMemberPlans();
}
showAdminNotice();
init();
import('/mouse-ui.js?v=01205');
import('/i18n.js?v=01331');
