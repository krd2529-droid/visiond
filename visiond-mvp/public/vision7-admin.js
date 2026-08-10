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
  issueKeySubmit = document.querySelector("#issueKeySubmit");
let programs = [],
  users = [],
  encryptionReady = false;
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
          `<option value="${x.id}">${esc(x.name)}${x.duration_days ? ` · ${x.duration_days} วัน` : " · ตลอดชีพ"}</option>`,
      )
      .join("");
  const veasy = program?.platform_type === "veasy";
  keyBindingPreview.hidden = !veasy;
  keyBindingPreview.textContent = veasy
    ? "คีย์ V Easy นี้ออกแยกจาก APK · เริ่มสถานะ ‘รอผูกร้าน’ ลูกค้านำไปกรอกใน Settings และผูกได้ 1 ร้าน"
    : "";
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
  licensesEl.innerHTML =
    window.__licenses
      .filter(
        (x) =>
          !q ||
          `${x.user_name} ${x.email} ${x.program_title} ${x.program_code} ${x.key_last4}`
            .toLowerCase()
            .includes(q),
      )
      .map(
        (x) =>
          `<section class="license-row"><p><b>${esc(x.user_name)}</b> · ${x.platform_type === "veasy" ? "V Easy · " : ""}${esc(x.program_title || x.program_code)}<br><code>${esc(x.key_masked)}</code> · <span class="status">${esc(x.status)}</span> · ${Number(x.active_devices)}/${Number(x.max_devices) || 3} เครื่อง<br><small>${esc(x.plan_name || "ไม่กำหนดแพ็กเกจ")} · หมดอายุ ${esc(x.expires_at || "ไม่หมดอายุ")}</small>${x.platform_type === "veasy" && x.binding_state === "unbound" ? '<br><span class="binding-unbound">รอผูกร้าน · 1 คีย์ต่อ 1 ร้าน</span>' : ""}</p><div class="bar"><button data-renew="${x.id}" data-program="${x.program_id}">ต่ออายุ</button>${x.status === "suspended" ? `<button data-status="active" data-id="${x.id}">เปิดคืน</button>` : `<button class="danger" data-status="suspended" data-id="${x.id}">ระงับ</button>`}<button data-history="${x.id}">ประวัติ</button></div></section>`,
      )
      .join("") || '<p class="muted">ไม่พบคีย์</p>';
  bindLicenseActions();
}
let productOptions = [];
function productLabel(x) {
  const price = `${(Number(x.price) || 0).toLocaleString("th-TH")} บาท`;
  const status = x.status === "published" ? "เปิดขาย" : "แบบร่าง—ลูกค้ายังซื้อไม่ได้";
  return `#${x.id} · ${x.title} · ${x.slug} · ${price} · ${status}${x.binding_program ? ` · ใช้แล้วกับ ${x.binding_program}` : ""}`;
}
function fillProductSelects() {
  document.querySelectorAll("[data-product-select]").forEach((select) => {
    const chosen = select.value;
    select.replaceChildren(new Option("— ไม่ผูกตะกร้าสินค้า —", ""));
    productOptions.forEach((x) => {
      const option = new Option(productLabel(x), String(x.id));
      option.disabled = Boolean(x.binding_program);
      select.add(option);
    });
    select.value = chosen;
  });
  saveProgram.disabled = false;
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
  const [p, l, r, u] = await Promise.all([
      fetch("/api/admin/vision7/programs"),
      fetch("/api/admin/vision7/licenses"),
      fetch("/api/admin/vision7/releases"),
      fetch("/api/admin/users"),
    ]),
    pd = await p.json(),
    ld = await l.json(),
    rd = await r.json(),
    ud = await u.json();
  if (p.status === 401 || p.status === 403) {
    location.href = "/login.html?next=/vision7-admin.html";
    return;
  }
  programs = pd.items || [];
  productOptions = pd.product_options || [];
  fillProductSelects();
  users = ud.items || [];
  window.__licenses = ld.items || [];
  encryptionReady = ld.encryption_ready === true;
  encryptionState.className = `key-center-state ${encryptionReady ? "ready" : "blocked"}`;
  encryptionState.textContent = encryptionReady
    ? "พร้อมออกคีย์ · ระบบเข้ารหัส VISION7_LICENSE_ENCRYPTION_KEY ทำงานแล้ว"
    : "ยังออกคีย์ไม่ได้ · กรุณาตั้ง Cloudflare Secret: VISION7_LICENSE_ENCRYPTION_KEY อย่างน้อย 32 ตัวอักษร";
  newKey.setAttribute("aria-disabled", String(!encryptionReady));
  const summary = ld.summary || {};
  keySummary.innerHTML = [
    ["คีย์ทั้งหมด", summary.total],
    ["กำลังใช้งาน", summary.active],
    ["หมดอายุ", summary.expired],
    ["V Easy รอผูกร้าน", summary.unbound_veasy],
    ["เครื่อง Active", summary.active_devices],
  ]
    .map(
      ([label, value]) =>
        `<article class="summary-card"><small>${esc(label)}</small><b>${Number(value) || 0}</b></article>`,
    )
    .join("");
  programsEl.innerHTML =
    programs
      .map(
        (x) =>
          `<p><b>${x.platform_type === "veasy" ? "V Easy · " : ""}${esc(x.product_title || x.code)}</b><br>${esc(x.code)} · v${esc(x.current_version)} · ${Number(x.max_devices) || 3} เครื่อง</p>`,
      )
      .join("") || "ยังไม่มีโปรแกรม";
  programOptions(releaseProgram);
  programOptions(keyProgram);
  userOptions();
  planOptions();
  renderLicenses();
  releases.innerHTML =
    (rd.items || [])
      .slice(0, 10)
      .map(
        (x) =>
          `<p><b>${esc(x.program_code)} v${esc(x.version)}</b>${x.mandatory ? " · บังคับอัปเดต" : ""}<br><small>${esc(x.file_name)} · SHA-256 ${esc(x.sha256)}</small></p>`,
      )
      .join("") || '<p class="muted">ยังไม่มีรีลีส</p>';
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
newProgram.onclick = () => {
  programState.textContent = "";
  programState.className = "muted";
  programDialog.showModal();
  programForm.elements.code.focus();
};
newKey.onclick = () => {
  if (!encryptionReady)
    return alert(
      "ยังออกคีย์ไม่ได้\nกรุณาตั้ง Cloudflare Secret: VISION7_LICENSE_ENCRYPTION_KEY อย่างน้อย 32 ตัวอักษร แล้ว Deploy ใหม่",
    );
  if (!programs.length)
    return alert("ยังไม่มีโปรแกรม กรุณากด ‘เพิ่มโปรแกรม’ ก่อนออกคีย์");
  issuedKey.hidden = true;
  keyDialog.showModal();
};
keyProgram.onchange = planOptions;
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
  if (!programForm.reportValidity() || !validateProductChoices()) return;
  saveProgram.disabled = true;
  programState.className = "muted";
  programState.textContent = "กำลังสร้างโปรแกรม…";
  const f = new FormData(programForm),
    b = Object.fromEntries(f);
  b.plans = [
    {
      plan_code: "lifetime",
      name: "ตลอดชีพ",
      price: 0,
      product_id: b.lifetime_product_id,
    },
    {
      plan_code: "monthly",
      name: "รายเดือน",
      price: 0,
      product_id: b.monthly_product_id,
    },
    {
      plan_code: "yearly",
      name: "รายปี",
      price: 0,
      product_id: b.yearly_product_id,
    },
  ];
  try {
    const r = await fetch("/api/admin/vision7/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      }),
      d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `สร้างโปรแกรมไม่สำเร็จ (${r.status})`);
    programState.textContent = "สร้างโปรแกรมแล้ว";
    programForm.reset();
    programDialog.close();
    await load();
  } catch (error) {
    programState.className = "muted error";
    programState.textContent = error.message || "สร้างโปรแกรมไม่สำเร็จ";
  } finally {
    saveProgram.disabled = false;
  }
};
programForm.querySelectorAll("[data-product-select]").forEach((x) => x.addEventListener("change", validateProductChoices));
programForm.elements.platform_type.addEventListener("change", (e) => {
  platformHelp.textContent = ({windows:"โปรแกรมติดตั้งบน Windows",mac:"โปรแกรมติดตั้งบน macOS",web:"ใช้งานผ่านเว็บเบราว์เซอร์","cross-platform":"ไฟล์หรือบัญชีเดียวรองรับหลายระบบ",veasy:"APK กลาง ไม่ฝังคีย์ · ลูกค้ากรอกคีย์ใน Settings · 1 คีย์ต่อ 1 ร้าน"})[e.target.value];
});
keyForm.onsubmit = async (e) => {
  e.preventDefault();
  const selectedUser = users.find(
      (x) => Number(x.id) === Number(keyUser.value),
    ),
    selectedProgram = programs.find(
      (x) => Number(x.id) === Number(keyProgram.value),
    );
  if (
    !confirm(
      `ยืนยันออกคีย์ให้ ${selectedUser?.name || "ลูกค้า"}\nโปรแกรม ${selectedProgram?.product_title || selectedProgram?.code || "-"}${selectedProgram?.platform_type === "veasy" ? "\nV Easy: คีย์นี้จะผูกได้ 1 ร้าน" : ""}`,
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
load();
