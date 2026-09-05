const $ = (selector) => document.querySelector(selector), escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
const normalizeProductName = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const arrayValue = (value) => Array.isArray(value) ? value : value === null || value === void 0 || value === "" ? [] : [value], textValue = (value) => Array.isArray(value) ? value.join(" \xB7 ") : String(value ?? "");
const form = $("#analysisForm"), message = $("#message"), thaiToday = () => new Date(Date.now() + 252e5).toISOString().slice(0, 10), dateDaysAgo = (days) => {
  const [y, m, d] = thaiToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - days * 864e5).toISOString().slice(0, 10);
};
let state = { channels: [], selected: null, connection: null, shopConnection: null, shopDateFrom: dateDaysAgo(29), shopDateTo: thaiToday(), showcasePage: 1, showcaseSearch: "", showcaseProducts: [], inventoryProducts: [], marketplaceProducts: [], marketplaceCategories: [], marketplaceCategoriesForConnection: "", marketplaceCategoriesLoadingForConnection: "", marketplaceNextToken: "", marketplaceSearchedAt: "", marketplaceComparisonDays: 7 };
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
  setWorkspaceView("input");
}, { capture: true });
const shopHeader = $("#shopDashboard .result-head>div"), resultHeader = $("#result .result-head>div"), manualHeader = $("#angelInventory .result-head>div");
shopHeader.querySelector("small").textContent = "AUTOMATIC \xB7 TIKTOK SHOP API";
shopHeader.querySelector("h2").textContent = "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E41\u0E22\u0E01\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07";
shopHeader.insertAdjacentHTML("beforeend", '<p class="source-caption">\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19 \u0E01\u0E23\u0E32\u0E1F\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</p>');
form.insertAdjacentHTML("afterbegin", '<div class="manual-source-note"><b>MANUAL ANALYSIS \xB7 \u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E01\u0E23\u0E2D\u0E01\u0E40\u0E2D\u0E07</b><span>\u0E43\u0E0A\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E44\u0E14\u0E49\u0E01\u0E48\u0E2D\u0E19 TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E22\u0E2D\u0E14\u0E08\u0E32\u0E01 Showcase \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34</span></div>');
resultHeader.querySelector("small").textContent = "CHANNEL ANALYSIS RESULT";
resultHeader.querySelector("h2").textContent = "\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E0A\u0E48\u0E2D\u0E07";
manualHeader.querySelector("small").textContent = "CHANNEL PRODUCT SELECTION LIST";
manualHeader.querySelector("h2").textContent = "\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32";
const typeLabels = { A: "\u2265 7 \u0E0A\u0E34\u0E49\u0E19/\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C", B: "4\u20136 \u0E0A\u0E34\u0E49\u0E19/\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C", C: "1\u20133 \u0E0A\u0E34\u0E49\u0E19/\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C", D: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E01\u0E23\u0E30\u0E41\u0E2A/\u0E24\u0E14\u0E39\u0E01\u0E32\u0E25/\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E48\u0E19", E: "AI \u0E41\u0E19\u0E30\u0E19\u0E33 \xB7 \u0E40\u0E1B\u0E47\u0E19\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D", F: "0 \u0E0A\u0E34\u0E49\u0E19/\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" };
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
const reviewDemo = new URLSearchParams(location.search).get("review_demo") === "1", money = (value) => `\u0E3F${Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, gradeAdvice = { A: "\u0E02\u0E32\u0E22\u0E14\u0E35 \xB7 \u0E25\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07", B: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E23\u0E2D\u0E07 \xB7 \u0E17\u0E33\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07", C: "\u0E1E\u0E2D\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 \xB7 \u0E40\u0E1D\u0E49\u0E32\u0E14\u0E39\u0E15\u0E48\u0E2D", D: "\u0E17\u0E33\u0E15\u0E32\u0E21\u0E01\u0E23\u0E30\u0E41\u0E2A\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E48\u0E19", E: "\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E14\u0E25\u0E2D\u0E07", F: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" };
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
function setWorkspaceView(view) {
  const output = view === "output";
  document.body.classList.toggle("workspace-output", output);
  document.body.classList.toggle("workspace-input", !output);
  $("#showInputView").classList.toggle("active", !output);
  $("#showOutputView").classList.toggle("active", output);
  $("#showInputView").setAttribute("aria-current", output ? "false" : "page");
  $("#showOutputView").setAttribute("aria-current", output ? "page" : "false");
}
async function loadPortfolioDashboard() {
  if (reviewDemo) {
    renderShopDashboard({ ...demoShopData, review_demo: true }, null);
    return;
  }
  const data = await api(`/api/admin/tiktok-connections?${shopDateQuery()}`);
  renderShopDashboard({ ...data, shop_products: data.shop_portfolio?.products || [], shop_orders: data.shop_portfolio?.orders || [] }, data.shop_connections?.[0] || null);
}
$("#showInputView").addEventListener("click", () => {
  setOutputScope("channel");
  setWorkspaceView("input");
});
$("#showOutputView").addEventListener("click", () => {
  setOutputScope("channel");
  setWorkspaceView("output");
});
setOutputScope("channel");
setWorkspaceView("input");
const demoShopData = { shop_portfolio: { commission: [] }, shop_products: [], shop_orders: [] };
const demoRankProducts = [{ product: "KING SYRUP \u0E01\u0E25\u0E34\u0E48\u0E19\u0E23\u0E32\u0E2A\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E23\u0E35\u0E48", product_type: "A", ranking_score: 95, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 42 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E32\u0E22\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" }, { product: "\u0E40\u0E01\u0E49\u0E32\u0E2D\u0E35\u0E49\u0E41\u0E04\u0E21\u0E1B\u0E4C\u0E1B\u0E34\u0E49\u0E07\u0E1E\u0E31\u0E1A\u0E44\u0E14\u0E49", product_type: "A", ranking_score: 92, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 35 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E17\u0E23\u0E32\u0E1F\u0E1F\u0E34\u0E01\u0E14\u0E35" }, { product: "\u0E0A\u0E38\u0E14\u0E40\u0E14\u0E47\u0E01\u0E44\u0E1B\u0E42\u0E23\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19", product_type: "B", ranking_score: 82, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 23 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E23\u0E2D\u0E07" }, { product: "\u0E04\u0E25\u0E35\u0E19\u0E0B\u0E34\u0E48\u0E07\u0E2A\u0E39\u0E15\u0E23\u0E2D\u0E48\u0E2D\u0E19\u0E42\u0E22\u0E19 300ml", product_type: "B", ranking_score: 78, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 18 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E17\u0E33\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" }, { product: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E2B\u0E31\u0E14\u0E40\u0E14\u0E34\u0E19\u0E40\u0E14\u0E47\u0E01", product_type: "C", ranking_score: 68, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 8 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E17\u0E14\u0E25\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E43\u0E19 3 \u0E27\u0E31\u0E19" }, { product: "\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E1C\u0E49\u0E32\u0E41\u0E1F\u0E0A\u0E31\u0E48\u0E19", product_type: "C", ranking_score: 64, ranking_reason: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22 30 \u0E27\u0E31\u0E19 4 \u0E0A\u0E34\u0E49\u0E19 \xB7 \u0E40\u0E1D\u0E49\u0E32\u0E14\u0E39\u0E1C\u0E25" }, { product: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E01\u0E31\u0E19\u0E1D\u0E19\u0E40\u0E14\u0E47\u0E01", product_type: "D", ranking_score: 60, ranking_reason: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E24\u0E14\u0E39\u0E01\u0E32\u0E25 \xB7 \u0E43\u0E0A\u0E49\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E1D\u0E19" }, { product: "\u0E40\u0E0B\u0E23\u0E31\u0E48\u0E21\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E1C\u0E34\u0E27\u0E01\u0E25\u0E38\u0E48\u0E21\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A", product_type: "E", ranking_score: null, ranking_reason: "AI \u0E41\u0E19\u0E30\u0E19\u0E33\u0E08\u0E32\u0E01\u0E41\u0E19\u0E27\u0E17\u0E32\u0E07\u0E0A\u0E48\u0E2D\u0E07 \xB7 \u0E40\u0E1B\u0E47\u0E19\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D" }, { product: "\u0E0A\u0E31\u0E49\u0E19\u0E27\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E2D\u0E40\u0E19\u0E01\u0E1B\u0E23\u0E30\u0E2A\u0E07\u0E04\u0E4C", product_type: "E", ranking_score: null, ranking_reason: "AI \u0E41\u0E19\u0E30\u0E19\u0E33\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E14\u0E25\u0E2D\u0E07" }, { product: "\u0E1E\u0E31\u0E14\u0E25\u0E21\u0E15\u0E31\u0E49\u0E07\u0E42\u0E15\u0E4A\u0E30\u0E23\u0E38\u0E48\u0E19\u0E40\u0E14\u0E34\u0E21", product_type: "F", ranking_score: 30, ranking_reason: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E17\u0E23\u0E32\u0E1F\u0E1F\u0E34\u0E01\u0E15\u0E48\u0E33 \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" }];
const demoAnalysisResult = { summary: "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E0A\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E49\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E07 30 \u0E27\u0E31\u0E19", confidence: 88, data_gaps: ["\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B"], channel_direction: { recommended: "\u0E17\u0E33\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01 A/B \u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 \u0E41\u0E25\u0E30\u0E17\u0E14\u0E25\u0E2D\u0E07 C \u0E17\u0E35\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", reasons: ["\u0E23\u0E31\u0E01\u0E29\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A", "\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21 C \u0E20\u0E32\u0E22\u0E43\u0E19 3 \u0E27\u0E31\u0E19"] }, winner_products: [], next_product_candidates: [], daily_product_list: demoRankProducts, audience_demographics: { primary_gender: "\u0E2B\u0E0D\u0E34\u0E07", primary_age_group: "25\u201334 \u0E1B\u0E35", gender_breakdown: [{ label: "\u0E2B\u0E0D\u0E34\u0E07", percentage: 68 }, { label: "\u0E0A\u0E32\u0E22", percentage: 32 }], age_breakdown: [{ label: "18\u201324 \u0E1B\u0E35", percentage: 22 }, { label: "25\u201334 \u0E1B\u0E35", percentage: 51 }, { label: "35\u201344 \u0E1B\u0E35", percentage: 27 }], evidence: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07" }, attachment_period_days: 30 };
const demoInventoryProducts = demoRankProducts.slice(0, 7).map((item, index) => ({ name: item.product, product_type: item.product_type, score: item.ranking_score || 0, evidence: item.ranking_reason, inventory_status: index < 6 ? "kept" : "discarded", decided_at: "2026-09-02 04:00:00", review_started_at: "2026-09-02 04:00:00", next_review_at: index < 2 ? "2026-09-09 04:00:00" : index < 6 ? "2026-09-05 04:00:00" : null, review_cycle_days: index < 2 ? 7 : index < 6 ? 3 : 0, attachment_date: "2026-09-02 03:30:00" })), demoInventoryEvents = demoInventoryProducts.map((item, index) => ({ product_name: item.name, event_type: item.inventory_status === "kept" ? "kept" : "discarded", product_type: item.product_type, detail: item.inventory_status === "kept" ? "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E01\u0E47\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" : "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01", event_at: `2026-09-02 04:0${index}:00` }));
function renderDemoChannelAnalysis() {
  renderResult(demoAnalysisResult);
  renderPermanentInventory(demoInventoryProducts, demoInventoryEvents);
  $("#angelInventory").hidden = false;
  $("#productReviewSchedule").hidden = true;
  $("#history").hidden = true;
}
const renderPendingShopDashboardBase = renderPendingShopDashboard;
renderPendingShopDashboard = function() {
  renderPendingShopDashboardBase();
  const samples = [["\u0E40\u0E0B\u0E23\u0E31\u0E48\u0E21\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E1C\u0E34\u0E27\u0E2A\u0E39\u0E15\u0E23\u0E2D\u0E48\u0E2D\u0E19\u0E42\u0E22\u0E19", 128, 3260, "3.9%", 3840], ["\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E1C\u0E49\u0E32\u0E41\u0E1F\u0E0A\u0E31\u0E48\u0E19\u0E1E\u0E31\u0E1A\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E14\u0E49", 86, 2180, "3.9%", 2150], ["\u0E0A\u0E38\u0E14\u0E40\u0E14\u0E47\u0E01\u0E44\u0E1B\u0E42\u0E23\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19", 64, 1740, "3.7%", 1920], ["\u0E04\u0E25\u0E35\u0E19\u0E0B\u0E34\u0E48\u0E07\u0E25\u0E49\u0E32\u0E07\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2A\u0E33\u0E2D\u0E32\u0E07 300ml", 41, 1260, "3.3%", 1230], ["\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E2B\u0E31\u0E14\u0E40\u0E14\u0E34\u0E19\u0E40\u0E14\u0E47\u0E01", 27, 980, "2.8%", 810]];
  $("#shopGradeList").innerHTML = `<div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>\u0E40\u0E25\u0E37\u0E2D\u0E01</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22</th><th>\u0E22\u0E2D\u0E14\u0E04\u0E25\u0E34\u0E01</th><th>\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E41\u0E1B\u0E25\u0E07</th><th>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19</th></tr></thead><tbody>${samples.map((item, index) => `<tr><td><input type="checkbox" aria-label="\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 ${index + 1}"></td><td><b>${item[0]}</b><small>\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07 \xB7 \u0E23\u0E2D TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API</small></td><td>${item[1].toLocaleString()}</td><td>${item[2].toLocaleString()}</td><td>${item[3]}</td><td>${money(item[4])}</td></tr>`).join("")}</tbody></table></div><p class="demo-showcase-note">\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E01\u0E32\u0E23\u0E17\u0E33\u0E07\u0E32\u0E19: \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E49\u0E27\u0E43\u0E0A\u0E49\u0E1B\u0E38\u0E48\u0E21\u0E25\u0E1A\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01 Showcase \xB7 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21 TikTok Shop</p>`;
  [$("#removeShowcasePage"), $("#removeShowcaseAll")].forEach((button) => { button.hidden = false; button.disabled = true; });
};
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
function shopSalesGrade(sales) {
  const sold = Number(sales) || 0;
  return sold >= 30 ? "A" : sold >= 16 ? "B" : sold > 0 ? "C" : "";
}
function soldProductSummaryTable(products, orders) {
  const byId = new Map(products.map((product) => [String(product.product_id), product])), sold = /* @__PURE__ */ new Map();
  orders.forEach((order) => (safeJson(order.product_ids) || []).forEach((id) => {
    const key = String(id), row = sold.get(key) || { count: 0, last: 0 };
    row.count++;
    row.last = Math.max(row.last, Number(order.create_time) || 0);
    sold.set(key, row);
  }));
  const rows = [...sold.entries()].map(([id, metrics]) => ({ product: byId.get(id) || { product_id: id, name: `\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 ${id}` }, ...metrics })).sort((a, b) => b.count - a.count || b.last - a.last);
  if (!rows.length) return '<p class="shop-empty-range">\u0E0A\u0E48\u0E27\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49</p>';
  return `<p class="shop-grade-note">เกรดจากยอดออเดอร์จริงในช่วงวันที่เลือก: A ตั้งแต่ 30 · B ตั้งแต่ 16 · C ตั้งแต่ 1</p><div class="shop-product-table-wrap"><table class="shop-product-table"><thead><tr><th>\u0E25\u0E33\u0E14\u0E31\u0E1A</th><th>เกรด</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49</th><th>\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</th><th>\u0E02\u0E32\u0E22\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</th></tr></thead><tbody>${rows.map((row, index) => { const grade = shopSalesGrade(row.count); return `<tr><td>${index + 1}</td><td><span class="type-pill type-${grade}" title="เกรด ${grade} จาก ${row.count.toLocaleString()} ออเดอร์ในช่วงวันที่เลือก">${grade}</span></td><td><b>${escapeHtml(row.product.name || "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32")}</b><small>เกรด ${grade} · คำนวณจาก ${row.count.toLocaleString()} ออเดอร์จริง</small></td><td><code>${escapeHtml(row.product.product_id || "\u2013")}</code></td><td>${row.count.toLocaleString()} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</td><td>${new Date((row.last + 25200) * 1e3).toISOString().slice(0, 10)}</td></tr>`; }).join("")}</tbody></table></div>`;
}
function shopRangeSummary(data, products, orders) {
  const range = data.date_range || { from: state.shopDateFrom, to: state.shopDateTo };
  return `<form id="shopDateFilter" class="shop-date-filter"><label>\u0E08\u0E32\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_from" type="date" value="${escapeHtml(range.from)}" max="${thaiToday()}" required></label><label>\u0E16\u0E36\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_to" type="date" value="${escapeHtml(range.to)}" max="${thaiToday()}" required></label><button type="submit">\u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E39</button></form><div class="shop-range-kpis"><span><small>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49</small><b>${orders.length.toLocaleString()}</b></span></div><h3 class="sold-products-heading">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49\u0E15\u0E32\u0E21\u0E0A\u0E48\u0E27\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48</h3>${soldProductSummaryTable(products, orders)}`;
}
function safeProductImage(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
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
  if (Math.min(a.length, b.length) >= 14 && (a.includes(b) || b.includes(a))) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * .25 + .7;
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 1)), bTokens = new Set(b.split(" ").filter((token) => token.length > 1));
  if (!aTokens.size || !bTokens.size) return 0;
  return [...aTokens].filter((token) => bTokens.has(token)).length / Math.min(aTokens.size, bTokens.size);
}
function renderShowcaseProducts(products, orders, demo = false, growthOrders = orders) {
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
    $("#removeShowcasePage").hidden = true;
    $("#removeShowcaseAll").hidden = true;
    return;
  }
  const usedInventory = new Set();
  const findSelection = (product) => {
    let bestIndex = -1, bestScore = 0;
    inventory.forEach((candidate, index) => {
      if (usedInventory.has(index)) return;
      const idMatch = product.product_id && String(candidate.product_url || "").includes(String(product.product_id));
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
  const analyzedOnly = inventory.filter((_, index) => !usedInventory.has(index)).map((selection) => ({ product_id: "", name: selection.name, image_url: "", product_url: selection.product_url, selection, analysisOnly: true }));
  const mergedProducts = [...showcaseProducts, ...analyzedOnly].sort((a, b) => {
    return gradeRank(a) - gradeRank(b) || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
  const query = normalizeProductName(state.showcaseSearch);
  const filtered = query ? mergedProducts.filter((product) => normalizeProductName(`${product.name || ""} ${product.product_id || ""}`).includes(query)) : [...mergedProducts];
  const pageSize = 20, pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.showcasePage = Math.min(Math.max(1, state.showcasePage), pageCount);
  const start = (state.showcasePage - 1) * pageSize, pageProducts = filtered.slice(start, start + pageSize);
  const rows = pageProducts.map((product, index) => {
    const metrics = productMetrics(product, orders), gmv = productGmvGrowth(product, growthOrders), image = safeProductImage(product.image_url || product.raw_image_url) || productImageFromRaw(product.raw_json), name = escapeHtml(product.name || product.product_id), link = safeProductImage(product.product_url), selection = product.selection || {}, grade = effectiveGrade(product), gradeLabel = "ABCDEF".includes(grade) ? grade : "–", evidence = String(selection.evidence || ""), evidenceSales = Number(evidence.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)\s*(\d[\d,]*)\s*ชิ้น/i)?.[1]?.replace(/,/g, "")) || 0, evidenceCommission = evidence.match(/(?:คอม(?:มิชชัน)?|commission)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/i)?.[1], gradeReason = selection.evidence || (metrics.sales ? `จัดเกรดอัตโนมัติจากยอดขายจริง ${metrics.sales.toLocaleString()} ออเดอร์ในช่วงวันที่เลือก` : "ยังไม่จัดเกรด — ยังไม่มียอดขายหรือผลวิเคราะห์"), growthLabel = gmv.growth === null ? "สินค้าใหม่" : `${gmv.growth > 0 ? "+" : ""}${gmv.growth.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`, growthClass = gmv.growth === null ? "new" : gmv.growth > 0 ? "up" : gmv.growth < 0 ? "down" : "flat";
    const picture = image ? `<img class="showcase-product-image" src="${escapeHtml(image)}" alt="รูป ${name}" loading="lazy">` : '<span class="showcase-product-image placeholder" aria-label="ไม่มีรูปสินค้า">ไม่มีรูป</span>';
    const title = link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"><b>${name}</b></a>` : `<b>${name}</b>`;
    return `<tr data-product-id="${escapeHtml(product.product_id)}"><td><span class="type-pill type-${escapeHtml(grade || "unknown")}" title="${grade ? `เกรด ${escapeHtml(grade)}` : "ยังไม่มีข้อมูลเพียงพอสำหรับจัดเกรด"}">${escapeHtml(gradeLabel)}</span></td><td><div class="showcase-product-cell">${picture}<div>${title}<small>${product.analysisOnly ? "อ่านจากรายงาน · ยังจับคู่ Showcase ไม่ได้" : demo ? "ข้อมูลสาธิต" : shopProductLabel(product, orders)}</small><code>${escapeHtml(product.product_id || "ไม่มีรหัสสินค้าในรายงาน")}</code></div></div></td><td>${(metrics.sales || evidenceSales) ? (metrics.sales || evidenceSales).toLocaleString() : "–"}</td><td>${metrics.commission ? money(metrics.commission) : evidenceCommission ? `${escapeHtml(evidenceCommission)}%` : "–"}</td><td class="gmv-cell">${product.analysisOnly ? "–" : compactMoney(gmv.latest, gmv.currency)}</td><td class="gmv-cell">${product.analysisOnly ? "–" : compactMoney(gmv.previous, gmv.currency)}</td><td>${product.analysisOnly ? "–" : `<span class="gmv-growth ${growthClass}">${growthLabel}</span>`}</td><td>${selection.score !== void 0 ? `${Number(selection.score) || 0}/100` : "–"}</td><td class="showcase-reason">${escapeHtml(gradeReason)}</td><td>${escapeHtml(selection.next_review_at || "–")}</td></tr>`;
  }).join("");
  list.innerHTML = `<div class="showcase-tools"><label>ค้นหาสินค้า<input id="showcaseSearch" type="search" value="${escapeHtml(state.showcaseSearch)}" placeholder="พิมพ์ชื่อหรือรหัสสินค้า"></label><span>พบ ${filtered.length.toLocaleString()} จาก ${mergedProducts.length.toLocaleString()} รายการ</span></div><p class="gmv-note">GMV เทียบ 7 วันล่าสุดกับ 7 วันก่อนหน้า สิ้นสุดวันที่ ${escapeHtml(state.shopDateTo)} · คำนวณจากรายงานออเดอร์</p><div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>เกรด</th><th>รูปและสินค้า</th><th>ขายได้</th><th>ค่าคอม</th><th>GMV 7 วัน</th><th>GMV 7 วันก่อน</th><th>เติบโต</th><th>คะแนน</th><th>เหตุผลล่าสุด</th><th>ตรวจครั้งถัดไป</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="showcase-empty-search">ไม่พบสินค้าที่ค้นหา</td></tr>'}</tbody></table></div><nav class="showcase-pagination" aria-label="แบ่งหน้ารายการสินค้า"><button id="showcasePrev" type="button" ${state.showcasePage === 1 ? "disabled" : ""}>ก่อนหน้า</button><b>หน้า ${state.showcasePage.toLocaleString()} / ${pageCount.toLocaleString()}</b><button id="showcaseNext" type="button" ${state.showcasePage === pageCount ? "disabled" : ""}>ถัดไป</button><small>หน้าละ 20 รายการ</small></nav>`;
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
  const pageHasProducts = pageProducts.some((product) => !product.analysisOnly && product.product_id);
  $("#removeShowcasePage").hidden = demo || !pageHasProducts;
  $("#removeShowcaseAll").hidden = demo || !state.showcaseProducts.length;
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
  select.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + state.marketplaceCategories.map(category => '<option value="' + escapeHtml(category.id) + '"' + (category.id === selected ? " selected" : "") + '>' + escapeHtml(category.name) + '</option>').join("");
}
async function loadMarketplaceCategories() {
  const connection = state.shopConnection, select = $("#marketplaceCategory");
  if (!connection?.capabilities?.can_search_marketplace || state.marketplaceCategoriesLoadingForConnection === connection.id) return;
  if (state.marketplaceCategoriesForConnection === connection.id && state.marketplaceCategories.length) return;
  state.marketplaceCategoriesLoadingForConnection = connection.id;
  select.disabled = true;
  select.innerHTML = '<option value="">กำลังโหลดหมวดหมู่จาก TikTok…</option>';
  try {
    const data = await api("/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id, categories_only: true, result_limit: 100, sort_field: "units_sold", sort_order: "DESC" }) });
    if (state.shopConnection?.id !== connection.id) return;
    state.marketplaceCategoriesForConnection = connection.id;
    renderMarketplaceCategories(data.categories || []);
    select.title = data.categories?.length ? `พบ ${data.categories.length} หมวดจากสินค้า Marketplace ${data.scanned_product_count || 0} รายการ` : "TikTok ยังไม่ส่งชื่อหมวดหมู่มา";
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
  renderMarketplaceCategories();
  renderMarketplaceProducts();
}
function renderShowcasePermission() {
  let box = $("#showcasePermission");
  if (!box) {
    $("#channelShopAnalysis .result-head").insertAdjacentHTML("afterend", '<div id="showcasePermission" class="showcase-permission" hidden></div>');
    box = $("#showcasePermission");
  }
  const connection = state.shopConnection, capabilities = connection?.capabilities || {}, ready = Boolean(capabilities.showcase_ready), account = connection?.creator_username || connection?.open_id || "บัญชี Creator";
  box.hidden = !connection || ready;
  box.innerHTML = !connection || ready ? "" : `<b>บัญชี ${escapeHtml(account)} ยังเพิ่มสินค้าเข้า Showcase ไม่ได้</b><span>สิทธิ์ที่ยังขาด: ${escapeHtml((capabilities.missing_scopes || []).join(", ") || "สิทธิ์ Creator สำหรับ Marketplace/Showcase")}</span><a href="/api/tiktok-shop/connect?channel_id=${encodeURIComponent(state.selected || "")}">เชื่อมใหม่เพื่ออัปเดตสิทธิ์</a>`;
  const searchButton = $("#marketplaceSearchForm button"), addButton = $("#addMarketplaceSelected");
  if (searchButton) searchButton.disabled = Boolean(connection) && !capabilities.can_search_marketplace;
  if (addButton && !capabilities.can_write_showcase) addButton.disabled = true;
}
function renderMarketplaceProducts(data = null) {
  const box = $("#marketplaceResults"), addButton = $("#addMarketplaceSelected"), snapshot = $("#marketplaceSnapshot"), products = state.marketplaceProducts;
  if (!data) {
    box.innerHTML = "";
    addButton.hidden = true;
    snapshot.textContent = "ยังไม่ได้ค้นหา — การค้นหาครั้งแรกจะสร้าง snapshot เพื่อใช้เทียบการเติบโตในครั้งถัดไป";
    return;
  }
  const time = state.marketplaceSearchedAt ? new Date(state.marketplaceSearchedAt).toLocaleString("th-TH") : "ขณะนี้", firstCount = products.filter((product) => product.previous_snapshot_at === null || product.previous_snapshot_at === void 0).length;
  snapshot.textContent = `Snapshot จาก TikTok เวลา ${time} · พบ ${products.length.toLocaleString()} รายการ · เทียบยอดกับ snapshot ย้อนหลัง ${state.marketplaceComparisonDays} วัน${firstCount ? ` · ${firstCount.toLocaleString()} รายการเป็น snapshot แรก จึงยังไม่มีอัตราเติบโต` : ""}`;
  const rows = products.map((product) => {
    const image = safeProductImage(product.image_url), name = escapeHtml(product.name || product.product_id), link = safeProductImage(product.product_url), growth = product.growth || {}, growthText = growth.growth_percent === null || growth.growth_percent === void 0 ? "Snapshot แรก" : `${Number(growth.growth_percent) > 0 ? "+" : ""}${Number(growth.growth_percent).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`, growthClass = growth.growth_percent === null || growth.growth_percent === void 0 ? "new" : Number(growth.growth_percent) > 0 ? "up" : Number(growth.growth_percent) < 0 ? "down" : "flat";
    const picture = image ? `<img class="showcase-product-image" src="${escapeHtml(image)}" alt="รูป ${name}" loading="lazy">` : '<span class="showcase-product-image placeholder">ไม่มีรูป</span>', title = link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"><b>${name}</b></a>` : `<b>${name}</b>`;
    return `<tr data-marketplace-product-id="${escapeHtml(product.product_id)}"><td><input class="marketplace-product-check" type="checkbox" aria-label="เลือก ${name}"></td><td><div class="showcase-product-cell">${picture}<div>${title}<code>${escapeHtml(product.product_id)}</code></div></div></td><td>${Number(product.units_sold || 0).toLocaleString()}</td><td>${Number(product.commission_rate || 0) ? `${(Number(product.commission_rate) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : "–"}</td><td>${marketplacePrice(product.price)}</td><td><span class="gmv-growth ${growthClass}">${growthText}</span></td></tr>`;
  }).join("");
  box.innerHTML = `<div class="showcase-table-wrap"><table class="showcase-table marketplace-table"><thead><tr><th>เลือก</th><th>สินค้า Open Collaboration</th><th>ขายแล้ว</th><th>ค่าคอม</th><th>ราคา</th><th>เติบโต ${state.marketplaceComparisonDays} วัน</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="showcase-empty-search">ไม่พบสินค้าตามคำค้นนี้</td></tr>'}</tbody></table></div>${state.marketplaceNextToken ? '<div class="showcase-pagination"><button id="marketplaceNext" type="button">ดูหน้าถัดไป</button><small>TikTok ส่งข้อมูลหน้าละไม่เกิน 20 รายการ ระบบรวมให้ตามจำนวนที่เลือก</small></div>' : ""}`;
  const account = state.shopConnection?.creator_username || state.shopConnection?.open_id || "บัญชี Creator";
  addButton.textContent = `เพิ่มรายการที่เลือกเข้า Showcase ของ ${account}`;
  addButton.hidden = !products.length;
  addButton.disabled = true;
  box.querySelectorAll(".marketplace-product-check").forEach((input) => input.addEventListener("change", () => addButton.disabled = !state.shopConnection?.capabilities?.can_write_showcase || !box.querySelector(".marketplace-product-check:checked")));
  $("#marketplaceNext")?.addEventListener("click", () => searchMarketplace(state.marketplaceNextToken));
}
async function searchMarketplace(pageToken = "") {
  if (!state.shopConnection) throw new Error("กรุณาเชื่อม TikTok Shop ก่อนค้นหา Marketplace");
  if (!state.shopConnection.capabilities?.can_search_marketplace) throw new Error("บัญชี Creator ยังไม่มีสิทธิ์ค้นหา Open Collaboration กรุณาเชื่อมและอนุญาตสิทธิ์ใหม่");
  const button = $("#marketplaceSearchForm button"), nextButton = $("#marketplaceNext");
  if (button) button.disabled = true;
  if (nextButton) nextButton.disabled = true;
  try {
    const data = await api("/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connection_id: state.shopConnection.id, keyword: $("#marketplaceKeyword").value.trim(), sort_field: $("#marketplaceSort").value, sort_order: $("#marketplaceOrder").value, result_limit: Number($("#marketplaceLimit").value) || 20, page_token: pageToken, price_min: $("#marketplacePriceMin").value, price_max: $("#marketplacePriceMax").value, category_id: $("#marketplaceCategory").value.trim(), commission_percent_min: $("#marketplaceCommissionMin").value, commission_percent_max: $("#marketplaceCommissionMax").value, comparison_days: Number($("#marketplaceComparisonDays").value) || 7 }) });
    state.marketplaceProducts = data.products || [];
    state.marketplaceNextToken = data.next_page_token || "";
    state.marketplaceSearchedAt = new Date().toISOString();
    state.marketplaceComparisonDays = Number(data.comparison_days) || 7;
    renderMarketplaceCategories(data.categories || []);
    renderMarketplaceProducts(data);
  } finally {
    if (button) button.disabled = false;
    if (nextButton) nextButton.disabled = false;
  }
}
function renderShopDashboard(data, shopConnection) {
  const demo = Boolean(data.review_demo), box = $("#shopDashboard"), portfolio = data.shop_portfolio || {}, commissions = portfolio.commission || [], products = data.shop_products || [], orders = data.shop_orders || [], notice = $("#reviewDemoNotice");
  box.hidden = !demo && !shopConnection && !commissions.length;
  if (box.hidden) return;
  notice.hidden = !demo;
  const commission = commissions[0], daily = commission?.daily || [], maxDaily = Math.max(1, ...daily.map((day) => Number(day.amount) || 0)), total = Number(commission?.total_30) || 0, channels = commission?.channels || [];
  $("#shopCommissionDashboard").innerHTML = commission ? `<div class="commission-summary"><div class="commission-kpis"><article><small>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19</small><b>${money(total)}</b><span class="positive">\u25B2 ${Number(commission.growth || 0).toLocaleString()}% \u0E08\u0E32\u0E01\u0E23\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19</span></article><article><small>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19 Showcase</small><b>${products.length.toLocaleString()}</b><span>\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49</span></article></div><div class="commission-visual"><section><h3>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19</h3><div class="commission-bars">${daily.slice(-30).map((day) => `<div title="${escapeHtml(day.date)} ${money(day.amount)}"><i style="height:${Math.max(8, Math.round(Number(day.amount) / maxDaily * 100))}%"></i><small>${escapeHtml(day.date)}</small></div>`).join("")}</div></section><aside><h3>\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</h3>${channels.map((channel) => `<div class="channel-share"><span>${escapeHtml(channel.channel)}</span><i><b style="width:${Math.max(5, Number(channel.amount) / Math.max(1, ...channels.map((x) => Number(x.amount))) * 100)}%"></b></i><strong>${money(channel.amount)}</strong></div>`).join("")}</aside></div></div>` : '<p class="hint">TikTok \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E22\u0E2D\u0E14\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E32 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E43\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</p>';
  renderShowcaseProducts(products, orders, demo, data.shop_growth_orders || orders);
}
const renderLiveShopDashboard = renderShopDashboard;
function renderPendingShopDashboard() {
  const box = $("#shopDashboard"), notice = $("#reviewDemoNotice"), pending = '<span class="api-pending">\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E04\u0E32\u0E14\u0E01\u0E32\u0E23\u0E13\u0E4C \xB7 \u0E23\u0E2D TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API</span>', chartPreview = `<div class="pending-chart-preview">${[34, 52, 43, 68, 57, 81, 64, 88, 73, 96].map((height) => `<i style="height:${height}%"></i>`).join("")}</div>${pending}`, channelPreview = `<div class="pending-channel-preview">${[82, 66, 48, 35, 24].map((width, index) => `<div><small>\u0E0A\u0E48\u0E2D\u0E07 ${index + 1}</small><i><b style="width:${width}%"></b></i></div>`).join("")}</div>${pending}`;
  box.hidden = false;
  notice.hidden = false;
  notice.innerHTML = "<b>\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E32\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C</b><span>\u0E20\u0E32\u0E1E\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E42\u0E04\u0E23\u0E07\u0E04\u0E32\u0E14\u0E01\u0E32\u0E23\u0E13\u0E4C \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 TikTok API</span>";
  $("#shopCommissionDashboard").innerHTML = `<div class="commission-summary"><div class="commission-kpis"><article><small>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19</small><b>\u2014</b>${pending}</article><article><small>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19 Showcase</small><b>\u2014</b>${pending}</article></div><div class="commission-visual"><section><h3>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19</h3><div class="pending-chart">${chartPreview}</div></section><aside><h3>\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</h3><div class="pending-channels">${channelPreview}</div></aside></div></div>`;
  $("#shopGradeList").innerHTML = `<div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>\u0E40\u0E25\u0E37\u0E2D\u0E01</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22</th><th>\u0E22\u0E2D\u0E14\u0E04\u0E25\u0E34\u0E01</th><th>\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E41\u0E1B\u0E25\u0E07</th><th>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19</th></tr></thead><tbody><tr class="pending-row"><td colspan="6">${pending}</td></tr></tbody></table></div>`;
  $("#removeShowcasePage").hidden = true;
  $("#removeShowcaseAll").hidden = true;
}
renderShopDashboard = function(data, shopConnection) {
  if (data?.review_demo) {
    renderPendingShopDashboard();
    return;
  }
  const commission = data?.shop_portfolio?.commission || [];
  if (!shopConnection && !commission.length) {
    renderPendingShopDashboard();
    $("#reviewDemoNotice").hidden = true;
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
    throw new Error(`${body.error || `HTTP ${response.status}`}${reason}`);
  }
  return body;
}
async function loadChannels() {
  try {
    const data = await api("/api/admin/tiktok-analyzer");
    state.channels = data.channels || [];
    $("#aiState").textContent = data.provider_configured ? "AI \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C" : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 AI";
    renderChannels();
    if (state.selected && !reviewDemo) await selectChannel(state.selected);
  } catch (error) {
    message.textContent = error.message;
  }
}
function renderChannels() {
  $("#channels").innerHTML = state.channels.length ? state.channels.map((x) => `<div class="channel-card ${x.id === state.selected ? "active" : ""}"><button class="channel" data-id="${escapeHtml(x.id)}"><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.channel_url || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C")} \xB7 \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C ${x.analysis_count} \u0E23\u0E2D\u0E1A</small></button><button class="delete-channel" type="button" data-delete-id="${escapeHtml(x.id)}" data-delete-name="${escapeHtml(x.name)}" aria-label="\u0E25\u0E1A\u0E0A\u0E48\u0E2D\u0E07 ${escapeHtml(x.name)}">\u0E25\u0E1A</button></div>`).join("") : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E48\u0E2D\u0E07 \u0E01\u0E14 \u201C\u0E0A\u0E48\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u201D \u0E41\u0E25\u0E49\u0E27\u0E40\u0E23\u0E34\u0E48\u0E21\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E23\u0E01\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22</p>';
}
const demoChannels = Array.from({ length: 5 }, (_, index) => ({ id: `demo-${index + 1}`, name: `\u0E0A\u0E48\u0E2D\u0E07 ${index + 1}` }));
function selectDemoChannel(id) {
  const channel = demoChannels.find((item) => item.id === id);
  if (!channel) return;
  state.selected = id;
  renderChannels();
  $("#channelShopAnalysis h2").textContent = `\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C${channel.name}`;
  $("#channelShopAnalysis .source-caption").textContent = `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E09\u0E1E\u0E32\u0E30${channel.name} \xB7 \u0E23\u0E2D TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API`;
  renderDemoChannelAnalysis();
  setOutputScope("channel");
}
const renderLiveChannels = renderChannels;
renderChannels = function() {
  if (!reviewDemo) renderLiveChannels();
  else $("#channels").innerHTML = demoChannels.map((channel) => `<button class="channel demo-channel${channel.id === state.selected ? " active" : ""}" type="button" data-demo-id="${channel.id}"><b>${channel.name}</b><small>\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49 \xB7 \u0E23\u0E2D TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API</small></button>`).join("");
};
if (reviewDemo) {
  state.selected = demoChannels[0].id;
  renderChannels();
  queueMicrotask(renderDemoChannelAnalysis);
}
async function selectChannel(id) {
  state.selected = id;
  form.classList.add("existing-channel");
  renderChannels();
  const data = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(id)}`), channel = data.channel, products = data.products || [];
  form.channel_id.value = channel.id;
  form.channel_name.value = channel.name;
  form.channel_url.value = channel.channel_url || "";
  form.strategy.value = channel.direction || "";
  $("#channelMode").textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49";
  $("#formHeading").textContent = channel.name;
  $("#history").hidden = false;
  $("#angelInventory").hidden = false;
  $("#angelCount").textContent = `${products.length} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32`;
  $("#angelProducts").innerHTML = products.length ? "ABCDEF".split("").map((type) => {
    const rows = products.filter((product) => (product.product_type || "B") === type);
    return `<section class="product-group type-${type}"><h3><span>${type}</span>${typeLabels[type]} <small>${rows.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows.length ? `<div class="product-table-wrap"><table class="product-table"><thead><tr><th>\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E15\u0E47\u0E21</th><th>\u0E40\u0E1E\u0E28\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 / \u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25</th><th>\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th></tr></thead><tbody>${rows.map((product) => `<tr><td class="product-full-name">${escapeHtml(product.name)}</td><td>${escapeHtml(product.customer_gender || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td>${escapeHtml(product.customer_age_range || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td class="score-cell">${Number(product.score) || 0}/100</td><td>${escapeHtml(product.evidence || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21")}</td><td>${product.product_url ? `<a href="${escapeHtml(product.product_url)}" target="_blank" rel="noopener noreferrer">\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u2197</a>` : "<em>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C</em>"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19\u0E41\u0E19\u0E27\u0E19\u0E35\u0E49</p>'}</section>`;
  }).join("") : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A\u2013F \u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49</p>';
  $("#runs").innerHTML = data.runs.length ? data.runs.map((run) => `<div class="run"><span><b>${escapeHtml(run.title)}</b><small> ${escapeHtml(run.created_at)} \xB7 ${escapeHtml(run.provider)}</small></span><button data-run="${escapeHtml(run.id)}">\u0E40\u0E1B\u0E34\u0E14\u0E1C\u0E25</button></div>`).join("") : "<p>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E1A\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C</p>";
  if (data.runs[0]) renderResult(data.runs[0].result);
}
function newChannel() {
  state.selected = null;
  form.classList.remove("existing-channel");
  form.reset();
  form.channel_id.value = "";
  $("#channelMode").textContent = "\u0E0A\u0E48\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48";
  $("#formHeading").textContent = "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0A\u0E48\u0E2D\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35";
  $("#history").hidden = true;
  $("#angelInventory").hidden = true;
  $("#result").hidden = true;
  $("#previews").innerHTML = "";
  renderChannels();
}
function list(values, render) {
  return Array.isArray(values) && values.length ? values.map(render).join("") : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E2D</p>';
}
function resultProductTable(rows = [], scoreKey = "score") {
  return Array.isArray(rows) && rows.length ? `<div class="product-table-wrap"><table class="product-table"><thead><tr><th>\u0E40\u0E01\u0E23\u0E14</th><th>\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E40\u0E15\u0E47\u0E21</th><th>\u0E40\u0E1E\u0E28\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19 / \u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25</th><th>\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th></tr></thead><tbody>${rows.map((x) => {
    const evidence = x.evidence || textValue(x.reasons) || x.decision || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", score = Number(x[scoreKey]) || 0, grade = x.product_type || "B";
    return `<tr><td><span class="type-pill type-${escapeHtml(grade)}">${escapeHtml(grade)}</span></td><td class="product-full-name">${escapeHtml(x.name)}</td><td>${escapeHtml(x.customer_gender || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td>${escapeHtml(x.customer_age_range || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td class="score-cell">${score}/100</td><td>${escapeHtml(evidence)}</td><td>${x.product_url ? `<a href="${escapeHtml(x.product_url)}" target="_blank" rel="noopener noreferrer">\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u2197</a>` : "<em>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C</em>"}</td><td><div class="inventory-actions"><button type="button" data-inventory="kept" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score}" data-product-evidence="${escapeHtml(evidence)}">\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49</button><button type="button" class="danger" data-inventory="discarded" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score}" data-product-evidence="${escapeHtml(evidence)}">\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01</button></div></td></tr>`;
  }).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E2D</p>';
}
function renderResult(result = {}) {
  $("#result").hidden = false;
  $("#confidence").textContent = `\u0E04\u0E27\u0E32\u0E21\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 ${Number(result.confidence) || 0}%`;
  $('[data-field="summary"]').textContent = result.summary || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E23\u0E38\u0E1B";
  $('[data-list="winners"]').innerHTML = resultProductTable(result.winner_products, "score");
  const d = result.channel_direction || {};
  $('[data-field="direction"]').innerHTML = `<b>${escapeHtml(d.recommended || "\u0E22\u0E31\u0E07\u0E2A\u0E23\u0E38\u0E1B\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</b>${list(arrayValue(d.reasons), (x) => `<p>\u2022 ${escapeHtml(x)}</p>`)}`;
  $('[data-list="candidates"]').innerHTML = resultProductTable(result.next_product_candidates, "fit_score");
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
    return sold >= 30 ? "A" : sold >= 16 ? "B" : "C";
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
async function loadTikTokConnection() {
  const box = $("#tiktokConnection");
  if (!state.selected) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const data = await api(`/api/admin/tiktok-connections?${shopDateQuery(state.selected)}`), connection = data.connections?.[0] || null, shopConnection = data.shop_connections?.[0] || null, videos = data.videos || [], products = data.shop_products || [], orders = data.shop_orders || [];
  state.connection = connection;
  state.shopConnection = shopConnection;
  renderShowcasePermission();
  renderShopDashboard(data, shopConnection);
  $("#connectTikTok").hidden = Boolean(connection);
  $("#connectTikTokShop").hidden = Boolean(shopConnection?.capabilities?.showcase_ready);
  $("#syncTikTokShop").hidden = !shopConnection;
  $("#showcaseSyncLimitField").hidden = !shopConnection;
  $("#disconnectTikTokShop").hidden = !shopConnection;
  $("#connectTikTok").href = `/api/tiktok/connect?channel_id=${encodeURIComponent(state.selected)}`;
  $("#connectTikTokShop").href = `/api/tiktok-shop/connect?channel_id=${encodeURIComponent(state.selected)}`;
  $("#connectTikTokShop").textContent = shopConnection ? "เชื่อมใหม่เพื่ออัปเดตสิทธิ์" : "เชื่อมบัญชี Creator";
  if (shopConnection) loadMarketplaceCategories();
  $("#tiktokShopState").innerHTML = shopConnection ? `<div class="shop-summary"><p><b>${escapeHtml(shopConnection.creator_username || "TikTok Shop Creator")}</b> \xB7 \u0E15\u0E25\u0E32\u0E14 ${escapeHtml(shopConnection.selection_region || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38")} \xB7 \u0E0B\u0E34\u0E07\u0E01\u0E4C ${escapeHtml(shopConnection.last_synced_at || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22")}</p><div class="tiktok-api-stats"><span>${products.length.toLocaleString()} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 Showcase \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</span><span>${orders.length.toLocaleString()} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01</span></div>${shopRangeSummary(data, products, orders)}${shopConnection.last_sync_error ? `<p class="shop-error">\u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14: ${escapeHtml(shopConnection.last_sync_error)}</p>` : ""}</div>` : data.shop_configured ? "<p>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 Showcase \u0E41\u0E25\u0E30\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C Affiliate</p>" : "<p>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 TikTok Shop App key \u0E41\u0E25\u0E30 App secret</p>";
  if (!data.configured && !connection) {
    $("#tiktokConnectionState").innerHTML = "<b>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 TikTok API</b><p>\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21 Sandbox Client key \u0E41\u0E25\u0E30 Client secret \u0E43\u0E19 Cloudflare \u0E01\u0E48\u0E2D\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35</p>";
    return;
  }
  if (!connection) {
    $("#tiktokConnectionState").innerHTML = "<b>\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E08\u0E32\u0E01 TikTok</b><p>\u0E14\u0E36\u0E07\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C \u0E2A\u0E16\u0E34\u0E15\u0E34 \u0E41\u0E25\u0E30\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E2A\u0E32\u0E18\u0E32\u0E23\u0E13\u0E30\u0E02\u0E2D\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49</p>";
    $("#tiktokVideoSummary").innerHTML = "";
    return;
  }
  $("#tiktokConnectionState").innerHTML = `<div class="tiktok-account">${connection.avatar_url ? `<img src="${escapeHtml(connection.avatar_url)}" alt="">` : ""}<div><b>${escapeHtml(connection.display_name || "\u0E1A\u0E31\u0E0D\u0E0A\u0E35 TikTok")}</b><small>${escapeHtml(connection.bio || "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C")} \xB7 \u0E0B\u0E34\u0E07\u0E01\u0E4C ${escapeHtml(connection.last_synced_at || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22")}</small></div></div><div class="tiktok-api-stats"><span>${Number(connection.follower_count).toLocaleString()} \u0E1C\u0E39\u0E49\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21</span><span>${Number(connection.likes_count).toLocaleString()} \u0E44\u0E25\u0E01\u0E4C</span><span>${Number(connection.video_count).toLocaleString()} \u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D</span></div>`;
  $("#tiktokVideoSummary").innerHTML = `<p>\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E25\u0E34\u0E1B\u0E41\u0E25\u0E49\u0E27 ${videos.length} \u0E04\u0E25\u0E34\u0E1B \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E43\u0E19\u0E01\u0E32\u0E23\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C</p>`;
}
const renderResultMonthlyCorrectionBase = renderResult;
renderResult = function(result = {}) {
  renderResultMonthlyCorrectionBase(result);
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  $('[data-list="plan"]').querySelectorAll(".product-prep-item").forEach((item) => {
    const reason = item.querySelector(".product-ranking-copy small")?.textContent || "", after = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)\s*(\d[\d,]*)\s*ชิ้น(?=[^\n]{0,30}30\s*วัน)/i), before = reason.match(/(?:ยอดขาย|ขาย(?:ได้|ดี)?)[^\n]{0,20}30\s*วัน[^\d\n]{0,20}(\d[\d,]*)\s*ชิ้น/i), value = after?.[1] ?? before?.[1], badge = item.querySelector(".product-prep-grade");
    if (value && badge && !["D", "E"].includes(badge.textContent.trim())) {
      const sold = Number(value.replace(/,/g, "")), grade2 = sold >= 30 ? "A" : sold >= 16 ? "B" : "C";
      badge.className = `product-prep-grade grade-${grade2}`;
      badge.textContent = grade2;
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
      const sold = Number(value.replace(/,/g, "")), grade2 = period === 3 ? "C" : period === 7 ? sold >= 7 ? "A" : sold >= 4 ? "B" : sold >= 1 ? "C" : "F" : sold >= 30 ? "A" : sold >= 16 ? "B" : "C";
      badge.className = `product-prep-grade grade-${grade2}`;
      badge.textContent = grade2;
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
function renderReviewSchedule(products = [], apiReady = false) {
  const scheduled = products.filter((x) => x.inventory_status === "kept" && ["A", "B", "C"].includes(x.product_type)), now = Date.now(), format = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(/* @__PURE__ */ new Date(`${value.replace(" ", "T")}Z`)) : "-", sourceText = apiReady ? "\u0E15\u0E23\u0E27\u0E08\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E08\u0E32\u0E01 TikTok Shop API \xB7 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48" : "API \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21 \xB7 \u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E16\u0E36\u0E07\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08", rows = scheduled.sort((a, b) => String(a.next_review_at || "9999").localeCompare(String(b.next_review_at || "9999"))).map((x) => {
    const due = x.next_review_at ? (/* @__PURE__ */ new Date(`${x.next_review_at.replace(" ", "T")}Z`)).getTime() <= now : false, cycle = Number(x.review_cycle_days) || (x.product_type === "C" ? 3 : 7);
    return `<div class="review-reminder${due ? " overdue" : ""}"><span class="type-pill type-${escapeHtml(x.product_type)}">${escapeHtml(x.product_type)}</span><div><b>${escapeHtml(x.name)}</b><small>\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 ${format(x.attachment_date || x.review_started_at)} \xB7 ${sourceText}</small><strong>${x.next_review_at ? `${due ? "\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E49\u0E27" : "\u0E15\u0E23\u0E27\u0E08\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B"} ${format(x.next_review_at)}` : "\u0E23\u0E2D\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E27\u0E31\u0E19\u0E15\u0E23\u0E27\u0E08"} \xB7 \u0E23\u0E2D\u0E1A ${cycle} \u0E27\u0E31\u0E19</strong></div>${x.product_type === "C" ? `<button type="button" class="fail-c-button" data-fail-c="${escapeHtml(x.name)}">\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19 \u2192 F</button>` : ""}</div>`;
  }).join("");
  $("#productReviewSchedule").innerHTML = `<div class="review-schedule-head"><div><h3>\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</h3><p>C \u0E15\u0E23\u0E27\u0E08\u0E23\u0E2D\u0E1A 3 \u0E27\u0E31\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E14\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35 \xB7 A \u0E41\u0E25\u0E30 B \u0E15\u0E23\u0E27\u0E08\u0E17\u0E38\u0E01 7 \u0E27\u0E31\u0E19 \xB7 ${sourceText}</p></div><b>${scheduled.length} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</b></div>${rows || '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 A/B/C \u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49\u0E41\u0E25\u0E30\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E23\u0E2D\u0E1A\u0E15\u0E23\u0E27\u0E08</p>'}`;
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
  $("#angelProducts").querySelectorAll(".permanent-product-table tbody tr").forEach((row) => {
    const name = row.querySelector(".product-full-name")?.textContent?.trim() || "", product = byName.get(normalizeProductName(name)), button = row.querySelector("button");
    if (!button || !product) return;
    if (product.product_type === "F") {
      delete button.dataset.inventory;
      button.dataset.retestF = name;
      button.textContent = "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 C";
    }
  });
  $("#angelProducts").querySelectorAll(".timeline-event b").forEach((label) => {
    if (label.textContent === "manual_retest") label.textContent = "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 C";
    if (label.textContent === "manual_c") label.textContent = "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E1B\u0E47\u0E19 C \u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07";
  });
};
async function setProductInventory(button) {
  if (!state.selected || reviewDemo) return;
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
  } catch (error) {
    message.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}
async function failCProduct(button) {
  if (!state.selected || reviewDemo) return;
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
    message.textContent = `\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 ${productName} \u0E08\u0E32\u0E01 C \u0E40\u0E1B\u0E47\u0E19 F \u0E41\u0E25\u0E49\u0E27`;
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
  if (!state.selected || reviewDemo) return;
  const productName = button.dataset.retestF || "";
  if (!productName) return;
  if (!confirm(`\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u201C${productName}\u201D \u0E40\u0E04\u0E22\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19 F \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 C \u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21?`)) return;
  const data = new FormData();
  data.set("action", "retest_f_product");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  button.disabled = true;
  try {
    await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    message.textContent = `\u0E19\u0E33 ${productName} \u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E40\u0E1B\u0E47\u0E19 C \u0E41\u0E25\u0E30\u0E15\u0E31\u0E49\u0E07\u0E23\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48 3 \u0E27\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27`;
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
  if (!state.selected || reviewDemo) return;
  const productName = button.dataset.setC || "";
  if (!productName) return;
  const data = new FormData();
  data.set("action", "set_product_c");
  data.set("channel_id", state.selected);
  data.set("product_name", productName);
  data.set("score", button.dataset.productScore || "0");
  data.set("evidence", button.dataset.productEvidence || "");
  button.disabled = true;
  try {
    const saved = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    const notice = saved.already_exists ? `\u201C${productName}\u201D \u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E04\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E49\u0E27 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0B\u0E49\u0E33` : `\u0E40\u0E1E\u0E34\u0E48\u0E21 \u201C${productName}\u201D \u0E40\u0E1B\u0E47\u0E19 C \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E41\u0E25\u0E30\u0E15\u0E31\u0E49\u0E07\u0E15\u0E23\u0E27\u0E08\u0E23\u0E2D\u0E1A\u0E41\u0E23\u0E01\u0E43\u0E19 3 \u0E27\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27`;
    message.textContent = notice;
    showToast(notice, saved.already_exists ? "warning" : "success");
    const latest = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(state.selected)}`);
    renderReviewSchedule(latest.products || [], Boolean(state.shopConnection), latest.product_events || []);
    renderPermanentInventory(latest.products || [], latest.product_events || []);
  } catch (error) {
    message.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
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
  button.dataset.productEvidence = "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 C \u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07";
  await setProductC(button);
  if (!button.disabled) input.value = "";
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
  await selectChannelBase(id);
  const inventory = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(id)}`);
  state.inventoryProducts = inventory.products || [];
  renderPermanentInventory(inventory.products || [], inventory.product_events || []);
  await loadTikTokConnection();
  document.body.classList.toggle("shop-connected", Boolean(state.shopConnection));
  renderReviewSchedule(inventory.products || [], Boolean(state.shopConnection), inventory.product_events || []);
};
$("#channels").addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-id]"), demoButton = event.target.closest("[data-demo-id]"), button = event.target.closest("[data-id]");
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
  if (demoButton || button) resetMarketplaceView();
  if (demoButton) selectDemoChannel(demoButton.dataset.demoId);
  else if (button) selectChannel(button.dataset.id).catch((error) => message.textContent = error.message);
});
$("#runs").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-run]");
  if (!button) return;
  try {
    const data = await api(`/api/admin/tiktok-analyzer?run_id=${encodeURIComponent(button.dataset.run)}`);
    renderResult(data.run.result);
  } catch (error) {
    message.textContent = error.message;
  }
});
$("#newChannel").addEventListener("click", () => {
  newChannel();
  setWorkspaceView("input");
  $("#tiktokConnection").hidden = true;
});
$("#syncTikTokShop").addEventListener("click", async () => {
  if (!state.shopConnection) return;
  const limitInput = $("#showcaseSyncLimit"), maxShowcase = Math.min(2000, Math.max(1, Math.floor(Number(limitInput.value) || 2000)));
  limitInput.value = String(maxShowcase);
  message.textContent = "กำลังดึงสินค้า Showcase สูงสุด " + maxShowcase.toLocaleString("th-TH") + " รายการ และออเดอร์ Affiliate ย้อนหลังสูงสุด 90 วัน…";
  $("#syncTikTokShop").disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_sync", id: state.shopConnection.id, days: 90, max_showcase: maxShowcase }) });
    message.textContent = `\u0E14\u0E36\u0E07\u0E41\u0E25\u0E49\u0E27 ${result.showcaseCount} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u0E41\u0E25\u0E30 ${result.orderCount} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C`;
    await loadTikTokConnection();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    $("#syncTikTokShop").disabled = false;
  }
});
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
$("#disconnectTikTokShop").addEventListener("click", async () => {
  if (!state.shopConnection || !confirm("\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 TikTok Shop \u0E41\u0E25\u0E30\u0E25\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E44\u0E27\u0E49?")) return;
  try {
    await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_disconnect", id: state.shopConnection.id }) });
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
    await searchMarketplace();
  } catch (error) {
    $("#marketplaceSnapshot").textContent = error.message;
    showToast(error.message, "error");
  }
});
$("#addMarketplaceSelected").addEventListener("click", async () => {
  if (!state.shopConnection) return;
  if (!state.shopConnection.capabilities?.can_write_showcase) return showToast("บัญชี Creator ยังไม่มีสิทธิ์เพิ่ม Showcase กรุณากดเชื่อมและอนุญาตสิทธิ์ใหม่", "error");
  const ids = [...document.querySelectorAll(".marketplace-product-check:checked")].map((input) => input.closest("[data-marketplace-product-id]").dataset.marketplaceProductId).filter(Boolean);
  if (!ids.length) return showToast("กรุณาเลือกสินค้า Marketplace ก่อน", "warning");
  const button = $("#addMarketplaceSelected");
  button.disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_add", id: state.shopConnection.id, product_ids: ids }) });
    showToast(result.warning || `เพิ่มสินค้าเข้า Showcase ของ ${state.shopConnection.creator_username || "บัญชี Creator"} แล้ว ${Number(result.added || ids.length).toLocaleString()} รายการ`, result.warning ? "warning" : "success");
    await loadTikTokConnection();
    renderMarketplaceProducts({ products: state.marketplaceProducts });
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
async function removeShowcaseProducts(ids, scopeLabel) {
  if (!state.shopConnection) return;
  const connectionId = state.shopConnection.id, account = state.shopConnection.creator_username || "บัญชี Creator";
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return showToast("ไม่มีสินค้า Showcase ให้ลบ", "warning");
  if (!confirm(`ยืนยัน${scopeLabel} ${uniqueIds.length.toLocaleString()} รายการออกจาก Showcase ของ ${account}? การกระทำนี้มีผลกับบัญชีจริงและย้อนกลับไม่ได้`)) return;
  const buttons = [$("#removeShowcasePage"), $("#removeShowcaseAll")];
  buttons.forEach((button) => { button.disabled = true; });
  let removed = 0;
  try {
    for (let index = 0; index < uniqueIds.length; index += 200) {
      const batch = uniqueIds.slice(index, index + 200);
      const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_remove", id: connectionId, product_ids: batch }) });
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
$("#removeShowcasePage").addEventListener("click", () => {
  const ids = [...document.querySelectorAll("#shopGradeList [data-product-id]")].map((row) => row.dataset.productId).filter(Boolean);
  return removeShowcaseProducts(ids, "ลบสินค้าในหน้านี้");
});
$("#removeShowcaseAll").addEventListener("click", () => removeShowcaseProducts(state.showcaseProducts.map((product) => product.product_id), "ลบสินค้าทั้งหมด"));
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
  message.textContent = shopOauthStatus === "connected" ? "เชื่อมบัญชี TikTok Shop Creator พร้อมใช้ Marketplace และ Showcase แล้ว" : shopOauthStatus === "account_already_linked" ? `บัญชี TikTok Shop นี้เชื่อมกับ “${detail || "ช่องอื่น"}” อยู่แล้ว ระบบจึงไม่ย้ายบัญชี กรุณาออกจาก TikTok Shop แล้วล็อกอินบัญชีของช่องที่เลือกก่อนเชื่อมใหม่` : shopOauthStatus === "permissions_required" ? `เชื่อมบัญชี Creator แล้ว แต่สิทธิ์ยังไม่ครบ: ${detail} กรุณาเปิดสิทธิ์ใน TikTok Partner Center แล้วเชื่อมใหม่` : shopOauthStatus === "denied" ? "ยกเลิกการอนุญาต TikTok Shop แล้ว" : `เชื่อม TikTok Shop ไม่สำเร็จ${detail ? `: ${detail}` : " กรุณาลองใหม่"}`;
  history.replaceState({}, "", location.pathname);
}
const oauthStatus = new URLSearchParams(location.search).get("tiktok");
if (oauthStatus) {
  message.textContent = oauthStatus === "connected" ? "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D TikTok \u0E41\u0E25\u0E30\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" : oauthStatus === "denied" ? "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 TikTok \u0E41\u0E25\u0E49\u0E27" : "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D TikTok \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48";
  history.replaceState({}, "", location.pathname);
}
if (reviewDemo) {
  document.body.classList.add("review-demo-mode");
  $("#reviewDemoLink").textContent = "\u0E01\u0E25\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07";
  $("#reviewDemoLink").href = "/tiktok-analyzer.html";
  renderShopDashboard({ ...demoShopData, review_demo: true }, null);
}
loadChannels();
