const $ = (selector) => document.querySelector(selector), escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
const normalizeProductName = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const arrayValue = (value) => Array.isArray(value) ? value : value === null || value === void 0 || value === "" ? [] : [value], textValue = (value) => Array.isArray(value) ? value.join(" \xB7 ") : String(value ?? "");
const form = $("#analysisForm"), message = $("#message"), thaiNow = () => new Date(Date.now() + 252e5).toISOString(), thaiToday = () => thaiNow().slice(0, 10), shiftThaiDate = (date, days) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 864e5).toISOString().slice(0, 10);
}, commissionAvailability = () => {
  const now = thaiNow(), today = now.slice(0, 10), ready = Number(now.slice(11, 13)) >= 12;
  return { ready, latestDate: shiftThaiDate(today, -1) };
}, dateDaysAgo = (days, base = commissionAvailability().latestDate) => {
  const [y, m, d] = base.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - days * 864e5).toISOString().slice(0, 10);
};
const savedUiValue = (key) => { try { return localStorage.getItem(key) || ""; } catch { return ""; } }, saveUiValue = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const requestedChannelId = new URLSearchParams(location.search).get("channel_id") || savedUiValue("visiond_tiktok_channel_id") || null;
let state = { channels: [], selected: requestedChannelId, connection: null, shopConnection: null, connectionLoadSeq: 0, shopDateFrom: dateDaysAgo(29), shopDateTo: commissionAvailability().latestDate, showcasePage: 1, showcaseSearch: "", showcaseProducts: [], inventoryProducts: [], marketplaceProducts: [], marketplaceCategories: [], marketplaceCategoriesForConnection: "", marketplaceCategoriesLoadingForConnection: "", marketplaceNextToken: "", marketplaceSearchedAt: "", marketplaceComparisonDays: 3, shopMarketplaceProducts: [], shopMarketplaceNextToken: "", shopMarketplaceSearchedAt: "", shopMarketplaceComparisonDays: 3 };
const shopConnectionRequests = new Map();
const commissionCardScript = document.createElement("script");
commissionCardScript.src = "/tiktok-commission-card.js?v=02087";
document.head.append(commissionCardScript);
let toastTimer;
function showToast(text, type = "success") {
  let toast = $("#actionToast");
  if (!toast) {
    document.body.insertAdjacentHTML("beforeend", '<div id="actionToast" class="action-toast" role="status" aria-live="polite"></div>');
    toast = $("#actionToast");
  }
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.className = `action-toast ${type} visible`;
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}
function correctLegacyEvidencePeriod() {
  const period = Number(form.attachment_period_days?.value) || 30;
  $("#angelProducts")?.querySelectorAll(".permanent-product-table tbody tr").forEach((row) => {
    const cell = row.cells[4], button = row.querySelector("[data-product-evidence]");
    if (!cell) return;
    const corrected = cell.textContent.replace(/(?:ขายดีมาก\s*)?([0-9][0-9,]*)\s*ชิ้น\s*7\s*วัน/i, `\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 ${period} \u0E27\u0E31\u0E19 $1 \u0E0A\u0E34\u0E49\u0E19`);
    if (corrected !== cell.textContent) {
      cell.textContent = corrected;
      if (button) button.dataset.productEvidence = corrected;
    }
  });
}
const legacyEvidenceObserver = new MutationObserver(correctLegacyEvidencePeriod);
legacyEvidenceObserver.observe($("#angelProducts"), { childList: true, subtree: true });
$("#attachmentPeriodDays").addEventListener("change", correctLegacyEvidencePeriod);
$("#channels").addEventListener("click", () => {
  setOutputScope("channel");
  setWorkspaceView("output");
}, { capture: true });
const shopHeader = $("#shopDashboard .result-head>div"), resultHeader = $("#result .result-head>div"), manualHeader = $("#angelInventory .result-head>div");
shopHeader.querySelector("small").textContent = "AUTOMATIC \xB7 TIKTOK SHOP API";
shopHeader.querySelector("h2").textContent = "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E41\u0E22\u0E01\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07";
shopHeader.insertAdjacentHTML("beforeend", '<p class="source-caption">\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19 \u0E01\u0E23\u0E32\u0E1F\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</p>');
form.insertAdjacentHTML("afterbegin", '<div class="manual-source-note"><b>MANUAL ANALYSIS \xB7 \u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E01\u0E23\u0E2D\u0E01\u0E40\u0E2D\u0E07</b><span>\u0E43\u0E0A\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E44\u0E14\u0E49\u0E01\u0E48\u0E2D\u0E19 TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E22\u0E2D\u0E14\u0E08\u0E32\u0E01 Showcase \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34</span></div>');
$("#newChannel").textContent = "+ ช่องใหม่";
resultHeader.querySelector("small").textContent = "CHANNEL ANALYSIS RESULT";
resultHeader.querySelector("h2").textContent = "\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E0A\u0E48\u0E2D\u0E07";
manualHeader.querySelector("small").textContent = "CHANNEL PRODUCT SELECTION LIST";
manualHeader.querySelector("h2").textContent = "\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32";
const typeLabels = { A: "สินค้าหลัก · ≥30 ชิ้น/เดือน", B: "สินค้ารอง · 16–29 ชิ้น/เดือน", C: "ขายได้เล็กน้อย · 1–15 ชิ้น/เดือน", D: "สินค้าทดสอบ · คัดเข้าลิสต์คัดสินค้า", E: "สินค้ากระแส · สินค้าแนะนำจาก AI", F: "สินค้าคัดออก" };
const safeJson = (value) => {
  try {
    return JSON.parse(value || "null");
  } catch {
    return null;
  }
}, shopProductLabel = (product, orders) => {
  const sold = orders.reduce((sum, order) => sum + (safeJson(order.product_ids) || []).filter((id) => String(id) === String(product.product_id)).length, 0), commission = safeJson(product.commission_json), amount = commission?.amount ? `${commission.amount} ${commission.currency || ""}`.trim() : "", rate = Number(commission?.rate) || 0, commissionText = amount || rate ? ` \xB7 \u0E04\u0E2D\u0E21 ${amount ? escapeHtml(amount) : `${(rate / 100).toLocaleString()}%`}` : "";
  return `${escapeHtml(product.name || product.product_id)} \xB7 \u0E02\u0E32\u0E22 ${sold.toLocaleString()} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C${commissionText}`;
};
const money = (value) => `\u0E3F${Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, gradeAdvice = { A: "\u0E02\u0E32\u0E22\u0E14\u0E35 \xB7 \u0E25\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07", B: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E23\u0E2D\u0E07 \xB7 \u0E17\u0E33\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07", C: "\u0E1E\u0E2D\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 \xB7 \u0E40\u0E1D\u0E49\u0E32\u0E14\u0E39\u0E15\u0E48\u0E2D", D: "\u0E17\u0E33\u0E15\u0E32\u0E21\u0E01\u0E23\u0E30\u0E41\u0E2A\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E48\u0E19", E: "\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E14\u0E25\u0E2D\u0E07", F: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" };
const marketplacePanel = $("#channelShopAnalysis .marketplace-panel"), showcaseHeading = $("#channelShopAnalysis .showcase-panel .showcase-heading");
$(".workspace-switch")?.insertAdjacentHTML("afterend",'<section id="analysisChannelPicker" class="analysis-channel-picker" aria-labelledby="analysisChannelPickerTitle"><div><small>ช่องที่กำลังวิเคราะห์</small><h3 id="analysisChannelPickerTitle">เลือกช่องจากรายการที่เชื่อมแล้ว</h3></div><div id="analysisChannelOptions" class="analysis-channel-options" role="listbox" aria-label="เลือกช่องที่ต้องการวิเคราะห์"></div></section>');
$("#channelShopAnalysis .result-head")?.insertAdjacentHTML("afterend", '<section id="shopConnectionRequired" class="shop-connection-required" hidden><b>ช่องนี้ยังไม่ได้เชื่อมระบบ TikTok Shop</b><p>TikTok ใช้ข้อมูลโปรไฟล์และวิดีโอ ส่วนออเดอร์ Marketplace และ Showcase ต้องเชื่อมระบบ TikTok Shop แยกอีกครั้ง</p><button type="button" data-open-shop-settings>ไปหน้า 1 เพื่อเชื่อมระบบ TikTok Shop</button></section>');
$("#shopConnectionRequired [data-open-shop-settings]")?.addEventListener("click", () => {
  setWorkspaceView("input");
  $("#shopConnectionManagement")?.scrollIntoView({ behavior: "smooth", block: "center" });
});
marketplacePanel?.insertAdjacentHTML("beforebegin", '<section id="soldProductsPanel" class="sold-products-panel"><div class="showcase-heading"><div><h3>สินค้าที่ขายได้และออเดอร์</h3><p class="hint">ข้อมูลจริงของช่องที่เลือก เรียงตามจำนวนออเดอร์ในช่วงวันที่กำหนด</p></div><div id="soldProductsControls" class="related-table-controls"></div></div><div id="soldProductsData"><p class="hint">เชื่อม TikTok Shop เพื่อโหลดข้อมูล</p></div></section>');
showcaseHeading?.insertAdjacentHTML("beforeend", '<div id="showcaseTableControls" class="related-table-controls"></div>');
$("#syncTikTokShop")?.remove();
if ($("#showcaseSyncLimitField")) {
  $("#showcaseSyncLimitField").firstChild.textContent = "จำนวนสินค้า Showcase ที่ต้องการโหลด";
  $("#showcaseTableControls").append($("#showcaseSyncLimitField"));
  $("#showcaseTableControls").insertAdjacentHTML("beforeend", '<button id="syncTikTokShowcase" type="button" hidden>โหลดสินค้า Showcase</button>');
}
marketplacePanel?.insertAdjacentHTML("beforebegin", '<section id="marketplaceShopPanel" class="marketplace-panel shop-search-panel"><div class="showcase-heading"><div><h3>ค้นหาสินค้าจากร้านค้า</h3><p class="hint">ค้นหาและดูสินค้าของร้านที่ต้องการ โดยไม่กระทบผลค้นหาสินค้านางฟ้า</p></div></div><form id="marketplaceShopSearchForm" class="marketplace-search-form"><div class="marketplace-search-main"><label>ชื่อร้านค้า<input id="marketplaceShopKeyword" maxlength="300" placeholder="เช่น ชื่อร้านใน TikTok Shop"></label><button class="marketplace-search-button" type="submit">ค้นหาชื่อร้านค้า</button></div></form><div id="marketplaceShopSnapshot" class="marketplace-snapshot" role="status">ยังไม่ได้ค้นหาชื่อร้านค้า</div><div id="marketplaceShopResults"></div><button id="addMarketplaceShopSelected" type="button" hidden>เพิ่มรายการที่เลือกเข้า Showcase</button></section>');
const marketplaceProductButton = $("#marketplaceSearchForm .marketplace-search-main button");
if (marketplaceProductButton) {
  marketplaceProductButton.classList.add("marketplace-search-button");
  marketplaceProductButton.textContent = "ค้นหาสินค้า";
}
function shopDateQuery(channelId = "") {
  const params = new URLSearchParams({ date_from: state.shopDateFrom, date_to: state.shopDateTo });
  if (channelId) params.set("channel_id", channelId);
  return params.toString();
}
function setOutputScope(scope) {
  const channel = scope === "channel";
  document.body.classList.toggle("output-channel", channel);
  document.body.classList.toggle("output-overview", !channel);
}
function setWorkspaceView(view, persist = true) {
  const output = view === "output";
  document.body.classList.toggle("workspace-output", output);
  document.body.classList.toggle("workspace-input", !output);
  $("#showInputView")?.classList.toggle("active", !output);
  $("#showOutputView")?.classList.toggle("active", output);
  $("#showInputView")?.setAttribute("aria-current", output ? "false" : "page");
  $("#showOutputView")?.setAttribute("aria-current", output ? "page" : "false");
  if (persist) saveUiValue("visiond_tiktok_workspace", output ? "output" : "input");
}
async function loadPortfolioDashboard() {
  const [data, commission, referral] = await Promise.all([api(`/api/admin/tiktok-connections?${shopDateQuery()}`), api(`/api/admin/tiktok-commissions?from=${state.shopDateFrom}&to=${state.shopDateTo}`), api('/api/vx/referrals').catch(() => null)]);
  renderShopDashboard({ ...data, shop_products: data.shop_portfolio?.products || [], shop_orders: data.shop_portfolio?.orders || [] }, data.shop_connections?.[0] || null);
  renderAccurateCommission(commission, referral);
}

function renderAccurateCommission(data, referral) {
  const totals = data?.totals || [], channels = data?.channels || [], series = data?.series || [], range = `${data?.from || state.shopDateFrom} ถึง ${data?.to || state.shopDateTo}`;
  state.commissionCards = totals.map(total => ({ owner: state.selected ? (state.channels.find(channel => channel.id === state.selected)?.name || 'ช่องที่เลือก') : 'รวมทุกช่อง', range, total: total.amount, currency: total.currency, channels: channels.filter(channel => channel.currency === total.currency && channel.basis === total.basis), referralUrl: referral?.link || '' }));
  const basisLabel = { actual: 'ยืนยันแล้ว', estimated: 'ประมาณการ', unknown: 'TikTok ไม่ระบุประเภท' };
  $('#shopCommissionDashboard').innerHTML = totals.length ? `<div class="commission-accurate"><div class="commission-total-grid">${totals.map((total, index) => `<article><small>${escapeHtml(basisLabel[total.basis] || total.basis)} · ${escapeHtml(total.currency)}</small><b>${Number(total.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(total.currency)}</b><button type="button" data-share-commission="${index}">สร้างรูปและแชร์</button></article>`).join('')}</div><h3>ค่าคอมแยกตามช่อง</h3><div class="commission-channel-table">${channels.map(channel => `<div><span>${escapeHtml(channel.channel)}<small>${escapeHtml(basisLabel[channel.basis] || channel.basis)}</small></span><b>${Number(channel.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(channel.currency)}</b></div>`).join('')}</div><h3>ค่าคอมรายวัน</h3><div class="commission-daily-table">${series.map(day => `<div><time>${escapeHtml(day.day)}</time><span>${escapeHtml(day.channel)}</span><small>${escapeHtml(basisLabel[day.basis] || day.basis)}</small><b>${Number(day.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(day.currency)}</b></div>`).join('')}</div><p class="hint">${escapeHtml(data.coverage?.note || '')} · ${Number(data.coverage?.orders || 0).toLocaleString()} ออเดอร์ · ซิงก์ล่าสุด ${escapeHtml(data.coverage?.last_synced_at || 'ยังไม่ระบุ')}</p></div>` : '<p class="hint">ยังไม่มีค่าคอมจากออเดอร์ที่ไม่ถูกยกเลิกหรือคืนสินค้าในช่วงนี้</p>';
  if (totals.length) $('#shopCommissionDashboard .commission-accurate')?.insertAdjacentHTML('afterbegin', `<div class="commission-range-actions"><button type="button" data-commission-days="7">7 วัน</button><button type="button" data-commission-days="30">30 วัน</button><span>${escapeHtml(range)}</span></div>`);
}
$("#shopCommissionDashboard").addEventListener("click", async event => {
  const button = event.target.closest('[data-commission-days]');
  if (!button) return;
  const days = Number(button.dataset.commissionDays) || 30;
  state.shopDateTo = commissionAvailability().latestDate; state.shopDateFrom = dateDaysAgo(days - 1);
  button.disabled = true;
  try { if (state.selected) await loadTikTokConnection(); else await loadPortfolioDashboard(); } catch (error) { showToast(error.message, 'error'); }
});
$("#showInputView").addEventListener("click", () => {
  setOutputScope("channel");
  setWorkspaceView("input");
});
$("#showOutputView").addEventListener("click", () => {
  setOutputScope("channel");
  setWorkspaceView("output");
});
setOutputScope("channel");
setWorkspaceView("output", false);
function productMetrics(product, orders) {
  const commission = safeJson(product.commission_json) || {}, sold = orders.reduce((sum, order) => sum + (safeJson(order.product_ids) || []).filter((id) => String(id) === String(product.product_id)).length, 0);
  return { sales: Number(product.sales ?? sold), clicks: Number(product.clicks || 0), conversion: Number(product.conversion || 0), commission: Number(product.commission ?? commission.amount ?? 0) };
}
function productGmv(order, productId) {
  const ids = [...new Set((safeJson(order.product_ids) || []).map(String))], value = safeJson(order.gmv_json) || {}, amount = Number(value.amount);
  if (!ids.includes(String(productId)) || !Number.isFinite(amount)) return 0;
  return amount / Math.max(1, ids.length);
}
function productGmvGrowth(product, orders) {
  const end = Math.floor(Date.parse(`${state.shopDateTo}T00:00:00+07:00`) / 1e3) + 86400, currentStart = end - 7 * 86400, previousStart = end - 14 * 86400;
  let latest = 0, previous = 0, currency = "THB";
  for (const order of orders) {
    const created = Number(order.create_time) || 0, value = safeJson(order.gmv_json) || {}, amount = productGmv(order, product.product_id);
    if (value.currency) currency = value.currency;
    if (created >= currentStart && created < end) latest += amount;
    else if (created >= previousStart && created < currentStart) previous += amount;
  }
  return { latest, previous, currency, growth: previous > 0 ? (latest - previous) / previous * 100 : latest > 0 ? null : 0 };
}
function compactMoney(amount, currency = "THB") {
  return `${Number(amount || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ${escapeHtml(currency)}`;
}
function displayDate(value) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "–");
}
function shopSalesGrade(sales) {
  const sold = Number(sales) || 0;
  return sold >= 30 ? "A" : sold >= 16 ? "B" : sold > 0 ? "C" : "";
}
function soldProductSummaryTable(products, orders) {
  const byId = new Map(products.map((product) => [String(product.product_id), product])), sold = /* @__PURE__ */ new Map();
  for (const order of orders) for (const detail of arrayValue(order.product_details)) {
    const id = String(detail?.product_id || ""), current = byId.get(id);
    if (id && (!current || (!current.name && detail.name))) byId.set(id, { ...current, ...detail, product_id: id, name: detail.name || current?.name || "" });
  }
  orders.forEach((order) => (safeJson(order.product_ids) || []).forEach((id) => {
    const key = String(id), row = sold.get(key) || { count: 0, last: 0 };
    row.count++;
    row.last = Math.max(row.last, Number(order.create_time) || 0);
    sold.set(key, row);
  }));
  const rows = [...sold.entries()].map(([id, metrics]) => ({ product: byId.get(id) || { product_id: id, name: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, ...metrics })).sort((a, b) => b.count - a.count || b.last - a.last);
  if (!rows.length) return '<p class="shop-empty-range">\u0E0A\u0E48\u0E27\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49</p>';
  return `<div class="shop-product-table-wrap"><table class="shop-product-table"><thead><tr><th>\u0E25\u0E33\u0E14\u0E31\u0E1A</th><th>เกรด</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49</th><th>\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</th><th>\u0E02\u0E32\u0E22\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</th><th>ลิงก์สินค้า</th></tr></thead><tbody>${rows.map((row, index) => { const grade = shopSalesGrade(row.count); return `<tr><td>${index + 1}</td><td><span class="type-pill type-${grade}" title="เกรด ${grade} จาก ${row.count.toLocaleString()} ออเดอร์ในช่วงวันที่เลือก">${grade}</span></td><td><b>${escapeHtml(row.product.name || "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32")}</b><small>เกรด ${grade} · คำนวณจาก ${row.count.toLocaleString()} ออเดอร์จริง</small></td><td><code>${escapeHtml(row.product.product_id || "\u2013")}</code></td><td>${row.count.toLocaleString()} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</td><td>${new Date((row.last + 25200) * 1e3).toISOString().slice(0, 10)}</td><td>${productLinkControl(row.product.product_url)}</td></tr>`; }).join("")}</tbody></table></div><div class="shop-grade-note"><b>เกรดจากยอดขายจริงต่อเดือน</b><span>A = 30 ชิ้นขึ้นไป · สินค้าหลัก</span><span>B = 16–29 ชิ้น · สินค้ารอง</span><span>C = 1–15 ชิ้น · สินค้าที่ขายได้เล็กน้อย</span><span>ไม่มีเกรด = 0 ชิ้นในเดือนนี้</span><small>เกรดเปลี่ยนตามข้อมูลยอดขายของแต่ละเดือน ไม่ใช่คะแนนคุณภาพถาวรของสินค้า</small></div>`;
}
function shopRangeSummary(data, products, orders) {
  const range = data.date_range || { from: state.shopDateFrom, to: state.shopDateTo };
  const rangeLabel = `${displayDate(range.from)}–${displayDate(range.to)}`;
  const serverAvailability = data.commission_availability, availability = serverAvailability ? { ready: Boolean(serverAvailability.ready), latestDate: serverAvailability.latest_date } : commissionAvailability(), availabilityText = availability.ready ? `ยอดล่าสุดดูได้ถึง ${availability.latestDate}` : `ยอดวันที่ ${availability.latestDate} กำลังประมวลผล กรุณารอ 12:00 น. เป็นต้นไป`;
  return `<form id="shopDateFilter" class="shop-date-filter"><label>\u0E08\u0E32\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_from" type="date" value="${escapeHtml(range.from)}" max="${availability.latestDate}" required></label><label>\u0E16\u0E36\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_to" type="date" value="${escapeHtml(range.to)}" max="${availability.latestDate}" required></label><button type="submit">แสดงผล</button></form><p class="hint commission-availability-note">${escapeHtml(availabilityText)}</p><div class="shop-range-kpis"><span><small>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49</small><b>${orders.length.toLocaleString()}</b></span></div><h3 class="sold-products-heading">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${escapeHtml(rangeLabel)}</h3>${soldProductSummaryTable(products, orders)}`;
}
function decorateSoldProductSelection(products = []) {
  const table = $("#soldProductsData .shop-product-table");
  if (!table) return;
  const header = table.querySelector("thead tr");
  if (header && !header.querySelector(".sold-selection-heading")) header.insertAdjacentHTML("beforeend", '<th class="sold-selection-heading">ลิสต์คัดสินค้า</th>');
  const productsByName = new Map(products.map((product) => [normalizeProductName(product.name), product]));
  const selectedNames = new Set((state.inventoryProducts || []).filter((product) => product.inventory_status === "kept").map((product) => normalizeProductName(product.name)));
  table.querySelectorAll("tbody tr").forEach((row) => {
    if (row.querySelector("[data-select-sold-product]")) return;
    const name = row.cells[2]?.querySelector("b")?.textContent?.trim() || "";
    const product = productsByName.get(normalizeProductName(name));
    if (!product) {
      row.insertAdjacentHTML("beforeend", '<td><button class="marketplace-row-add marketplace-selection-add" type="button" disabled>ข้อมูลไม่พร้อม</button></td>');
      return;
    }
    const selected = selectedNames.has(normalizeProductName(name));
    const sales = Number((row.cells[4]?.textContent || "").replace(/[^0-9]/g, "")) || 0;
    const grade = shopSalesGrade(sales) || "D";
    row.insertAdjacentHTML("beforeend", `<td><button class="marketplace-row-add marketplace-selection-add" type="button" data-select-sold-product data-product-name="${escapeHtml(product.name)}" data-product-url="${escapeHtml(product.product_url || "")}" data-product-grade="${grade}" data-product-sales="${sales}" data-product-evidence="ยอดขาย 30 วัน ${sales.toLocaleString()} ออเดอร์ · เกรด ${grade}" ${selected ? "disabled" : ""}>${selected ? "อยู่ในลิสต์คัดสินค้าแล้ว" : "เพิ่มเข้าลิสต์คัดสินค้า"}</button></td>`);
  });
}
async function syncSelectedSoldProductGrades() {
  const selectedByName = new Map((state.inventoryProducts || []).filter((product) => product.inventory_status === "kept" && product.source_kind === "sold_product_selection").map((product) => [normalizeProductName(product.name), product]));
  const updates = [...document.querySelectorAll("[data-select-sold-product]")].map((button) => ({ name: button.dataset.productName || "", grade: button.dataset.productGrade || "D", sales: Number(button.dataset.productSales) || 0 })).filter((item) => {
    const current = selectedByName.get(normalizeProductName(item.name));
    return current && current.product_type !== item.grade;
  });
  if (!updates.length) return;
  const data = new FormData();
  data.set("action", "sync_sold_product_grades");
  data.set("channel_id", state.selected);
  data.set("sales_grades", JSON.stringify(updates));
  const synced = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
  if (synced.products) {
    state.inventoryProducts = synced.products;
    renderPermanentInventory(synced.products, synced.product_events || []);
  }
}
function safeProductImage(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function productLinkControl(value) {
  const url = safeProductImage(value);
  return url ? `<button class="copy-product-link" type="button" data-copy-product-link="${escapeHtml(url)}">คัดลอกลิงก์</button>` : '<span class="product-link-missing">ไม่มีลิงก์</span>';
}
function upgradeLegacyProductLinkCells(root) {
  root?.querySelectorAll("td").forEach((cell) => {
    const link = cell.querySelector(':scope > a[target="_blank"][href]');
    const missing = cell.querySelector(":scope > em");
    if (!link && missing?.textContent?.trim() !== "ยังไม่มีลิงก์") return;
    cell.innerHTML = productLinkControl(link?.href || "");
  });
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-product-link]");
  if (!button) return;
  const url = button.dataset.copyProductLink;
  try {
    await navigator.clipboard.writeText(url);
    showToast("คัดลอกลิงก์สินค้าแล้ว");
  } catch {
    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    showToast(copied ? "คัดลอกลิงก์สินค้าแล้ว" : "คัดลอกลิงก์ไม่สำเร็จ", copied ? "success" : "error");
  }
});
function productImageFromRaw(raw) {
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return "";
  }
  const visit = (value, imageContext = false) => {
    if (typeof value === "string") return imageContext ? safeProductImage(value) : "";
    if (!value || typeof value !== "object") return "";
    for (const [key, child] of Object.entries(value)) {
      const found = visit(child, imageContext || /image|cover|thumbnail/i.test(key));
      if (found) return found;
    }
    return "";
  };
  return visit(data);
}
function productNameSimilarity(left, right) {
  const a = normalizeProductName(left), b = normalizeProductName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const compactA = a.replace(/\s+/g, ""), compactB = b.replace(/\s+/g, "");
  if (Math.min(compactA.length, compactB.length) >= 8 && (compactA.includes(compactB) || compactB.includes(compactA))) return Math.min(compactA.length, compactB.length) / Math.max(compactA.length, compactB.length) * .2 + .78;
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 1)), bTokens = new Set(b.split(" ").filter((token) => token.length > 1));
  if (!aTokens.size || !bTokens.size) return 0;
  const shared = [...aTokens].filter((token) => bTokens.has(token)), coverage = shared.length / Math.min(aTokens.size, bTokens.size), numericA = [...aTokens].filter((token) => /^\d/.test(token)), numericB = [...bTokens].filter((token) => /^\d/.test(token));
  if (numericA.length && numericB.length && !numericA.some((token) => numericB.includes(token))) return coverage * .5;
  return coverage;
}
const productIdentityIds = (value) => [...new Set(String(value || "").match(/\b1\d{15,21}\b/g) || [])];
function renderShowcaseProducts(products, orders, demo = false, growthOrders = orders) {
  const orderDetailsById = new Map();
  for (const order of orders) for (const detail of arrayValue(order.product_details)) {
    const id = String(detail?.product_id || ""), current = orderDetailsById.get(id);
    if (id && (!current || (!current.name && detail.name) || (!current.image_url && detail.image_url))) orderDetailsById.set(id, { ...current, ...detail, product_id: id, name: detail.name || current?.name || "", image_url: detail.image_url || current?.image_url || "" });
  }
  products = products.map((product) => {
    const detail = orderDetailsById.get(String(product.product_id));
    return detail ? { ...product, name: product.name || detail.name, image_url: product.image_url || product.raw_image_url || detail.image_url } : product;
  });
  if (!demo) state.showcaseProducts = products.filter((product) => product.product_id);
  const list = $("#shopGradeList");
  const inventory = [];
  for (const candidate of state.inventoryProducts || []) {
    const duplicateIndex = inventory.findIndex((existing) => productNameSimilarity(existing.name, candidate.name) >= .82);
    if (duplicateIndex < 0) inventory.push(candidate);
    else if ((Number(candidate.score) || 0) > (Number(inventory[duplicateIndex].score) || 0)) inventory[duplicateIndex] = candidate;
  }
  if (!products.length && !inventory.length) {
    list.innerHTML = '<p class="hint">ยังไม่มีสินค้าใน Showcase ของช่องนี้</p>';
    return;
  }
  const usedInventory = new Set();
  const findSelection = (product) => {
    let bestIndex = -1, bestScore = 0;
    inventory.forEach((candidate, index) => {
      if (usedInventory.has(index)) return;
      const candidateIds = productIdentityIds(`${candidate.product_url || ""} ${candidate.name || ""} ${candidate.evidence || ""}`), idMatch = product.product_id && candidateIds.includes(String(product.product_id));
      const score = idMatch ? 1 : productNameSimilarity(product.name, candidate.name);
      if (score > bestScore) bestScore = score, bestIndex = index;
    });
    if (bestIndex < 0 || bestScore < .65) return null;
    usedInventory.add(bestIndex);
    return inventory[bestIndex];
  };
  const effectiveGrade = (product) => {
    const sales = productMetrics(product, orders).sales;
    if (!product.analysisOnly) return shopSalesGrade(sales);
    const analyzed = String(product.selection?.product_type || "").toUpperCase();
    if ("ABCDEF".includes(analyzed)) return analyzed;
    return "";
  };
  const gradeRank = (product) => {
    const grade = effectiveGrade(product);
    const index = "ABCDEF".indexOf(grade);
    return index < 0 ? 6 : index;
  };
  const showcaseProducts = products.map((product) => ({ ...product, selection: findSelection(product), analysisOnly: false }));
  const mergedProducts = showcaseProducts.sort((a, b) => {
    return gradeRank(a) - gradeRank(b) || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
  const query = normalizeProductName(state.showcaseSearch);
  const filtered = query ? mergedProducts.filter((product) => normalizeProductName(`${product.name || ""} ${product.product_id || ""}`).includes(query)) : [...mergedProducts];
  const facts = new Map(filtered.map((product) => {
    const metrics = productMetrics(product, orders), gmv = productGmvGrowth(product, growthOrders), selection = product.selection || {}, evidence = String(selection.evidence || ""), evidenceSales = Number(evidence.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)\s*(\d[\d,]*)\s*ชิ้น/i)?.[1]?.replace(/,/g, "")) || 0, evidenceCommission = evidence.match(/(?:คอม(?:มิชชัน)?|commission)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/i)?.[1];
    return [product, { metrics, gmv, selection, evidence, evidenceSales, evidenceCommission }];
  }));
  const columns = {
    grade: filtered.some((product) => product.analysisOnly ? "ABCDEF".includes(String(product.selection?.product_type || "").toUpperCase()) : (facts.get(product).metrics.sales || facts.get(product).evidenceSales) > 0),
    sales: filtered.some((product) => (facts.get(product).metrics.sales || facts.get(product).evidenceSales) > 0),
    commission: filtered.some((product) => facts.get(product).metrics.commission > 0 || Boolean(facts.get(product).evidenceCommission)),
    gmvLatest: filtered.some((product) => !product.analysisOnly && facts.get(product).gmv.latest > 0),
    gmvPrevious: filtered.some((product) => !product.analysisOnly && facts.get(product).gmv.previous > 0),
    growth: filtered.some((product) => !product.analysisOnly && (facts.get(product).gmv.latest > 0 || facts.get(product).gmv.previous > 0)),
    score: filtered.some((product) => facts.get(product).selection.score !== void 0 && facts.get(product).selection.score !== null && facts.get(product).selection.score !== ""),
    reason: filtered.some((product) => Boolean(facts.get(product).evidence) || facts.get(product).metrics.sales > 0)
  };
  const pageSize = 20, pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.showcasePage = Math.min(Math.max(1, state.showcasePage), pageCount);
  const start = (state.showcasePage - 1) * pageSize, pageProducts = filtered.slice(start, start + pageSize);
  const rows = pageProducts.map((product, index) => {
    const { metrics, gmv, selection, evidenceSales, evidenceCommission } = facts.get(product), image = safeProductImage(product.image_url || product.raw_image_url) || productImageFromRaw(product.raw_json), name = escapeHtml(product.name || product.product_id), grade = effectiveGrade(product), gradeLabel = "ABCDEF".includes(grade) ? grade : "–", gradeReason = selection.evidence || (metrics.sales ? `จัดเกรดอัตโนมัติจากยอดขายจริง ${metrics.sales.toLocaleString()} ออเดอร์ในช่วงวันที่เลือก` : ""), growthLabel = gmv.growth === null ? "สินค้าใหม่" : `${gmv.growth > 0 ? "+" : ""}${gmv.growth.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`, growthClass = gmv.growth === null ? "new" : gmv.growth > 0 ? "up" : gmv.growth < 0 ? "down" : "flat";
    const picture = image ? `<img class="showcase-product-image" src="${escapeHtml(image)}" alt="รูป ${name}" loading="lazy">` : '<span class="showcase-product-image placeholder" aria-label="ไม่มีรูปสินค้า">ไม่มีรูป</span>';
    const title = `<b>${name}</b>`;
    const removeAction = !demo && !product.analysisOnly && product.product_id ? `<button class="remove-showcase-item" type="button" data-product-id="${escapeHtml(product.product_id)}" data-product-name="${name}" aria-label="ลบ ${name} ออกจาก Showcase">ลบรายการนี้</button>` : "–";
    return `<tr data-product-id="${escapeHtml(product.product_id)}">${columns.grade ? `<td><span class="type-pill type-${escapeHtml(grade || "unknown")}" title="${grade ? `เกรด ${escapeHtml(grade)}` : "ยังไม่มีข้อมูลเพียงพอสำหรับจัดเกรด"}">${escapeHtml(gradeLabel)}</span></td>` : ""}<td><div class="showcase-product-cell">${picture}<div>${title}<small>${demo ? "ข้อมูลสาธิต" : shopProductLabel(product, orders)}</small><code>${escapeHtml(product.product_id || "ไม่มีรหัสสินค้าในรายงาน")}</code></div></div></td>${columns.sales ? `<td>${(metrics.sales || evidenceSales) ? (metrics.sales || evidenceSales).toLocaleString() : "–"}</td>` : ""}${columns.commission ? `<td>${metrics.commission ? money(metrics.commission) : evidenceCommission ? `${escapeHtml(evidenceCommission)}%` : "–"}</td>` : ""}${columns.gmvLatest ? `<td class="gmv-cell">${product.analysisOnly ? "–" : compactMoney(gmv.latest, gmv.currency)}</td>` : ""}${columns.gmvPrevious ? `<td class="gmv-cell">${product.analysisOnly ? "–" : compactMoney(gmv.previous, gmv.currency)}</td>` : ""}${columns.growth ? `<td>${product.analysisOnly ? "–" : `<span class="gmv-growth ${growthClass}">${growthLabel}</span>`}</td>` : ""}${columns.score ? `<td>${selection.score !== void 0 ? `${Number(selection.score) || 0}/100` : "–"}</td>` : ""}${columns.reason ? `<td class="showcase-reason">${escapeHtml(gradeReason || "–")}</td>` : ""}<td class="showcase-row-action">${removeAction}</td></tr>`;
  }).join("");
  const columnCount = 2 + Object.values(columns).filter(Boolean).length, headers = `${columns.grade ? "<th>เกรด</th>" : ""}<th>รูปและสินค้า</th>${columns.sales ? "<th>ขายได้</th>" : ""}${columns.commission ? "<th>ค่าคอม</th>" : ""}${columns.gmvLatest ? "<th>GMV 7 วัน</th>" : ""}${columns.gmvPrevious ? "<th>GMV 7 วันก่อน</th>" : ""}${columns.growth ? "<th>เติบโต</th>" : ""}${columns.score ? "<th>คะแนน</th>" : ""}${columns.reason ? "<th>เหตุผลล่าสุด</th>" : ""}<th>จัดการ</th>`, gmvNote = columns.gmvLatest || columns.gmvPrevious || columns.growth ? `<p class="gmv-note">GMV เทียบ 7 วันล่าสุดกับ 7 วันก่อนหน้า สิ้นสุดวันที่ ${escapeHtml(state.shopDateTo)} · คำนวณจากรายงานออเดอร์</p>` : "";
  list.innerHTML = `<div class="showcase-tools"><label>ค้นหาสินค้า<input id="showcaseSearch" type="search" value="${escapeHtml(state.showcaseSearch)}" placeholder="พิมพ์ชื่อหรือรหัสสินค้า"></label><span>พบ ${filtered.length.toLocaleString()} จาก ${mergedProducts.length.toLocaleString()} รายการ</span></div>${gmvNote}<div class="showcase-table-wrap"><table class="showcase-table"><thead><tr>${headers}</tr></thead><tbody>${rows || `<tr><td colspan="${columnCount}" class="showcase-empty-search">ไม่พบสินค้าที่ค้นหา</td></tr>`}</tbody></table></div><nav class="showcase-pagination" aria-label="แบ่งหน้ารายการสินค้า"><button id="showcasePrev" type="button" ${state.showcasePage === 1 ? "disabled" : ""}>ก่อนหน้า</button><b>หน้า ${state.showcasePage.toLocaleString()} / ${pageCount.toLocaleString()}</b><button id="showcaseNext" type="button" ${state.showcasePage === pageCount ? "disabled" : ""}>ถัดไป</button><small>หน้าละ 20 รายการ</small></nav>`;
  $("#showcaseSearch").addEventListener("input", (event) => {
    state.showcaseSearch = event.target.value;
    state.showcasePage = 1;
    renderShowcaseProducts(products, orders, demo, growthOrders);
    $("#showcaseSearch").focus();
  });
  $("#showcasePrev").addEventListener("click", () => {
    state.showcasePage--;
    renderShowcaseProducts(products, orders, demo, growthOrders);
  });
  $("#showcaseNext").addEventListener("click", () => {
    state.showcasePage++;
    renderShowcaseProducts(products, orders, demo, growthOrders);
  });
  list.onclick = (event) => {
    const button = event.target.closest(".remove-showcase-item");
    if (!button) return;
    return removeShowcaseProducts([button.dataset.productId], `ลบสินค้า “${button.dataset.productName || button.dataset.productId}”`);
  };
}
function marketplacePrice(value) {
  if (!value || typeof value !== "object") return "–";
  const minimum = value.minimum_amount ?? value.amount, maximum = value.maximum_amount, currency = value.currency || "";
  if (minimum === void 0 || minimum === "") return "–";
  return `${escapeHtml(currency)} ${Number(minimum).toLocaleString("th-TH")}${maximum && String(maximum) !== String(minimum) ? `–${Number(maximum).toLocaleString("th-TH")}` : ""}`.trim();
}
function renderMarketplaceCategories(categories = []) {
  const select = $("#marketplaceCategory"), selected = select.value, merged = new Map(state.marketplaceCategories.map(category => [String(category.id), category]));
  for (const category of categories) {
    const id = String(category?.id || "").trim(), name = String(category?.name || "").trim();
    if (id && name) merged.set(id, { id, name });
  }
  state.marketplaceCategories = [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "th"));
  select.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + state.marketplaceCategories.map(category => '<option value="' + escapeHtml(category.id) + '"' + (category.id === selected ? " selected" : "") + '>' + escapeHtml(category.name) + ' · รหัส ' + escapeHtml(category.id) + '</option>').join("");
}
async function loadMarketplaceCategories() {
  const connection = state.shopConnection, select = $("#marketplaceCategory");
  if (!connection?.capabilities?.can_search_marketplace || state.marketplaceCategoriesLoadingForConnection === connection.id) return;
  if (state.marketplaceCategoriesForConnection === connection.id && state.marketplaceCategories.length) return;
  state.marketplaceCategoriesLoadingForConnection = connection.id;
  select.disabled = true;
  select.innerHTML = '<option value="">กำลังโหลดหมวดหมู่จาก TikTok…</option>';
  try {
    const data = await api("/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id, channel_id: state.selected, categories_only: true }) });
    if (state.shopConnection?.id !== connection.id) return;
    state.marketplaceCategoriesForConnection = connection.id;
    renderMarketplaceCategories(data.categories || []);
    select.title = data.categories?.length ? `พบ ${data.categories.length} หมวดหมู่จากรหัสที่ TikTok ส่งมา` : "ยังไม่มีรหัสหมวดหมู่จากข้อมูล TikTok ที่เคยค้นหา";
  } catch (error) {
    if (state.shopConnection?.id === connection.id) {
      renderMarketplaceCategories();
      select.title = `โหลดหมวดหมู่ไม่สำเร็จ: ${error.message}`;
    }
  } finally {
    if (state.marketplaceCategoriesLoadingForConnection === connection.id) state.marketplaceCategoriesLoadingForConnection = "";
    if (state.shopConnection?.id === connection.id) select.disabled = false;
  }
}
function resetMarketplaceView() {
  state.marketplaceProducts = [];
  state.marketplaceCategories = [];
  state.marketplaceCategoriesForConnection = "";
  state.marketplaceCategoriesLoadingForConnection = "";
  state.marketplaceNextToken = "";
  state.marketplaceSearchedAt = "";
  state.shopMarketplaceProducts = [];
  state.shopMarketplaceNextToken = "";
  state.shopMarketplaceSearchedAt = "";
  renderMarketplaceCategories();
  renderMarketplaceProducts();
  renderMarketplaceProducts(null, "shop");
}
function renderShowcasePermission() {
  let box = $("#showcasePermission");
  if (!box) {
    $("#shopConnectionManagement>strong").insertAdjacentHTML("afterend", '<div id="showcasePermission" class="showcase-permission" hidden></div>');
    box = $("#showcasePermission");
  }
  const connection = state.shopConnection, capabilities = connection?.capabilities || {}, ready = Boolean(capabilities.showcase_ready), account = connection?.creator_username || connection?.open_id || "บัญชี Creator";
  box.hidden = !connection || ready;
  box.innerHTML = !connection || ready ? "" : `<b>เชื่อมบัญชี ${escapeHtml(account)} แล้ว แต่สิทธิ์เพิ่มสินค้าเข้า Showcase ยังไม่ครบ</b><span>ข้อมูลที่ได้รับอนุญาตยังใช้งานได้ตามปกติ · สิทธิ์ที่ขาด: ${escapeHtml((capabilities.missing_scopes || []).join(", ") || "creator.showcase.write หรือ creator.video.write")}</span>`;
  const searchButtons = document.querySelectorAll("#marketplaceSearchForm .marketplace-search-button, #marketplaceShopSearchForm .marketplace-search-button"), addButtons = [$("#addMarketplaceSelected"), $("#addMarketplaceShopSelected")];
  searchButtons.forEach(button => button.disabled = Boolean(connection) && !capabilities.can_search_marketplace);
  addButtons.filter(Boolean).forEach((addButton) => {
    addButton.setAttribute("aria-disabled", capabilities.can_write_showcase ? "false" : "true");
    addButton.title = capabilities.can_write_showcase ? "" : "กดเพื่อดูวิธีเปิดสิทธิ์เพิ่มสินค้าเข้า Showcase";
  });
}
function marketplaceView(mode = "product") {
  const shop = mode === "shop";
  return { mode, form: $(shop ? "#marketplaceShopSearchForm" : "#marketplaceSearchForm"), box: $(shop ? "#marketplaceShopResults" : "#marketplaceResults"), addButton: $(shop ? "#addMarketplaceShopSelected" : "#addMarketplaceSelected"), snapshot: $(shop ? "#marketplaceShopSnapshot" : "#marketplaceSnapshot"), products: state[shop ? "shopMarketplaceProducts" : "marketplaceProducts"], nextToken: state[shop ? "shopMarketplaceNextToken" : "marketplaceNextToken"], searchedAt: state[shop ? "shopMarketplaceSearchedAt" : "marketplaceSearchedAt"], comparisonDays: state[shop ? "shopMarketplaceComparisonDays" : "marketplaceComparisonDays"] };
}
function renderMarketplaceProducts(data = null, mode = "product") {
  const view = marketplaceView(mode), { box, addButton, snapshot, products } = view;
  if (!data) {
    box.innerHTML = "";
    addButton.hidden = true;
    snapshot.textContent = mode === "shop" ? "ยังไม่ได้ค้นหาชื่อร้านค้า" : "ยังไม่ได้ค้นหา — การค้นหาครั้งแรกจะสร้าง snapshot เพื่อใช้เทียบการเติบโตในครั้งถัดไป";
    return;
  }
  const time = view.searchedAt ? new Date(view.searchedAt).toLocaleString("th-TH") : "ขณะนี้", firstCount = products.filter((product) => product.previous_snapshot_at === null || product.previous_snapshot_at === void 0).length;
  snapshot.textContent = mode === "shop" ? `ข้อมูลสินค้าจาก TikTok เวลา ${time} · พบ ${products.length.toLocaleString()} รายการ` : `Snapshot จาก TikTok เวลา ${time} · พบ ${products.length.toLocaleString()} รายการ · เทียบยอดกับ snapshot ย้อนหลัง ${view.comparisonDays} วัน${firstCount ? ` · ${firstCount.toLocaleString()} รายการเป็น snapshot แรก จึงยังไม่มีอัตราเติบโต` : ""}`;
  const rows = products.map((product) => {
    const image = safeProductImage(product.image_url), name = escapeHtml(product.name || product.product_id), link = safeProductImage(product.product_url), growth = product.growth || {}, growthText = growth.growth_percent === null || growth.growth_percent === void 0 ? "Snapshot แรก" : `${Number(growth.growth_percent) > 0 ? "+" : ""}${Number(growth.growth_percent).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`, growthClass = growth.growth_percent === null || growth.growth_percent === void 0 ? "new" : Number(growth.growth_percent) > 0 ? "up" : Number(growth.growth_percent) < 0 ? "down" : "flat";
    const picture = image ? `<img class="showcase-product-image" src="${escapeHtml(image)}" alt="รูป ${name}" loading="lazy">` : '<span class="showcase-product-image placeholder">ไม่มีรูป</span>', title = link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"><b>${name}</b></a>` : `<b>${name}</b>`;
    const contentCreators = product.content_creator_count, showcaseCreators = product.showcase_creator_count, creatorDensity = contentCreators === null || contentCreators === void 0 ? showcaseCreators === null || showcaseCreators === void 0 ? '<span class="creator-density unavailable">ไม่มีข้อมูลจาก API</span>' : `<span class="creator-density"><b>${Number(showcaseCreators).toLocaleString()}</b><small>เก็บใน Showcase</small></span>` : `<span class="creator-density"><b>${Number(contentCreators).toLocaleString()}</b><small>ทำคอนเทนต์${showcaseCreators === null || showcaseCreators === void 0 ? "" : ` · ${Number(showcaseCreators).toLocaleString()} เก็บ Showcase`}</small></span>`;
    const actions = `<td>${productLinkControl(product.product_url)}</td><td><button class="marketplace-row-add" type="button" data-add-marketplace-product="${escapeHtml(product.product_id)}">เพิ่มเข้า Showcase</button></td><td><button class="marketplace-row-add marketplace-selection-add" type="button" data-select-marketplace-product="${escapeHtml(product.product_id)}">เพิ่มเข้าลิสต์คัดสินค้า</button></td>`;
    return mode === "shop" ? `<tr data-marketplace-product-id="${escapeHtml(product.product_id)}"><td><input class="marketplace-product-check" type="checkbox" aria-label="เลือก ${name}"></td><td><div class="showcase-product-cell">${picture}<div>${title}<code>${escapeHtml(product.product_id)}</code></div></div></td><td>${escapeHtml(product.shop_name || "–")}</td><td>${Number(product.units_sold || 0).toLocaleString()}</td><td>${Number(product.commission_rate || 0) ? `${(Number(product.commission_rate) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : "–"}</td><td>${escapeHtml(product.category_name||product.category_id||"–")}</td>${actions}</tr>` : `<tr data-marketplace-product-id="${escapeHtml(product.product_id)}"><td><input class="marketplace-product-check" type="checkbox" aria-label="เลือก ${name}"></td><td><div class="showcase-product-cell">${picture}<div>${title}<code>${escapeHtml(product.product_id)}</code></div></div></td><td>${escapeHtml(product.shop_name || "–")}</td><td>${Number(product.units_sold || 0).toLocaleString()}</td><td>${Number(product.commission_rate || 0) ? `${(Number(product.commission_rate) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : "–"}</td><td>${creatorDensity}</td><td><span class="gmv-growth ${growthClass}">${growthText}</span></td>${actions}</tr>`;
  }).join("");
  const nextId = mode === "shop" ? "marketplaceShopNext" : "marketplaceNext";
  const headers=mode==="shop"?"<th>เลือก</th><th>รูปและสินค้า</th><th>ร้านค้า</th><th>ขายแล้ว</th><th>ค่าคอม</th><th>หมวดหมู่</th><th>ลิงก์สินค้า</th><th>Showcase</th><th>ลิสต์คัดสินค้า</th>":`<th>เลือก</th><th>สินค้า Open Collaboration</th><th>ร้านค้า</th><th>ขายแล้ว</th><th>ค่าคอม</th><th>ความหนาแน่นครีเอเตอร์</th><th>เติบโต ${view.comparisonDays} วัน</th><th>ลิงก์สินค้า</th><th>Showcase</th><th>ลิสต์คัดสินค้า</th>`;
  const columnCount = mode === "shop" ? 9 : 10;
  box.innerHTML = `<div class="showcase-table-wrap"><table class="showcase-table marketplace-table"><thead><tr>${headers}</tr></thead><tbody>${rows || `<tr><td colspan="${columnCount}" class="showcase-empty-search">ไม่พบสินค้าตามคำค้นนี้</td></tr>`}</tbody></table></div>${view.nextToken ? `<div class="showcase-pagination"><button id="${nextId}" type="button">ดูหน้าถัดไป</button><small>TikTok ส่งข้อมูลหน้าละไม่เกิน 20 รายการ ระบบรวมให้ตามจำนวนที่เลือก</small></div>` : ""}`;
  const account = state.shopConnection?.creator_username || state.shopConnection?.open_id || "บัญชี Creator";
  addButton.textContent = `เพิ่มรายการที่เลือกเข้า Showcase ของ ${account}`;
  addButton.hidden = !products.length;
  addButton.disabled = true;
  box.querySelectorAll(".marketplace-product-check").forEach((input) => input.addEventListener("change", () => {
    const selected = Boolean(box.querySelector(".marketplace-product-check:checked"));
    addButton.disabled = !selected;
    addButton.textContent = `เพิ่มรายการที่เลือกเข้า Showcase ของ ${account}`;
  }));
  box.querySelectorAll("[data-add-marketplace-product]").forEach((button) => button.addEventListener("click", () => addProductsToShowcase([button.dataset.addMarketplaceProduct], button, mode)));
  box.querySelectorAll("[data-select-marketplace-product]").forEach((button) => button.addEventListener("click", () => addMarketplaceProductToSelection(button.dataset.selectMarketplaceProduct, button, mode)));
  $(`#${nextId}`)?.addEventListener("click", () => searchMarketplace(mode, view.nextToken));
}
async function searchMarketplace(mode = "product", pageToken = "") {
  if (mode !== "product" && mode !== "shop") {
    pageToken = mode;
    mode = "product";
  }
  const requestedChannelId = state.selected;
  let shopConnection = state.shopConnection && String(state.shopConnection.channel_id) === String(state.selected) ? state.shopConnection : null;
  if (!shopConnection && requestedChannelId) shopConnection = await loadTikTokConnection(requestedChannelId);
  if (requestedChannelId !== state.selected) throw new Error("เปลี่ยนช่องแล้ว กรุณากดค้นหาอีกครั้ง");
  if (!shopConnection) throw new Error("กรุณาเชื่อม TikTok Shop ก่อนค้นหา Marketplace");
  const view = marketplaceView(mode), buttons = view.form.querySelectorAll(".marketplace-search-button"), nextButton = $(mode === "shop" ? "#marketplaceShopNext" : "#marketplaceNext"), shopMode = mode === "shop";
  buttons.forEach(button => button.disabled = true);
  if (nextButton) nextButton.disabled = true;
  try {
    const data = await api("/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(shopMode ? { connection_id: shopConnection.id, channel_id: requestedChannelId, keyword: "", shop_keyword: $("#marketplaceShopKeyword").value.trim(), sort_field: "units_sold", sort_order: "DESC", result_limit: 20, page_token: pageToken } : { connection_id: shopConnection.id, channel_id: requestedChannelId, keyword: $("#marketplaceKeyword").value.trim(), shop_keyword: "", sort_field: $("#marketplaceSort").value, sort_order: $("#marketplaceOrder").value, result_limit: Number($("#marketplaceLimit").value) || 20, page_token: pageToken, price_min: $("#marketplacePriceMin").value, price_max: $("#marketplacePriceMax").value, category_id: $("#marketplaceCategory").value.trim(), commission_percent_min: $("#marketplaceCommissionMin").value, commission_percent_max: $("#marketplaceCommissionMax").value, comparison_days: Number($("#marketplaceComparisonDays").value) || 3 }) });
    const prefix = shopMode ? "shopMarketplace" : "marketplace";
    state[`${prefix}Products`] = data.products || [];
    state[`${prefix}NextToken`] = data.next_page_token || "";
    state[`${prefix}SearchedAt`] = new Date().toISOString();
    state[`${prefix}ComparisonDays`] = Number(data.comparison_days) || 7;
    if (!shopMode) renderMarketplaceCategories(data.categories || []);
    renderMarketplaceProducts(data, mode);
  } finally {
    buttons.forEach(button => button.disabled = false);
    if (nextButton) nextButton.disabled = false;
  }
}
function renderShopDashboard(data, shopConnection) {
  const box = $("#shopDashboard"), portfolio = data.shop_portfolio || {}, commissions = portfolio.commission || [], products = data.shop_products || [], orders = data.shop_orders || [];
  box.hidden = !shopConnection && !commissions.length;
  if (box.hidden) return;
  const commission = commissions[0], daily = commission?.daily || [], maxDaily = Math.max(1, ...daily.map((day) => Number(day.amount) || 0)), total = Number(commission?.total ?? commission?.total_30) || 0, channels = commission?.channels || [];
  state.lastCommissionCard = commission ? { owner: state.selected ? (state.channels.find((channel) => channel.id === state.selected)?.name || "ช่องที่เลือก") : "รวมทุกช่อง", range: `${data.date_range?.from || state.shopDateFrom} ถึง ${data.date_range?.to || state.shopDateTo}`, total, currency: commission.currency || "THB", channels, referralUrl: data.vx_referral?.url || "" } : null;
  $("#shopCommissionDashboard").innerHTML = commission ? `<div class="commission-summary"><div class="commission-kpis"><article><small>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19</small><b>${money(total)}</b><span class="positive">\u25B2 ${Number(commission.growth || 0).toLocaleString()}% \u0E08\u0E32\u0E01\u0E23\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19</span></article><article><small>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19 Showcase</small><b>${products.length.toLocaleString()}</b><span>\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49</span></article></div><div class="commission-visual"><section><h3>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19</h3><div class="commission-bars">${daily.slice(-30).map((day) => `<div title="${escapeHtml(day.date)} ${money(day.amount)}"><i style="height:${Math.max(8, Math.round(Number(day.amount) / maxDaily * 100))}%"></i><small>${escapeHtml(day.date)}</small></div>`).join("")}</div></section><aside><h3>\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</h3>${channels.map((channel) => `<div class="channel-share"><span>${escapeHtml(channel.channel)}</span><i><b style="width:${Math.max(5, Number(channel.amount) / Math.max(1, ...channels.map((x) => Number(x.amount))) * 100)}%"></b></i><strong>${money(channel.amount)}</strong></div>`).join("")}</aside></div></div>` : '<p class="hint">TikTok \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E22\u0E2D\u0E14\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E32 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E43\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</p>';
  if (commission) $("#shopCommissionDashboard .commission-summary")?.insertAdjacentHTML("afterbegin", '<div class="commission-share-actions"><button type="button" data-share-commission>สร้างรูปและแชร์สรุปค่าคอม</button></div>');
  renderShowcaseProducts(products, orders, false, data.shop_growth_orders || orders);
}
const renderLiveShopDashboard = renderShopDashboard;
renderShopDashboard = function(data, shopConnection) {
  const commission = data?.shop_portfolio?.commission || [];
  if (!shopConnection && !commission.length) {
    $("#shopDashboard").hidden = true;
    $("#shopCommissionDashboard").innerHTML = "";
    $("#shopGradeList").innerHTML = "";
    return;
  }
  renderLiveShopDashboard(data, shopConnection);
  const range = data.date_range || { from: state.shopDateFrom, to: state.shopDateTo }, rangeText = `${range.from} \u0E16\u0E36\u0E07 ${range.to}`;
  $("#shopDashboard .result-head>b").textContent = rangeText;
  shopHeader.querySelector(".source-caption").textContent = `\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07 ${rangeText}`;
  const totalLabel = document.querySelector("#shopCommissionDashboard .commission-kpis article:nth-child(1) small");
  if (totalLabel) totalLabel.textContent = "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01";
};
async function api(url, options) {
  const response = await fetch(url, options), body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body.code ? ` (${body.code})` : "";
    const error = new Error(`${body.error || `HTTP ${response.status}`}${reason}`);
    error.detail = body.detail || "";
    error.requestId = body.request_id || "";
    error.reconnectRequired = Boolean(body.reconnect_required);
    throw error;
  }
  return body;
}
function marketplaceErrorMessage(error) {
  const detail = String(error?.detail || "").trim(), requestId = String(error?.requestId || "").trim();
  return `${error?.message || "ค้นหาไม่สำเร็จ"}${detail && !String(error?.message || "").includes(detail) ? ` · TikTok: ${detail}` : ""}${requestId ? ` · Request ID: ${requestId}` : ""}`;
}
function revealMarketplaceReconnect(error) {
  if (!error?.reconnectRequired || !state.selected) return;
  const link = $("#connectTikTokShop");
  link.hidden = false;
  link.href = `/api/tiktok-shop/connect?channel_id=${encodeURIComponent(state.selected)}`;
  link.textContent = "ต่อสิทธิ์ Marketplace ใหม่";
}
$("#shopCommissionDashboard").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-share-commission]");
  if (!button) return;
  const card = state.commissionCards?.[Number(button.dataset.shareCommission)] || state.lastCommissionCard;
  if (!card) return showToast("ยังไม่มีข้อมูลค่าคอมสำหรับสร้างรูป", "warning");
  try {
    if (!window.VisionDCommissionCard) throw new Error("เครื่องมือสร้างรูปยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง");
    const result = await window.VisionDCommissionCard.shareCommissionCard(card);
    showToast(result === "shared" ? "เปิดหน้าต่างแชร์แล้ว" : "ดาวน์โหลดรูปสรุปค่าคอมแล้ว");
  } catch (error) {
    if (error?.name !== "AbortError") showToast(error.message || "แชร์รูปไม่สำเร็จ", "error");
  }
});
async function loadChannels() {
  try {
    const data = await api("/api/admin/tiktok-analyzer");
    state.channels = data.channels || [];
    const aiState = $("#aiState");
    if (aiState) aiState.textContent = data.provider_configured ? "AI \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C" : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 AI";
    const selectedExists = state.channels.some((channel) => String(channel.id) === String(state.selected));
    if (!selectedExists) state.selected = state.channels.find((channel) => channel.follower_count !== null && channel.follower_count !== void 0)?.id || state.channels[0]?.id || null;
    renderChannels();
    if (state.selected) await selectChannel(state.selected).catch((error) => showToast(error.message || "โหลดข้อมูลช่องไม่สำเร็จ", "error"));
  } catch (error) {
    $("#channels").innerHTML = `<p class="shop-error">${escapeHtml(error.message || "โหลดช่องไม่สำเร็จ")}</p>`;
  }
}
function renderChannels() {
  $("#channels").innerHTML = state.channels.length ? state.channels.map((x) => `<div class="channel-card ${x.id === state.selected ? "active" : ""}" role="option" aria-selected="${x.id === state.selected}"><button class="channel" data-id="${escapeHtml(x.id)}">${x.avatar_url ? `<img class="channel-card-avatar" src="${escapeHtml(x.avatar_url)}" alt="">` : ""}<span><b>${escapeHtml(x.name)}</b><small>${x.follower_count === null || x.follower_count === void 0 ? "ยังไม่เชื่อม TikTok" : `${Number(x.follower_count).toLocaleString()} ผู้ติดตาม · ${Number(x.likes_count).toLocaleString()} ไลก์ · ${Number(x.video_count).toLocaleString()} วิดีโอ`} · วิเคราะห์ ${x.analysis_count} รอบ</small></span></button><button class="delete-channel" type="button" data-delete-id="${escapeHtml(x.id)}" data-delete-name="${escapeHtml(x.name)}" aria-label="ลบช่อง ${escapeHtml(x.name)}">ลบ</button></div>`).join("") : '<p class="hint">ยังไม่มีช่อง กด “ช่องใหม่” แล้วเริ่มช่องแรกได้เลย</p>';
  renderAnalysisChannelPicker();
}
function renderAnalysisChannelPicker(){
  const box=$("#analysisChannelOptions"),connected=state.channels.filter(channel=>channel.follower_count!==null&&channel.follower_count!==void 0);
  if(!box)return;
  box.innerHTML=connected.length?connected.map(channel=>`<button type="button" class="analysis-channel-option ${channel.id===state.selected?"active":""}" data-analysis-channel="${escapeHtml(channel.id)}" role="option" aria-selected="${channel.id===state.selected}">${channel.avatar_url?`<img src="${escapeHtml(channel.avatar_url)}" alt="">`:""}<span><b>${escapeHtml(channel.name)}</b><small>${channel.id===state.selected?"กำลังดูช่องนี้":"เลือกดูช่องนี้"}</small></span></button>`).join(""):'<p class="hint">ยังไม่มีช่องที่เชื่อม TikTok กรุณาเชื่อมจากหน้า 1 ก่อน</p>';
}
$("#analysisChannelOptions")?.addEventListener("click",async event=>{const button=event.target.closest("[data-analysis-channel]");if(!button||button.dataset.analysisChannel===state.selected)return;setOutputScope("channel");setWorkspaceView("output");await selectChannel(button.dataset.analysisChannel)});
async function selectChannel(id) {
  state.selected = id;
  form.classList.add("existing-channel");
  renderChannels();
  const data = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(id)}`), channel = data.channel, products = data.products || [];
  form.channel_id.value = channel.id;
  form.channel_name.value = channel.name;
  form.channel_url.value = channel.channel_url || "";
  form.strategy.value = channel.direction || "";
  if ($("#channelMode")) $("#channelMode").textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49";
  if ($("#formHeading")) $("#formHeading").textContent = channel.name;
  $("#angelInventory").hidden = false;
  $("#angelCount").textContent = `${products.length} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32`;
  $("#angelProducts").innerHTML = products.length ? ["A", "B", "C", "D", "E", "F", ""].map((type) => {
    const rows = products.filter((product) => (product.product_type || "") === type);
    return `<section class="product-group type-${type}"><h3><span>${type || "–"}</span>${type ? typeLabels[type] : "ไม่มีเกรด"} <small>${rows.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows.length ? `<div class="product-table-wrap"><table class="product-table"><thead><tr><th>\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E15\u0E47\u0E21</th><th>\u0E40\u0E1E\u0E28\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 / \u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25</th><th>\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th></tr></thead><tbody>${rows.map((product) => `<tr><td class="product-full-name">${escapeHtml(product.name)}</td><td>${escapeHtml(product.customer_gender || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td>${escapeHtml(product.customer_age_range || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td class="score-cell">${Number(product.score) || 0}/100</td><td>${escapeHtml(product.evidence || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21")}</td><td>${product.product_url ? `<a href="${escapeHtml(product.product_url)}" target="_blank" rel="noopener noreferrer">\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u2197</a>` : "<em>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C</em>"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19\u0E41\u0E19\u0E27\u0E19\u0E35\u0E49</p>'}</section>`;
  }).join("") : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A\u2013F \u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49</p>';
  upgradeLegacyProductLinkCells($("#angelProducts"));
  if (data.runs[0]) renderResult(data.runs[0].result);
}
function newChannel() {
  state.selected = null;
  form.classList.remove("existing-channel");
  form.reset();
  form.channel_id.value = "";
  if ($("#channelMode")) $("#channelMode").textContent = "\u0E0A\u0E48\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48";
  if ($("#formHeading")) $("#formHeading").textContent = "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0A\u0E48\u0E2D\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35";
  $("#angelInventory").hidden = true;
  $("#result").hidden = true;
  if ($("#previews")) $("#previews").innerHTML = "";
  renderChannels();
}
function list(values, render) {
  return Array.isArray(values) && values.length ? values.map(render).join("") : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E2D</p>';
}
function resultProductTable(rows = [], scoreKey = "score") {
  return Array.isArray(rows) && rows.length ? `<div class="product-table-wrap"><table class="product-table"><thead><tr><th>\u0E40\u0E01\u0E23\u0E14</th><th>\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E15\u0E47\u0E21</th><th>\u0E40\u0E1E\u0E28\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 / \u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25</th><th>\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th></tr></thead><tbody>${rows.map((x) => {
    const evidence = x.evidence || textValue(x.reasons) || x.decision || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", score = Number(x[scoreKey]) || 0, grade = String(x.product_type || "").toUpperCase(), gradeLabel = /^[A-F]$/.test(grade) ? grade : "ไม่มีเกรด";
    return `<tr><td><span class="type-pill type-${escapeHtml(grade || "unknown")}">${escapeHtml(gradeLabel)}</span></td><td class="product-full-name">${escapeHtml(x.name)}</td><td>${escapeHtml(x.customer_gender || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td>${escapeHtml(x.customer_age_range || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td class="score-cell">${score}/100</td><td>${escapeHtml(evidence)}</td><td>${x.product_url ? `<a href="${escapeHtml(x.product_url)}" target="_blank" rel="noopener noreferrer">\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u2197</a>` : "<em>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C</em>"}</td><td><div class="inventory-actions"><button type="button" data-inventory="kept" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score}" data-product-evidence="${escapeHtml(evidence)}">\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49</button><button type="button" class="danger" data-inventory="discarded" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score}" data-product-evidence="${escapeHtml(evidence)}">\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01</button></div></td></tr>`;
  }).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E2D</p>';
}
function renderResult(result = {}) {
  $("#result").hidden = false;
  $('[data-field="summary"]').textContent = result.summary || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E23\u0E38\u0E1B";
  if (!$("#gradeMeaningNote")) $('[data-field="summary"]').insertAdjacentHTML("afterend", '<p id="gradeMeaningNote" class="marketplace-shop-search-note"><b>แยกให้ชัด:</b> F = สินค้าที่กดคัดออกหรือกดไม่ผ่านแล้ว · ไม่มีเกรด = ยอดขาย 0 หรือข้อมูลยังไม่พอ</p>');
  $('[data-list="winners"]').innerHTML = resultProductTable(result.winner_products, "score");
  const d = result.channel_direction || {};
  $('[data-field="direction"]').innerHTML = `<b>${escapeHtml(d.recommended || "\u0E22\u0E31\u0E07\u0E2A\u0E23\u0E38\u0E1B\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</b>${list(arrayValue(d.reasons), (x) => `<p>\u2022 ${escapeHtml(x)}</p>`)}`;
  $('[data-list="candidates"]').innerHTML = resultProductTable(result.next_product_candidates, "fit_score");
  upgradeLegacyProductLinkCells($("#result"));
  const rawDailyProducts = Array.isArray(result.daily_product_list) ? result.daily_product_list : result.posting_plan || [], seenProductNames = /* @__PURE__ */ new Set(), dailyProducts = rawDailyProducts.filter((item) => {
    const name = normalizeProductName(typeof item === "string" ? item : item?.product_identity || item?.product || "");
    if (!name || seenProductNames.has(name)) return false;
    seenProductNames.add(name);
    return true;
  }).slice(0, 40), knownProducts = [...result.winner_products || [], ...result.next_product_candidates || [], ...result.avoid_products || []], gradeByName = new Map(knownProducts.map((x) => [normalizeProductName(x.name), String(x.product_type || "").toUpperCase()])), monthlyGrade = (x) => {
    if (!x || typeof x !== "object") return "";
    const text = [x.ranking_reason, x.evidence, x.decision, textValue(x.reasons)].filter(Boolean).join(" "), match = text.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)\s*(\d[\d,]*)\s*ชิ้น(?=[^\n]{0,30}30\s*วัน)/i);
    if (!match) return "";
    const sold = Number(match[1].replace(/,/g, ""));
    return sold >= 30 ? "A" : sold >= 16 ? "B" : sold >= 1 ? "C" : "";
  }, gradeOf = (x) => {
    const monthly = monthlyGrade(x);
    if (monthly && !["D", "E"].includes(String(x?.product_type || "").toUpperCase())) return monthly;
    const explicit = typeof x === "object" && x ? String(x.product_type || x.grade || "").toUpperCase() : "";
    if (/^[A-F]$/.test(explicit)) return explicit;
    const name = typeof x === "string" ? x : x?.product || "";
    const matched = gradeByName.get(normalizeProductName(name)) || "";
    return /^[A-F]$/.test(matched) ? matched : "";
  }, gradeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, unknown: 0 }, gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4, unknown: 5, E: 6 };
  dailyProducts.sort((a, b) => {
    const gradeA = gradeOf(a) || "unknown", gradeB = gradeOf(b) || "unknown", order = gradeOrder[gradeA] - gradeOrder[gradeB];
    if (order) return order;
    const scoreA = Number(a?.ranking_score), scoreB = Number(b?.ranking_score);
    return (Number.isFinite(scoreB) ? scoreB : -1) - (Number.isFinite(scoreA) ? scoreA : -1);
  });
  dailyProducts.forEach((x) => {
    const grade = gradeOf(x);
    gradeCounts[grade || "unknown"]++;
  });
  $("#productPrepSummary").innerHTML = `<span class="total">\u0E23\u0E27\u0E21 <b>${dailyProducts.length}/40</b> \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</span>${["A", "B", "C", "D", "E", "F"].map((grade) => `<span><i class="grade-dot grade-${grade}">${grade}</i><b>${gradeCounts[grade]}</b> \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</span>`).join("")}${gradeCounts.unknown ? `<span class="unknown">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E01\u0E23\u0E14 <b>${gradeCounts.unknown}</b></span>` : ""}`;
  $('[data-list="plan"]').innerHTML = list(dailyProducts, (x, index) => {
    const grade = gradeOf(x), backup = index >= 30, rank = index + 1, hasScore = x && typeof x === "object" && x.ranking_score !== null && x.ranking_score !== void 0 && x.ranking_score !== "" && Number.isFinite(Number(x.ranking_score)), score = hasScore ? Math.max(0, Math.min(100, Number(x.ranking_score))) : null, reason = x && typeof x === "object" ? x.ranking_reason || "" : "";
    return `<div class="product-prep-item ranked${backup ? " backup" : ""}"><span>${rank}</span><div class="product-ranking-copy"><b>${escapeHtml(typeof x === "string" ? x : x.product || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32")}</b><small>${reason ? escapeHtml(reason) : "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21 \xB7 \u0E01\u0E14\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07 Ranking"}${backup ? " \xB7 \u0E15\u0E31\u0E27\u0E2A\u0E33\u0E23\u0E2D\u0E07" : ""}</small></div><strong class="ranking-score ${score === null ? "pending" : ""}">${score === null ? "\u2014" : `${score}/100`}</strong><i class="product-prep-grade ${grade ? `grade-${grade}` : "unknown"}">${grade || "?"}</i></div>`;
  });
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}
const renderResultBase = renderResult;
renderResult = function(result = {}) {
  renderResultBase(result);
  $('[data-list="plan"]').querySelectorAll(".product-prep-item").forEach((item) => {
    const name = item.querySelector(".product-ranking-copy b")?.textContent?.trim() || "", grade = item.querySelector(".product-prep-grade")?.textContent?.trim() || "C", score = (item.querySelector(".ranking-score")?.textContent || "").replace(/\D/g, "") || "0", evidence = item.querySelector(".product-ranking-copy small")?.textContent?.trim() || "";
    if (!name) return;
    item.insertAdjacentHTML("beforeend", `<div class="inventory-actions product-prep-actions"><button type="button" data-inventory="kept" data-product-name="${escapeHtml(name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${escapeHtml(score)}" data-product-evidence="${escapeHtml(evidence)}">\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49</button><button type="button" class="danger" data-inventory="discarded" data-product-name="${escapeHtml(name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${escapeHtml(score)}" data-product-evidence="${escapeHtml(evidence)}">\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01</button></div>`);
  });
};
function fetchTikTokConnectionData(channelId) {
  const key = String(channelId || "");
  if (!key) return Promise.resolve(null);
  if (shopConnectionRequests.has(key)) return shopConnectionRequests.get(key);
  const request = api(`/api/admin/tiktok-connections?${shopDateQuery(key)}`, { cache: "no-store" }).finally(() => {
    if (shopConnectionRequests.get(key) === request) shopConnectionRequests.delete(key);
  });
  shopConnectionRequests.set(key, request);
  return request;
}
async function loadTikTokConnection(channelId = state.selected) {
  const box = $("#tiktokConnection");
  if (!channelId) {
    box.hidden = true;
    return null;
  }
  box.hidden = false;
  const requestedChannelId=channelId,loadSeq=++state.connectionLoadSeq;
  const data = await fetchTikTokConnectionData(requestedChannelId);
  const connection = data.connections?.[0] || null, shopConnection = data.shop_connections?.[0] || null, videos = data.videos || [], products = data.shop_products || [], orders = data.shop_orders || [];
  if(loadSeq!==state.connectionLoadSeq||requestedChannelId!==state.selected)return shopConnection;
  state.connection = connection;
  state.shopConnection = shopConnection;
  $("#channelShopAnalysis").classList.toggle("shop-connection-missing", !shopConnection);
  $("#shopConnectionRequired").hidden = Boolean(shopConnection);
  renderShowcasePermission();
  renderShopDashboard(data, shopConnection);
  if (shopConnection) {
    const [commission, referral] = await Promise.all([api(`/api/admin/tiktok-commissions?channel_id=${encodeURIComponent(requestedChannelId)}&from=${state.shopDateFrom}&to=${state.shopDateTo}`), api('/api/vx/referrals').catch(() => null)]);
    if (loadSeq !== state.connectionLoadSeq || requestedChannelId !== state.selected) return null;
    renderAccurateCommission(commission, referral);
  }
  $("#connectTikTok").hidden = false;
  $("#connectTikTokShop").hidden = Boolean(shopConnection?.capabilities?.showcase_ready);
  $("#syncTikTokShowcase").hidden = !shopConnection;
  $("#showcaseSyncLimitField").hidden = !shopConnection;
  $("#disconnectTikTokShop").hidden = !shopConnection;
  $("#connectTikTok").href = `/api/tiktok/connect?channel_id=${encodeURIComponent(state.selected)}`;
  $("#connectTikTok").textContent = connection ? "เลือกบัญชี TikTok ใหม่" : "เลือกบัญชี TikTok เพื่อเชื่อม";
  $("#connectTikTokShop").href = `/api/tiktok-shop/connect?channel_id=${encodeURIComponent(state.selected)}`;
  $("#connectTikTokShop").textContent = "เชื่อมระบบ TikTok";
  if (shopConnection) loadMarketplaceCategories();
  $("#tiktokShopState").innerHTML = shopConnection ? `<div class="shop-summary"><p><b>${escapeHtml(shopConnection.creator_username || "TikTok Shop Creator")}</b> · ตลาด ${escapeHtml(shopConnection.selection_region || "ยังไม่ระบุ")} · ซิงก์ ${escapeHtml(shopConnection.last_synced_at || "ยังไม่เคย")}</p>${shopConnection.last_sync_error ? `<p class="shop-error">ครั้งล่าสุด: ${escapeHtml(shopConnection.last_sync_error)}</p>` : ""}</div>` : data.shop_configured ? "<p>ยังไม่ได้เชื่อมข้อมูล Showcase และออเดอร์ Affiliate</p>" : "<p>ยังไม่ได้ตั้งค่า TikTok Shop App key และ App secret</p>";
  $("#soldProductsData").innerHTML = shopConnection ? shopRangeSummary(data, products, orders) : '<p class="hint">เชื่อม TikTok Shop เพื่อโหลดสินค้าที่ขายได้และออเดอร์</p>';
  if (shopConnection) {
    decorateSoldProductSelection(products);
    await syncSelectedSoldProductGrades();
  }
  if (!data.configured && !connection) {
    $("#tiktokConnectionState").innerHTML = "<b>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 TikTok API</b><p>\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21 Sandbox Client key \u0E41\u0E25\u0E30 Client secret \u0E43\u0E19 Cloudflare \u0E01\u0E48\u0E2D\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35</p>";
    return shopConnection;
  }
  if (!connection) {
    $("#tiktokConnectionState").innerHTML = "<b>\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E08\u0E32\u0E01 TikTok</b><p>\u0E14\u0E36\u0E07\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C \u0E2A\u0E16\u0E34\u0E15\u0E34 \u0E41\u0E25\u0E30\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E2A\u0E32\u0E18\u0E32\u0E23\u0E13\u0E30\u0E02\u0E2D\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49</p>";
    $("#tiktokVideoSummary").innerHTML = "";
    return shopConnection;
  }
  $("#tiktokConnectionState").innerHTML = `<b>เชื่อมบัญชี TikTok ของช่องนี้แล้ว</b><p>ข้อมูลโปรไฟล์และสถิติแสดงอยู่ในการ์ดช่องด้านซ้าย · ซิงก์ล่าสุด ${escapeHtml(connection.last_synced_at || "ยังไม่เคย")}</p>`;
  $("#tiktokVideoSummary").innerHTML = `<p>\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E25\u0E34\u0E1B\u0E41\u0E25\u0E49\u0E27 ${videos.length} \u0E04\u0E25\u0E34\u0E1B \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E43\u0E19\u0E01\u0E32\u0E23\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C</p>`;
  return shopConnection;
}
const renderResultMonthlyCorrectionBase = renderResult;
renderResult = function(result = {}) {
  renderResultMonthlyCorrectionBase(result);
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  $('[data-list="plan"]').querySelectorAll(".product-prep-item").forEach((item) => {
    const reason = item.querySelector(".product-ranking-copy small")?.textContent || "", after = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)\s*(\d[\d,]*)\s*ชิ้น(?=[^\n]{0,30}30\s*วัน)/i), before = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)[^\n]{0,20}30\s*วัน[^\d\n]{0,20}(\d[\d,]*)\s*ชิ้น/i), value = after?.[1] ?? before?.[1], badge = item.querySelector(".product-prep-grade");
    if (value && badge && !["D", "E"].includes(badge.textContent.trim())) {
      const sold = Number(value.replace(/,/g, "")), grade2 = sold >= 30 ? "A" : sold >= 16 ? "B" : sold >= 1 ? "C" : "";
      badge.className = `product-prep-grade grade-${grade2 || "unknown"}`;
      badge.textContent = grade2 || "ไม่มีเกรด";
    }
    const grade = badge?.textContent.trim();
    if (counts[grade] !== void 0) counts[grade]++;
  });
  $("#productPrepSummary").querySelectorAll(".grade-dot").forEach((dot) => {
    const grade = dot.textContent.trim(), value = dot.nextElementSibling;
    if (value && counts[grade] !== void 0) value.textContent = counts[grade];
  });
};
const renderResultTextGradeBase = renderResult;
renderResult = function(result = {}) {
  renderResultTextGradeBase(result);
  const period = Number(result.attachment_period_days) || 30, counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  $('[data-list="plan"]').querySelectorAll(".product-prep-item").forEach((item) => {
    const reason = item.querySelector(".product-ranking-copy small")?.textContent || "", after = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)[ \t]*([0-9][0-9,]*)[ \t]*ชิ้น(?=[^\r\n]{0,30}30[ \t]*วัน)/i), before = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)[^\r\n]{0,20}30[ \t]*วัน[^0-9\r\n]{0,20}([0-9][0-9,]*)[ \t]*ชิ้น/i), loose = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)[ \t]*([0-9][0-9,]*)[ \t]*ชิ้น/i), value = after?.[1] ?? before?.[1] ?? loose?.[1], badge = item.querySelector(".product-prep-grade");
    if (value && badge && !["D", "E"].includes(badge.textContent.trim())) {
      const sold = Number(value.replace(/,/g, "")), grade2 = period === 3 ? sold > 0 ? "C" : "" : period === 7 ? sold >= 7 ? "A" : sold >= 4 ? "B" : sold >= 1 ? "C" : "" : sold >= 30 ? "A" : sold >= 16 ? "B" : sold >= 1 ? "C" : "";
      badge.className = `product-prep-grade grade-${grade2 || "unknown"}`;
      badge.textContent = grade2 || "ไม่มีเกรด";
      item.querySelectorAll("[data-product-grade]").forEach((button) => button.dataset.productGrade = grade2);
    }
    const grade = badge?.textContent.trim();
    if (counts[grade] !== void 0) counts[grade]++;
  });
  $("#productPrepSummary").querySelectorAll(".grade-dot").forEach((dot) => {
    const grade = dot.textContent.trim(), value = dot.nextElementSibling;
    if (value && counts[grade] !== void 0) value.textContent = counts[grade];
  });
};
function renderPermanentInventory(products = [], events = []) {
  const kept = products.filter((x) => x.inventory_status === "kept"), discarded = products.filter((x) => x.inventory_status === "discarded"), eventLabels = { analyzed: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E08\u0E32\u0E01\u0E23\u0E39\u0E1B", review_scheduled: "\u0E19\u0E31\u0E14\u0E15\u0E23\u0E27\u0E08", kept: "\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49", discarded: "\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01", manual_fail: "\u0E01\u0E14\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19" }, format = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(/* @__PURE__ */ new Date(`${value.replace(" ", "T")}Z`)) : "-", timeline = (name) => events.filter((event) => normalizeProductName(event.product_name) === normalizeProductName(name)).slice(0, 5).map((event) => `<div class="timeline-event"><time>${format(event.event_at)}</time><b>${escapeHtml(eventLabels[event.event_type] || event.event_type)}</b><span>${event.product_type ? `\u0E40\u0E01\u0E23\u0E14 ${escapeHtml(event.product_type)} \xB7 ` : ""}${escapeHtml(event.detail || "")}</span></div>`).join("") || '<span class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C</span>', rows = (items, status) => items.length ? `<div class="product-table-wrap"><table class="product-table permanent-product-table"><thead><tr><th>\u0E25\u0E33\u0E14\u0E31\u0E1A</th><th>\u0E40\u0E01\u0E23\u0E14</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</th><th>\u0E40\u0E27\u0E25\u0E32\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C</th><th>\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30</th></tr></thead><tbody>${items.map((x, index) => `<tr><td><span class="inventory-order">${index + 1}</span></td><td><span class="type-pill type-${escapeHtml(x.product_type || "C")}">${escapeHtml(x.product_type || "C")}</span></td><td class="product-full-name">${escapeHtml(x.name)}</td><td>${Number(x.score) || 0}/100</td><td>${escapeHtml(x.evidence || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21")}</td><td class="product-timeline">${timeline(x.name)}</td><td><button type="button" data-inventory="${status === "kept" ? "discarded" : "kept"}" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(x.product_type || "C")}" data-product-score="${Number(x.score) || 0}" data-product-evidence="${escapeHtml(x.evidence || "")}">${status === "kept" ? "\u0E22\u0E49\u0E32\u0E22\u0E44\u0E1B\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" : "\u0E19\u0E33\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E40\u0E01\u0E47\u0E1A"}</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</p>';
  const remaining = Math.max(0, 30 - kept.length);
  $("#angelCount").textContent = `\u0E40\u0E01\u0E47\u0E1A\u0E41\u0E25\u0E49\u0E27 ${kept.length}/30 \xB7 ${remaining ? `\u0E40\u0E2B\u0E25\u0E37\u0E2D ${remaining}` : "\u0E04\u0E23\u0E1A 30 \u0E41\u0E25\u0E49\u0E27"} \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01 ${discarded.length}`;
  $("#angelProducts").innerHTML = `<section class="permanent-list kept"><h3>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49 <small>${kept.length}/30 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows(kept, "kept")}</section><section class="permanent-list discarded"><h3>\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01 <small>${discarded.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows(discarded, "discarded")}</section>`;
}
function reconcileProductPrepInventory(products = []) {
  const discarded = new Set(products.filter((product) => product.inventory_status === "discarded").map((product) => normalizeProductName(product.name)));
  const list = $('[data-list="plan"]');
  if (!list) return;
  const kept = products.filter((product) => product.inventory_status === "kept");
  for (const product of kept) {
    const key = normalizeProductName(product.name);
    if (!key) continue;
    let item = [...list.querySelectorAll(".product-prep-item")].find((row) => normalizeProductName(row.querySelector(".product-ranking-copy b")?.textContent) === key);
    const grade = /^[A-F]$/.test(product.product_type) ? product.product_type : "";
    if (!item) {
      const actionData = `data-product-name="${escapeHtml(product.name)}" data-product-grade="${grade}" data-product-score="${Number(product.score) || 0}" data-product-evidence="${escapeHtml(product.evidence || "")}"`;
      list.insertAdjacentHTML("beforeend", `<div class="product-prep-item ranked"><span></span><div class="product-ranking-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.evidence || "เพิ่มเข้าลิสต์คัดสินค้าแล้ว")}</small></div><strong class="ranking-score pending">—</strong><i class="product-prep-grade"></i><div class="inventory-actions product-prep-actions"><button type="button" data-inventory="kept" ${actionData}>เก็บไว้</button><button type="button" class="danger" data-inventory="discarded" ${actionData}>คัดออก</button></div></div>`);
      item = list.lastElementChild;
    }
    const badge = item.querySelector(".product-prep-grade");
    if (badge) { badge.textContent = grade || "ไม่มีเกรด"; badge.className = `product-prep-grade grade-${grade || "unknown"}`; }
    item.querySelectorAll("[data-product-grade]").forEach((button) => button.dataset.productGrade = grade);
  }
  if (kept.length) $("#result").hidden = false;
  if (!$("#productPrepSummary .total")) $("#productPrepSummary").innerHTML = `<span class="total">รวม <b>0/40</b> สินค้า</span>${Object.keys(typeLabels).map((grade) => `<span><i class="grade-dot grade-${grade}">${grade}</i><b>0</b> สินค้า</span>`).join("")}`;
  list.querySelectorAll(".product-prep-item").forEach((item) => {
    const name = item.querySelector(".product-ranking-copy b")?.textContent?.trim() || "";
    if (discarded.has(normalizeProductName(name))) item.remove();
  });
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  list.querySelectorAll(".product-prep-item").forEach((item, index) => {
    const order = item.querySelector(":scope > span:first-child"), grade = item.querySelector(".product-prep-grade")?.textContent?.trim();
    if (order) order.textContent = String(index + 1);
    if (counts[grade] !== void 0) counts[grade]++;
  });
  const visibleCount = list.querySelectorAll(".product-prep-item").length;
  const total = $("#productPrepSummary .total b");
  if (total) total.textContent = `${visibleCount}/40`;
  $("#productPrepSummary")?.querySelectorAll(".grade-dot").forEach((dot) => {
    const value = dot.nextElementSibling, grade = dot.textContent.trim();
    if (value && counts[grade] !== void 0) value.textContent = counts[grade];
  });
}
function renderReviewSchedule(products = [], apiReady = false) {
  const scheduled = products.filter((x) => x.inventory_status === "kept" && ["A", "B", "C", "D"].includes(x.product_type)), now = Date.now(), format = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(/* @__PURE__ */ new Date(`${value.replace(" ", "T")}Z`)) : "-", sourceText = apiReady ? "\u0E15\u0E23\u0E27\u0E08\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E08\u0E32\u0E01 TikTok Shop API \xB7 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48" : "API \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21 \xB7 \u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E16\u0E36\u0E07\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08", rows = scheduled.sort((a, b) => String(a.next_review_at || "9999").localeCompare(String(b.next_review_at || "9999"))).map((x) => {
    const due = x.next_review_at ? (/* @__PURE__ */ new Date(`${x.next_review_at.replace(" ", "T")}Z`)).getTime() <= now : false, cycle = Number(x.review_cycle_days) || (x.product_type === "D" ? 3 : 30);
    return `<div class="review-reminder${due ? " overdue" : ""}"><span class="type-pill type-${escapeHtml(x.product_type)}">${escapeHtml(x.product_type)}</span><div><b>${escapeHtml(x.name)}</b><small>\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 ${format(x.attachment_date || x.review_started_at)} \xB7 ${sourceText}</small><strong>${x.next_review_at ? `${due ? "\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E49\u0E27" : "\u0E15\u0E23\u0E27\u0E08\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B"} ${format(x.next_review_at)}` : "\u0E23\u0E2D\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E27\u0E31\u0E19\u0E15\u0E23\u0E27\u0E08"} \xB7 \u0E23\u0E2D\u0E1A ${cycle} \u0E27\u0E31\u0E19</strong></div>${x.product_type === "D" ? `<button type="button" class="fail-c-button" data-fail-c="${escapeHtml(x.name)}">\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19 \u2192 F</button>` : ""}</div>`;
  }).join("");
  $("#productReviewSchedule").innerHTML = `<div class="review-schedule-head"><div><h3>\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</h3><p>D \u0E15\u0E23\u0E27\u0E08\u0E23\u0E2D\u0E1A\u0E17\u0E14\u0E2A\u0E2D\u0E1A 3 \u0E27\u0E31\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E14\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35 \xB7 A/B/C \u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 \xB7 ${sourceText}</p></div><b>${scheduled.length} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</b></div>${rows || '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A/B/C/D \u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49\u0E41\u0E25\u0E30\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08</p>'}`;
}
const renderReviewScheduleBase = renderReviewSchedule;
renderReviewSchedule = function(products = [], apiReady = false, events = []) {
  renderReviewScheduleBase(products, apiReady);
  const retested = new Set(events.filter((x) => x.event_type === "manual_retest").map((x) => normalizeProductName(x.product_name)));
  $("#productReviewSchedule").querySelectorAll(".review-reminder").forEach((row) => {
    const name = row.querySelector("div>b")?.textContent || "";
    if (retested.has(normalizeProductName(name))) row.querySelector("div>b")?.insertAdjacentHTML("afterend", '<em class="retest-warning">\u0E40\u0E04\u0E22\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27 \xB7 \u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48</em>');
  });
};
const renderPermanentInventoryBase = renderPermanentInventory;
renderPermanentInventory = function(products = [], events = []) {
  renderPermanentInventoryBase(products, events);
  const byName = new Map(products.map((x) => [normalizeProductName(x.name), x]));
  $("#angelProducts").querySelectorAll(".permanent-product-table thead tr").forEach((row) => {
    row.lastElementChild?.insertAdjacentHTML("beforebegin", "<th>ลิงก์สินค้า</th>");
  });
  $("#angelProducts").querySelectorAll(".permanent-product-table tbody tr").forEach((row) => {
    const name = row.querySelector(".product-full-name")?.textContent?.trim() || "", product = byName.get(normalizeProductName(name)), button = row.querySelector("button");
    if (!button || !product) return;
    row.lastElementChild?.insertAdjacentHTML("beforebegin", `<td>${productLinkControl(product.product_url)}</td>`);
    if (product.product_type === "F") {
      delete button.dataset.inventory;
      button.dataset.retestF = name;
      button.textContent = "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 D";
    }
  });
  $("#angelProducts").querySelectorAll(".timeline-event b").forEach((label) => {
    if (label.textContent === "manual_retest") label.textContent = "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 D";
    if (label.textContent === "manual_c") label.textContent = "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E1B\u0E47\u0E19 D \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E17\u0E14\u0E2A\u0E2D\u0E1A";
  });
};
async function setProductInventory(button) {
  if (!state.selected) return;
  const data = new FormData(), productName = button.dataset.productName || "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E19\u0E35\u0E49";
  data.set("action", "set_product_inventory");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  data.set("product_type", button.dataset.productGrade || "C");
  data.set("score", button.dataset.productScore || "0");
  data.set("evidence", button.dataset.productEvidence || "");
  data.set("inventory_status", button.dataset.inventory);
  button.disabled = true;
  try {
    const saved = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    const latest = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(state.selected)}`), kept = (latest.products || []).filter((x) => x.inventory_status === "kept"), position = kept.findIndex((x) => normalizeProductName(x.name) === normalizeProductName(productName)) + 1, countText = position ? ` \xB7 \u0E25\u0E33\u0E14\u0E31\u0E1A ${position}/30` : "";
    const notice = saved.already_exists ? button.dataset.inventory === "kept" ? `\u201C${productName}\u201D \u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E41\u0E25\u0E49\u0E27${countText} \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0B\u0E49\u0E33` : `\u201C${productName}\u201D \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01\u0E41\u0E25\u0E49\u0E27 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0B\u0E49\u0E33` : button.dataset.inventory === "kept" ? `\u0E40\u0E01\u0E47\u0E1A \u201C${productName}\u201D \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08${countText}` : `\u0E04\u0E31\u0E14 \u201C${productName}\u201D \u0E2D\u0E2D\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \xB7 \u0E40\u0E2B\u0E25\u0E37\u0E2D ${kept.length}/30`;
    message.textContent = notice;
    showToast(notice, saved.already_exists ? "warning" : "success");
    renderPermanentInventory(latest.products || [], latest.product_events || []);
    reconcileProductPrepInventory(latest.products || []);
  } catch (error) {
    message.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}
async function failCProduct(button) {
  if (!state.selected) return;
  const productName = button.dataset.failC || "";
  if (!productName) return;
  if (!confirm(`\u0E43\u0E2B\u0E49\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u201C${productName}\u201D \u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19 F \u0E17\u0E31\u0E19\u0E17\u0E35\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21?`)) return;
  const data = new FormData();
  data.set("action", "fail_c_product");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  button.disabled = true;
  try {
    await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    message.textContent = `\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 ${productName} \u0E08\u0E32\u0E01 D \u0E40\u0E1B\u0E47\u0E19 F \u0E41\u0E25\u0E49\u0E27`;
    const latest = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(state.selected)}`);
    renderReviewSchedule(latest.products || [], Boolean(state.shopConnection), latest.product_events || []);
    renderPermanentInventory(latest.products || [], latest.product_events || []);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
