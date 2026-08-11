const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  programDialog = document.querySelector("#programDialog"),
  keyDialog = document.querySelector("#keyDialog"),
  historyDialog = document.querySelector("#historyDialog"),
  programsEl = document.querySelector("#programs"),
  licensesEl = document.querySelector("#licenses"),
  licenseSearch = document.querySelector("#licenseSearch"),
  releaseProgram = document.querySelector("#releaseProgram"),
  keyProgram = document.querySelector("#keyProgram"),
  keyPlan = document.querySelector("#keyPlan"),
  keyUser = document.querySelector("#keyUser"),
  userSearch = document.querySelector("#userSearch"),
  historyContent = document.querySelector("#historyContent"),
  issuedKey = document.querySelector("#issuedKey"),
  releaseForm = document.querySelector("#releaseForm"),
  releaseState = document.querySelector("#releaseState"),
  releases = document.querySelector("#releases"),
  newProgram = document.querySelector("#newProgram"),
  newKey = document.querySelector("#newKey"),
  programForm = document.querySelector("#programForm"),
  programState = document.querySelector("#programState"),
  saveProgram = document.querySelector("#saveProgram"),
  keyForm = document.querySelector("#keyForm"),
  encryptionState = document.querySelector("#encryptionState"),
  keySummary = document.querySelector("#keySummary"),
  keyBindingPreview = document.querySelector("#keyBindingPreview"),
  issueKeySubmit = document.querySelector("#issueKeySubmit"),
  nextAction = document.querySelector("#nextAction"),
  releaseDetails = document.querySelector("#releaseDetails");
const programPreview = document.querySelector("#programPreview"),
  platformHelp = document.querySelector("#platformHelp"),
  keyMode = document.querySelector("#keyMode"),
  keyCostSummary = document.querySelector("#keyCostSummary"),
  keyCustomerFields = document.querySelector("#keyCustomerFields"),
  keyPackageField = document.querySelector("#keyPackageField"),
  testDurationField = document.querySelector("#testDurationField"),
  testDuration = document.querySelector("#testDuration");
let programs = [],
  users = [],
  encryptionReady = false,
  licenseFilter = "all",
  operatorUserId = 0;
