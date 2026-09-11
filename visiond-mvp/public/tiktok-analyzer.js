const COMMISSION_WORKSPACE_ENABLED = false; // Set true to restore the commission workspace and its data requests.
function createTikTokShopNavigation({ getState, setOutputScope, setWorkspaceView, setChannelView, navigate }) {
  const connectUrl = () => {
    const current = getState(), selected = String(current?.selected ?? "");
    if (!selected || !Array.isArray(current?.channels) || !current.channels.some((channel) => String(channel.id) === selected)) return "";
    return `/api/tiktok-shop/connect?channel_id=${encodeURIComponent(selected)}`;
  };
  return {
    connectUrl,
    connect() {
      const url = connectUrl();
      if (!url) return false;
      navigate(url);
      return true;
    },
    showTab(view) {
      if (view !== "products" && view !== "commission") return false;
      setOutputScope("channel");
      setWorkspaceView("output");
      setChannelView(view);
      return true;
    },
  };
}


function tiktokShopActionVisibility({ loading = false, selectable = false, connected = false } = {}) {
  const ready = !loading && Boolean(selectable);
  return { connect: ready && !connected };
}

function createTikTokChannelOwnership(getSelected) {
  let generation = 0, committedChannelId = "";
  const normalize = (value) => String(value ?? "");
  const current = (context) => Boolean(context?.channelId) && context.generation === generation && context.channelId === normalize(getSelected());
  return {
    begin(channelId) {
      generation += 1;
      committedChannelId = "";
      return { channelId: normalize(channelId), generation };
    },
    capture() {
      const channelId = normalize(getSelected());
      return channelId && channelId === committedChannelId ? { channelId, generation } : null;
    },
    current,
    commit(context) {
      if (!current(context)) return false;
      committedChannelId = context.channelId;
      return true;
    },
    revision: () => generation,
    unchanged: (revision) => revision === generation,
    adopt(channelId, revision) {
      if (revision !== generation) return null;
      const context = this.begin(channelId);
      committedChannelId = context.channelId;
      return context;
    },
    clear() {
      generation += 1;
      committedChannelId = "";
    }
  };
}

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
const pageParams = new URLSearchParams(location.search), requestedConnectMode = ["tiktok", "shop", "tiktok_new"].includes(pageParams.get("connect")) ? pageParams.get("connect") : "", handoffChannelId = requestedConnectMode && requestedConnectMode !== "tiktok_new" ? pageParams.get("channel_id") || "" : "";
const requestedChannelId = handoffChannelId || pageParams.get("channel_id") || savedUiValue("visiond_tiktok_channel_id") || null;
const browserProfileUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,launcherProfileRequested=pageParams.get("launcher_profile")==="1",launcherMode=["new","existing"].includes(pageParams.get("launcher_mode"))?pageParams.get("launcher_mode"):"",launcherSlot=browserProfileUuid.test(pageParams.get("launcher_slot")||"")?pageParams.get("launcher_slot"):"",launcherChannelId=launcherMode==="existing"&&browserProfileUuid.test(pageParams.get("channel_id")||"")?pageParams.get("channel_id"):"";
const launcherContextFromQuery=launcherProfileRequested&&launcherMode&&((launcherMode==="new"&&launcherSlot)||(launcherMode==="existing"&&launcherChannelId))?Object.freeze({mode:launcherMode,slotId:launcherSlot,channelId:launcherChannelId||(launcherMode==="new"&&browserProfileUuid.test(pageParams.get("channel_id")||"")?pageParams.get("channel_id"):"")}):null;
let launcherContext=launcherContextFromQuery;
let handoffOpened = false, launcherTargetConsumed = false, pageAuthorized = false, pageViewerId = "";
let state = { channels: [], channelPagination: {}, selected: requestedChannelId, connection: null, shopConnection: null, connectionLoadSeq: 0, shopDateFrom: dateDaysAgo(29), shopDateTo: commissionAvailability().latestDate, showcasePage: 1, showcaseSearch: "", showcaseProducts: [], inventoryProducts: [], inventoryEvents: [], inventoryCounts: {}, inventoryPagination: {}, marketplaceProducts: [], marketplaceCategories: [], marketplaceCategoriesForConnection: "", marketplaceCategoriesLoadingForConnection: "", marketplaceNextToken: "", marketplaceSearchedAt: "", marketplaceComparisonDays: 3, shopMarketplaceProducts: [], shopMarketplaceNextToken: "", shopMarketplaceSearchedAt: "", shopMarketplaceComparisonDays: 3 };
const setBrowserProfileStatus=(text,type="")=>{const status=$("[data-browser-profile-status]");if(status){status.textContent=text;status.dataset.type=type}};
const browserLauncher=window.createVisionDBrowserLauncher?.({cryptoApi:window.crypto,invoke:(uri)=>{location.href=uri},setStatus:setBrowserProfileStatus,storage:window.localStorage,getOwnerId:()=>pageViewerId})||null;
const commandLauncher=window.createVisionDCommandLauncher?.({cryptoApi:window.crypto,openWindow:(...args)=>window.open(...args)})||null;
const channelOwnership = createTikTokChannelOwnership(() => state.selected);
const shopConnectionRequests = new Map();
const inventoryRequests = new Map();
const marketplaceQueryRequests=new Map(),marketplaceQueryCache=new Map(),marketplaceLatest=new Map(),marketplaceSnapshots=new Map();
let marketplaceQueryTail=Promise.resolve(),marketplaceQuerySequence=0;
const shortlistRequests = new Map(), shortlistCache = new Map();
const inventoryVersions = new Map();
const commissionCardScript = document.createElement("script");
commissionCardScript.src = "/tiktok-commission-card.js?v=02092";
if(COMMISSION_WORKSPACE_ENABLED)document.head.append(commissionCardScript);
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
  setChannelView("products");
}, { capture: true });
const shopHeader = $("#shopDashboard .result-head>div"), resultHeader = $("#result .result-head>div"), manualHeader = $("#angelInventory .result-head>div");
shopHeader.querySelector("small").textContent = "AUTOMATIC \xB7 TIKTOK SHOP API";
shopHeader.querySelector("h2").textContent = "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E41\u0E22\u0E01\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07";
shopHeader.insertAdjacentHTML("beforeend", '<p class="source-caption">\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19 \u0E01\u0E23\u0E32\u0E1F\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</p>');
form.insertAdjacentHTML("afterbegin", '<div class="manual-source-note"><b>MANUAL ANALYSIS \xB7 \u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E01\u0E23\u0E2D\u0E01\u0E40\u0E2D\u0E07</b><span>\u0E43\u0E0A\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E44\u0E14\u0E49\u0E01\u0E48\u0E2D\u0E19 TikTok \u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 API \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E22\u0E2D\u0E14\u0E08\u0E32\u0E01 Showcase \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34</span></div>');
$("#newChannel").textContent = "กำลังตรวจ Helper…";
$("#newChannel").disabled = true;
$("#newChannel").setAttribute('aria-busy','true');
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
$(".workspace-switch")?.insertAdjacentHTML("afterend",'<section id="analysisChannelPicker" class="analysis-channel-picker" aria-labelledby="analysisChannelPickerTitle"><div><small>ช่องที่กำลังวิเคราะห์</small><h3 id="analysisChannelPickerTitle">เลือกช่องจากรายการที่เชื่อมแล้ว</h3><small data-browser-profile-label></small><button class="vds-btn vds-btn--secondary" type="button" data-refresh-profile>รีเฟรชสถานะช่อง</button></div><div id="analysisChannelOptions" class="analysis-channel-options" role="listbox" aria-label="เลือกช่องที่ต้องการวิเคราะห์"></div><div id="browserProfilePanel" class="analysis-channel-status"><p class="browser-profile-status" data-browser-profile-status role="status" aria-live="polite"></p></div></section>');
$("#analysisChannelPicker")?.insertAdjacentHTML("afterend", '<nav id="channelActionSwitch" class="channel-action-switch" aria-label="เลือกข้อมูลของช่อง"><button class="active" type="button" data-channel-view="products" aria-current="page">จัดการสินค้า</button>' + (COMMISSION_WORKSPACE_ENABLED ? '<button type="button" data-channel-view="commission" aria-current="false">ดูค่าคอม</button>' : '') + '</nav>');
function setChannelView(view) {
  const commission = COMMISSION_WORKSPACE_ENABLED && view === "commission";
  document.body.classList.toggle("channel-view-products", !commission);
  document.body.classList.toggle("channel-view-commission", commission);
  $("#channelActionSwitch")?.querySelectorAll("[data-channel-view]").forEach((button) => {
    const active = button.dataset.channelView === (commission ? "commission" : "products");
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}
$("#channelActionSwitch")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-channel-view]");
  if (button) tiktokShopNavigation.showTab(button.dataset.channelView);
});
setChannelView("products");
$("#channelShopAnalysis .result-head")?.insertAdjacentHTML("afterend", '<section id="shopConnectionRequired" class="shop-connection-required" hidden><b>ช่องนี้ยังไม่ได้เชื่อมระบบ TikTok Shop</b><p>TikTok ใช้ข้อมูลโปรไฟล์และวิดีโอ ส่วนออเดอร์ Marketplace และ Showcase ต้องเชื่อมระบบ TikTok Shop แยกอีกครั้ง</p><button type="button" data-connect-selected-shop>เชื่อม TikTok Shop สำหรับช่องนี้</button></section>');
$("#shopConnectionRequired [data-connect-selected-shop]")?.addEventListener("click", (event) => routeProfileConnection("shop",event.currentTarget));
$("#connectTikTokShop")?.addEventListener("click", (event) => {
  event.preventDefault();
  tiktokShopNavigation.connect();
});
$("#connectTikTok")?.addEventListener("click", (event) => {
  event.preventDefault();
  routeProfileConnection("tiktok");
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
function selectedChannel(){return state.channels.find(channel=>String(channel.id)===String(state.selected))||null}
function browserProfileMatches(channel){
  if(!launcherContext||!channel)return false;
  const slot=String(channel.browser_profile_slot_id||"");
  return slot?launcherContext.slotId===slot:launcherContext.mode==="existing"&&!launcherContext.slotId&&launcherContext.channelId===String(channel.id);
}
function connectionActionStatus(control,text,type=''){
  let node=control?.parentElement?.querySelector('[data-connection-action-status]');
  if(!node&&control){node=document.createElement('p');node.dataset.connectionActionStatus='';node.setAttribute('role','status');node.className='browser-profile-status';control.insertAdjacentElement('afterend',node)}
  if(node){node.textContent=text;node.dataset.type=type}else setBrowserProfileStatus(text,type);
  return node;
}
function helperRecoveryStatus(control,text){
 const node=connectionActionStatus(control,text+' หากยังไม่ติดตั้งหรือ Helper ไม่ทำงาน ให้เปิดขั้นตอนติดตั้งด้านล่าง โดยยังเก็บคำขอเดิมไว้','error')||$('[data-browser-profile-status]');
 if(node?.appendChild){const link=document.createElement('a');link.href='/launcher-setup';link.textContent='ดาวน์โหลด / ติดตั้ง / แก้ไข Helper';link.className='vds-btn vds-btn--secondary';link.dataset.helperRecovery='';node.appendChild(document.createElement('br'));node.appendChild(link)}
}
function routeProfileConnection(mode,control){return issueProfileOAuth(mode,control||$(mode==='tiktok_new'?'#newChannel':mode==='shop'?'#connectTikTokShop':'#connectTikTok'))}
function consumeLegacyConnectionHint(){handoffOpened=true;setBrowserProfileStatus(requestedConnectMode==='tiktok_new'?'กด + ช่องใหม่ เพื่อเข้าสู่ TikTok ในโปรไฟล์ใหม่':'เปิดช่องที่ระบุแล้ว กดปุ่มเชื่อม TikTok ของช่องนี้เพื่อดำเนินการ')}
const profileOAuthRequests=new Set();
const profileOAuthPendingKeys=new Set();
const profileHandoffRequests=new Map(),profileControlAttempts=new WeakMap();
let profileOAuthPending=false;
const launcherControllers=new Set();
let launcherPageActive=true;window.addEventListener('pagehide',()=>{launcherPageActive=false;launcherControllers.forEach(c=>c.abort())});
async function launcherFetch(url,options={},timeout=5000){
  const controller=new AbortController();launcherControllers.add(controller);let timer;
  const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('คำขอหมดเวลาหรือหน้าถูกปิด กรุณาตรวจสถานะก่อนลองใหม่')),{once:true}));
  try{return await Promise.race([(async()=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal}),body=await response.json();return {ok:response.ok,json:async()=>body}})(),aborted,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('คำขอหมดเวลา กรุณาตรวจสถานะก่อนลองใหม่'))},Math.max(1,timeout))})])}
  finally{clearTimeout(timer);launcherControllers.delete(controller)}
}
const launcherStatusReads=new Map();
let launcherReadiness={owner:'',helper:null,items:[],expires:0,hasMore:false,after:''},launcherReadinessRequest=null;
function renderLauncherChoices(){
 const root=$('#browserProfilePanel');if(!root)return;let box=root.querySelector('[data-helper-choice]');if(!box){box=document.createElement('div');box.dataset.helperChoice='';root.appendChild(box)}box.textContent='';
 if(!launcherReadiness.helper&&launcherReadiness.items?.length){const label=document.createElement('label');label.textContent='เลือก Helper ที่ผูกกับบัญชีนี้ ';const select=document.createElement('select'),empty=document.createElement('option');empty.value='';empty.textContent='เลือกเครื่อง…';select.appendChild(empty);for(const h of launcherReadiness.items){const option=document.createElement('option');option.value=h.id;option.textContent='Helper '+h.id.slice(-8)+' · '+(h.created_at||'');select.appendChild(option)}select.addEventListener('change',()=>{const helper=launcherReadiness.items.find(h=>h.id===select.value);if(!helper||launcherReadiness.owner!==pageViewerId)return;launcherReadiness.helper=helper;try{localStorage.setItem('visiond_launcher_helper',helper.id)}catch{}renderLauncherChoices();setBrowserProfileStatus('เลือกตัวช่วยที่ผูกกับบัญชีแล้ว กดเชื่อมช่องเพื่อตรวจการตอบรับจากเครื่อง')});label.appendChild(select);box.appendChild(label)}
 if(launcherReadiness.hasMore){const more=document.createElement('button');more.type='button';more.textContent='ดู Helper เพิ่ม';more.addEventListener('click',()=>prepareLauncherReadiness(true,launcherReadiness.nextCursor).catch(e=>setBrowserProfileStatus(e.message,'error')));box.appendChild(more)}
}
function launcherRegisteredMessage(){return launcherReadiness.helper?'พบ Helper ที่ผูกกับบัญชีแล้ว กดเชื่อมช่องเพื่อตรวจการตอบรับจริงจากเครื่อง':launcherReadiness.items?.length?'บัญชีนี้มี Helper ที่ผูกแล้ว โปรดเลือกเครื่องด้านบน':'ไม่พบ Helper ที่ผูกกับบัญชี VisionD ที่เข้าสู่ระบบนี้ ตรวจบัญชีหรือไปตั้งค่า Helper';}
async function prepareLauncherReadiness(force=false,after=''){
 const owner=pageViewerId,key=owner+':'+after;if(launcherReadinessRequest?.key===key)return launcherReadinessRequest.promise;
 if(!force&&launcherReadiness.owner===owner&&launcherReadiness.expires>Date.now()&&launcherReadiness.after===after)return launcherReadiness.helper;
 const pending={key};pending.promise=(async()=>{const response=await launcherFetch('/api/launcher/helpers'+(after?'?after='+encodeURIComponent(after):'')),data=await response.json();if(owner!==pageViewerId||!pageAuthorized||!launcherPageActive||launcherReadinessRequest!==pending)return null;if(!response.ok){launcherReadiness={owner,helper:null,items:[],expires:0};throw new Error('ตรวจสถานะตัวช่วยไม่ได้ กรุณาเข้าสู่ระบบหรือลองรีเฟรชอีกครั้ง')}let saved='';try{saved=localStorage.getItem('visiond_launcher_helper')||''}catch{}const items=Array.isArray(data.items)?data.items:[],helper=items.find(h=>h.id===saved)||(!after&&items.length===1&&!data.has_more?items[0]:null);launcherReadiness={owner,helper,items,hasMore:!!data.has_more,nextCursor:data.next_cursor||'',after,expires:Date.now()+30000};if(helper)try{localStorage.setItem('visiond_launcher_helper',helper.id)}catch{}renderLauncherChoices();return helper})().finally(()=>{if(launcherReadinessRequest===pending)launcherReadinessRequest=null});launcherReadinessRequest=pending;return pending.promise;
}
function readLauncherStatus(commandId){
  let pending=launcherStatusReads.get(commandId);
  if(!pending){pending=launcherFetch('/api/launcher/status?command_id='+encodeURIComponent(commandId)).finally(()=>launcherStatusReads.delete(commandId));launcherStatusReads.set(commandId,pending)}
  return pending.then(response=>response.clone?response.clone():response);
}
async function initializeLauncherReadiness(){
 const control=$('#newChannel'),owner=pageViewerId;
 if(control){control.disabled=true;control.setAttribute('aria-busy','true');control.textContent='กำลังตรวจ Helper…'}
 try{await prepareLauncherReadiness()}
 catch(error){if(launcherPageActive&&pageAuthorized&&owner===pageViewerId)helperRecoveryStatus(control,error.message)}
 finally{if(control){control.disabled=false;control.removeAttribute('aria-busy');control.textContent='+ ช่องใหม่'}}
}
function clearProfileCommand(pending){
 if(profileHandoffRequests.get(pending.key)!==pending)return false;
 profileOAuthPendingKeys.delete(pending.key);profileHandoffRequests.delete(pending.key);profileOAuthPending=profileHandoffRequests.size>0;return true;
}
function launcherOAuthStage(result){
 if(result.error_code==='HELPER_UPDATE_REQUIRED')return 'ต้องอัปเดต Helper เป็น v0.20.78 ก่อนเปิด Chrome ดาวน์โหลดและติดตั้งรุ่นใหม่จากหน้าตั้งค่า โปรไฟล์และการผูกเดิมยังคงอยู่';
 if(result.oauth_status==='complete')return (result.oauth_provider==='shop'?'บันทึกการอนุญาต TikTok Shop แล้ว':result.oauth_provider==='tiktok'?'บันทึกการอนุญาต TikTok Login Kit แล้ว':'บันทึกการอนุญาตแล้ว')+' สถานะสิทธิ์ API แสดงแยกตามช่อง';
 if(result.expired)return 'คำขอหมดอายุแล้ว';
 if(['failed','cancelled'].includes(result.status))return 'คำขอเปิดสิ้นสุดแล้ว ยังไม่ยืนยันการอนุญาต API';
 if(result.status==='unknown')return 'ผลการเปิดยังไม่แน่นอน ตรวจหน้าต่างเดิมก่อน ยังไม่เปิดซ้ำ';
 const stage=result.oauth_provider==='tiktok'?(result.oauth_continuation==='shop'?'ขั้นแรก: อนุญาต Login Kit เพื่อยืนยันโปรไฟล์ช่องนี้ก่อน จากนั้นจะไป TikTok Shop ในหน้าต่างเดิม':'กำลังรอการอนุญาต TikTok Login Kit ในหน้าต่างประจำช่อง'):result.oauth_provider==='shop'?'กำลังรอการอนุญาต TikTok Shop Creator ในหน้าต่างประจำช่อง':'ยังไม่มีขั้น OAuth ที่ยืนยันจากเซิร์ฟเวอร์';
 return (result.status==='process_started'?'ตัวช่วยยืนยันว่าเริ่ม Chrome แล้ว · ':'')+stage;
}
async function reconcileProfileCommand(mode,control,pending){
 if(!pending||profileOAuthRequests.has(pending.key))return false;
 const revision=channelOwnership.revision(),owner=pageViewerId,attempt={};
 const current=()=>launcherPageActive&&pageAuthorized&&owner===pageViewerId&&pending.owner===owner&&channelOwnership.unchanged(revision)&&profileHandoffRequests.get(pending.key)===pending&&(pending.key==='new'||String(selectedChannel()?.id)===pending.key);
 profileOAuthRequests.add(pending.key);if(control){profileControlAttempts.set(control,attempt);control.setAttribute('aria-busy','true')}
 try{
  const response=await readLauncherStatus(pending.commandId),result=await response.json();if(!current())return false;
  if(!response.ok||result.command_id&&result.command_id!==pending.commandId)throw new Error('อ่านสถานะคำขอเดิมไม่ได้ ยังไม่เปิดคำขอซ้ำ');
  const terminal=result.oauth_status==='complete'||result.expired||['failed','cancelled'].includes(result.status);
  if(result.oauth_status==='complete'&&pending.key==='new'&&typeof refreshProfileStatus==='function'){await refreshProfileStatus();return false}
  if(terminal){clearProfileCommand(pending);if(result.error_code==='HELPER_UPDATE_REQUIRED')helperRecoveryStatus(control,launcherOAuthStage(result));else connectionActionStatus(control,launcherOAuthStage(result));
   return false}
  connectionActionStatus(control,launcherOAuthStage(result)+' · ยังเก็บคำขอเดิมไว้ ไม่สร้าง OAuth ซ้ำ');
  const node=control?.parentElement?.querySelector('[data-connection-action-status]');
  const action=(label,fn)=>{if(!node)return;const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{if(current()&&!button.disabled){button.disabled=true;try{Promise.resolve(fn()).catch(e=>{if(current())helperRecoveryStatus(control,e.message)}).finally(()=>{button.disabled=false})}catch(e){button.disabled=false;if(current())helperRecoveryStatus(control,e.message)}}});node.appendChild(button)};
  if(['pending','claimed'].includes(result.status))action('เปิดคำขอเดิมต่อ',()=>{commandLauncher.resumeCommand(pending.commandId);connectionActionStatus(control,'ส่งคำขอเดิมไปยัง Helper แล้ว กดตรวจสถานะเพื่อดูผลตอบรับ');});
  action('ตรวจสถานะคำขอเดิม',()=>reconcileProfileCommand(mode,control,pending));
  if(['pending','waiting'].includes(result.status))action('ยกเลิกคำขอเดิม',async()=>{const r=await launcherFetch('/api/launcher/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command_id:pending.commandId})});if(!current())return;if(!r.ok)throw new Error('คำขอถูก Helper รับแล้วหรือยังไม่แน่นอน กรุณาตรวจสถานะใหม่');clearProfileCommand(pending);connectionActionStatus(control,'ยกเลิกคำขอเดิมแล้ว กดเชื่อมอีกครั้งเพื่อเริ่มใหม่')});
  return false;
 }catch(e){if(current())helperRecoveryStatus(control,e.message);return false}
 finally{profileOAuthRequests.delete(pending.key);if(control&&profileControlAttempts.get(control)===attempt){profileControlAttempts.delete(control);control.removeAttribute('aria-busy')}}
}
async function issueProfileOAuth(mode,control){
  const create=mode==='tiktok_new',provider=mode==='shop'?'shop':'tiktok',context=channelOwnership.capture(),revision=channelOwnership.revision(),owner=pageViewerId;
  const channelId=create?'':context?.channelId||'',key=create?'new':channelId;
  if(profileOAuthRequests.has(key))return false;
  if(profileOAuthPendingKeys.has(key))return reconcileProfileCommand(mode,control,profileHandoffRequests.get(key));
  if(!launcherPageActive)return false;
  if(!pageAuthorized||!commandLauncher||!create&&(!context||String(selectedChannel()?.id)!==channelId)){connectionActionStatus(control,'กรุณารอให้ช่องโหลดเสร็จแล้วลองอีกครั้ง','error');return false}
  if(launcherReadiness.owner!==owner||!launcherReadiness.helper&&launcherReadiness.expires<=Date.now()){
    connectionActionStatus(control,'กำลังตรวจ Helper…');
    try{await prepareLauncherReadiness();if(owner===pageViewerId&&channelOwnership.unchanged(revision))(launcherReadiness.helper?connectionActionStatus(control,launcherRegisteredMessage()):helperRecoveryStatus(control,launcherRegisteredMessage()))}catch(e){if(owner===pageViewerId&&channelOwnership.unchanged(revision))helperRecoveryStatus(control,e.message)}return false;
  }
  const helper=launcherReadiness.helper;
  if(!helper){helperRecoveryStatus(control,launcherRegisteredMessage());return false}
  const attempt={};profileOAuthRequests.add(key);if(control){profileControlAttempts.set(control,attempt);control.setAttribute('aria-busy','true')}
  connectionActionStatus(control,'กำลังเปิด TikTok ใน Chrome ประจำบัญชี…');
  const current=()=>launcherPageActive&&owner===pageViewerId&&pageAuthorized&&channelOwnership.unchanged(revision)&&(create||channelOwnership.current(context));
  try{
    const commandId=commandLauncher.openCommand({provider,intent:create?'new':mode==='view'?'view':'reconnect',channel_id:channelId});
    const pending={commandId,revision,owner,key,provider,intent:create?'new':mode==='view'?'view':'reconnect'};profileOAuthPendingKeys.add(key);profileOAuthPending=true;profileHandoffRequests.set(key,pending);
    const issued=await launcherFetch('/api/tiktok/handoff',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({helper_id:helper.id,command_id:commandId,provider,intent:create?'new':mode==='view'?'view':'reconnect',channel_id:channelId})}),issueBody=await issued.json();if(!current())return false;
    if(!issued.ok||issueBody.command_id!==commandId)throw new Error(issueBody.error||'สร้างคำขอไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่');
    const pollDeadline=Date.now()+25000;
    for(const delay of [0,500,1000,1500,2500,4000,6000,8000]){
      if(delay)await new Promise(resolve=>setTimeout(resolve,Math.min(delay,Math.max(0,pollDeadline-Date.now()))));if(!current())return false;if(Date.now()>=pollDeadline)throw new Error('หมดเวลารอ กรุณาตรวจสถานะก่อนลองใหม่');
      const response=await readLauncherStatus(commandId),body=await response.json();if(!current())return false;
      if(!response.ok)throw new Error('ตรวจสถานะตัวช่วยไม่สำเร็จ กรุณาลองรีเฟรชสถานะ');
      if(body.handoff_id){pending.id=body.handoff_id;pending.slotId=body.slot_id}
      if(['pending','claimed'].includes(body.status))connectionActionStatus(control,launcherOAuthStage(body));
      if(body.oauth_status==='complete'){if(pending.key==='new'&&typeof refreshProfileStatus==='function')await refreshProfileStatus();else clearProfileCommand(pending);connectionActionStatus(control,launcherOAuthStage(body));return true}
      if(body.status==='process_started'){connectionActionStatus(control,launcherOAuthStage(body));if(mode==='view'){profileOAuthPendingKeys.delete(key);profileHandoffRequests.delete(key)}return true}
      if(['failed','unknown','cancelled'].includes(body.status)||body.expired)throw new Error(launcherOAuthStage(body));
    }
    throw new Error('ยังไม่พบการยืนยันจากตัวช่วย ตรวจว่า helper ทำงานและผูกเครื่องแล้ว จากนั้นกดตรวจสถานะก่อนลองใหม่');
  }catch(error){if(current())helperRecoveryStatus(control,error.message);return false}
  finally{profileOAuthRequests.delete(key);if(control&&profileControlAttempts.get(control)===attempt){profileControlAttempts.delete(control);control.removeAttribute('aria-busy')}}
}
function updateBrowserProfilePanel(){
  const channel=selectedChannel(),label=$('[data-browser-profile-label]');
  if(label)label.textContent=channel?'โปรไฟล์ของช่อง '+(channel.name||'ที่เลือก'):'ยังไม่ได้เลือกช่อง';
}
const tiktokShopNavigation = createTikTokShopNavigation({ getState: () => state, setOutputScope, setWorkspaceView, setChannelView, navigate: () => routeProfileConnection("shop") });
async function loadPortfolioDashboard() {
  const [data, [commission, referral]] = await Promise.all([api(`/api/admin/tiktok-connections?${shopDateQuery()}`), loadCommissionWorkspace(`from=${state.shopDateFrom}&to=${state.shopDateTo}`)]);
  renderShopDashboard({ ...data, shop_products: data.shop_portfolio?.products || [], shop_orders: data.shop_portfolio?.orders || [] }, data.shop_connections?.[0] || null);
  if(COMMISSION_WORKSPACE_ENABLED)renderAccurateCommission(commission, referral);
}

async function loadCommissionWorkspace(query){
  if(!COMMISSION_WORKSPACE_ENABLED)return [null,null];
  return Promise.all([api(`/api/admin/tiktok-commissions?${query}`),api('/api/vx/referrals').catch(()=>null)]);
}

function renderAccurateCommission(data, referral) {
  const totals = data?.totals || [], channels = data?.channels || [], series = data?.series || [], collectorChannels=data?.collector_channels||[], range = `${data?.from || state.shopDateFrom} ถึง ${data?.to || state.shopDateTo}`;
  state.commissionCards = totals.map(total => ({ owner: state.selected ? (state.channels.find(channel => channel.id === state.selected)?.name || 'ช่องที่เลือก') : 'รวมทุกช่อง', range, dateFrom:data?.from||state.shopDateFrom, dateTo:data?.to||state.shopDateTo, basis:total.basis||'unknown', total: total.amount, currency: total.currency, channels: channels.filter(channel => channel.currency === total.currency && channel.basis === total.basis), referralUrl: referral?.link || '' }));
  const basisLabel = { actual: 'ยืนยันแล้ว', actual_center: 'ยืนยันแล้ว', estimated: 'ประมาณการ', unknown: 'TikTok ไม่ระบุประเภท' };
  const referralLink=referral?.link||'',defaultName=state.commissionOwnerName||state.commissionCards?.[0]?.owner||'',defaultCaption=state.commissionCaption||`สรุปค่าคอม VX ช่วง ${range}\n${referralLink}\n#VX #Vtools #VisionD`;
  $('#shopCommissionDashboard').innerHTML = totals.length ? `<div class="commission-accurate"><form id="commissionShareForm" class="commission-share-form"><h3>สร้างรูปสรุปค่าคอม</h3><label>ชื่อที่แสดงบนรูป<input name="owner" maxlength="80" value="${escapeHtml(defaultName)}" required></label><label>จากวันที่<input name="date_from" type="date" value="${escapeHtml(data?.from||state.shopDateFrom)}" max="${escapeHtml(commissionAvailability().latestDate)}" required></label><label>ถึงวันที่<input name="date_to" type="date" value="${escapeHtml(data?.to||state.shopDateTo)}" max="${escapeHtml(commissionAvailability().latestDate)}" required></label><label class="wide">แคปชั่นและแฮชแท็ก<textarea name="caption" rows="3" maxlength="1000">${escapeHtml(defaultCaption)}</textarea></label><label class="wide">ลิงก์แนะนำ VX ของฉัน<div class="commission-referral-row"><input name="referral_url" value="${escapeHtml(referralLink)}" readonly><button type="button" data-copy-vx-referral>${referralLink?'คัดลอกลิงก์':'สร้างลิงก์แนะนำ'}</button></div></label><p class="wide hint">เลือกวันเดียวให้ใส่วันที่เริ่มและสิ้นสุดเป็นวันเดียวกัน</p><div id="commissionPreparedActions" class="commission-prepared-actions wide" hidden><span></span><button type="button" data-social-share>แชร์ไปโซเชียล</button><button type="button" data-copy-commission-caption>คัดลอกแคปชั่น</button></div><div id="commissionImagePreview" class="commission-image-preview wide" hidden aria-live="polite"></div></form><div class="commission-total-grid">${totals.map((total, index) => `<article><small>${escapeHtml(basisLabel[total.basis] || total.basis)} · ${escapeHtml(total.currency)}</small><b>${Number(total.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(total.currency)}</b><button type="button" data-generate-commission="${index}">สร้างรูป</button></article>`).join('')}</div><h3>ค่าคอมแยกตามช่อง</h3><div class="commission-channel-table">${channels.map(channel => `<div><span>${escapeHtml(channel.channel)}<small>${escapeHtml(basisLabel[channel.basis] || channel.basis)}</small></span><b>${Number(channel.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(channel.currency)}</b></div>`).join('')}</div><h3>ค่าคอมรายวัน</h3><div class="commission-daily-table">${series.map(day => `<div><time>${escapeHtml(day.day)}</time><span>${escapeHtml(day.channel)}</span><small>${escapeHtml(basisLabel[day.basis] || day.basis)}</small><b>${Number(day.amount).toLocaleString('th-TH',{maximumFractionDigits:2})} ${escapeHtml(day.currency)}</b></div>`).join('')}</div><p class="hint">${escapeHtml(data.coverage?.note || '')} · ${Number(data.coverage?.orders || 0).toLocaleString()} ออเดอร์ · ซิงก์ล่าสุด ${escapeHtml(data.coverage?.last_synced_at || 'ยังไม่ระบุ')}</p></div>` : '<p class="hint">ยังไม่มีค่าคอมจากออเดอร์ที่ไม่ถูกยกเลิกหรือคืนสินค้าในช่วงนี้</p>';
  if (totals.length) $('#shopCommissionDashboard .commission-accurate')?.insertAdjacentHTML('afterbegin', `<div class="commission-range-actions"><button type="button" data-commission-days="7">7 วัน</button><button type="button" data-commission-days="30">30 วัน</button><span>${escapeHtml(range)}</span></div>`);
  const statusLabel={not_connected:'ยังไม่เชื่อม',connecting:'กำลังตรวจ',ready:'พร้อมอ่าน',reconnect_required:'ต้องเชื่อมใหม่',error:'อ่านไม่สำเร็จ'};
  $('#shopCommissionDashboard').insertAdjacentHTML('afterbegin',`<div class="collector-channel-status"><b>สถานะตัวอ่านค่าคอม</b>${collectorChannels.length?collectorChannels.map(item=>`<span data-status="${escapeHtml(item.status||'not_connected')}">${escapeHtml(item.channel||'ไม่ระบุช่อง')} · ${escapeHtml(statusLabel[item.status]||item.status||'ยังไม่เชื่อม')}${item.last_success_at?` · ล่าสุด ${escapeHtml(item.last_success_at)}`:''}</span>`).join(''):'<span>ยังไม่มีช่องที่เชื่อม TikTok Shop</span>'}</div>`);
}
$("#shopCommissionDashboard").addEventListener("click", async event => {
  if(!COMMISSION_WORKSPACE_ENABLED)return;
  const button = event.target.closest('[data-commission-days]');
  if (!button) return;
  const days = Number(button.dataset.commissionDays) || 30;
  const context=state.selected?channelContextFor(button):null;if(state.selected&&!context)return;
  state.shopDateTo = commissionAvailability().latestDate; state.shopDateFrom = dateDaysAgo(days - 1);
  button.disabled = true;
  try { if (context) await loadTikTokConnection(context.channelId,context); else await loadPortfolioDashboard(); } catch (error) { if(!context||channelOwnership.current(context))showToast(error.message, 'error'); }
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
  const byId = resolvedSoldProducts(products, orders), sold = /* @__PURE__ */ new Map();
  orders.forEach((order) => (safeJson(order.product_ids) || []).forEach((id) => {
    const key = String(id), row = sold.get(key) || { count: 0, last: 0 };
    row.count++;
    row.last = Math.max(row.last, Number(order.create_time) || 0);
    sold.set(key, row);
  }));
  const rows = [...sold.entries()].map(([id, metrics]) => ({ product: byId.get(id) || { product_id: id, name: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, ...metrics })).sort((a, b) => b.count - a.count || b.last - a.last);
  if (!rows.length) return orders.length?'<p class="hint">พบออเดอร์ แต่ยังไม่มีรายละเอียดสินค้าที่ใช้แสดงผล</p>':'<p class="shop-empty-range">ช่วงวันที่นี้ยังไม่มีสินค้าที่ขายได้</p>';
  return `<div class="shop-product-table-wrap"><table class="shop-product-table"><thead><tr><th>\u0E25\u0E33\u0E14\u0E31\u0E1A</th><th>เกรด</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49</th><th>\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</th><th>\u0E02\u0E32\u0E22\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</th></tr></thead><tbody>${rows.map((row, index) => { const grade = shopSalesGrade(row.count); return `<tr><td>${index + 1}</td><td><span class="type-pill type-${grade}" title="เกรด ${grade} จาก ${row.count.toLocaleString()} ออเดอร์ในช่วงวันที่เลือก">${grade}</span></td><td><b>${escapeHtml(row.product.name || "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32")}</b><small>เกรด ${grade} · คำนวณจาก ${row.count.toLocaleString()} ออเดอร์จริง</small></td><td><code>${escapeHtml(row.product.product_id || "\u2013")}</code></td><td>${row.count.toLocaleString()} \u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</td><td>${new Date((row.last + 25200) * 1e3).toISOString().slice(0, 10)}</td></tr>`; }).join("")}</tbody></table></div><div class="shop-grade-note"><b>เกรดจากยอดขายจริงต่อเดือน</b><span>A = 30 ชิ้นขึ้นไป · สินค้าหลัก</span><span>B = 16–29 ชิ้น · สินค้ารอง</span><span>C = 1–15 ชิ้น · สินค้าที่ขายได้เล็กน้อย</span><span>ไม่มีเกรด = 0 ชิ้นในเดือนนี้</span><small>เกรดเปลี่ยนตามข้อมูลยอดขายของแต่ละเดือน ไม่ใช่คะแนนคุณภาพถาวรของสินค้า</small></div>`;
}
function soldProductName(value) {
  const name = String(value || "").trim();
  return ["ไม่พบรายละเอียดสินค้า", "ไม่พบชื่อสินค้า"].includes(name) ? "" : name;
}
function resolvedSoldProducts(products = [], orders = []) {
  const byId = new Map();
  for (const product of products) {
    const id = String(product?.product_id || "").trim();
    if (id) byId.set(id, { ...product, product_id: id, name: soldProductName(product.name) });
  }
  for (const order of orders) for (const detail of arrayValue(order.product_details)) {
    const id = String(detail?.product_id || "").trim(), current = byId.get(id);
    if (id && (!current || !current.name)) byId.set(id, { ...current, ...detail, product_id: id, name: soldProductName(detail?.name), product_url: detail?.product_url || current?.product_url || "" });
  }
  return byId;
}
function shopRangeSummary(data, products, orders) {
  const sync=data.order_sync||{status:'never'},verified=sync.status==='complete'&&!sync.truncated;
  const explanations={never:'กดแสดงผลเพื่อดึงออเดอร์ในช่วงวันที่นี้',failed:'ดึงออเดอร์ไม่สำเร็จ ข้อมูลเดิมยังอยู่ กดแสดงผลเพื่อลองใหม่',partial:'มีข้อมูลบางส่วน กดแสดงผลเพื่อทำต่อจนครบ',running:'กำลังดึงออเดอร์ กรุณากดแสดงผลเพื่อตรวจสถานะ',missing_scope:'บัญชีนี้ยังไม่ได้ให้สิทธิ์อ่านออเดอร์ creator.affiliate_collaboration.read',provider_not_ready:'TikTok ยังไม่พร้อมส่งข้อมูล กรุณาลองดึงอีกครั้ง',unavailable:'ไม่พบการเชื่อมต่อของช่องนี้',invalid_range:'กรุณาเลือกวันที่ผ่านมาไม่เกิน 90 วัน',complete:sync.truncated?'ผลลัพธ์มีมากกว่าขอบเขตที่แสดง กรุณาลดช่วงวันที่':'ดึงออเดอร์ครบช่วงวันที่แล้ว'};
  const syncText=explanations[sync.status]||'ยังยืนยันความครบถ้วนของข้อมูลไม่ได้';
  const syncPanel=`<p class="hint" role="status">${escapeHtml(syncText)}</p>`;
  const range = data.date_range || { from: state.shopDateFrom, to: state.shopDateTo };
  const rangeLabel = `${displayDate(range.from)}–${displayDate(range.to)}`;
  const serverAvailability = data.commission_availability, availability = serverAvailability ? { ready: Boolean(serverAvailability.ready), latestDate: serverAvailability.latest_date } : commissionAvailability(), availabilityText = `เลือกดึงออเดอร์ย้อนหลังได้ถึง ${availability.latestDate} · ข้อมูลขึ้นอยู่กับผลตอบกลับจาก TikTok`;
  return `<form id="shopDateFilter" class="shop-date-filter"><label>\u0E08\u0E32\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_from" type="date" value="${escapeHtml(range.from)}" max="${availability.latestDate}" required></label><label>\u0E16\u0E36\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48<input name="date_to" type="date" value="${escapeHtml(range.to)}" max="${availability.latestDate}" required></label><button type="submit">แสดงผล</button></form>${syncPanel}<p class="hint commission-availability-note">${escapeHtml(availabilityText)}</p><div class="shop-range-kpis"><span><small>\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49</small><b>${verified?orders.length.toLocaleString():'ยังไม่สรุป'}</b></span></div><h3 class="sold-products-heading">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${escapeHtml(rangeLabel)}</h3>${orders.length||verified?soldProductSummaryTable(products, orders):''}`;
}
function decorateSoldProductSelection(products = [], orders = []) {
  const table = $("#soldProductsData .shop-product-table");
  if (!table) return;
  const header = table.querySelector("thead tr");
  if (header && !header.querySelector(".sold-selection-heading")) header.insertAdjacentHTML("beforeend", '<th class="sold-selection-heading">ลิสต์คัดสินค้า</th>');
  const productsById = resolvedSoldProducts(products, orders);
  const selectedNames = new Set((state.inventoryProducts || []).filter((product) => product.inventory_status === "kept").map((product) => normalizeProductName(product.name)));
  table.querySelectorAll("tbody tr").forEach((row) => {
    if (row.querySelector("[data-select-sold-product]")) return;
    const product = productsById.get(row.cells[3]?.textContent?.trim() || "");
    const name = product?.name || "";
    if (!name) {
      row.insertAdjacentHTML("beforeend", '<td><button class="marketplace-row-add marketplace-selection-add" type="button" disabled>ข้อมูลไม่พร้อม</button></td>');
      return;
    }
    const selected = selectedNames.has(normalizeProductName(name));
    const sales = Number((row.cells[4]?.textContent || "").replace(/[^0-9]/g, "")) || 0;
    const grade = shopSalesGrade(sales) || "D";
    row.insertAdjacentHTML("beforeend", `<td><button class="marketplace-row-add marketplace-selection-add" type="button" data-select-sold-product data-product-name="${escapeHtml(product.name)}" data-product-url="${escapeHtml(product.product_url || "")}" data-product-grade="${grade}" data-product-sales="${sales}" data-product-evidence="ยอดขาย 30 วัน ${sales.toLocaleString()} ออเดอร์ · เกรด ${grade}" ${selected ? "disabled" : ""}>${selected ? "อยู่ในลิสต์คัดสินค้าแล้ว" : "เพิ่มเข้าลิสต์คัดสินค้า"}</button></td>`);
  });
}
async function syncSelectedSoldProductGrades(context = channelOwnership.capture()) {
  if (!context || !channelOwnership.current(context)) return;
  const selectedByName = new Map((state.inventoryProducts || []).filter((product) => product.inventory_status === "kept" && product.source_kind === "sold_product_selection").map((product) => [normalizeProductName(product.name), product]));
  const updates = [...document.querySelectorAll("[data-select-sold-product]")].map((button) => ({ name: button.dataset.productName || "", grade: button.dataset.productGrade || "D", sales: Number(button.dataset.productSales) || 0 })).filter((item) => {
    const current = selectedByName.get(normalizeProductName(item.name));
    return current && current.product_type !== item.grade;
  });
  if (!updates.length) return;
  const data = new FormData();
  data.set("action", "sync_sold_product_grades");
  data.set("channel_id", context.channelId);
  data.set("sales_grades", JSON.stringify(updates));
  await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
  if(!channelOwnership.current(context))return;
  await refreshOwnedInventory(context);
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
    return removeShowcaseProducts([button.dataset.productId], `ลบสินค้า “${button.dataset.productName || button.dataset.productId}”`, button);
  };
  const context=channelOwnership.capture();if(context)stampChannelOwnedActions(list,context);
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
async function loadMarketplaceCategories(context = channelOwnership.capture()) {
  const connection = context&&state.shopConnection&&String(state.shopConnection.channel_id)===context.channelId?state.shopConnection:null, select = $("#marketplaceCategory");
  if (!connection?.capabilities?.can_search_marketplace || state.marketplaceCategoriesLoadingForConnection === connection.id) return;
  if (state.marketplaceCategoriesForConnection === connection.id && state.marketplaceCategories.length) return;
  state.marketplaceCategoriesLoadingForConnection = connection.id;
  select.disabled = true;
  select.innerHTML = '<option value="">กำลังโหลดหมวดหมู่จาก TikTok…</option>';
  try {
    const data = await api("/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id, channel_id: context.channelId, categories_only: true }) });
    if (!channelOwnership.current(context)||state.shopConnection?.id !== connection.id) return;
    state.marketplaceCategoriesForConnection = connection.id;
    renderMarketplaceCategories(data.categories || []);
    select.title = data.categories?.length ? `พบ ${data.categories.length} หมวดหมู่จากรหัสที่ TikTok ส่งมา` : "ยังไม่มีรหัสหมวดหมู่จากข้อมูล TikTok ที่เคยค้นหา";
  } catch (error) {
    if (channelOwnership.current(context)&&state.shopConnection?.id === connection.id) {
      renderMarketplaceCategories();
      select.title = `โหลดหมวดหมู่ไม่สำเร็จ: ${error.message}`;
    }
  } finally {
    if (state.marketplaceCategoriesLoadingForConnection === connection.id) state.marketplaceCategoriesLoadingForConnection = "";
    if (channelOwnership.current(context)&&state.shopConnection?.id === connection.id) select.disabled = false;
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
    const actions = `<td>${productLinkControl(product.product_url)}</td><td><button class="marketplace-row-add" type="button" data-add-marketplace-product="${escapeHtml(product.product_id)}">เพิ่มเข้า Showcase</button></td><td><button class="marketplace-row-add marketplace-selection-add" type="button" data-select-marketplace-product="${escapeHtml(product.product_id)}">เพิ่มเข้าลิสต์คัดสินค้า</button></td>`;
    return mode === "shop" ? `<tr data-marketplace-product-id="${escapeHtml(product.product_id)}"><td><input class="marketplace-product-check" type="checkbox" aria-label="เลือก ${name}"></td><td><div class="showcase-product-cell">${picture}<div>${title}<code>${escapeHtml(product.product_id)}</code></div></div></td><td>${escapeHtml(product.shop_name || "–")}</td><td>${Number(product.units_sold || 0).toLocaleString()}</td><td>${Number(product.commission_rate || 0) ? `${(Number(product.commission_rate) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : "–"}</td><td>${escapeHtml(product.category_name||product.category_id||"–")}</td>${actions}</tr>` : `<tr data-marketplace-product-id="${escapeHtml(product.product_id)}"><td><input class="marketplace-product-check" type="checkbox" aria-label="เลือก ${name}"></td><td><div class="showcase-product-cell">${picture}<div>${title}<code>${escapeHtml(product.product_id)}</code></div></div></td><td>${escapeHtml(product.shop_name || "–")}</td><td>${Number(product.units_sold || 0).toLocaleString()}</td><td>${Number(product.commission_rate || 0) ? `${(Number(product.commission_rate) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%` : "–"}</td><td><span class="gmv-growth ${growthClass}">${growthText}</span></td>${actions}</tr>`;
  }).join("");
  const nextId = mode === "shop" ? "marketplaceShopNext" : "marketplaceNext";
  const headers=mode==="shop"?"<th>เลือก</th><th>รูปและสินค้า</th><th>ร้านค้า</th><th>ขายแล้ว</th><th>ค่าคอม</th><th>หมวดหมู่</th><th>ลิงก์สินค้า</th><th>Showcase</th><th>ลิสต์คัดสินค้า</th>":`<th>เลือก</th><th>สินค้า</th><th>ร้านค้า</th><th>ขายแล้ว</th><th>ค่าคอม</th><th>เติบโต ${view.comparisonDays} วัน</th><th>ลิงก์สินค้า</th><th>Showcase</th><th>ลิสต์คัดสินค้า</th>`;
  const columnCount = 9;
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
  const moreButton=$(`#${nextId}`);moreButton?.addEventListener("click", () => {const context=channelContextFor(moreButton);if(context)searchMarketplace(mode, view.nextToken,context)});
  const context=channelOwnership.capture();if(context){stampChannelOwnedActions(box,context);addButton.dataset.channelOwner=context.channelId}
}
async function searchMarketplace(mode = "product", pageToken = "", expectedContext = null) {
  if(mode!=="product"&&mode!=="shop"){pageToken=mode;mode="product"}
  const context=expectedContext||channelOwnership.capture(),owner=pageViewerId,requestedChannelId=context?.channelId||"";
  if(!context)throw new Error("เปลี่ยนช่องแล้ว กรุณากดค้นหาอีกครั้ง");
  const shopMode=mode==="shop",previous=marketplaceSnapshots.get(mode);
  const values=pageToken&&previous?.owner===owner&&previous?.channelId===requestedChannelId?previous.values:shopMode?{keyword:"",shop_keyword:$("#marketplaceShopKeyword").value.trim(),sort_field:"units_sold",sort_order:"DESC",result_limit:20}:{keyword:$("#marketplaceKeyword").value.trim(),shop_keyword:"",sort_field:$("#marketplaceSort").value,sort_order:$("#marketplaceOrder").value,result_limit:Number($("#marketplaceLimit").value)||20,price_min:$("#marketplacePriceMin").value,price_max:$("#marketplacePriceMax").value,category_id:$("#marketplaceCategory").value.trim(),commission_percent_min:$("#marketplaceCommissionMin").value,commission_percent_max:$("#marketplaceCommissionMax").value,comparison_days:Number($("#marketplaceComparisonDays").value)||3};
  const snapshot=Object.freeze({...values}),sequence=++marketplaceQuerySequence;
  marketplaceLatest.set(mode,sequence);
  const owned=()=>pageViewerId===owner&&channelOwnership.current(context),current=()=>owned()&&marketplaceLatest.get(mode)===sequence;
  let shopConnection=state.shopConnection&&String(state.shopConnection.channel_id)===requestedChannelId?state.shopConnection:null;
  if(!shopConnection)shopConnection=await loadTikTokConnection(requestedChannelId,context);
  if(!current())return null;
  if(!shopConnection)throw new Error("กรุณาเชื่อม TikTok Shop ก่อนค้นหา Marketplace");
  const view=marketplaceView(mode),buttons=view.form.querySelectorAll(".marketplace-search-button"),nextButton=$(shopMode?"#marketplaceShopNext":"#marketplaceNext");
  buttons.forEach(button=>button.disabled=true);if(nextButton)nextButton.disabled=true;
  try {
    const body=Object.freeze({connection_id:shopConnection.id,channel_id:requestedChannelId,...snapshot,page_token:pageToken});
    const key=JSON.stringify([owner,context.generation,mode,body]),cached=marketplaceQueryCache.get(key);
    let data=cached&&Date.now()-cached.at<30000?cached.data:null;
    if(!data){
      let request=marketplaceQueryRequests.get(key);
      if(!request){
        request=marketplaceQueryTail.catch(()=>{}).then(async()=>{
          if(!owned())return null;
          const result=await api("/api/admin/tiktok-connections/marketplace",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
          if(owned()){if(marketplaceQueryCache.size>=24)marketplaceQueryCache.delete(marketplaceQueryCache.keys().next().value);marketplaceQueryCache.set(key,{at:Date.now(),data:result})}
          return result;
        });
        marketplaceQueryRequests.set(key,request);marketplaceQueryTail=request;
        request.finally(()=>{if(marketplaceQueryRequests.get(key)===request)marketplaceQueryRequests.delete(key)}).catch(()=>{});
      }
      data=await request;
    }
    if(!data||!current())return null;
    const prefix=shopMode?"shopMarketplace":"marketplace";
    state[`${prefix}Products`]=data.products||[];state[`${prefix}NextToken`]=data.next_page_token||"";state[`${prefix}SearchedAt`]=new Date().toISOString();state[`${prefix}ComparisonDays`]=Number(data.comparison_days)||7;
    marketplaceSnapshots.set(mode,{owner,channelId:requestedChannelId,values:snapshot});
    if(!shopMode)renderMarketplaceCategories(data.categories||[]);
    renderMarketplaceProducts(data,mode);return data;
  }catch(error){if(current())throw error;return null}
  finally{if(current()){buttons.forEach(button=>button.disabled=false);if(nextButton)nextButton.disabled=false}}
}
function renderShopDashboard(data, shopConnection) {
  const box = $("#shopDashboard"), portfolio = data.shop_portfolio || {}, commissions = portfolio.commission || [], products = data.shop_products || [], orders = data.shop_orders || [];
  box.hidden = !shopConnection && !commissions.length;
  if (box.hidden) return;
  const commission = commissions[0], daily = commission?.daily || [], maxDaily = Math.max(1, ...daily.map((day) => Number(day.amount) || 0)), total = Number(commission?.total ?? commission?.total_30) || 0, channels = commission?.channels || [];
  state.lastCommissionCard = commission ? { owner: state.selected ? (state.channels.find((channel) => channel.id === state.selected)?.name || "ช่องที่เลือก") : "รวมทุกช่อง", range: `${data.date_range?.from || state.shopDateFrom} ถึง ${data.date_range?.to || state.shopDateTo}`, dateFrom:data.date_range?.from||state.shopDateFrom, dateTo:data.date_range?.to||state.shopDateTo, basis:commission.basis||'unknown', total, currency: commission.currency || "THB", channels, referralUrl: data.vx_referral?.url || "" } : null;
  $("#shopCommissionDashboard").innerHTML = commission ? `<div class="commission-summary"><div class="commission-kpis"><article><small>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E27\u0E21 30 \u0E27\u0E31\u0E19</small><b>${money(total)}</b><span class="positive">\u25B2 ${Number(commission.growth || 0).toLocaleString()}% \u0E08\u0E32\u0E01\u0E23\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19</span></article><article><small>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E19 Showcase</small><b>${products.length.toLocaleString()}</b><span>\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49</span></article></div><div class="commission-visual"><section><h3>\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E19\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19</h3><div class="commission-bars">${daily.slice(-30).map((day) => `<div title="${escapeHtml(day.date)} ${money(day.amount)}"><i style="height:${Math.max(8, Math.round(Number(day.amount) / maxDaily * 100))}%"></i><small>${escapeHtml(day.date)}</small></div>`).join("")}</div></section><aside><h3>\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E17\u0E35\u0E22\u0E1A\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07</h3>${channels.map((channel) => `<div class="channel-share"><span>${escapeHtml(channel.channel)}</span><i><b style="width:${Math.max(5, Number(channel.amount) / Math.max(1, ...channels.map((x) => Number(x.amount))) * 100)}%"></b></i><strong>${money(channel.amount)}</strong></div>`).join("")}</aside></div></div>` : '<p class="hint">TikTok \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E22\u0E2D\u0E14\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E32 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E2A\u0E14\u0E07\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E43\u0E19\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C</p>';
  if (commission) $("#shopCommissionDashboard .commission-summary")?.insertAdjacentHTML("afterbegin", '<div class="commission-share-actions"><button type="button" data-share-commission>สร้างรูปและแชร์สรุปค่าคอม</button></div>');
  renderShowcaseProducts(products, orders, false, data.shop_growth_orders || orders);
}
const renderLiveShopDashboard = renderShopDashboard;
renderShopDashboard = function(data, shopConnection) {
  const commission = data?.shop_portfolio?.commission || [];
  if (!shopConnection && !commission.length) {
    $("#shopDashboard").hidden = !state.selected;
    $("#shopCommissionDashboard").innerHTML = state.selected ? '<p class="hint">ยังไม่มีข้อมูลค่าคอมของช่องนี้ — เชื่อม TikTok Shop จากแท็บจัดการสินค้าเพื่อเริ่มรับข้อมูล</p>' : "";
    $("#shopGradeList").innerHTML = "";
    return;
  }
  renderLiveShopDashboard(data, shopConnection);
  shopHeader.querySelector("small").textContent = "ช่องที่เลือก · ค่าคอมมิชชัน";
  shopHeader.querySelector("h2").textContent = "ค่าคอมของช่องที่เลือก";
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
function loadChannelInventory(channelId=state.selected){
  const key=String(channelId||''),version=inventoryVersions.get(key)||0;if(!key)return Promise.resolve({products:[],product_events:[]});
  const pending=inventoryRequests.get(key);if(pending?.version===version)return pending.request;
  const request=api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(key)}&resource=inventory&limit=24`,{cache:'no-store'}).finally(()=>{if(inventoryRequests.get(key)?.request===request)inventoryRequests.delete(key)});
  inventoryRequests.set(key,{version,request});return request;
}
function invalidateChannelInventory(channelId=state.selected){const key=String(channelId||'');if(!key)return;inventoryVersions.set(key,(inventoryVersions.get(key)||0)+1);inventoryRequests.delete(key)}
const mergeById=(current,next)=>{const seen=new Set(current.map(item=>String(item.id)));return current.concat((next||[]).filter(item=>!seen.has(String(item.id))))};
function replaceInventory(data){state.inventoryProducts=data.products||[];state.inventoryEvents=data.product_events||[];state.inventoryCounts=data.inventory_counts||{};state.inventoryPagination=data.pagination||{};return data}
function renderInventoryState(){renderPermanentInventory(state.inventoryProducts,state.inventoryEvents);reconcileProductPrepInventory(state.shortlistProducts||[]);renderReviewSchedule(state.inventoryProducts,Boolean(state.shopConnection),state.inventoryEvents)}
async function refreshOwnedShortlist(context) {
  if (!context || !channelOwnership.current(context)) return null;
  const owner=pageViewerId,channelId=context.channelId,key=`${owner}:${channelId}`,version=inventoryVersions.get(channelId)||0;
  const valid=()=>owner===pageViewerId && channelOwnership.current(context) && (inventoryVersions.get(channelId)||0)===version;
  const cached=shortlistCache.get(key);
  let result=cached?.version===version&&Date.now()-cached.at<30000?cached.data:null;
  if (!result) {
    let pending=shortlistRequests.get(key);
    if (!pending || pending.version!==version || pending.context.generation!==context.generation) {
      const request=(async()=>{
        let products=[],cursor='',truncated=false;
        const seen=new Set();
        do {
          if (!valid()) return null;
          const params=new URLSearchParams({channel_id:channelId,resource:'shortlist',limit:String(Math.min(24,40-products.length))});
          if(cursor)params.set('product_cursor',cursor);
          const data=await api(`/api/admin/tiktok-analyzer?${params}`,{cache:'no-store'});
          if(!valid())return null;
          if(String(data.channel_id)!==channelId)throw new Error('ข้อมูลลิสต์ไม่ตรงกับช่องที่เลือก');
          const before=products.length;
          for(const product of data.products||[])if(product.inventory_status==='kept'&&!seen.has(String(product.id))){seen.add(String(product.id));products.push(product)}
          const page=data.pagination?.products||{};truncated=Boolean(page.has_more);
          const next=page.next_cursor||'';
          if(truncated&&(!next||next===cursor||products.length===before))throw new Error('โหลดลิสต์คัดสินค้าไม่ครบ กรุณารีเฟรช');
          cursor=next;
        } while(truncated&&products.length<40);
        return {products:products.slice(0,40),truncated};
      })();
      pending={version,context,request};shortlistRequests.set(key,pending);
      request.finally(()=>{if(shortlistRequests.get(key)===pending)shortlistRequests.delete(key)}).catch(()=>{});
    }
    try { result=await pending.request; } catch(error) {
      if(valid()){state.shortlistError=error.message||'โหลดลิสต์ไม่สำเร็จ';reconcileProductPrepInventory(state.shortlistProducts||[])}
      return null;
    }
    if(!result||!valid())return null;
    if(shortlistCache.size>=32)shortlistCache.delete(shortlistCache.keys().next().value);
    shortlistCache.set(key,{version,at:Date.now(),data:result});
  }
  if(!valid())return null;
  state.shortlistProducts=result.products;state.shortlistTruncated=result.truncated;state.shortlistError='';
  reconcileProductPrepInventory(result.products);stampChannelOwnedActions($("#result"),context);
  return result;
}
function channelContextFor(element) {
  const context = channelOwnership.capture();
  if (!context) return null;
  const owner = element?.closest?.("[data-channel-owner]")?.dataset.channelOwner || "";
  return owner === context.channelId ? context : null;
}
function stampChannelOwnedActions(root, context) {
  if (!root || !context) return;
  root.dataset.channelOwner = context.channelId;
  root.querySelectorAll("button").forEach((button) => { button.dataset.channelOwner = context.channelId; });
}
function clearChannelOwnedView() {
  state.connectionLoadSeq += 1;
  state.connection = null;
  state.shopConnection = null;
  state.inventoryProducts = [];
  state.shortlistProducts = [];
  state.shortlistTruncated = false;
  state.shortlistError = '';
  state.inventoryEvents = [];
  state.inventoryCounts = {};
  state.inventoryPagination = {};
  state.marketplaceProducts = [];
  state.shopMarketplaceProducts = [];
  (state.commissionPreviewUrls || []).forEach((url) => { try { URL.revokeObjectURL(url); } catch {} });
  state.commissionPreviewUrls = [];
  state.preparedCommission = null;
  state.commissionCards = [];
  state.lastCommissionCard = null;
  const result = $("#result"), inventory = $("#angelInventory"), connection = $("#tiktokConnection");
  if (result) {
    result.hidden = true;
    delete result.dataset.channelOwner;
    result.querySelectorAll('[data-field="summary"]').forEach((node) => { node.textContent = ""; });
    result.querySelectorAll('[data-list]').forEach((node) => { node.innerHTML = ""; });
  }
  if (inventory) {
    inventory.hidden = true;
    delete inventory.dataset.channelOwner;
    $("#angelProducts").innerHTML = "";
    $("#productReviewSchedule").innerHTML = "";
    $("#angelCount").textContent = "";
  }
  if (connection) connection.hidden = true;
  $("#shopConnectionRequired").hidden = true;
  if($("#syncTikTokShowcase"))$("#syncTikTokShowcase").hidden = true;
  if($("#syncTikTokShop"))$("#syncTikTokShop").hidden = true;
  if($("#showcaseSyncLimitField"))$("#showcaseSyncLimitField").hidden = true;
  if($("#disconnectTikTokShop"))$("#disconnectTikTokShop").hidden = true;
  $("#connectTikTok")?.removeAttribute("href");
  $("#connectTikTokShop")?.removeAttribute("href");
  $("#tiktokConnectionState").innerHTML = "";
  $("#tiktokShopState").innerHTML = "";
  $("#tiktokVideoSummary").innerHTML = "";
  $("#soldProductsData").innerHTML = "";
  $("#shopCommissionDashboard").innerHTML = "";
  $("#shopGradeList").innerHTML = "";
  $("#shopDashboard").hidden = true;
  $("#channelShopAnalysis").classList.remove("shop-connection-missing");
  document.body.classList.remove("shop-connected");
  if (form) {
    if (form.notes) form.notes.value = "";
    if (form.candidate_products) form.candidate_products.value = "";
    if ($("#screenshots")) $("#screenshots").value = "";
    if ($("#previews")) $("#previews").innerHTML = "";
  }
  resetMarketplaceView();
}
async function refreshOwnedInventory(context) {
  invalidateChannelInventory(context.channelId);
  const latest = await loadChannelInventory(context.channelId);
  if (!channelOwnership.current(context)) return null;
  replaceInventory(latest);
  await refreshOwnedShortlist(context);
  if (!channelOwnership.current(context)) return null;
  renderInventoryState();
  stampChannelOwnedActions($("#angelInventory"), context);
  stampChannelOwnedActions($("#result"), context);
  return latest;
}
async function loadMoreInventoryResource(resource){const context=channelOwnership.capture(),page=state.inventoryPagination?.[resource],cursor=page?.next_cursor;if(!context||!cursor)return;const key=resource==='products'?'product_cursor':'event_cursor',params=new URLSearchParams({channel_id:context.channelId,resource,limit:'24',[key]:cursor}),data=await api(`/api/admin/tiktok-analyzer?${params}`,{cache:'no-store'});if(!channelOwnership.current(context))return;if(resource==='products'){state.inventoryProducts=mergeById(state.inventoryProducts,data.products);state.inventoryCounts=data.inventory_counts||state.inventoryCounts}else state.inventoryEvents=mergeById(state.inventoryEvents,data.product_events);state.inventoryPagination[resource]=data.pagination?.[resource]||{};renderInventoryState();stampChannelOwnedActions($("#angelInventory"),context);stampChannelOwnedActions($("#result"),context)}
function marketplaceErrorMessage(error) {
  const detail = String(error?.detail || "").trim(), requestId = String(error?.requestId || "").trim();
  return `${error?.message || "ค้นหาไม่สำเร็จ"}${detail && !String(error?.message || "").includes(detail) ? ` · TikTok: ${detail}` : ""}${requestId ? ` · Request ID: ${requestId}` : ""}`;
}
function revealMarketplaceReconnect(error) {
  if (!error?.reconnectRequired || !state.selected) return;
  const link = $("#connectTikTokShop");
  link.hidden = false;
  link.href = '#';
  link.textContent = "ต่อสิทธิ์ Marketplace ใหม่";
}
async function prepareOwnedCommission(context, model) {
  const prepared = await window.VisionDCommissionCard.prepareCommissionCard(model);
  return context && !channelOwnership.current(context) ? null : prepared;
}
$("#shopCommissionDashboard").addEventListener("click", async (event) => {
  if(!COMMISSION_WORKSPACE_ENABLED)return;
  const context=state.selected?channelContextFor(event.target):null;if(state.selected&&!context)return;
  const stillCurrent=()=>!context||channelOwnership.current(context);
  const copyLink=event.target.closest('[data-copy-vx-referral]');if(copyLink){try{let link=$('#commissionShareForm [name="referral_url"]')?.value;if(!link){const referral=await api('/api/vx/referrals');if(!stillCurrent())return;link=referral.link||'';const input=$('#commissionShareForm [name="referral_url"]');if(!input)return;input.value=link;copyLink.textContent='คัดลอกลิงก์'}if(link){await navigator.clipboard.writeText(link);if(stillCurrent())showToast('คัดลอกลิงก์แนะนำ VX แล้ว')}}catch(error){if(stillCurrent())showToast(error.message||'สร้างลิงก์แนะนำไม่สำเร็จ','error')}return}
  const copyCaption=event.target.closest('[data-copy-commission-caption]');if(copyCaption){await navigator.clipboard.writeText($('#commissionShareForm [name="caption"]')?.value||'');if(stillCurrent())showToast('คัดลอกแคปชั่นแล้ว');return}
  const social=event.target.closest('[data-social-share]');if(social){const prepared=state.preparedCommission;if(!prepared||String(prepared.channelId||'')!==String(context?.channelId||''))return showToast('กรุณาสร้างรูปก่อน','warning');try{await window.VisionDCommissionCard.sharePreparedCommission(prepared.files,prepared.model);if(stillCurrent())showToast('เปิดหน้าต่างแชร์แล้ว')}catch(error){if(stillCurrent()&&error?.name!=='AbortError')showToast(error.message||'แชร์รูปไม่สำเร็จ','error')}return}
  const button = event.target.closest("[data-generate-commission]");
  if (!button) return;
  const form=$('#commissionShareForm'),from=form.elements.date_from.value,to=form.elements.date_to.value,index=button.dataset.generateCommission;state.commissionOwnerName=form.elements.owner.value.trim();state.commissionCaption=form.elements.caption.value.trim();if(!state.commissionOwnerName)return showToast('กรุณาใส่ชื่อที่จะแสดงบนรูป','warning');if(from>to)return showToast('ช่วงวันที่ไม่ถูกต้อง','warning');if(from!==state.shopDateFrom||to!==state.shopDateTo){state.shopDateFrom=from;state.shopDateTo=to;button.disabled=true;try{if(context)await loadTikTokConnection(context.channelId,context);else await loadPortfolioDashboard();if(stillCurrent())$(`[data-generate-commission="${index}"]`)?.click()}catch(error){if(stillCurrent())showToast(error.message,'error')}return}
  const card = state.commissionCards?.[Number(button.dataset.generateCommission)] || state.lastCommissionCard;
  if (!card) return showToast("ยังไม่มีข้อมูลค่าคอมสำหรับสร้างรูป", "warning");
  try {
    if (!window.VisionDCommissionCard) throw new Error("เครื่องมือสร้างรูปยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง");
    const model={...card,owner:state.commissionOwnerName,caption:state.commissionCaption,referralUrl:form.elements.referral_url.value};const prepared=await prepareOwnedCommission(context,model);if(!prepared||!stillCurrent())return;(state.commissionPreviewUrls||[]).forEach(url=>URL.revokeObjectURL(url));state.commissionPreviewUrls=prepared.files.map(file=>URL.createObjectURL(file));state.preparedCommission={...prepared,model,channelId:context?.channelId||''};const actions=$('#commissionPreparedActions'),preview=$('#commissionImagePreview');if(!actions||!preview||!stillCurrent())return;actions.hidden=false;actions.querySelector('span').textContent=prepared.cached?`ดึงรูปเดิมจากคลังแล้ว ${prepared.files.length} รูป`:`สร้างและบันทึกเข้าคลังแล้ว ${prepared.files.length} รูป`;preview.innerHTML=state.commissionPreviewUrls.map((url,index)=>`<figure><img src="${escapeHtml(url)}" alt="รูปสรุปค่าคอม หน้า ${index+1} จาก ${prepared.files.length}"><figcaption>รูปที่ ${index+1}/${prepared.files.length}</figcaption></figure>`).join('');preview.hidden=false;preview.scrollIntoView({behavior:'smooth',block:'nearest'});showToast(actions.querySelector('span').textContent);
  } catch (error) {
    if (stillCurrent()&&error?.name !== "AbortError") showToast(error.message || "แชร์รูปไม่สำเร็จ", "error");
  }
});
async function loadChannels() {
  try {
    const data = await api("/api/admin/tiktok-analyzer");
    state.channels = data.channels || [];
    state.channelPagination=data.pagination||{};
    const aiState = $("#aiState");
    if (aiState) aiState.textContent = data.provider_configured ? "AI \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C" : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 AI";
    if(!launcherTargetConsumed&&launcherContext?.channelId){
      state.selected=launcherContext.channelId;renderChannels();
      const selected=await selectChannel(launcherContext.channelId);if(!selected)throw new Error("ไม่พบช่องเป้าหมายในบัญชีนี้");
      const actualSlot=String(selected.channel?.browser_profile_slot_id||"");
      if(actualSlot!==launcherContext.slotId)throw new Error(actualSlot?"ช่องนี้ผูกกับ Chrome โปรไฟล์อื่นแล้ว กรุณาเปิดใหม่จากรายการช่อง":"ข้อมูลโปรไฟล์ของช่องนี้ไม่ตรงกัน กรุณาเปิดใหม่จากรายการช่อง");
      launcherTargetConsumed=true;updateBrowserProfilePanel();
      if(requestedConnectMode&&!handoffOpened)consumeLegacyConnectionHint();
      return;
    }
    if (!handoffOpened && requestedConnectMode && requestedConnectMode !== "tiktok_new") {
      if (!handoffChannelId) throw new Error("ลิงก์เชื่อมบัญชีไม่ระบุช่อง กรุณาเลือกช่องอีกครั้ง");
      state.selected = handoffChannelId;
      renderChannels();
      const selected = await selectChannel(handoffChannelId);
      if (!selected) throw new Error("ไม่พบช่องเป้าหมายในบัญชีนี้ กรุณากลับไปเลือกลิงก์จากช่องที่ต้องการ");
      if (!handoffOpened) consumeLegacyConnectionHint();
      return;
    }
    let selectedExists = state.channels.some((channel) => String(channel.id) === String(state.selected)),selectedLoaded=false;
    if(!selectedExists&&browserProfileUuid.test(String(state.selected||""))){try{selectedLoaded=Boolean(await selectChannel(state.selected))}catch{state.selected=null}}
    selectedExists=selectedLoaded||state.channels.some((channel) => String(channel.id) === String(state.selected));
    if (!selectedExists) state.selected = state.channels.find((channel) => channel.tiktok_connected ?? (channel.follower_count !== null && channel.follower_count !== void 0))?.id || state.channels[0]?.id || null;
    renderChannels();
    if (state.selected&&!selectedLoaded) await selectChannel(state.selected).catch(()=>{});
    if (requestedConnectMode === "tiktok_new" && !handoffOpened) consumeLegacyConnectionHint();
    updateBrowserProfilePanel();
  } catch (error) {
    $("#channels").innerHTML = `<p class="shop-error">${escapeHtml(error.message || "โหลดช่องไม่สำเร็จ")}</p>`;
    setBrowserProfileStatus(error.message||"โหลดข้อมูลโปรไฟล์ไม่สำเร็จ","error");
  }
}
function renderChannels() {
  $("#channels").innerHTML = state.channels.length ? state.channels.map((x) => `<div class="channel-card ${x.id === state.selected ? "active" : ""}" role="option" aria-selected="${x.id === state.selected}"><button class="channel" data-id="${escapeHtml(x.id)}">${x.avatar_url ? `<img class="channel-card-avatar" src="${escapeHtml(x.avatar_url)}" alt="">` : ""}<span><b>${escapeHtml(x.name)}</b><small>${x.follower_count === null || x.follower_count === void 0 ? (x.tiktok_connected ? "เชื่อมข้อมูลพื้นฐาน · ยังไม่มีสิทธิ์สถิติ" : "ยังไม่เชื่อม TikTok") : `${Number(x.follower_count).toLocaleString()} ผู้ติดตาม · ${Number(x.likes_count).toLocaleString()} ไลก์ · ${Number(x.video_count).toLocaleString()} วิดีโอ`} · วิเคราะห์ ${x.analysis_count} รอบ</small></span></button><button class="delete-channel" type="button" data-delete-id="${escapeHtml(x.id)}" data-delete-name="${escapeHtml(x.name)}" aria-label="ลบช่อง ${escapeHtml(x.name)}">ลบ</button></div>`).join("")+(state.channelPagination?.has_more?'<button type="button" data-load-more-channels>โหลดช่องเพิ่มเติม</button>':'') : '<p class="hint">ยังไม่มีช่อง กด “+ ช่องใหม่” เพื่อเพิ่มและเชื่อมช่องแรก</p>';
  renderAnalysisChannelPicker();
  updateBrowserProfilePanel();
}
function renderAnalysisChannelPicker(){
  const box=$("#analysisChannelOptions"),connected=state.channels.filter(channel=>channel.tiktok_connected ?? (channel.follower_count!==null&&channel.follower_count!==void 0));
  if(!box)return;
  box.innerHTML=connected.length?connected.map(channel=>`<button type="button" class="analysis-channel-option ${channel.id===state.selected?"active":""}" data-analysis-channel="${escapeHtml(channel.id)}" role="option" aria-selected="${channel.id===state.selected}">${channel.avatar_url?`<img src="${escapeHtml(channel.avatar_url)}" alt="">`:""}<span><b>${escapeHtml(channel.name)}</b><small>${channel.id===state.selected?"กำลังดูช่องนี้":"เลือกดูช่องนี้"}</small></span></button>`).join(""):'<p class="hint">ยังไม่มีช่องที่เชื่อม TikTok กด “+ ช่องใหม่” เพื่อเพิ่มและเชื่อมช่องแรก</p>';
}
$("#analysisChannelOptions")?.addEventListener("click",async event=>{const button=event.target.closest("[data-analysis-channel]");if(!button||button.dataset.analysisChannel===state.selected)return;setOutputScope("channel");setWorkspaceView("output");setChannelView("products");await selectChannel(button.dataset.analysisChannel).catch(()=>{})});
async function selectChannel(id, context) {
  state.selected = String(id);
  form.classList.add("existing-channel");
  renderChannels();
  const data = await api(`/api/admin/tiktok-analyzer?channel_id=${encodeURIComponent(id)}&resource=overview&limit=24&run_limit=1`,{cache:'no-store'}), channel = data.channel, products = data.products || [];
  if (!channelOwnership.current(context) || String(channel?.id || "") !== context.channelId || !channelOwnership.commit(context)) return null;
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
  renderOwnedResult(data.runs?.[0]?.result || {}, context);
  return data;
}
function newChannel() {
  channelOwnership.clear();
  state.selected = null;
  clearChannelOwnedView();
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
    const evidence = x.evidence || textValue(x.reasons) || x.decision || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E25\u0E31\u0E01\u0E10\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", hasScore = x[scoreKey] !== null && x[scoreKey] !== undefined && x[scoreKey] !== "" && Number.isFinite(Number(x[scoreKey])), score = hasScore ? Math.max(0, Math.min(100, Number(x[scoreKey]))) : null, grade = String(x.product_type || "").toUpperCase(), gradeLabel = /^[A-F]$/.test(grade) ? grade : "ไม่มีเกรด";
    return `<tr><td><span class="type-pill type-${escapeHtml(grade || "unknown")}">${escapeHtml(gradeLabel)}</span></td><td class="product-full-name">${escapeHtml(x.name)}</td><td>${escapeHtml(x.customer_gender || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td>${escapeHtml(x.customer_age_range || "\u0E22\u0E31\u0E07\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49")}</td><td class="score-cell">${score === null ? "—" : `${score}/100`}</td><td>${escapeHtml(evidence)}</td><td>${x.product_url ? `<a href="${escapeHtml(x.product_url)}" target="_blank" rel="noopener noreferrer">\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u2197</a>` : "<em>\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C</em>"}</td><td><div class="inventory-actions"><button type="button" data-inventory="kept" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score ?? 0}" data-product-evidence="${escapeHtml(evidence)}">\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49</button><button type="button" class="danger" data-inventory="discarded" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(grade)}" data-product-score="${score ?? 0}" data-product-evidence="${escapeHtml(evidence)}">\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01</button></div></td></tr>`;
  }).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E2D</p>';
}
function cleanAiSearchQuery(value) {
  if(typeof value!=="string")return "";
  return value.normalize("NFKC").replace(/https?:\/\/\S+/gi," ").replace(/\([^)]*\)|\[[^\]]*\]/g," ").replace(/[<>"'`]/g," ").replace(/พรีเมียม|รุ่นใหม่สุด|รุ่นใหม่|อัจฉริยะ|สุดคุ้ม/g," ").replace(/\b[A-Za-z]+[0-9][A-Za-z0-9-]*\b/g," ").trim().split(/\s+/).filter(Boolean).slice(0,4).join(" ").slice(0,80).trim();
}
function aiRecommendationSearchQuery(item) {
  const explicit=cleanAiSearchQuery(item?.search_query);
  if(explicit)return explicit;
  let name=String(item?.name||item?.product||"");
  if(/[ก-๙]/.test(name))name=name.replace(/^(?:[A-Za-z0-9-]+\s+)+(?=[ก-๙])/,"");
  // Recognized product intents only; unknown concepts retain editable conservative text.
  for(const [pattern,intent] of [[/ครีม.*(?:เด็ก|ทารก)/,'ครีมเด็ก'],[/น้ำมันรำข้าว/,'น้ำมันรำข้าว'],[/ยางกัด/,'ยางกัดเด็ก'],[/ของเล่น.*(?:เด็ก|ทารก)/,'ของเล่นเด็ก'],[/ผ้าอ้อม/,'ผ้าอ้อมเด็ก']])if(pattern.test(name))return intent;
  return cleanAiSearchQuery(name);
}
function aiRecommendationTable(items) {
  if(!items.length)return '<p class="hint">ยังไม่มีข้อมูลพอ</p>';
  return `<p class="hint">แนวคิดจาก AI ยังไม่ได้ยืนยันว่ามีสินค้านี้ใน Marketplace — คำค้นแก้ไขได้ ผลจาก TikTok เท่านั้นที่เป็นรายการสินค้าจริง</p>${items.map(item=>`<article class="ai-concept-card" data-ai-concept><b>${escapeHtml(item.name)}</b><p>${escapeHtml(item.evidence||"")}</p><label class="ai-concept-query">คำค้นสินค้า<input data-ai-search-query maxlength="80" value="${escapeHtml(aiRecommendationSearchQuery(item))}"></label><div class="ai-concept-actions"><button class="vds-btn vds-btn--primary" type="button" data-ai-marketplace-search>ค้นหาสินค้า</button></div><p class="ai-concept-status" data-ai-search-status role="status"></p></article>`).join("")}`;
}
async function searchAiRecommendation(button) {
  const context=channelContextFor(button),row=button.closest('[data-ai-concept]');
  if(!context||!row)return;
  const input=row.querySelector('[data-ai-search-query]'),status=row.querySelector('[data-ai-search-status]'),query=cleanAiSearchQuery(input?.value);
  if(!query){status.textContent='กรุณาใส่คำค้นประเภทสินค้า เช่น แปรงขนแมว';return}
  input.value=query;$('#marketplaceKeyword').value=query;
  status.textContent='กำลังค้นหาแนวคิดนี้ใน Marketplace โดยใช้ตัวกรองปัจจุบัน…';
  const owner=pageViewerId,attempt={};row.aiSearchAttempt=attempt;
  try{
    const data=await searchMarketplace('product','',context);
    if(owner!==pageViewerId||!channelOwnership.current(context)||!row.isConnected||row.aiSearchAttempt!==attempt)return;
    if(!data){status.textContent='มีคำค้นใหม่แล้ว ดูผลล่าสุดใน Marketplace หรือกดค้นหาแนวคิดนี้อีกครั้ง';return}
    status.textContent=data.products?.length?'พบรายการจาก TikTok แล้ว โปรดตรวจรายละเอียดก่อนเลือกสินค้า':'ไม่พบสินค้าตามคำค้นและตัวกรองนี้ — ลองแก้เป็นประเภทสินค้าที่กว้างขึ้น แล้วกดค้นหาอีกครั้ง';
    $('#marketplaceResults')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){if(owner===pageViewerId&&channelOwnership.current(context)&&row.isConnected&&row.aiSearchAttempt===attempt)status.textContent=marketplaceErrorMessage(error)}
}
function renderResult(result = {}) {
  $("#result").hidden = false;
  $('[data-field="summary"]').textContent = result.summary || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E23\u0E38\u0E1B";
  if (!$("#gradeMeaningNote")) $('[data-field="summary"]').insertAdjacentHTML("afterend", '<p id="gradeMeaningNote" class="marketplace-shop-search-note"><b>แยกให้ชัด:</b> F = สินค้าที่กดคัดออกหรือกดไม่ผ่านแล้ว · ไม่มีเกรด = ยอดขาย 0 หรือข้อมูลยังไม่พอ</p>');
  $('[data-list="winners"]').innerHTML = resultProductTable(result.winner_products, "score");
  const aiRecommendations = [...result.next_product_candidates || [], ...result.daily_product_list || []].filter((item) => String(item?.product_type || item?.grade || "").toUpperCase() === "E").map((item) => ({ ...item, name: item.name || item.product || "", evidence: item.evidence || item.ranking_reason || textValue(item.reasons), fit_score: item.fit_score ?? item.ranking_score })).filter((item, index, rows) => item.name && rows.findIndex((candidate) => normalizeProductName(candidate.name) === normalizeProductName(item.name)) === index);
  $('[data-list="ai-recommendations"]').innerHTML = aiRecommendationTable(aiRecommendations);
  $('[data-list="candidates"]').innerHTML = resultProductTable(result.next_product_candidates, "fit_score");
  upgradeLegacyProductLinkCells($("#result"));
  $("#productPrepSummary").innerHTML = '<span class="total">รวม <b>0/40</b> สินค้าที่เลือกไว้</span>';
  $('[data-list="plan"]').innerHTML = '<p class="hint">ยังไม่มีข้อมูลพอ — ยังไม่มีสินค้าที่เลือกไว้</p>';
}
function renderOwnedResult(result, context = channelOwnership.capture()) {
  if (!context || !channelOwnership.current(context)) return false;
  renderResult(result || {});
  stampChannelOwnedActions($("#result"), context);
  return true;
}
const renderResultBase = renderResult;
renderResult = function(result = {}) {
  renderResultBase(result);
  reconcileProductPrepInventory(state.shortlistProducts || []);
};
$("#analyzeAiRecommendations")?.addEventListener("click", async (event) => {
  const context = channelContextFor(event.currentTarget);
  if (!context) return showToast("กรุณาเลือกช่องก่อนวิเคราะห์", "warning");
  const shopConnection = state.shopConnection && String(state.shopConnection.channel_id) === context.channelId ? state.shopConnection : null;
  if (!shopConnection) return showToast("กรุณาเชื่อม TikTok Shop ก่อนให้ AI วิเคราะห์", "warning");
  const button = event.currentTarget, channel = state.channels.find((item) => String(item.id) === context.channelId), data = new FormData();
  data.set("channel_id", context.channelId);
  data.set("channel_name", channel?.name || "ช่อง TikTok");
  data.set("channel_url", channel?.channel_url || "");
  data.set("lookback_days", "30");
  data.set("attachment_period_days", "30");
  data.set("clips_per_day", "40");
  data.set("date_range", `${state.shopDateFrom} ถึง ${state.shopDateTo}`);
  data.set("notes", "วิเคราะห์สินค้าแนะนำเกรด E จากข้อมูล TikTok Shop API ของช่องนี้ โดยอิงสินค้าที่ขายได้และแนวทางช่อง");
  button.disabled = true;
  button.textContent = "AI กำลังวิเคราะห์…";
  try {
    const response = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if (!channelOwnership.current(context)) return;
    renderOwnedResult(response.result || {}, context);
    await refreshOwnedInventory(context);
    if (!channelOwnership.current(context)) return;
    showToast("AI วิเคราะห์สินค้าแนะนำเกรด E เรียบร้อยแล้ว", "success");
    $(".ai-recommendations")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if(channelOwnership.current(context))showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "ให้ AI วิเคราะห์สินค้าแนะนำ";
  }
});
function fetchTikTokConnectionData(channelId) {
  if (!channelId) return Promise.resolve(null);
  const query=shopDateQuery(String(channelId)),key=(typeof pageViewerId==='undefined'?'':pageViewerId)+':'+String(query);
  if (shopConnectionRequests.has(key)) return shopConnectionRequests.get(key);
  const request = api(`/api/admin/tiktok-connections?${query}`, { cache: "no-store" }).finally(() => {
    if (shopConnectionRequests.get(key) === request) shopConnectionRequests.delete(key);
  });
  shopConnectionRequests.set(key, request);
  return request;
}
async function loadTikTokConnection(channelId = state.selected, context = channelOwnership.capture()) {
  const box = $("#tiktokConnection");
  if (!channelId) {
    box.hidden = true;
    $("#shopConnectionRequired").hidden = true;
    $("#connectTikTokShop")?.removeAttribute("href");
    return null;
  }
  box.hidden = false;
  const requestedChannelId=String(channelId),loadSeq=++state.connectionLoadSeq,requestedRange=String(shopDateQuery(requestedChannelId));
  const data = await fetchTikTokConnectionData(requestedChannelId);
  const connection = data.connections?.[0] || null, shopConnection = data.shop_connections?.[0] || null, videos = data.videos || [], products = data.shop_products || [], orders = data.shop_orders || [];
  if(loadSeq!==state.connectionLoadSeq||!context||!channelOwnership.current(context)||requestedRange!==String(shopDateQuery(requestedChannelId)))return shopConnection;
  state.connection = connection;
  state.shopConnection = shopConnection;
  state.orderSync=data.order_sync||{status:'never',revision:0};
  state.orderSyncRange=requestedRange;
  const shopActions = tiktokShopActionVisibility({ selectable: Boolean(tiktokShopNavigation.connectUrl()), connected: Boolean(shopConnection) });
  $("#channelShopAnalysis").classList.toggle("shop-connection-missing", !shopConnection);
  $("#shopConnectionRequired").hidden = !shopActions.connect;
  renderShowcasePermission();
  renderShopDashboard(data, shopConnection);
  stampChannelOwnedActions($("#shopDashboard"), context);
  if (shopConnection && COMMISSION_WORKSPACE_ENABLED) {
    const [commission, referral] = await loadCommissionWorkspace(`channel_id=${encodeURIComponent(requestedChannelId)}&from=${state.shopDateFrom}&to=${state.shopDateTo}`);
    if (loadSeq !== state.connectionLoadSeq || !channelOwnership.current(context)) return null;
    renderAccurateCommission(commission, referral);
    stampChannelOwnedActions($("#shopDashboard"), context);
  }
  $("#connectTikTok").hidden = false;
  $("#connectTikTokShop").hidden = Boolean(shopConnection?.capabilities?.showcase_ready);
  $("#syncTikTokShowcase").hidden = !shopConnection;
  $("#showcaseSyncLimitField").hidden = !shopConnection;
  $("#disconnectTikTokShop").hidden = !shopConnection;
  $("#connectTikTok").href = "#";
  $("#connectTikTok").textContent = connection ? "เลือกบัญชี TikTok ใหม่" : "เลือกบัญชี TikTok เพื่อเชื่อม";
  $("#connectTikTokShop").href = "#";
  $("#connectTikTokShop").textContent = "เชื่อมระบบ TikTok";
  if (shopConnection) loadMarketplaceCategories(context);
  $("#tiktokShopState").innerHTML = shopConnection ? `<div class="shop-summary"><p><b>${escapeHtml(shopConnection.creator_username || "TikTok Shop Creator")}</b> · ตลาด ${escapeHtml(shopConnection.selection_region || "ยังไม่ระบุ")} · ซิงก์ ${escapeHtml(shopConnection.last_synced_at || "ยังไม่เคย")}</p>${shopConnection.last_sync_error ? `<p class="shop-error">ครั้งล่าสุด: ${escapeHtml(shopConnection.last_sync_error)}</p>` : ""}</div>` : data.shop_configured ? "<p>ยังไม่ได้เชื่อมข้อมูล Showcase และออเดอร์ Affiliate</p>" : "<p>ยังไม่ได้ตั้งค่า TikTok Shop App key และ App secret</p>";
  $("#soldProductsData").innerHTML = shopConnection ? shopRangeSummary(data, products, orders) : '<p class="hint">เชื่อม TikTok Shop เพื่อโหลดสินค้าที่ขายได้และออเดอร์</p>';
  stampChannelOwnedActions($("#tiktokConnection"), context);
  stampChannelOwnedActions($("#channelShopAnalysis"), context);
  if (shopConnection) {
    decorateSoldProductSelection(products, orders);
    await syncSelectedSoldProductGrades(context);
    if (loadSeq !== state.connectionLoadSeq || !channelOwnership.current(context)) return null;
  }
  if (!data.configured && !connection) {
    $("#tiktokConnectionState").innerHTML = "<b>ยังไม่ได้ตั้งค่า TikTok API</b><p>ผู้ดูแลต้องตั้งค่า Login Kit client key และ secret ของ environment ที่ได้รับอนุมัติ</p>";
    return shopConnection;
  }
  if (!connection) {
    $("#tiktokConnectionState").innerHTML = "<b>เชื่อมข้อมูลพื้นฐานและวิดีโอที่ได้รับอนุญาต</b><p>โปรไฟล์เสริมและสถิติเป็นสิทธิ์เพิ่มเติม ไม่จำเป็นต่อการบันทึกบัญชีพื้นฐาน</p>";
    $("#tiktokVideoSummary").innerHTML = "";
    return shopConnection;
  }
  const granted = String(connection.scopes || '').split(/[\s,]+/);
  if (!granted.includes('user.info.basic')) {
    $("#tiktokConnectionState").innerHTML = '<b>ต้องเชื่อม TikTok ใหม่</b><p>ไม่มีสิทธิ์ข้อมูลพื้นฐานแล้ว จึงยังใช้ข้อมูลบัญชีนี้ไม่ได้</p>';
    $("#tiktokVideoSummary").innerHTML = '';
    return shopConnection;
  }
  $("#tiktokConnectionState").innerHTML = `<b>เชื่อมบัญชี TikTok ของช่องนี้แล้ว</b><p>ข้อมูลพื้นฐาน: เชื่อมแล้ว · วิดีโอ: ${granted.includes('video.list')?'ได้รับสิทธิ์':'ยังไม่ได้รับสิทธิ์'} · ข้อมูลเสริมโปรไฟล์: ${granted.includes('user.info.profile')?'ได้รับสิทธิ์':'ยังไม่ได้รับสิทธิ์'} · สถิติผู้ติดตาม: ${granted.includes('user.info.stats')?'ได้รับสิทธิ์':'ยังไม่ได้รับสิทธิ์'} · ซิงก์ล่าสุด ${escapeHtml(connection.last_synced_at || "ยังไม่เคย")}</p>`;
  $("#tiktokVideoSummary").innerHTML = granted.includes("video.list") ? `<p>รายการคลิปที่บันทึกไว้ ${videos.length} คลิป</p>` : "<p>ยังไม่ได้รับสิทธิ์วิดีโอ — บัญชีพื้นฐานยังเชื่อมอยู่ และจะไม่นำคลิปเก่ามาใช้วิเคราะห์</p>";
  return shopConnection;
}

function renderPermanentInventory(products = [], events = []) {
  const kept = products.filter((x) => x.inventory_status === "kept"), discarded = products.filter((x) => x.inventory_status === "discarded"), eventLabels = { analyzed: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E08\u0E32\u0E01\u0E23\u0E39\u0E1B", review_scheduled: "\u0E19\u0E31\u0E14\u0E15\u0E23\u0E27\u0E08", kept: "\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49", discarded: "\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01", manual_fail: "\u0E01\u0E14\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19" }, format = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(/* @__PURE__ */ new Date(`${value.replace(" ", "T")}Z`)) : "-", timeline = (name) => events.filter((event) => normalizeProductName(event.product_name) === normalizeProductName(name)).slice(0, 5).map((event) => `<div class="timeline-event"><time>${format(event.event_at)}</time><b>${escapeHtml(eventLabels[event.event_type] || event.event_type)}</b><span>${event.product_type ? `\u0E40\u0E01\u0E23\u0E14 ${escapeHtml(event.product_type)} \xB7 ` : ""}${escapeHtml(event.detail || "")}</span></div>`).join("") || '<span class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C</span>', rows = (items, status) => items.length ? `<div class="product-table-wrap"><table class="product-table permanent-product-table"><thead><tr><th>\u0E25\u0E33\u0E14\u0E31\u0E1A</th><th>\u0E40\u0E01\u0E23\u0E14</th><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th><th>\u0E04\u0E30\u0E41\u0E19\u0E19</th><th>\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14</th><th>\u0E40\u0E27\u0E25\u0E32\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C</th><th>\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30</th></tr></thead><tbody>${items.map((x, index) => `<tr><td><span class="inventory-order">${index + 1}</span></td><td><span class="type-pill type-${escapeHtml(x.product_type || "C")}">${escapeHtml(x.product_type || "C")}</span></td><td class="product-full-name">${escapeHtml(x.name)}</td><td>${Number(x.score) || 0}/100</td><td>${escapeHtml(x.evidence || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21")}</td><td class="product-timeline">${timeline(x.name)}</td><td><button type="button" data-inventory="${status === "kept" ? "discarded" : "kept"}" data-product-name="${escapeHtml(x.name)}" data-product-grade="${escapeHtml(x.product_type || "C")}" data-product-score="${Number(x.score) || 0}" data-product-evidence="${escapeHtml(x.evidence || "")}">${status === "kept" ? "\u0E22\u0E49\u0E32\u0E22\u0E44\u0E1B\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01" : "\u0E19\u0E33\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E40\u0E01\u0E47\u0E1A"}</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</p>';
  const remaining = Math.max(0, 30 - kept.length);
  $("#angelCount").textContent = `\u0E40\u0E01\u0E47\u0E1A\u0E41\u0E25\u0E49\u0E27 ${kept.length}/30 \xB7 ${remaining ? `\u0E40\u0E2B\u0E25\u0E37\u0E2D ${remaining}` : "\u0E04\u0E23\u0E1A 30 \u0E41\u0E25\u0E49\u0E27"} \xB7 \u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01 ${discarded.length}`;
  $("#angelProducts").innerHTML = `<section class="permanent-list kept"><h3>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49 <small>${kept.length}/30 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows(kept, "kept")}</section><section class="permanent-list discarded"><h3>\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01 <small>${discarded.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</small></h3>${rows(discarded, "discarded")}</section>`;
}
function reconcileProductPrepInventory(products = []) {
  const target = $('[data-list="plan"]');
  if (!target) return;
  const kept = products.filter(product => product.inventory_status === "kept").slice(0,40);
  target.innerHTML = kept.length ? kept.map((product,index) => {
    const grade = /^[A-F]$/.test(product.product_type) ? product.product_type : "";
    return `<div class="product-prep-item ranked"><span>${index+1}</span><div class="product-ranking-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.evidence||"เพิ่มเข้าลิสต์คัดสินค้าแล้ว")}</small></div><i class="product-prep-grade grade-${grade||"unknown"}">${grade||"ไม่มีเกรด"}</i><div class="inventory-actions product-prep-actions"><button type="button" class="danger" data-inventory="discarded" data-product-name="${escapeHtml(product.name)}" data-product-grade="${grade}">คัดออก</button></div></div>`;
  }).join("") : '<p class="hint">ยังไม่มีข้อมูลพอ — ยังไม่มีสินค้าที่เลือกไว้</p>';
  $("#productPrepSummary").innerHTML = `<span class="total">รวม <b>${kept.length}/40</b> สินค้าที่เลือกไว้</span>${["A","B","C","D","E","F"].map(grade=>`<span><i class="grade-dot grade-${grade}">${grade}</i><b>${kept.filter(product=>product.product_type===grade).length}</b> สินค้า</span>`).join("")}${state.shortlistTruncated?'<span>แสดง 40 รายการล่าสุดที่เลือกไว้</span>':""}`;
  if(state.shortlistError)target.innerHTML=`<p class="hint">${escapeHtml(state.shortlistError)} — เลือกช่องนี้อีกครั้งเพื่อลองใหม่</p>`+target.innerHTML;
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
  const keptTotal=Number(state.inventoryCounts?.kept)||products.filter(item=>item.inventory_status==='kept').length,discardedTotal=Number(state.inventoryCounts?.discarded)||products.filter(item=>item.inventory_status==='discarded').length,remaining=Math.max(0,30-keptTotal);
  $("#angelCount").textContent=`เก็บแล้ว ${keptTotal}/30 · ${remaining?`เหลือ ${remaining}`:'ครบ 30 แล้ว'} · คัดออก ${discardedTotal}`;
  const headings=$("#angelProducts").querySelectorAll('.permanent-list h3 small');if(headings[0])headings[0].textContent=`${keptTotal}/30 รายการ`;if(headings[1])headings[1].textContent=`${discardedTotal} รายการ`;
  const productMore=state.inventoryPagination?.products?.has_more,eventMore=state.inventoryPagination?.events?.has_more;if(productMore||eventMore)$("#angelProducts").insertAdjacentHTML('beforeend',`<div class="showcase-pagination">${productMore?'<button type="button" data-load-more-inventory="products">โหลดสินค้าเก่ากว่า</button>':''}${eventMore?'<button type="button" data-load-more-inventory="events">โหลดประวัติเหตุการณ์เก่ากว่า</button>':''}<small>โหลดเพิ่มครั้งละไม่เกิน 24 รายการ</small></div>`);
};
async function setProductInventory(button) {
  const context = channelContextFor(button);
  if (!context) return;
  const data = new FormData(), productName = button.dataset.productName || "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E19\u0E35\u0E49";
  data.set("action", "set_product_inventory");
  data.set("channel_id", context.channelId);
  data.set("product_name", productName);
  data.set("product_type", button.dataset.productGrade || "C");
  data.set("score", button.dataset.productScore || "0");
  data.set("evidence", button.dataset.productEvidence || "");
  data.set("inventory_status", button.dataset.inventory);
  button.disabled = true;
  try {
    const saved = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if(!channelOwnership.current(context))return;
    const latest=await refreshOwnedInventory(context);if(!latest)return;const kept=(latest.products||[]).filter(x=>x.inventory_status==="kept"),keptTotal=Number(state.inventoryCounts.kept)||kept.length,position=kept.findIndex(x=>normalizeProductName(x.name)===normalizeProductName(productName))+1,countText=position?` \xB7 \u0E25\u0E33\u0E14\u0E31\u0E1A ${position}/${keptTotal}`:"";
    const notice = saved.already_exists ? button.dataset.inventory === "kept" ? `\u201C${productName}\u201D \u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E25\u0E34\u0E2A\u0E15\u0E4C\u0E41\u0E25\u0E49\u0E27${countText} \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0B\u0E49\u0E33` : `\u201C${productName}\u201D \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E04\u0E31\u0E14\u0E2D\u0E2D\u0E01\u0E41\u0E25\u0E49\u0E27 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E0B\u0E49\u0E33` : button.dataset.inventory === "kept" ? `\u0E40\u0E01\u0E47\u0E1A \u201C${productName}\u201D \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08${countText}` : `\u0E04\u0E31\u0E14 \u201C${productName}\u201D \u0E2D\u0E2D\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \xB7 \u0E40\u0E2B\u0E25\u0E37\u0E2D ${keptTotal}/30`;
    message.textContent = notice;
    showToast(notice, saved.already_exists ? "warning" : "success");
  } catch (error) {
    if(channelOwnership.current(context)){message.textContent = error.message;showToast(error.message, "error");}
  } finally {
    button.disabled = false;
  }
}
async function failCProduct(button) {
  const context = channelContextFor(button);
  if (!context) return;
  const productName = button.dataset.failC || "";
  if (!productName) return;
  if (!confirm(`\u0E43\u0E2B\u0E49\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u201C${productName}\u201D \u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19 F \u0E17\u0E31\u0E19\u0E17\u0E35\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21?`)) return;
  const data = new FormData();
  data.set("action", "fail_c_product");
  data.set("channel_id", context.channelId);
  data.set("product_name", productName);
  button.disabled = true;
  try {
    await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if(!channelOwnership.current(context))return;message.textContent = `\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 ${productName} \u0E08\u0E32\u0E01 D \u0E40\u0E1B\u0E47\u0E19 F \u0E41\u0E25\u0E49\u0E27`;
    await refreshOwnedInventory(context);
  } catch (error) {
    if(channelOwnership.current(context))message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
async function retestFProduct(button) {
  const context = channelContextFor(button);
  if (!context) return;
  const productName = button.dataset.retestF || "";
  if (!productName) return;
  if (!confirm(`\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u201C${productName}\u201D \u0E40\u0E04\u0E22\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19 F \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1B\u0E47\u0E19 D \u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E0A\u0E48\u0E44\u0E2B\u0E21?`)) return;
  const data = new FormData();
  data.set("action", "retest_f_product");
  data.set("channel_id", context.channelId);
  data.set("product_name", productName);
  button.disabled = true;
  try {
    await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if(!channelOwnership.current(context))return;message.textContent = `\u0E19\u0E33 ${productName} \u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E40\u0E1B\u0E47\u0E19 D \u0E41\u0E25\u0E30\u0E15\u0E31\u0E49\u0E07\u0E23\u0E2D\u0E1A\u0E43\u0E2B\u0E21\u0E48 3 \u0E27\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27`;
    await refreshOwnedInventory(context);
  } catch (error) {
    if(channelOwnership.current(context))message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
async function setProductC(button) {
  const context = channelContextFor(button);
  if (!context) return;
  const productName = button.dataset.setC || "";
  if (!productName) return;
  const data = new FormData();
  data.set("action", "set_product_c");
  data.set("channel_id", context.channelId);
  data.set("product_name", productName);
  data.set("score", button.dataset.productScore || "0");
  data.set("evidence", button.dataset.productEvidence || "");
  data.set("product_url", button.dataset.productUrl || "");
  data.set("source_kind", button.dataset.sourceKind || "manual_selection");
  data.set("requested_grade", button.dataset.requestedGrade || "D");
  button.disabled = true;
  try {
    const saved = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if(!channelOwnership.current(context))return;
    const savedGrade = saved.product_type || "D";
    const notice = saved.already_exists ? `“${productName}” มีอยู่ในลิสต์คัดสินค้าแล้ว เกรดปัจจุบัน ${savedGrade}` : `เพิ่ม “${productName}” เป็นเกรด ${savedGrade} สำเร็จ`;
    message.textContent = notice;
    showToast(notice, saved.already_exists ? "warning" : "success");
    await refreshOwnedInventory(context);
    return saved;
  } catch (error) {
    if(channelOwnership.current(context)){message.textContent = error.message;showToast(error.message, "error");}
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
  const context=channelContextFor(button);if(!context)return;
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
  if(!channelOwnership.current(context))return;
  status.textContent = saved ? (saved.already_exists ? "สินค้านี้อยู่ในลิสต์แล้ว" : "เพิ่มสินค้าเข้าลิสต์แล้ว") : `เพิ่มสินค้าไม่สำเร็จ: ${message.textContent || "กรุณาลองอีกครั้ง"}`;
  if (saved) input.value = "";
});
$("#result").addEventListener("click", (event) => {
  const aiSearch=event.target.closest('[data-ai-marketplace-search]');
  if(aiSearch){searchAiRecommendation(aiSearch);return}
  const button = event.target.closest("[data-inventory]");
  if (button) setProductInventory(button);
});
$("#angelProducts").addEventListener("click", (event) => {
  const more=event.target.closest('[data-load-more-inventory]');if(more){const context=channelContextFor(more);if(!context)return;more.disabled=true;loadMoreInventoryResource(more.dataset.loadMoreInventory).catch(error=>{if(channelOwnership.current(context))showToast(error.message,'error')}).finally(()=>more.disabled=false);return}
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
  state.selected = String(id);
  const context = channelOwnership.begin(state.selected);
  clearChannelOwnedView();
  renderChannels();
  let inventory;
  try{inventory=await selectChannelBase(state.selected, context)}catch(error){if(channelOwnership.current(context)){message.textContent=error.message||"โหลดข้อมูลช่องไม่สำเร็จ";showToast(message.textContent,"error")}throw error}
  if(!inventory||!channelOwnership.current(context))return null;
  if(inventory.channel&&!state.channels.some(channel=>String(channel.id)===context.channelId)){state.channels.unshift(inventory.channel);renderChannels()}
  saveUiValue("visiond_tiktok_channel_id", context.channelId);
  replaceInventory(inventory);renderInventoryState();stampChannelOwnedActions($("#angelInventory"),context);stampChannelOwnedActions($("#result"),context);
  await refreshOwnedShortlist(context);
  if(!channelOwnership.current(context))return null;
  await loadTikTokConnection(context.channelId,context);
  if(!channelOwnership.current(context))return null;
  document.body.classList.toggle("shop-connected", Boolean(state.shopConnection));
  renderReviewSchedule(state.inventoryProducts,Boolean(state.shopConnection),state.inventoryEvents);
  stampChannelOwnedActions($("#angelInventory"),context);
  return inventory;
};
$("#channels").addEventListener("click", async (event) => {
  const moreChannels=event.target.closest('[data-load-more-channels]');if(moreChannels){const cursor=state.channelPagination?.next_cursor;if(!cursor)return;moreChannels.disabled=true;try{const params=new URLSearchParams({limit:'24',cursor}),data=await api(`/api/admin/tiktok-analyzer?${params}`,{cache:'no-store'});state.channels=mergeById(state.channels,data.channels);state.channelPagination=data.pagination||{};renderChannels()}catch(error){showToast(error.message,'error')}return}
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
  if (button) { resetMarketplaceView(); selectChannel(button.dataset.id).catch(()=>{}); }
});
function requestNewBrowserProfile(){return routeProfileConnection('tiktok_new',$('#newChannel'))}
$("#newChannel").addEventListener("click",requestNewBrowserProfile);
$("[data-open-channel-profile]")?.addEventListener("click",event=>issueProfileOAuth('view',event.currentTarget));
let profileRefreshRequest=null;
const refreshProfileStatus=()=>{if(!pageAuthorized||profileRefreshRequest)return profileRefreshRequest;const fresh=profileHandoffRequests.get('new'),target=fresh&&channelOwnership.unchanged(fresh.revision)?fresh:profileHandoffRequests.get(String(state.selected)),requests=target?[target]:[],owner=pageViewerId,revision=channelOwnership.revision();let selected=String(state.selected);const current=()=>launcherPageActive&&pageAuthorized&&owner===pageViewerId&&channelOwnership.unchanged(revision)&&String(state.selected)===selected;profileRefreshRequest=(async()=>{
 await prepareLauncherReadiness(true);if(!current())return;
 if(!requests.length){if(launcherReadiness.helper)setBrowserProfileStatus('สถานะช่องเป็นปัจจุบัน');else helperRecoveryStatus(null,launcherRegisteredMessage());if(!profileHandoffRequests.size)await loadChannels();return}
 await Promise.all(requests.map(async request=>{
  const response=await readLauncherStatus(request.commandId);if(!response.ok)throw new Error('อ่านสถานะการเชื่อมไม่ได้');const result=await response.json();
  if(!current()||profileHandoffRequests.get(request.key)!==request||request.owner!==pageViewerId)return;
  if(result.command_id&&result.command_id!==request.commandId)throw new Error('คำตอบสถานะไม่ตรงกับคำขอเดิม');
  if(result.oauth_status==='complete'){
   profileOAuthPendingKeys.delete(request.key);profileHandoffRequests.delete(request.key);
   setBrowserProfileStatus(launcherOAuthStage(result));
   if(browserProfileUuid.test(result.channel_id)&&channelOwnership.unchanged(request.revision)){state.selected=result.channel_id;selected=String(result.channel_id);browserLauncher?.clearPending(request.slotId);await loadChannels()}
  }else if(result.expired||['failed','cancelled'].includes(result.status)){clearProfileCommand(request);if(result.error_code==='HELPER_UPDATE_REQUIRED')helperRecoveryStatus(null,launcherOAuthStage(result));else setBrowserProfileStatus(launcherOAuthStage(result))}
  else if(result.status==='process_started'){setBrowserProfileStatus(launcherOAuthStage(result));if(result.intent==='view'){profileOAuthPendingKeys.delete(request.key);profileHandoffRequests.delete(request.key)}}
  else setBrowserProfileStatus(launcherOAuthStage(result));
 }));
 profileOAuthPending=profileHandoffRequests.size>0;
})().catch(error=>{if(current())helperRecoveryStatus(null,error.message)}).finally(()=>{profileRefreshRequest=null});return profileRefreshRequest};
$("[data-refresh-profile]")?.addEventListener('click',refreshProfileStatus);
window.addEventListener('focus',()=>{if(profileOAuthPending)refreshProfileStatus()});
async function syncTikTokShopData(mode) {
  const context=channelOwnership.capture(),shopConnection=context&&state.shopConnection&&String(state.shopConnection.channel_id)===context.channelId?state.shopConnection:null;
  if (!context||!shopConnection) return;
  const limitInput = $("#showcaseSyncLimit"), maxShowcase = Math.min(2000, Math.max(1, Math.floor(Number(limitInput.value) || 100)));
  limitInput.value = String(maxShowcase);
  const button=mode==="showcase"?$("#syncTikTokShowcase"):$("#syncTikTokShop");
  message.textContent = mode==="showcase" ? "กำลังโหลดสินค้า Showcase สูงสุด " + maxShowcase.toLocaleString("th-TH") + " รายการ…" : "กำลังรีเฟรชสินค้าที่ขายได้และออเดอร์ย้อนหลังสูงสุด 90 วัน…";
  button.disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_sync", id: shopConnection.id, channel_id: context.channelId, mode, days: 90, max_showcase: maxShowcase }) });
    if(!channelOwnership.current(context))return;
    message.textContent = mode==="showcase" ? `โหลดแล้ว ${result.showcaseCount} สินค้า Showcase` : `รีเฟรชแล้ว ${result.orderCount} ออเดอร์`;
    await loadTikTokConnection(context.channelId,context);
  } catch (error) {
    if(channelOwnership.current(context))message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
$("#syncTikTokShowcase").addEventListener("click", () => syncTikTokShopData("showcase"));
$("#tiktokShopState").addEventListener("submit", async (event) => {
  if (event.target.id !== "shopDateFilter") return;
  event.preventDefault();
  const context=channelOwnership.capture();if(!context)return;
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
    await loadTikTokConnection(context.channelId,context);
    if(!channelOwnership.current(context))return;
    showToast(`\u0E41\u0E2A\u0E14\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 ${from} \u0E16\u0E36\u0E07 ${to}`);
  } catch (error) {
    if(channelOwnership.current(context))showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "\u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E39";
  }
});
const soldOrderRequests=new Map(),soldOrderAttempts=new Map();
async function showSoldOrderRange(form,context,from,to){
  const connection=state.shopConnection,owner=pageViewerId,workspace=document.body?.classList.contains('workspace-output');
  if(!connection||String(connection.channel_id)!==context.channelId)return;
  const key=JSON.stringify([owner,connection.id,from,to]);
  if(soldOrderRequests.has(key))return soldOrderRequests.get(key);
  const button=form.querySelector('button[type="submit"]');
  const current=()=>pageAuthorized&&launcherPageActive&&owner===pageViewerId&&channelOwnership.current(context)&&form.isConnected&&workspace===document.body?.classList.contains('workspace-output')&&from===state.shopDateFrom&&to===state.shopDateTo&&String(new FormData(form).get('date_from'))===from&&String(new FormData(form).get('date_to'))===to;
  const request=(async()=>{
    button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='กำลังแสดงผล…';
    try{
      const query=new URLSearchParams({channel_id:context.channelId,date_from:from,date_to:to});
      const data=await api('/api/admin/tiktok-connections?'+query,{cache:'no-store',signal:AbortSignal.timeout(45000)});
      if(!current())return;
      if(data.date_range?.from!==from||data.date_range?.to!==to||data.shop_connections?.[0]?.id!==connection.id)throw new Error('ข้อมูลช่องหรือช่วงวันที่เปลี่ยน กรุณากดแสดงผลอีกครั้ง');
      let sync=data.order_sync;
      if(!sync?.can_read_orders)throw new Error('ยังไม่พร้อมอ่านออเดอร์ กรุณาตรวจสิทธิ์การเชื่อมต่อของช่องนี้');
      if(sync.status==='complete')soldOrderAttempts.delete(key);
      if(sync.status==='failed'&&sync.revision>(soldOrderAttempts.get(key)?.revision??-1))soldOrderAttempts.delete(key);
      while(current()){
        const attempt=soldOrderAttempts.get(key)||{id:crypto.randomUUID(),revision:sync.revision};
        soldOrderAttempts.set(key,attempt);
        const result=await api('/api/admin/tiktok-connections',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({action:'shop_orders',id:connection.id,channel_id:context.channelId,date_from:from,date_to:to,request_id:attempt.id,revision:attempt.revision})});
        if(!current())return;
        sync=result.order_sync;
        if(sync?.status==='running')throw new Error('คำขอเดิมยังทำงานอยู่ กรุณากดแสดงผลอีกครั้งเพื่อตรวจและทำต่อ');
        soldOrderAttempts.delete(key);
        if(sync?.status==='complete')break;
        if(sync?.status!=='partial')throw new Error(sync?.status==='invalid_range'?'กรุณาเลือกวันที่ผ่านมาไม่เกิน 90 วัน':'TikTok ยังส่งข้อมูลไม่สำเร็จ กดแสดงผลอีกครั้งเพื่อทำต่อ ข้อมูลเดิมยังอยู่');
        if(!Number.isInteger(sync.revision)||sync.revision<=attempt.revision)throw new Error('สถานะคำขอเปลี่ยน กรุณากดแสดงผลอีกครั้งเพื่อทำต่อ');
      }
      if(current())await loadTikTokConnection(context.channelId,context);
    }catch(error){
      if(current()){message.textContent=error.message;await loadTikTokConnection(context.channelId,context).catch(()=>{});}
    }finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent='แสดงผล'}
  })();
  soldOrderRequests.set(key,request);
  try{return await request}finally{if(soldOrderRequests.get(key)===request)soldOrderRequests.delete(key)}
}
$("#soldProductsData").addEventListener("submit", async (event) => {
  if(event.target.id!=="shopDateFilter")return;
  event.preventDefault();
  const context=channelOwnership.capture();if(!context)return;
  const data=new FormData(event.target),from=String(data.get('date_from')||''),to=String(data.get('date_to')||'');
  if(!from||!to||from>to)return showToast('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด','warning');
  state.shopDateFrom=from;state.shopDateTo=to;
  await showSoldOrderRange(event.target,context,from,to);
});
$("#soldProductsData").addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-sold-product]");
  if (button) addSoldProductToSelection(button);
});
$("#disconnectTikTokShop").addEventListener("click", async () => {
  const context=channelOwnership.capture(),shopConnection=context&&state.shopConnection&&String(state.shopConnection.channel_id)===context.channelId?state.shopConnection:null;
  if (!context||!shopConnection || !confirm("\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 TikTok Shop \u0E41\u0E25\u0E30\u0E25\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E44\u0E27\u0E49?")) return;
  try {
    await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_disconnect", id: shopConnection.id, channel_id: context.channelId }) });
    if(!channelOwnership.current(context))return;
    state.shopConnection = null;
    message.textContent = "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 TikTok Shop \u0E41\u0E25\u0E49\u0E27";
    await loadTikTokConnection(context.channelId,context);
  } catch (error) {
    if(channelOwnership.current(context))message.textContent = error.message;
  }
});
$("#marketplaceSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const context=channelOwnership.capture();if(!context)return;
  try {
    $("#marketplaceSnapshot").textContent = "กำลังค้นหาสินค้า Open Collaboration จาก TikTok…";
    await searchMarketplace("product","",context);
  } catch (error) {
    if(!channelOwnership.current(context))return;
    const message = marketplaceErrorMessage(error);
    revealMarketplaceReconnect(error);
    $("#marketplaceSnapshot").textContent = message;
    showToast(message, "error");
  }
});
$("#marketplaceShopSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const context=channelOwnership.capture();if(!context)return;
  try {
    $("#marketplaceShopSnapshot").textContent = "กำลังค้นหาชื่อร้านค้าจาก TikTok Marketplace…";
    await searchMarketplace("shop","",context);
  } catch (error) {
    if(!channelOwnership.current(context))return;
    const message = marketplaceErrorMessage(error);
    revealMarketplaceReconnect(error);
    $("#marketplaceShopSnapshot").textContent = message;
    showToast(message, "error");
  }
});
async function addProductsToShowcase(ids, button, mode = "product") {
  const context=channelContextFor(button),shopConnection=context&&state.shopConnection&&String(state.shopConnection.channel_id)===context.channelId?state.shopConnection:null;
  if (!context||!shopConnection) return;
  if (!shopConnection.capabilities?.can_write_showcase) {
    renderShowcasePermission();
    $("#showcasePermission")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return showToast("ยังเพิ่มไม่ได้: ต้องเปิด creator.showcase.write หรือ creator.video.write ใน TikTok Shop Partner Center แล้วเชื่อมบัญชีใหม่", "error");
  }
  if (!ids.length) return showToast("กรุณาเลือกสินค้า Marketplace ก่อน", "warning");
  button.disabled = true;
  try {
    const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_add", id: shopConnection.id, channel_id: context.channelId, product_ids: ids }) });
    if(!channelOwnership.current(context))return;
    showToast(result.warning || `เพิ่มสินค้าเข้า Showcase ของ ${shopConnection.creator_username || "บัญชี Creator"} แล้ว ${Number(result.added || ids.length).toLocaleString()} รายการ`, result.warning ? "warning" : "success");
    await loadTikTokConnection(context.channelId,context);
    renderMarketplaceProducts({ products: marketplaceView(mode).products }, mode);
  } catch (error) {
    if(channelOwnership.current(context))showToast(error.message, "error");
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
async function removeShowcaseProducts(ids, scopeLabel, sourceButton) {
  const context=channelContextFor(sourceButton),shopConnection=context&&state.shopConnection&&String(state.shopConnection.channel_id)===context.channelId?state.shopConnection:null;
  if (!context||!shopConnection) return;
  const connectionId = shopConnection.id, account = shopConnection.creator_username || "บัญชี Creator";
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return showToast("ไม่มีสินค้า Showcase ให้ลบ", "warning");
  if (!confirm(`ยืนยัน${scopeLabel} ${uniqueIds.length.toLocaleString()} รายการออกจาก Showcase ของ ${account}? การกระทำนี้มีผลกับบัญชีจริงและย้อนกลับไม่ได้`)) return;
  const buttons = [...document.querySelectorAll(".remove-showcase-item")];
  buttons.forEach((button) => { button.disabled = true; });
  let removed = 0;
  try {
    for (let index = 0; index < uniqueIds.length; index += 200) {
      const batch = uniqueIds.slice(index, index + 200);
      const result = await api("/api/admin/tiktok-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "shop_remove", id: connectionId, channel_id: context.channelId, product_ids: batch }) });
      removed += Number(result.removed || batch.length);
    }
    if(!channelOwnership.current(context))return;showToast(`ลบสินค้าออกจาก Showcase แล้ว ${removed.toLocaleString()} รายการ`);
    state.showcasePage = 1;
    await loadTikTokConnection(context.channelId,context);
  } catch (error) {
    if(channelOwnership.current(context)){showToast(removed ? `ลบสำเร็จ ${removed.toLocaleString()} รายการ ก่อนเกิดข้อผิดพลาด: ${error.message}` : error.message, "error");await loadTikTokConnection(context.channelId,context);}
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
  const selectedAtStart=String(state.selected||""),context=selectedAtStart?channelOwnership.capture():null,startRevision=channelOwnership.revision();
  if(selectedAtStart&&!context)return;
  message.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E48\u0E2D\u0E07\u2026";
  const data = new FormData(form);
  data.set("action", "save_channel");
  try {
    const result = await api("/api/admin/tiktok-analyzer", { method: "POST", body: data });
    if(context&&!channelOwnership.current(context)||!context&&!channelOwnership.unchanged(startRevision))return;
    state.selected = String(result.channel_id);
    if(!context)channelOwnership.adopt(state.selected,startRevision);
    message.textContent = "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E0A\u0E48\u0E2D\u0E07\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27";
    await loadChannels();
  } catch (error) {
    if(context?channelOwnership.current(context):channelOwnership.unchanged(startRevision))message.textContent = error.message;
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
  const selectedAtStart=String(state.selected||""),existingContext=selectedAtStart?channelOwnership.capture():null,startRevision=channelOwnership.revision();
  if(selectedAtStart&&!existingContext)return showToast("กำลังเปลี่ยนช่อง กรุณารอข้อมูลช่องที่เลือก", "warning");
  message.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E48\u0E32\u0E19\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C \u0E2D\u0E32\u0E08\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 1 \u0E19\u0E32\u0E17\u0E35\u2026";
  $("#analyze").disabled = true;
  let publishContext=existingContext;
  try {
    const selectedFiles = [...$("#screenshots").files], batches = selectedFiles.length > 5 ? Array.from({ length: Math.ceil(selectedFiles.length / 5) }, (_, index) => selectedFiles.slice(index * 5, index * 5 + 5)) : [selectedFiles],baseEntries=[...new FormData(form).entries()].filter(([key])=>key!=="screenshots");
    const results = [];let operationChannelId=existingContext?.channelId||"";
    for (let index = 0; index < batches.length; index++) {
      if (batches.length > 1&&(publishContext?channelOwnership.current(publishContext):channelOwnership.unchanged(startRevision))) message.textContent = `กำลังวิเคราะห์ชุด ${index + 1}/${batches.length}…`;
      const payload = new FormData();baseEntries.forEach(([key,value])=>payload.append(key,value));
      for (const file of batches[index]) payload.append("screenshots", file);
      if (operationChannelId) payload.set("channel_id", operationChannelId);else payload.delete("channel_id");
      if (batches.length > 1) payload.set("clips_per_day", "20");
      const data = await api("/api/admin/tiktok-analyzer", { method: "POST", body: payload });
      if(!operationChannelId)operationChannelId=String(data.channel_id||"");
      if(!publishContext&&operationChannelId&&channelOwnership.unchanged(startRevision)){state.selected=operationChannelId;publishContext=channelOwnership.adopt(operationChannelId,startRevision)}
      results.push(data.result);
    }
    if(!publishContext||!channelOwnership.current(publishContext))return;
    if(renderOwnedResult(mergeAnalysisResults(results),publishContext)) $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    message.textContent = "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E41\u0E25\u0E49\u0E27";
    await loadChannels();
  } catch (error) {
    if(publishContext?channelOwnership.current(publishContext):channelOwnership.unchanged(startRevision))message.textContent = error.message;
  } finally {
    $("#analyze").disabled = false;
  }
});
const cleanProviderCallbackUrl=()=>{const source=new URLSearchParams(location.search),keep=new URLSearchParams();for(const key of['channel_id','launcher_profile','launcher_mode','launcher_slot']){const value=source.get(key);if(value)keep.set(key,value)}history.replaceState({},"",`${location.pathname}${keep.size?`?${keep}`:""}`)};
const shopOauthStatus = new URLSearchParams(location.search).get("tiktok_shop");
if (shopOauthStatus) {
  const detail = new URLSearchParams(location.search).get("detail") || "";
  message.textContent = shopOauthStatus === "connected" ? "เชื่อมบัญชี TikTok Shop Creator พร้อมใช้ Marketplace และ Showcase แล้ว" : shopOauthStatus === "account_already_linked" ? `บัญชี TikTok Shop นี้เชื่อมกับ “${detail || "ช่องอื่น"}” อยู่แล้ว ระบบจึงไม่ย้ายบัญชี กลับไปกดเชื่อมระบบ TikTok แล้วเลือกบัญชีของช่องนี้` : shopOauthStatus === "channel_already_linked" ? `การ์ดช่องนี้เชื่อมกับ “${detail || "บัญชี TikTok Shop อื่น"}” อยู่แล้ว กรุณายกเลิกการเชื่อมต่อเดิมก่อน` : shopOauthStatus === "channel_unavailable" ? "ไม่สามารถเชื่อมได้ เพราะการ์ดช่องนี้ถูกลบหรือไม่ใช่ช่องของบัญชีคุณ" : shopOauthStatus === "permissions_required" ? `เชื่อมบัญชี Creator แล้ว แต่สิทธิ์ยังไม่ครบ: ${detail} กรุณาเปิดสิทธิ์ใน TikTok Partner Center แล้วเชื่อมใหม่` : shopOauthStatus === "denied" ? "ยกเลิกการอนุญาต TikTok Shop แล้ว" : `เชื่อม TikTok Shop ไม่สำเร็จ${detail ? `: ${detail}` : " กรุณาลองใหม่"}`;
  cleanProviderCallbackUrl();
}
const oauthStatus = new URLSearchParams(location.search).get("tiktok");
if (oauthStatus) {
  const detail = new URLSearchParams(location.search).get("detail") || "";
  message.textContent = oauthStatus === "account_limit" ? detail : oauthStatus === "connected" ? "เชื่อมต่อ TikTok สำเร็จ กำลังตรวจข้อมูล Chrome โปรไฟล์ของช่อง" : oauthStatus === "profile_conflict" ? "Chrome โปรไฟล์นี้ถูกผูกกับช่องหรือบัญชีอื่นแล้ว ระบบไม่ได้ย้ายการเชื่อมต่อ" : oauthStatus === "account_already_linked" ? `บัญชี TikTok นี้เชื่อมกับ “${detail || "ช่องอื่น"}” อยู่แล้ว ระบบจึงไม่ย้ายบัญชี` : oauthStatus === "channel_already_linked" ? `การ์ดช่องนี้เชื่อมกับ “${detail || "บัญชี TikTok อื่น"}” อยู่แล้ว กรุณายกเลิกการเชื่อมต่อเดิมก่อน` : oauthStatus === "channel_unavailable" ? "ไม่สามารถเชื่อมได้ เพราะการ์ดช่องนี้ถูกลบหรือไม่ใช่ช่องของบัญชีคุณ" : oauthStatus === "denied" ? "ยกเลิกการอนุญาต TikTok แล้ว" : "เชื่อมต่อ TikTok ไม่สำเร็จ กรุณาลองใหม่";
  cleanProviderCallbackUrl();
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
async function bootstrapReviewerAccess(){
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store'});
    if(response.status===401){
      sessionStorage.setItem('vd_return_to',`${location.pathname}${location.search}${location.hash}`);
      location.replace('/login.html');
      return;
    }
    if(!response.ok)throw new Error(response.status===503?'ระบบสมาชิกถึงขีดจำกัดชั่วคราว กรุณาลองใหม่หลังระบบรีเซ็ต':'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ');
    const authPayload=await response.json().catch(()=>({}));pageViewerId=String(authPayload?.user?.id||"");if(!/^\d+$/.test(pageViewerId))throw new Error('ตรวจสอบเจ้าของโปรไฟล์ไม่สำเร็จ');
    try{
      const key='visiond_browser_launcher_context';
      if(launcherContextFromQuery)sessionStorage.setItem(key,JSON.stringify({...launcherContextFromQuery,ownerId:pageViewerId}));
      else{const saved=JSON.parse(sessionStorage.getItem(key)||'null');launcherContext=saved&&String(saved.ownerId)===pageViewerId&&['new','existing'].includes(saved.mode)&&(!saved.slotId||browserProfileUuid.test(saved.slotId))&&(!saved.channelId||browserProfileUuid.test(saved.channelId))?Object.freeze({mode:saved.mode,slotId:saved.slotId||'',channelId:saved.channelId||''}):null}
    }catch{if(!launcherContextFromQuery)launcherContext=null}
    pageAuthorized=true;
    await initializeLauncherReadiness();
    await loadChannels();
  }catch(error){
    $('#channels').innerHTML=`<p class="shop-error">${escapeHtml(error.message||'เปิดระบบ VX ไม่สำเร็จ')}</p><button type="button" onclick="location.reload()">ลองใหม่</button>`;
  }finally{
    $('#newChannel').disabled=false;$('#newChannel').removeAttribute('aria-busy');$('#newChannel').textContent='+ ช่องใหม่';
  }
}
bootstrapReviewerAccess();