async function retestFProduct(button) {
  if (!state.selected) return;
  const productName = button.dataset.retestF || "";
  if (!productName) return;
  if (!confirm(`\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u201C${productName}\u201D \u0E40\u0E04\u0E22\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19 F \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 D \u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21?`)) return;
  const data = new FormData();
  data.set("action", "retest_f_product");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  button.disabled = true;
  try {
    await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    message.textContent = `\u0E19\u0E33 ${productName} \u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E40\u0E1B\u0E47\u0E19 D \u0E41\u0E25\u0E30\u0E15\u0E31\u0E49\u0E07\u0E23\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48 3 \u0E27\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27`;
    const latest = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(state.selected)}`);
    renderReviewSchedule(latest.products || [], Boolean(state.shopConnection), latest.product_events || []);
    renderPermanentInventory(latest.products || [], latest.product_events || []);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
async function setProductC(button) {
  if (!state.selected) return;
  const productName = button.dataset.setC || "";
  if (!productName) return;
  const data = new FormData();
  data.set("action", "set_product_c");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  data.set("score", button.dataset.productScore || "0");
  data.set("evidence", button.dataset.productEvidence || "");
  data.set("product_url", button.dataset.productUrl || "");
  data.set("source_kind", button.dataset.sourceKind || "manual_selection");
  data.set("requested_grade", button.dataset.requestedGrade || "D");
  button.disabled = true;
  try {
    const saved = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    const savedGrade = saved.product_type || "D";
    const notice = saved.already_exists ? `“${productName}” มีอยู่ในลิสต์คัดสินค้าแล้ว เกรดปัจจุบัน ${savedGrade}` : `เพิ่ม “${productName}” เป็นเกรด ${savedGrade} สำเร็จ`;
    message.textContent = notice;
    showToast(notice, saved.already_exists ? "warning" : "success");
    const latest = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(state.selected)}`);
    state.inventoryProducts = latest.products || [];
    reconcileProductPrepInventory(state.inventoryProducts);
    renderReviewSchedule(latest.products || [], Boolean(state.shopConnection), latest.product_events || []);
    renderPermanentInventory(latest.products || [], latest.product_events || []);
    return saved;
  } catch (error) {
    message.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}