window.__licenses = [];
const plans = (p) => {
  try {
    return typeof p.plans === "string" ? JSON.parse(p.plans) : p.plans || [];
  } catch {
    return [];
  }
};
function programOptions(target) {
  target.innerHTML = programs
    .map(
      (x) =>
        `<option value="${x.id}">${x.platform_type === "veasy" ? "V Easy · " : ""}${esc(x.product_title || x.code)}</option>`,
    )
    .join("");
}
function planOptions() {
  const program = programs.find(
    (x) => Number(x.id) === Number(keyProgram.value),
  );
  keyPlan.innerHTML =
    '<option value="">ไม่กำหนด</option>' +
    plans(program || {})
      .filter((x) => x.active !== 0)
      .map(
        (x) =>
          `<option value="${x.id}">${esc(x.name)}${x.duration_days ? ` · ${x.duration_days} วัน` : " · ตลอดชีพ"}${x.offer_price != null ? ` · ${(Number(x.offer_price)/100).toLocaleString("th-TH")} บาท` : " · ยังไม่มีราคาขาย"}</option>`,
      )
      .join("");
  const veasy = program?.platform_type === "veasy";
  keyBindingPreview.hidden = !veasy;
  keyBindingPreview.textContent = veasy
    ? "คีย์ V Easy นี้ออกแยกจาก APK · เริ่มสถานะ ‘รอผูกร้าน’ ลูกค้านำไปกรอกใน Settings และผูกได้ 1 ร้าน"
    : "";
  updateKeyCost();
}
function updateKeyCost() {
  if (keyMode.value === "test") {
    keyCostSummary.textContent = "คีย์ทดสอบ · ไม่มีค่าใช้จ่าย";
    return;
  }
  const program = programs.find((x) => Number(x.id) === Number(keyProgram.value));
  const plan = plans(program || {}).find((x) => Number(x.id) === Number(keyPlan.value));
  keyCostSummary.textContent = !plan ? "กรุณาเลือกแพ็กเกจเพื่อดูค่าใช้จ่าย" : plan.offer_price != null ? `ค่าใช้จ่าย ${(Number(plan.offer_price)/100).toLocaleString("th-TH")} บาท · ${plan.name}` : `${plan.name} · ยังไม่ได้กำหนดราคาขาย`;
}
function syncKeyMode() {
  const testMode = keyMode.value === "test";
  keyCustomerFields.hidden = testMode;
  keyPackageField.hidden = testMode;
  testDurationField.hidden = !testMode;
  keyUser.required = !testMode;
  keyPlan.required = !testMode;
  if (testMode && operatorUserId) keyUser.value = String(operatorUserId);
  updateKeyCost();
}
function userOptions(q = "") {
  const needle = q.trim().toLowerCase();
  keyUser.innerHTML = users
    .filter(
      (x) =>
        !needle ||
        `${x.name} ${x.username} ${x.email} ${x.phone}`
          .toLowerCase()
          .includes(needle),
    )
    .slice(0, 100)
    .map(
      (x) =>
        `<option value="${x.id}">${esc(x.name)} · ${esc(x.username || "-")} · ${esc(x.email)}</option>`,
    )
    .join("");
}
function renderLicenses() {
  const q = licenseSearch.value.trim().toLowerCase();
  const effectiveStatus = (x) => x.status === "active" && x.expires_at && Date.parse(String(x.expires_at).replace(" ", "T") + (String(x.expires_at).includes("Z") ? "" : "Z")) <= Date.now() ? "expired" : x.status;
  const matchesFilter = (x) => licenseFilter === "all" ||
    (licenseFilter === "active" && effectiveStatus(x) === "active") ||
    (licenseFilter === "expired" && effectiveStatus(x) === "expired") ||
    (licenseFilter === "unbound" && x.platform_type === "veasy" && x.binding_state === "unbound") ||
    (licenseFilter === "devices" && Number(x.active_devices) > 0);
  const filtered = window.__licenses.filter(
        (x) =>
          matchesFilter(x) && (!q ||
          `${x.user_name} ${x.email} ${x.program_title} ${x.program_code} ${x.key_last4}`
            .toLowerCase()
            .includes(q)),
      );
  const ageLabel = (x) => { let days=x.duration_days;if(x.issuance_type==="test"&&x.expires_at&&x.starts_at)days=Math.round((Date.parse(String(x.expires_at).replace(" ","T")+"Z")-Date.parse(String(x.starts_at).replace(" ","T")+"Z"))/86400000);return days==null?"ตลอดอายุ":Number(days)===30?"30 วัน":Number(days)===365?"1 ปี":`${Number(days)} วัน`;};
  const dateLabel = (value) => value ? new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"short"}).format(new Date(String(value).replace(" ","T")+"Z")) : "-";
  licensesEl.innerHTML = filtered.length ? `<div class="license-table-wrap"><table class="license-table"><thead><tr><th>ลูกค้า</th><th>แอป / เลขคีย์</th><th>แพ็กเกจ / อายุคีย์</th><th>ค่าใช้จ่าย</th><th>วันที่ออก</th><th>ผู้ออก</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${filtered.map((x)=>`<tr><td><b>#${Number(x.user_id)}</b><br>${esc(x.user_name)}<br><small>${esc(x.email||"")}</small></td><td><b>${x.platform_type === "veasy" ? "V Easy · " : ""}${esc(x.program_title||x.program_code)}</b><br><code>${esc(x.key_masked)}</code></td><td>${esc(x.plan_name||"ไม่กำหนดแพ็กเกจ")}<br><b>${ageLabel(x)}</b></td><td><b>${Number(x.display_cost||0).toLocaleString("th-TH")} บาท</b><br><small>${x.issuance_type === "test" ? "คีย์ทดสอบ" : x.order_id ? "จากออเดอร์" : "คีย์ลูกค้า"}</small></td><td>${dateLabel(x.created_at)}</td><td>${esc(x.issuer_name||"ระบบ")}</td><td><span class="status">${esc(effectiveStatus(x))}</span><br><small>${Number(x.active_devices)}/${Number(x.max_devices)||3} เครื่อง</small>${x.platform_type === "veasy"&&x.binding_state === "unbound"?'<br><span class="binding-unbound">รอผูกร้าน</span>':""}</td><td><div class="license-actions"><button data-renew="${x.id}" data-program="${x.program_id}">ต่ออายุ</button>${x.status === "suspended"?`<button data-status="active" data-id="${x.id}">เปิดคืน</button>`:`<button class="danger" data-status="suspended" data-id="${x.id}">ระงับ</button>`}<button data-history="${x.id}">ประวัติ</button></div></td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">ไม่พบคีย์</p>';
  for (const license of filtered) if (Number(license.active_devices) > 0) {
    const historyButton = licensesEl.querySelector(`[data-history="${CSS.escape(String(license.id))}"]`), resetButton = document.createElement("button");
    resetButton.type = "button";resetButton.className = "danger";resetButton.dataset.resetSlots = license.id;resetButton.dataset.deviceCount = String(license.active_devices);resetButton.textContent = `ล้างสล็อตคีย์ (${license.active_devices})`;historyButton?.before(resetButton);
  }
  bindLicenseActions();
}
let productOptions = [];
function productLabel(x) {
  const price = `${(Number(x.price) || 0).toLocaleString("th-TH")} บาท`;
  const status = x.status === "published" ? "เปิดขาย" : "แบบร่าง—ลูกค้ายังซื้อไม่ได้";
  return `#${x.id} · ${x.title} · ${x.slug} · ${price} · ${status}${x.binding_program ? ` · ใช้แล้วกับ ${x.binding_program}` : ""}`;
}
function fillProductSelects(available = true) {
  const selects = document.querySelectorAll("[data-product-select]");
  selects.forEach((select) => {
    const chosen = select.value;
    select.replaceChildren(new Option("— ไม่ผูกตะกร้าสินค้า —", ""));
    productOptions.forEach((x) => {
      const option = new Option(productLabel(x), String(x.id));
      option.disabled = Boolean(x.binding_program);
      select.add(option);
    });
    select.value = available ? chosen : "";
    select.disabled = !available;
  });
  if (!selects.length) return;
  saveProgram.disabled = false;
  if (available) {
    if (programState.textContent.includes("โหลดรายการสินค้า")) programState.textContent = "";
    programPreview.textContent = "ยังไม่ได้ผูกตะกร้าขาย · แอดมินยังออกคีย์ทั้ง 3 แบบได้";
  } else {
    programState.className = "muted error";
    programState.textContent = "โหลดรายการสินค้าไม่สำเร็จ แต่ยังสร้างโปรแกรมเพื่อออกคีย์โดยแอดมินได้ โดยยังไม่ผูกตะกร้าขาย";
    programPreview.textContent = "โหมดออกคีย์โดยแอดมิน · Product ID ทุกแพ็กเกจจะเว้นว่าง";
  }
}
function validateProductChoices() {
  const selects = [...programForm.querySelectorAll("[data-product-select]")];
  selects.forEach((x) => x.classList.remove("field-error"));
  const selected = selects.filter((x) => x.value);
  const duplicate = selected.find((x, i) => selected.some((y, j) => j !== i && y.value === x.value));
  if (duplicate) {
    selected.filter((x) => x.value === duplicate.value).forEach((x) => x.classList.add("field-error"));
    programState.className = "muted error";
    programState.textContent = `สินค้า #${duplicate.value} เลือกซ้ำหลายช่อง กรุณาเลือกสินค้าแยกกัน`;
    return false;
  }
  const names = {lifetime_product_id:"ตลอดชีพ",monthly_product_id:"รายเดือน 30 วัน",yearly_product_id:"รายปี 365 วัน"};
  const linked = selected.filter((x) => names[x.name]).map((x) => names[x.name]);
  programPreview.textContent = linked.length ? `เปิดขายอัตโนมัติ: ${linked.join(" · ")} · ช่องว่างยังออกคีย์โดยแอดมินได้` : "ยังไม่ได้ผูกตะกร้าขาย · แอดมินยังออกคีย์ทั้ง 3 แบบได้";
  return true;
}
async function load() {
  let pd = {items:[],product_options:[],product_options_available:false};
  try {
    const p = await fetch("/api/admin/vision7/programs", {cache:"no-store"});
    if (p.status === 401 || p.status === 403) { location.href = "/login.html?next=/vision7-admin.html"; return; }
    const parsed = await p.json().catch(() => null);
    if (!p.ok || !parsed) throw new Error(parsed?.error || "โหลดโปรแกรมไม่สำเร็จ");
    pd = parsed;
  } catch (error) {
    programsEl.innerHTML = `<p class="muted error">${esc(error.message || "โหลดโปรแกรมไม่สำเร็จ")} · ยังสร้างโปรแกรมแบบไม่ผูกตะกร้าได้</p>`;
  }
  programs = Array.isArray(pd.items) ? pd.items : [];
  productOptions = Array.isArray(pd.product_options) ? pd.product_options : [];
  fillProductSelects(pd.product_options_available !== false);
  const safeLoad = async (url) => {
    const response = await fetch(url, {cache:"no-store"});
    if (response.status === 401 || response.status === 403) { location.href = "/login.html?next=/vision7-admin.html"; throw new Error("AUTH_REDIRECT"); }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || `โหลดข้อมูลไม่สำเร็จ (${response.status})`);
    return data;
  };
  const [licenseResult, releaseResult, userResult] = await Promise.allSettled([
    safeLoad("/api/admin/vision7/licenses"), safeLoad("/api/admin/vision7/releases"), safeLoad("/api/admin/users")
  ]);
  const ld = licenseResult.status === "fulfilled" ? licenseResult.value : {items:[],encryption_ready:false,summary:{}};
  const rd = releaseResult.status === "fulfilled" ? releaseResult.value : {items:[]};
  const ud = userResult.status === "fulfilled" ? userResult.value : {items:[]};
  users = Array.isArray(ud.items) ? ud.items : [];
  operatorUserId = Number(ld.operator?.id) || 0;
  window.__licenses = Array.isArray(ld.items) ? ld.items : [];
  encryptionReady = ld.encryption_ready === true;
  encryptionState.className = `key-center-state ${encryptionReady ? "ready" : "blocked"}`;
  encryptionState.textContent = encryptionReady
    ? "พร้อมออกคีย์ · ระบบเข้ารหัส VISION7_LICENSE_ENCRYPTION_KEY ทำงานแล้ว"
    : "ยังออกคีย์ไม่ได้ · กรุณาตั้ง Cloudflare Secret: VISION7_LICENSE_ENCRYPTION_KEY อย่างน้อย 32 ตัวอักษร";
  newKey.setAttribute("aria-disabled", String(!encryptionReady));
  const rows = window.__licenses;
  const isExpired = (x) => x.status === "expired" || (x.status === "active" && x.expires_at && Date.parse(String(x.expires_at).replace(" ", "T") + (String(x.expires_at).includes("Z") ? "" : "Z")) <= Date.now());
  const summary = {total:rows.length,active:rows.filter((x)=>x.status === "active" && !isExpired(x)).length,expired:rows.filter(isExpired).length,unbound_veasy:rows.filter((x)=>x.platform_type === "veasy" && x.binding_state === "unbound").length,active_devices:rows.reduce((n,x)=>n+Number(x.active_devices||0),0)};
  keySummary.innerHTML = [
    ["all", "คีย์ทั้งหมด", summary.total],
    ["active", "กำลังใช้งาน", summary.active],
    ["expired", "หมดอายุ", summary.expired],
    ["unbound", "V Easy รอผูกร้าน", summary.unbound_veasy],
    ["devices", "เครื่อง Active", summary.active_devices],
  ]
    .map(
      ([filter, label, value]) =>
        `<button type="button" class="summary-card" data-license-filter="${filter}" aria-pressed="${filter === licenseFilter}"><small>${esc(label)}</small><b>${Number(value) || 0}</b></button>`,
    )
    .join("");
  keySummary.querySelectorAll("[data-license-filter]").forEach((button) => button.onclick = () => { licenseFilter = button.dataset.licenseFilter; renderLicenses(); keySummary.querySelectorAll("[data-license-filter]").forEach((x)=>x.setAttribute("aria-pressed", String(x === button))); });
  programsEl.innerHTML =
    programs
      .map(
        (x) =>
          `<section class="program-row"><div><b>${x.platform_type === "veasy" ? "V Easy · " : ""}${esc(x.product_title || x.code)}</b><code>${esc(x.code)}</code><span>${esc(x.platform_type)} · v${esc(x.current_version)} · ${plans(x).filter((p)=>p.product_id).length}/3 แพ็กเกจขาย</span></div><div class="program-actions"><button type="button" data-issue-program="${x.id}">ออกคีย์</button><button type="button" class="secondary-action" data-release-program="${x.id}">จัดการเวอร์ชัน</button></div></section>`,
      )
      .join("") || '<section class="v7-empty"><span aria-hidden="true">1</span><h3>เริ่มจากสร้างโปรแกรมแรก</h3><p>กำหนดแพลตฟอร์มก่อน จึงจะออกคีย์และเผยแพร่ตัวติดตั้งได้</p><button type="button" data-first-program>สร้างโปรแกรมแรก</button></section>';
  programOptions(releaseProgram);
  programOptions(keyProgram);
  userOptions();
  syncKeyMode();
  planOptions();
  syncKeyMode();
  const hasPrograms = programs.length > 0;
  newProgram.textContent = hasPrograms ? "＋ เพิ่มโปรแกรม" : "＋ เพิ่มโปรแกรมแรก";
  newKey.toggleAttribute("disabled", !hasPrograms);
  newKey.setAttribute("aria-disabled", String(!hasPrograms || !encryptionReady));
  releaseDetails.dataset.blocked = String(!hasPrograms);
  releaseForm.querySelectorAll("input,select,textarea,button").forEach((x)=>x.disabled=!hasPrograms);
  nextAction.textContent = !hasPrograms ? "ขั้นถัดไป: สร้างโปรแกรมแรกก่อนออกคีย์" : !rows.length ? "ขั้นถัดไป: ออกคีย์ทดสอบให้โปรแกรมที่สร้างแล้ว" : "ระบบพร้อมใช้งาน · เพิ่มรีลีสใหม่เมื่อมี APK หรือตัวติดตั้งเวอร์ชันใหม่";
  document.querySelectorAll("[data-workflow-step]").forEach((x)=>x.classList.remove("current","complete"));
  const workflow = document.querySelectorAll("[data-workflow-step]");
  workflow[0].classList.add(hasPrograms ? "complete" : "current");
  if(hasPrograms) workflow[1].classList.add(rows.length ? "complete" : "current");
  if(hasPrograms && rows.length) workflow[2].classList.add("current");
  programsEl.querySelectorAll("[data-first-program]").forEach((x)=>x.onclick=openProgramDialog);
  programsEl.querySelectorAll("[data-issue-program]").forEach((x)=>x.onclick=()=>openKeyDialog(x.dataset.issueProgram));
  programsEl.querySelectorAll("[data-release-program]").forEach((x)=>x.onclick=()=>{releaseProgram.value=x.dataset.releaseProgram;releaseDetails.open=true;releaseDetails.scrollIntoView({behavior:"smooth",block:"start"});});
  renderLicenses();
  releases.innerHTML =
    (rd.items || [])
      .slice(0, 10)
      .map(
        (x) =>
          `<section class="release-row"><b>${esc(x.program_code)} v${esc(x.version)}</b>${x.mandatory ? " · บังคับอัปเดต" : ""}<small>${esc(x.file_name)}</small><details><summary>ดู SHA-256</summary><code>${esc(x.sha256)}</code></details></section>`,
      )
      .join("") || `<p class="muted">${releaseResult.status === "rejected" ? "โหลดรีลีสไม่สำเร็จ กรุณาลองใหม่" : "ยังไม่มีรีลีส"}</p>`;
  if (licenseResult.status === "rejected") licensesEl.innerHTML = '<p class="muted error">โหลดรายการคีย์ไม่สำเร็จ แต่ยังเพิ่มโปรแกรมได้</p>';
}
async function patchLicense(body) {
  const r = await fetch("/api/admin/vision7/licenses", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    d = await r.json();
  if (!r.ok) throw new Error(d.error || "จัดการคีย์ไม่สำเร็จ");
  return d;
}
function bindLicenseActions() {
  document.querySelectorAll("[data-status]").forEach(
    (b) =>
      (b.onclick = async () => {
        const note = prompt("หมายเหตุการเปลี่ยนสถานะ") || "";
        if (!confirm(`${b.textContent.trim()} คีย์นี้ใช่ไหม?`)) return;
        try {
          await patchLicense({
            id: b.dataset.id,
            action: "status",
            status: b.dataset.status,
            note,
          });
          load();
        } catch (e) {
          alert(e.message);
        }
      }),
  );
  document.querySelectorAll("[data-renew]").forEach(
    (b) =>
      (b.onclick = async () => {
        const p = programs.find(
            (x) => Number(x.id) === Number(b.dataset.program),
          ),
          choices = plans(p || {}).filter((x) => x.active !== 0),
          label = choices.map((x) => `${x.id}: ${x.name}`).join("\n"),
          planId = prompt(`ใส่ Plan ID ที่จะต่ออายุ\n${label}`);
        if (!planId) return;
        try {
          const d = await patchLicense({
            id: b.dataset.renew,
            action: "renew",
            plan_id: Number(planId),
            note: "ต่ออายุโดยผู้ดูแล",
          });
          alert(`ต่ออายุแล้ว หมดอายุ ${d.expires_at || "ไม่หมดอายุ"}`);
          load();
        } catch (e) {
          alert(e.message);
        }
      }),
  );
  document
    .querySelectorAll("[data-history]")
    .forEach((b) => (b.onclick = () => showHistory(b.dataset.history)));
  document.querySelectorAll("[data-reset-slots]").forEach((button) => button.onclick = async () => {
    const count = Number(button.dataset.deviceCount || 0);
    if (!confirm(`ล้างสล็อตคีย์ ${count} เครื่องใช่ไหม?\n\nคีย์ ร้าน เจ้าของ อายุคีย์ ออเดอร์ และประวัติจะไม่ถูกลบ`)) return;
    button.disabled = true;button.textContent = "กำลังล้างสล็อต…";
    try {
      const response = await fetch("/api/admin/vision7/licenses", {method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:button.dataset.resetSlots,action:"reset_devices",note:"Boss cleared test device slots"})}), data = await response.json();
      if (!response.ok) throw new Error(data.error || "ล้างสล็อตคีย์ไม่สำเร็จ");
      alert(`ล้างสล็อตคีย์แล้ว ${Number(data.revoked_devices || 0)} เครื่อง · คีย์และร้านยังอยู่`);await load();
    } catch (error) { alert(error.message);button.disabled = false;button.textContent = `ล้างสล็อตคีย์ (${count})`; }
  });
}
async function showHistory(id) {
  const r = await fetch(
      `/api/admin/vision7/licenses/${encodeURIComponent(id)}/history`,
    ),
    d = await r.json();
  if (!r.ok) return alert(d.error || "โหลดประวัติไม่สำเร็จ");
  historyContent.innerHTML = `<p><b>${esc(d.license.user_name)}</b> · ${esc(d.license.program_code)} · ${esc(d.license.key_masked)}</p><h3>เหตุการณ์</h3>${d.events.map((x) => `<p><b>${esc(x.event_type)}</b> · ${esc(x.created_at)}<br><small>${esc(x.actor_name || "ระบบ")} · ${esc(x.detail)}</small></p>`).join("") || "<p>ไม่มีประวัติ</p>"}<h3>อุปกรณ์</h3>${d.devices.map((x) => `<p>${esc(x.device_name || x.platform || "อุปกรณ์")} · ${esc(x.last_seen_at)}${x.revoked_at ? " · ปิดแล้ว" : ""}</p>`).join("") || "<p>ไม่มีอุปกรณ์</p>"}`;
  historyDialog.showModal();
}
function openProgramDialog() {
  programForm.reset();
  programState.textContent = "";
  programState.className = "muted";
  programPreview.textContent = "เว้นราคาทั้งหมดเพื่อบันทึกเป็นร่าง หรือใส่ราคาอย่างน้อย 1 แบบเพื่อเปิดขาย";
  programDialog.showModal();
  const platform = programForm.elements.platform_type.value;
  platformHelp.textContent = ({android:"แอป VBot สำหรับติดตั้งบน Android",windows:"โปรแกรมติดตั้งบน Windows",mac:"โปรแกรมติดตั้งบน macOS",web:"ใช้งานผ่านเว็บเบราว์เซอร์","cross-platform":"ไฟล์หรือบัญชีเดียวรองรับหลายระบบ",veasy:"V Easy · 1 คีย์ = 1 ร้าน · ลูกค้ากรอกคีย์ใน Settings"})[platform];
  programForm.elements.name.focus();
}
function openKeyDialog(programId) {
  if (!encryptionReady)
    return alert(
      "ยังออกคีย์ไม่ได้\nกรุณาตั้ง Cloudflare Secret: VISION7_LICENSE_ENCRYPTION_KEY อย่างน้อย 32 ตัวอักษร แล้ว Deploy ใหม่",
    );
  if (!programs.length)
    return alert("ยังไม่มีโปรแกรม กรุณากด ‘เพิ่มโปรแกรม’ ก่อนออกคีย์");
  if (programId) keyProgram.value = String(programId);
  planOptions();
  issuedKey.hidden = true;
  keyDialog.showModal();
}
newProgram.onclick = openProgramDialog;
document.querySelectorAll("[data-open-program]").forEach((x)=>x.onclick=openProgramDialog);
newKey.onclick = () => openKeyDialog();
releaseDetails.querySelector("summary").addEventListener("click", (event) => {
  if (releaseDetails.dataset.blocked === "true") {
    event.preventDefault();
    nextAction.textContent = "ต้องสร้างโปรแกรมก่อน จึงจะเผยแพร่ APK หรือตัวติดตั้งได้";
  }
});
keyProgram.onchange = planOptions;
keyPlan.onchange = updateKeyCost;
keyMode.onchange = syncKeyMode;
testDuration.onchange = updateKeyCost;
userSearch.oninput = () => userOptions(userSearch.value);
licenseSearch.oninput = renderLicenses;
document
  .querySelectorAll("[data-close]")
  .forEach(
    (b) =>
      (b.onclick = () => document.querySelector("#" + b.dataset.close).close()),
  );
programForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!programForm.reportValidity()) return;
  const installer = programForm.elements.installer.files[0];
  const cover = programForm.elements.cover.files[0];
  if (cover && cover.size > 5 * 1024 * 1024) {
    programState.className = "muted error";
    programState.textContent = "รูปปกต้องไม่เกิน 5 MB";
    programForm.elements.cover.focus();
    return;
  }
  if (installer && installer.size > 95 * 1024 * 1024) {
    programState.className = "muted error";
    programState.textContent = "ไฟล์ติดตั้งต้องไม่เกิน 95 MB";
    programForm.elements.installer.focus();
    return;
  }
  saveProgram.disabled = true;
  programState.className = "muted";
  programState.textContent = "กำลังสร้างแอป ตะกร้าขาย และไฟล์เวอร์ชันแรก…";
  const body = new FormData(programForm);
  const appCode = `vbot-${Date.now().toString(36)}`;
  const prices = {
    monthly: body.get("price_30d"),
    yearly: body.get("price_1y"),
    lifetime: body.get("price_lifetime"),
  };
  const hasOffer = Object.values(prices).some(Boolean);
  body.set("code", appCode);
  body.set("plans", JSON.stringify([
    { plan_code:"monthly", name:"คีย์ 30 วัน", price:prices.monthly || null },
    { plan_code:"yearly", name:"คีย์ 1 ปี", price:prices.yearly || null },
    { plan_code:"lifetime", name:"คีย์ตลอดชีพ", price:prices.lifetime || null },
  ]));
  body.delete("price_30d");
  body.delete("price_1y");
  body.delete("price_lifetime");
  try {
    const r = await fetch("/api/admin/vision7/programs", {
        method: "POST",
        body,
      }),
      d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `สร้างแอปไม่สำเร็จ (${r.status})`);
    programState.textContent = hasOffer ? "สร้างแอปและเตรียมแพ็กเกจขายแล้ว" : "บันทึกแอปเป็นร่างแล้ว";
    programForm.reset();
    programDialog.close();
    await load();
  } catch (error) {
    programState.className = "muted error";
    programState.textContent = error.message || "สร้างแอปไม่สำเร็จ";
  } finally {
    saveProgram.disabled = false;
  }
};
programForm.elements.platform_type.addEventListener("change", (e) => {
  platformHelp.textContent = ({android:"แอป VBot สำหรับติดตั้งบน Android",windows:"โปรแกรมติดตั้งบน Windows",mac:"โปรแกรมติดตั้งบน macOS",web:"ใช้งานผ่านเว็บเบราว์เซอร์","cross-platform":"ไฟล์หรือบัญชีเดียวรองรับหลายระบบ",veasy:"V Easy · 1 คีย์ = 1 ร้าน · ลูกค้ากรอกคีย์ใน Settings"})[e.target.value];
});
programForm.querySelectorAll('[name^="price_"]').forEach((input) => input.addEventListener("input", () => {
  const selected = [...programForm.querySelectorAll('[name^="price_"]')].filter((x) => x.value).map((x) => ({price_30d:"30 วัน",price_1y:"1 ปี",price_lifetime:"ตลอดชีพ"})[x.name]);
  programPreview.textContent = selected.length ? `พร้อมสร้างตะกร้าขาย: ${selected.join(" · ")}` : "เว้นราคาทั้งหมดเพื่อบันทึกเป็นร่าง หรือใส่ราคาอย่างน้อย 1 แบบเพื่อเปิดขาย";
}));
keyForm.onsubmit = async (e) => {
  e.preventDefault();
  if (keyMode.value === "customer" && !keyPlan.value) return alert("คีย์ลูกค้าต้องเลือกแพ็กเกจก่อน เพื่อแสดงค่าใช้จ่ายให้ถูกต้อง");
  const selectedUser = users.find(
      (x) => Number(x.id) === Number(keyUser.value),
    ),
    selectedProgram = programs.find(
      (x) => Number(x.id) === Number(keyProgram.value),
    );
  if (
    !confirm(
      `${keyMode.value === "test" ? `ยืนยันออกคีย์ทดสอบ ${testDuration.options[testDuration.selectedIndex].text} · ไม่มีค่าใช้จ่าย` : `ยืนยันออกคีย์ให้ ${selectedUser?.name || "ลูกค้า"}`}\nโปรแกรม ${selectedProgram?.product_title || selectedProgram?.code || "-"}${selectedProgram?.platform_type === "veasy" ? "\nV Easy: คีย์นี้จะผูกได้ 1 ร้าน" : ""}`,
    )
  )
    return;
  issueKeySubmit.disabled = true;
  issueKeySubmit.textContent = "กำลังออกคีย์…";
  try {
    const b = Object.fromEntries(new FormData(keyForm)),
      r = await fetch("/api/admin/vision7/licenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      }),
      d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `ออกคีย์ไม่สำเร็จ (${r.status})`);
    issuedKey.hidden = false;
    issuedKey.innerHTML = `คีย์ใหม่ (แสดงรอบนี้): <code>${esc(d.license.key)}</code> <button type="button" id="copyIssued">คัดลอก</button>`;
    copyIssued.onclick = async () => {
      try { await navigator.clipboard.writeText(d.license.key); copyIssued.textContent = "คัดลอกแล้ว"; }
      catch { alert("คัดลอกอัตโนมัติไม่ได้ กรุณากดค้างที่คีย์แล้วคัดลอก"); }
    };
    await load();
  } catch (error) {
    alert(error.message || "ออกคีย์ไม่สำเร็จ");
  } finally {
    issueKeySubmit.disabled = false;
    issueKeySubmit.textContent = "ออกคีย์";
  }
};
releaseForm.onsubmit = async (e) => {
  e.preventDefault();
  const state = releaseState,
    button = releaseForm.querySelector("button");
  button.disabled = true;
  state.textContent = "กำลังอัปโหลด กรุณาอย่าปิดหน้านี้";
  try {
    const r = await fetch("/api/admin/vision7/releases", {
        method: "POST",
        body: new FormData(releaseForm),
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error || "เผยแพร่ไม่สำเร็จ");
    state.textContent = `เผยแพร่แล้ว · SHA-256 ${d.sha256}`;
    releaseForm.reset();
    await load();
  } catch (error) {
    state.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
fillProductSelects(false);
load().catch((error) => {
  programState.className = "muted error";
  programState.textContent = error.message || "โหลดข้อมูล Vision 7 ไม่สำเร็จ แต่ยังสร้างโปรแกรมแบบไม่ผูกตะกร้าได้";
  fillProductSelects(false);
});