async function addMarketplaceProductToSelection(productId, button, mode = "product") {
  const product = marketplaceView(mode).products.find((item) => String(item.product_id) === String(productId));
  if (!product?.name) return showToast("ไม่พบข้อมูลสินค้าที่ต้องการเพิ่ม", "error");
  button.dataset.setC = product.name;
  button.dataset.productScore = "0";
  button.dataset.productUrl = product.product_url || "";
  button.dataset.sourceKind = "marketplace_selection";
  button.dataset.productEvidence = `เลือกจาก TikTok Open Collaboration${product.shop_name ? ` · ร้าน ${product.shop_name}` : ""}${Number(product.units_sold) ? ` · ขายแล้ว ${Number(product.units_sold).toLocaleString()} ชิ้น` : ""}`;
  const saved = await setProductC(button);
  if (saved) {
    button.textContent = "อยู่ในลิสต์คัดสินค้าแล้ว";
    button.disabled = true;
  }
}
async function addSoldProductToSelection(button) {
  const productName = button.dataset.productName || "";
  if (!productName) return showToast("ไม่พบข้อมูลสินค้าที่ต้องการเพิ่ม", "error");
  button.dataset.setC = productName;
  button.dataset.productScore = "0";
  button.dataset.sourceKind = "sold_product_selection";
  button.dataset.requestedGrade = button.dataset.productGrade || "D";
  const saved = await setProductC(button);
  if (saved) {
    button.textContent = "อยู่ในลิสต์คัดสินค้าแล้ว";
    button.disabled = true;
  }
}
$("#manualCForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#manualCName"), productName = input.value.trim();
  if (!state.selected) {
    message.textContent = "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E01\u0E48\u0E2D\u0E19";
    return;
  }
  if (!productName) {
    message.textContent = "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E2A\u0E48\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32";
    input.focus();
    return;
  }
  const button = event.currentTarget.querySelector("button");
  button.dataset.setC = productName;
  button.dataset.productScore = "0";
  button.dataset.productEvidence = "ผู้ใช้เพิ่มสินค้าทดสอบ D ด้วยตนเอง";
  let status = $("#manualProductStatus");
  if (!status) {
    event.currentTarget.insertAdjacentHTML("afterend", '<p id="manualProductStatus" role="status" aria-live="polite"></p>');
    status = $("#manualProductStatus");
  }
  status.textContent = "กำลังบันทึกสินค้า…";
  const saved = await setProductC(button);
  status.textContent = saved ? (saved.already_exists ? "สินค้านี้อยู่ในลิสต์แล้ว" : "เพิ่มสินค้าเข้าลิสต์แล้ว") : `เพิ่มสินค้าไม่สำเร็จ: ${message.textContent || "กรุณาลองอีกครั้ง"}`;
  if (saved) input.value = "";
});
$("#result").addEventListener("click", (event) => {
  const button = event.target.closest("[data-inventory]");
  if (button) setProductInventory(button);
});
$("#angelProducts").addEventListener("click", (event) => {
  const retestButton = event.target.closest("[data-retest-f]"), button = event.target.closest("[data-inventory]");
  if (retestButton) retestFProduct(retestButton);
  else if (button) setProductInventory(button);
});
$("#productReviewSchedule").addEventListener("click", (event) => {
  const button = event.target.closest("[data-fail-c]");
  if (button) failCProduct(button);
});
const selectChannelBase = selectChannel;
selectChannel = async function(id) {
  saveUiValue("visiond_tiktok_channel_id", String(id));
  state.shopConnection = null;
  await selectChannelBase(id);
  const inventory = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(id)}`);
  state.inventoryProducts = inventory.products || [];
  renderPermanentInventory(inventory.products || [], inventory.product_events || []);
  reconcileProductPrepInventory(inventory.products || []);
  await loadTikTokConnection();
  document.body.classList.toggle("shop-connected", Boolean(state.shopConnection));
  renderReviewSchedule(inventory.products || [], Boolean(state.shopConnection), inventory.product_events || []);
};
$("#channels").addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-id]"), button = event.target.closest("[data-id]");
  if (deleteButton) {
    const name = deleteButton.dataset.deleteName;
    if (!confirm(`\u0E19\u0E33\u0E0A\u0E48\u0E2D\u0E07 \u201C${name}\u201D \u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21? \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21\u0E08\u0E30\u0E22\u0E31\u0E07\u0E16\u0E39\u0E01\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49\u0E41\u0E25\u0E30\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E44\u0E14\u0E49`)) return;
    deleteButton.disabled = true;
    const data = new FormData();
    data.set("action", "delete_channel");
    data.set("channel_id", deleteButton.dataset.deleteId);
    try {
      await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
      if (state.selected === deleteButton.dataset.deleteId) newChannel();
      message.textContent = `\u0E19\u0E33\u0E0A\u0E48\u0E2D\u0E07 ${name} \u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27`;
      await loadChannels();
    } catch (error) {
      message.textContent = error.message;
      deleteButton.disabled = false;
    }
    return;
  }
  if (button) { resetMarketplaceView(); selectChannel(button.dataset.id).catch((error) => message.textContent = error.message); }
});
$("#newChannel").addEventListener("click", () => {
  location.assign("/api/tiktok/connect?create=1");
});
async function syncTikTokShopData(mode) {
  if (!state.shopConnection) return;
  if(mode!=="showcase"&&!commissionAvailability().ready){message.textContent="ยอดเมื่อวานยังอยู่ระหว่างการประมวลผล กรุณารอ 12:00 น. เป็นต้นไป";showToast(message.textContent,"warning");return;}
  const limitInput = $("#showcaseSyncLimit"), maxShowcase = Math.min(2000, Math.max(1, Math.floor(Number(limitInput.value) || 100)));
  limitInput.value = String(maxShowcase);
  const button=mode==="showcase"?$("#syncTikTokShowcase"):$("#syncTikTokShop");
  message.textContent = mode==="showcase" ? "กำลังโหลดสินค้า Showcase สูงสุด " + maxShowcase.toLocaleString("th-TH") + " รายการ…" : "กำลังรีเฟรชสินค้าที่ขายได้และออเดอร์ย้อนหลังสูงสุด 90 วัน…";
  button.disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_sync", id: state.shopConnection.id, channel_id: state.selected, mode, days: 90, max_showcase: maxShowcase }) });
    message.textContent = mode==="showcase" ? `โหลดแล้ว ${result.showcaseCount} สินค้า Showcase` : `รีเฟรชแล้ว ${result.orderCount} ออเดอร์`;
    await loadTikTokConnection();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
$("#syncTikTokShowcase").addEventListener("click", () => syncTikTokShopData("showcase"));
$("#tiktokShopState").addEventListener("submit", async (event) => {
  if (event.target.id !== "shopDateFilter") return;
  event.preventDefault();
  const data = new FormData(event.target), from = String(data.get("date_from") || ""), to = String(data.get("date_to") || "");
  if (!from || !to || from > to) {
    showToast("\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14", "warning");
    return;
  }
  state.shopDateFrom = from;
  state.shopDateTo = to;
  const button = event.target.querySelector("button");
  button.disabled = true;
  button.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E39\u2026";
  try {
    await loadTikTokConnection();
    showToast(`\u0E41\u0E2A\u0E14\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 ${from} \u0E16\u0E36\u0E07 ${to}`);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "\u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E39";
  }
});
$("#soldProductsData").addEventListener("submit", async (event) => {
  if (event.target.id !== "shopDateFilter") return;
  event.preventDefault();
  const data = new FormData(event.target), from = String(data.get("date_from") || ""), to = String(data.get("date_to") || "");
  if (!from || !to || from > to) return showToast("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด", "warning");
  state.shopDateFrom = from; state.shopDateTo = to;
  await loadTikTokConnection().catch(error => message.textContent = error.message);
});
$("#soldProductsData").addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-sold-product]");
  if (button) addSoldProductToSelection(button);
});
$("#disconnectTikTokShop").addEventListener("click", async () => {
  if (!state.shopConnection || !confirm("\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 TikTok Shop \u0E41\u0E25\u0E30\u0E25\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E44\u0E27\u0E49?")) return;
  try {
    await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_disconnect", id: state.shopConnection.id, channel_id: state.selected }) });
    state.shopConnection = null;
    message.textContent = "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 TikTok Shop \u0E41\u0E25\u0E49\u0E27";
    await loadTikTokConnection();
  } catch (error) {
    message.textContent = error.message;
  }
});
$("#marketplaceSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    $("#marketplaceSnapshot").textContent = "กำลังค้นหาสินค้า Open Collaboration จาก TikTok…";
    await searchMarketplace("product");
  } catch (error) {
    const message = marketplaceErrorMessage(error);
    revealMarketplaceReconnect(error);
    $("#marketplaceSnapshot").textContent = message;
    showToast(message, "error");
  }
});
$("#marketplaceShopSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    $("#marketplaceShopSnapshot").textContent = "กำลังค้นหาชื่อร้านค้าจาก TikTok Marketplace…";
    await searchMarketplace("shop");
  } catch (error) {
    const message = marketplaceErrorMessage(error);
    revealMarketplaceReconnect(error);
    $("#marketplaceShopSnapshot").textContent = message;
    showToast(message, "error");
  }
});
async function addProductsToShowcase(ids, button, mode = "product") {
  if (!state.shopConnection) return;
  if (!state.shopConnection.capabilities?.can_write_showcase) {
    renderShowcasePermission();
    $("#showcasePermission")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return showToast("ยังเพิ่มไม่ได้: ต้องเปิด creator.showcase.write หรือ creator.video.write ใน TikTok Shop Partner Center แล้วเชื่อมบัญชีใหม่", "error");
  }
  if (!ids.length) return showToast("กรุณาเลือกสินค้า Marketplace ก่อน", "warning");
  button.disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_add", id: state.shopConnection.id, channel_id: state.selected, product_ids: ids }) });
    showToast(result.warning || `เพิ่มสินค้าเข้า Showcase ของ ${state.shopConnection.creator_username || "บัญชี Creator"} แล้ว ${Number(result.added || ids.length).toLocaleString()} รายการ`, result.warning ? "warning" : "success");
    await loadTikTokConnection();
    renderMarketplaceProducts({ products: marketplaceView(mode).products }, mode);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}
async function addMarketplaceSelection(mode = "product") {
  const view = marketplaceView(mode), ids = [...view.box.querySelectorAll(".marketplace-product-check:checked")].map((input) => input.closest("[data-marketplace-product-id]").dataset.marketplaceProductId).filter(Boolean);
  return addProductsToShowcase(ids, view.addButton, mode);
}
$("#addMarketplaceSelected").addEventListener("click", () => addMarketplaceSelection("product"));
$("#addMarketplaceShopSelected").addEventListener("click", () => addMarketplaceSelection("shop"));
async function removeShowcaseProducts(ids, scopeLabel) {
  if (!state.shopConnection) return;
  const connectionId = state.shopConnection.id, account = state.shopConnection.creator_username || "บัญชี Creator";
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return showToast("ไม่มีสินค้า Showcase ให้ลบ", "warning");
  if (!confirm(`ยืนยัน${scopeLabel} ${uniqueIds.length.toLocaleString()} รายการออกจาก Showcase ของ ${account}? การกระทำนี้มีผลกับบัญชีจริงและย้อนกลับไม่ได้`)) return;
  const buttons = [...document.querySelectorAll(".remove-showcase-item")];
  buttons.forEach((button) => { button.disabled = true; });
  let removed = 0;
  try {
    for (let index = 0; index < uniqueIds.length; index += 200) {
      const batch = uniqueIds.slice(index, index + 200);
      const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_remove", id: connectionId, channel_id: state.selected, product_ids: batch }) });
      removed += Number(result.removed || batch.length);
    }
    showToast(`ลบสินค้าออกจาก Showcase แล้ว ${removed.toLocaleString()} รายการ`);
    state.showcasePage = 1;
    await loadTikTokConnection();
  } catch (error) {
    showToast(removed ? `ลบสำเร็จ ${removed.toLocaleString()} รายการ ก่อนเกิดข้อผิดพลาด: ${error.message}` : error.message, "error");
    await loadTikTokConnection();
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}
$("#screenshots").addEventListener("change", (event) => {
  const files = [...event.target.files];
  message.textContent = files.length > 30 ? "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E14\u0E49\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 30 \u0E23\u0E39\u0E1B\u0E15\u0E48\u0E2D\u0E23\u0E2D\u0E1A" : "";
  $("#previews").innerHTML = files.slice(0, 30).map((file) => `<div class="preview"><img src="${URL.createObjectURL(file)}" alt=""><small>${escapeHtml(file.name)}</small></div>`).join("");
});
$("#saveChannel").addEventListener("click", async () => {
  message.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E48\u0E2D\u0E07\u2026";
  const data = new FormData(form);
  data.set("action", "save_channel");
  try {
    const result = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    state.selected = result.channel_id;
    message.textContent = "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E0A\u0E48\u0E2D\u0E07\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27";
    await loadChannels();
  } catch (error) {
    message.textContent = error.message;
  }
});
function mergeAnalysisResults(results) {
  if (results.length === 1) return results[0];
  const merged = { ...results[0] };
  const arrayKeys = ["data_gaps", "clip_performance", "winner_products", "next_product_candidates", "avoid_products", "daily_product_list", "homework", "extracted_metrics"];
  for (const key of arrayKeys) {
    const seen = new Set();
    merged[key] = results.flatMap((result) => Array.isArray(result?.[key]) ? result[key] : []).filter((item) => {
      const identity = normalizeProductName(typeof item === "string" ? item : item?.product_identity || item?.product || item?.name || JSON.stringify(item));
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }
  merged.audience_demographics = results.find((result) => {
    const audience = result?.audience_demographics || {};
    return audience.primary_gender || audience.primary_age_group || audience.gender_breakdown?.length || audience.age_breakdown?.length;
  })?.audience_demographics || merged.audience_demographics;
  merged.confidence = Math.round(results.reduce((sum, result) => sum + (Number(result.confidence) || 0), 0) / results.length);
  return merged;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E48\u0E32\u0E19\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C \u0E2D\u0E32\u0E08\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 1 \u0E19\u0E32\u0E17\u0E35\u2026";
  $("#analyze").disabled = true;
  try {
    const selectedFiles = [...$("#screenshots").files], batches = selectedFiles.length > 5 ? Array.from({ length: Math.ceil(selectedFiles.length / 5) }, (_, index) => selectedFiles.slice(index * 5, index * 5 + 5)) : [selectedFiles];
    const results = [];
    for (let index = 0; index < batches.length; index++) {
      if (batches.length > 1) message.textContent = `กำลังวิเคราะห์ชุด ${index + 1}/${batches.length}…`;
      const payload = new FormData(form);
      payload.delete("screenshots");
      for (const file of batches[index]) payload.append("screenshots", file);
      if (state.selected) payload.set("channel_id", state.selected);
      if (batches.length > 1) payload.set("clips_per_day", "20");
      const data = await api("/api/admin/tiktok-analyzer", { method: "POST", body: payload });
      state.selected = data.channel_id;
      results.push(data.result);
    }
    renderResult(mergeAnalysisResults(results));
    message.textContent = "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E41\u0E25\u0E49\u0E27";
    await loadChannels();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    $("#analyze").disabled = false;
  }
});
const shopOauthStatus = new URLSearchParams(location.search).get("tiktok_shop");
if (shopOauthStatus) {
  const detail = new URLSearchParams(location.search).get("detail") || "";
  message.textContent = shopOauthStatus === "connected" ? "เชื่อมบัญชี TikTok Shop Creator พร้อมใช้ Marketplace และ Showcase แล้ว" : shopOauthStatus === "account_already_linked" ? `บัญชี TikTok Shop นี้เชื่อมกับ “${detail || "ช่องอื่น"}” อยู่แล้ว ระบบจึงไม่ย้ายบัญชี กลับไปกดเชื่อมระบบ TikTok แล้วเลือกบัญชีของช่องนี้` : shopOauthStatus === "channel_already_linked" ? `การ์ดช่องนี้เชื่อมกับ “${detail || "บัญชี TikTok Shop อื่น"}” อยู่แล้ว กรุณายกเลิกการเชื่อมต่อเดิมก่อน` : shopOauthStatus === "channel_unavailable" ? "ไม่สามารถเชื่อมได้ เพราะการ์ดช่องนี้ถูกลบหรือไม่ใช่ช่องของบัญชีคุณ" : shopOauthStatus === "permissions_required" ? `เชื่อมบัญชี Creator แล้ว แต่สิทธิ์ยังไม่ครบ: ${detail} กรุณาเปิดสิทธิ์ใน TikTok Partner Center แล้วเชื่อมใหม่` : shopOauthStatus === "denied" ? "ยกเลิกการอนุญาต TikTok Shop แล้ว" : `เชื่อม TikTok Shop ไม่สำเร็จ${detail ? `: ${detail}` : " กรุณาลองใหม่"}`;
  history.replaceState({}, "", location.pathname);
}
const oauthStatus = new URLSearchParams(location.search).get("tiktok");
if (oauthStatus) {
  const detail = new URLSearchParams(location.search).get("detail") || "";
  message.textContent = oauthStatus === "account_limit" ? detail : oauthStatus === "connected" ? "เชื่อมต่อ TikTok และนำเข้าข้อมูลสำเร็จ" : oauthStatus === "account_already_linked" ? `บัญชี TikTok นี้เชื่อมกับ “${detail || "ช่องอื่น"}” อยู่แล้ว ระบบจึงไม่ย้ายบัญชี` : oauthStatus === "channel_already_linked" ? `การ์ดช่องนี้เชื่อมกับ “${detail || "บัญชี TikTok อื่น"}” อยู่แล้ว กรุณายกเลิกการเชื่อมต่อเดิมก่อน` : oauthStatus === "channel_unavailable" ? "ไม่สามารถเชื่อมได้ เพราะการ์ดช่องนี้ถูกลบหรือไม่ใช่ช่องของบัญชีคุณ" : oauthStatus === "denied" ? "ยกเลิกการอนุญาต TikTok แล้ว" : "เชื่อมต่อ TikTok ไม่สำเร็จ กรุณาลองใหม่";
  history.replaceState({}, "", location.pathname);
}
form.remove();
$(".workspace-switch")?.remove();
$("#channelShopAnalysis > .result-head")?.remove();
const marketplaceCategoryField = $("#marketplaceCategory")?.closest("label");
if (marketplaceCategoryField) marketplaceCategoryField.hidden = true;
$("#productPrepSummary")?.insertAdjacentHTML("beforebegin", `<div class="grade-explanation" aria-label="คำอธิบายเกรดสินค้า">${Object.entries(typeLabels).map(([grade, label]) => `<span><i class="grade-dot grade-${grade}">${grade}</i><b>${label}</b></span>`).join("")}</div>`);
const manualGradeLabel = $("#manualCForm label");
if (manualGradeLabel?.firstChild) manualGradeLabel.firstChild.textContent = "เพิ่มสินค้าทดสอบ D ด้วยตนเอง";
const manualGradeButton = $("#manualCForm button");
if (manualGradeButton) manualGradeButton.textContent = "เพิ่มเป็น D";
const manualGradeHint = $("#manualCForm")?.nextElementSibling;
if (manualGradeHint) manualGradeHint.textContent = "สินค้าที่เพิ่มเข้าลิสต์จะเป็น D เพื่อทดสอบรอบ 3 วัน · เมื่อมีข้อมูลยอดขายครบ 30 วัน ระบบคำนวณ A/B/C ตามยอดจริง · สินค้า F นำกลับมาทดสอบได้เป็น D";
for (const hint of document.querySelectorAll("#result .hint")) {
  if (hint.textContent.trim().startsWith("เป้าหมาย 30 สินค้าหลัก")) hint.remove();
}
loadChannels();
