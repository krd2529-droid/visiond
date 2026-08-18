const esc = (v) =>
    String(v ?? "").replace(
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
  date = (v) =>
    v
      ? new Date(
          String(v).replace(" ", "T") + (String(v).includes("Z") ? "" : "Z"),
        ).toLocaleString("th-TH")
      : "-",
  money = (n) =>
    new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
let state;
const coursePlanPages = {
    rights: {
      number: "1",
      title: "ซื้อสิทธิ์ 499 บาท",
      detail: "ใช้ 1 เครดิตต่อคอร์ส รับเงินเข้าบัญชีผู้สอนและรับยอดขาย 100%",
      submit: "ใช้ 1 เครดิตและสร้างคอร์สแบบ 1",
      steps: ["ซื้อสิทธิ์และมีเครดิต", "สร้างคอร์สและเพิ่ม EP พร้อมเอกสาร", "ส่งคอร์สให้ Boss ตรวจ"],
    },
    free: {
      number: "2",
      title: "เริ่มขายฟรี",
      detail: "สร้างได้สูงสุด 3 คอร์ส คอร์สละไม่เกิน 5 EP ผู้สอนตรวจและอนุมัติสลิปเอง",
      submit: "สร้างคอร์สแบบ 2 ฟรี",
      steps: ["ตรวจสิทธิ์โควตาขายฟรี", "สร้างคอร์สและเพิ่มไม่เกิน 5 EP", "ส่งคอร์สให้ Boss ตรวจ"],
    },
    partner: {
      number: "3",
      title: "พาร์ตเนอร์ 50/50",
      detail: "ไม่จำกัดคอร์สและ EP ระบบตรวจสลิปอัตโนมัติและแบ่งยอด VisionD 50% / ผู้สอน 50%",
      submit: "สร้างคอร์สแบบ 3 พาร์ตเนอร์",
      steps: ["ตรวจเงื่อนไขพาร์ตเนอร์ 50/50", "VisionD รับเงินและตรวจสลิปอัตโนมัติ", "สร้างคอร์ส · เพิ่ม EP พร้อมคำอธิบายและเอกสาร · ส่งตรวจ"],
    },
  },
  courseCreateMode = new URLSearchParams(location.search).get("create");
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="/vision5-flow.css?v=014265">',
);
const sellerShell = document.querySelector(".seller-shell");
[
  document.querySelector(".seller-hero"),
  document.querySelector("#vision5SellerFlow"),
  document.querySelector("#vision5CreditSummary"),
  document.querySelector("#createPanel"),
  document.querySelector("#paymentProfilePanel"),
  document.querySelector("#slipApiPanel"),
  document.querySelector("#myCoursesPanel"),
  document.querySelector("#sellerLessonManager"),
  document.querySelector("#publishPanel"),
  document.querySelector("#customerSalesPanel"),
  document.querySelector("#pendingSlipPanel"),
].forEach((section) => section && sellerShell?.append(section));
function updateVision5Flow(data) {
  const courses = data.courses || [],
    creditReady = Number(data.credit_balance) > 0 || courses.length > 0,
    setupReady = ["pending", "approved"].includes(data.payment_profile?.status),
    done = { credit: creditReady, setup: setupReady };
  for (const key of ["credit", "setup"]) {
    const el = document.querySelector('[data-v5-step="' + key + '"]');
    el?.classList.toggle("complete", done[key]);
    el?.classList.remove("current");
  }
  const courseStep = document.querySelector('[data-v5-step="course"]');
  courseStep?.classList.remove("complete", "current");
  const current = !creditReady ? "credit" : !setupReady ? "setup" : "course";
  document
    .querySelector('[data-v5-step="' + current + '"]')
    ?.classList.add("current");
  const next = document.querySelector("#vision5NextAction");
  if (next)
    next.textContent =
      current === "credit"
        ? "ขั้นต่อไป: ซื้อสิทธิ์เพื่อรับเครดิตก่อนสร้าง"
        : current === "setup"
          ? "ขั้นต่อไป: ตั้งค่าบัญชีรับเงินและเลือกโหมดตรวจสลิป"
          : "พร้อมแล้ว: สร้างตะกร้าคอร์ส เพิ่ม EP แล้วกดเผยแพร่";
}
function paintSlipSwitch(on) {
  slipApiForm.elements.enabled.checked = Boolean(on);
  slipTokenField.hidden = !on;
  slipManualHelp.hidden = Boolean(on);
  slipSwitchTitle.textContent = on ? "ตรวจสลิปอัตโนมัติ" : "ตรวจและอนุมัติเอง";
  slipSwitchDescription.textContent = on
    ? "เปิดใช้ EasySlip API ของเจ้าของคอร์ส"
    : "ปิดการตรวจสลิปอัตโนมัติ";
}
function render(data) {
  state = data;
  updateVision5Flow(data);
  const profile = data.payment_profile || { status: "unset" },
    used = (data.licenses || []).filter((x) => !x.available).length;
  licenseList.innerHTML = `<div class="vision5-credit-grid"><article><small>1 · ซื้อสิทธิ์</small><b>${Number(data.credit_balance)||0} เครดิต</b><div class="course-plan-card-actions"><button type="button" data-course-plan="rights">สร้างคอร์สแบบ 1</button><a href="/product.html?slug=course-selling-rights">ซื้อเครดิต</a></div></article><article><small>2 · เริ่มขายฟรี</small><b>${Number(data.free_course_count)||0}/3 คอร์ส</b><button type="button" data-course-plan="free">สร้างคอร์สแบบ 2</button></article><article><small>3 · พาร์ตเนอร์ 50/50</small><b>ไม่จำกัดคอร์ส</b><button type="button" data-course-plan="partner">สร้างคอร์สแบบ 3</button></article></div><p>เลือกแบบที่ต้องการก่อนสร้าง · เฉพาะแบบ 1 ที่ใช้ 1 เครดิต</p>`;
  licenseList.querySelectorAll("[data-course-plan]").forEach((button) => {
    button.onclick = () => openCoursePlan(button.dataset.coursePlan);
  });
  if (profile.status === "unset") {
    paymentProfileStatus.innerHTML =
      "<p>ยังไม่ได้ตั้งค่าบัญชีรับเงิน ตั้งภายหลังเมื่อต้องการเปิดตะกร้าได้</p>";
    paymentProfileForm.hidden = false;
  } else {
    paymentProfileForm.hidden = false;
    paymentProfileForm.elements.bank_name.value = profile.bank_name || "";
    paymentProfileForm.elements.account_name.value = profile.account_name || "";
    paymentProfileForm.elements.account_number.value = profile.account_number || "";
    paymentProfileStatus.innerHTML = `<div class="payment-profile-summary"><b>${esc(profile.bank_name || "-")} · ${esc(profile.account_name || "-")}</b><strong>✓ บันทึกแล้ว ไม่ต้องกรอกเพิ่ม</strong><span>ข้อมูลเดิมแสดงอยู่ด้านล่าง แก้ไขแล้วบันทึกใหม่ได้เมื่อต้องการ</span><small>${profile.has_payment_qr ? "มี QR รับเงินเดิมแล้ว · ไม่เลือกไฟล์ใหม่ ระบบจะใช้ QR เดิม" : "ยังไม่มี QR รับเงิน · ช่อง QR ไม่บังคับ"}</small></div>`;
    paymentProfileForm.querySelector('button[type="submit"]').textContent = "บันทึกการแก้ไขบัญชีรับเงิน";
  }
  const auto = profile.slip_auto_verify === 1;
  paintSlipSwitch(auto);
  slipApiStatus.innerHTML = profile.test_account
    ? "<b>ยูสเทส · สลิปต้องรอ Boss อนุมัติ</b>"
    : auto
      ? profile.slip_api_configured
        ? "<b>เปิดตรวจอัตโนมัติ · EasySlip พร้อมใช้</b>"
        : "<b>เปิดตรวจอัตโนมัติ · กรุณาบันทึก Token</b>"
      : "<p>ปิดตรวจอัตโนมัติ · เจ้าของคอร์สต้องตรวจและอนุมัติเอง</p>";
  mySellerCourses.innerHTML = data.courses.length
    ? data.courses
        .map((c) => {
          const total = Math.max(
              1,
              Number(c.planned_lesson_count) ||
                Number(c.expected_episodes) ||
                1,
            ),
            ready = Number(c.lesson_count) || 0,
            plan = coursePlanPages[c.course_plan] || coursePlanPages.rights;
          return `<article class="owned-course seller-course-card"><img src="${esc(c.cover_url || "/assets/product-placeholder.svg")}" alt="ปก ${esc(c.title)}"><div class="seller-course-card-body"><span class="seller-course-plan" data-plan="${esc(c.course_plan || "rights")}">แบบ ${plan.number} · ${esc(plan.title)}</span><h3>${esc(c.title)}</h3><p class="seller-course-meta"><span>ผู้สอน ${esc(c.teacher_name || "-")}</span><b>${money(c.price)}</b></p><div class="seller-course-badges"><span class="seller-course-ep">สร้างแล้ว ${total} EP · พร้อมเผยแพร่ ${ready}/${total}</span><span class="seller-course-status" data-status="${esc(c.review_status || "draft")}">${c.review_status === "approved" ? "เปิดขายแล้ว" : c.review_status === "pending" ? "รอตรวจหลังเผยแพร่" : c.review_status === "changes_requested" ? "ต้องแก้ไขตามที่ Boss แจ้ง" : "กำลังจัดทำ"}</span></div><small>แก้ไขล่าสุด ${date(c.updated_at)}</small></div></article>`;
        })
        .join("")
    : '<div class="seller-course-empty"><b>ยังไม่มีตะกร้าคอร์ส</b><p>เลือกสร้างคอร์สแบบ 1, 2 หรือ 3 ด้านบน</p></div>';
  mySellerCourses.querySelectorAll(".owned-course").forEach((card, index) => {
    const course = data.courses[index],
      total = Math.max(
        1,
        Number(course.planned_lesson_count) ||
          Number(course.expected_episodes) ||
          1,
      ),
      complete = Number(course.lesson_count) === total,
      actions = document.createElement("div");
    actions.className = "seller-basket-actions";
    const edit = document.createElement("a");
    edit.href = `/course-basket-edit.html?id=${course.id}`;
    edit.textContent = "แก้ไขตะกร้า";
    edit.className = "seller-basket-primary";
    actions.append(edit);
    const upload = document.createElement("button");
    upload.type = "button";
    upload.textContent = "จัดการบทเรียนและ EP";
    upload.onclick = () => openLessons(course);
    actions.append(upload);
    if (["draft", "changes_requested"].includes(course.review_status)) {
      const publish = document.createElement("button");
      publish.type = "button";
      publish.textContent = complete
        ? "ส่งตรวจ"
        : `เติมสื่ออีก ${Math.max(0, total - Number(course.lesson_count))} EP`;
      publish.disabled = !complete;
      publish.title = complete
        ? "ส่งให้ Boss ตรวจอนุมัติก่อนเปิดขาย"
        : "เพิ่มสื่อให้ครบทุก EP ก่อนเผยแพร่";
      publish.onclick = () => openPublish(course);
      actions.append(publish);
    }
    card.append(actions);
  });
  salesTotal.textContent = money(data.totals?.amount);
  salesCount.textContent =
    (Number(data.totals?.orders) || 0) +
    (data.sales_list_limited ? " (ตาราง 200 ล่าสุด)" : "");
  salesRows.innerHTML = data.sales?.length
    ? data.sales
        .map(
          (x) =>
            `<tr><td>${esc(x.order_no)}</td><td>${esc(x.buyer_name || "-")}</td><td>${esc(x.course_title)}</td><td>${x.has_slip ? `<a class="seller-slip-link" href="/api/course-seller/orders/${x.id}/slip" target="_blank" rel="noopener">เปิดดูสลิป</a>` : '<span class="seller-no-slip">ไม่มีสลิป</span>'}</td><td>${money(x.total)}</td><td>${date(x.paid_at)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6">ยังไม่มียอดขาย</td></tr>';
  slipIssueRows.innerHTML = data.slip_issues?.length
    ? data.slip_issues
        .map(
          (x) =>
            `<tr><td>${esc(x.order_no)}</td><td>${esc(x.buyer_name || "-")}</td><td>${esc(x.course_title)}</td><td>${money(x.total)}</td><td><small>${esc(x.slip_verification_code || "API ตรวจไม่ได้")}</small><div class="seller-slip-actions"><a href="/api/course-seller/orders/${x.id}/slip" target="_blank" rel="noopener">ดูสลิป</a><button type="button" data-slip-approve="${x.id}">อนุมัติ</button><button type="button" data-slip-reject="${x.id}">ปฏิเสธ</button></div></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5">ไม่มีรายการผิดปกติ</td></tr>';
  slipIssueRows
    .querySelectorAll("[data-slip-approve]")
    .forEach(
      (b) => (b.onclick = () => reviewSlip(b.dataset.slipApprove, "approve")),
    );
  slipIssueRows
    .querySelectorAll("[data-slip-reject]")
    .forEach(
      (b) => (b.onclick = () => reviewSlip(b.dataset.slipReject, "reject")),
    );
  createCourseBasket.hidden = true;
  paymentProfilePanel.hidden = true;
  slipApiPanel.hidden = true;
}
function openCoursePlan(plan) {
  if (!coursePlanPages[plan]) return;
  location.href = `/course-seller.html?create=${encodeURIComponent(plan)}`;
}
function enterCourseCreatePage(plan) {
  const config = coursePlanPages[plan];
  if (!config) return;
  document.body.classList.add("course-create-page");
  [...sellerShell.children].forEach((section) => {
    section.hidden = section !== createPanel;
  });
  createPanel.hidden = false;
  createPanel.insertAdjacentHTML(
    "afterbegin",
    `<a class="course-create-back" href="/course-seller.html">← กลับศูนย์จัดการคอร์ส</a><header class="course-plan-page-head"><small>รูปแบบ ${config.number}</small><h1>${config.title}</h1><p>${config.detail}</p></header><div class="course-plan-head-actions"><button class="course-step-action" type="button" data-start-course>+ สร้างตะกร้าคอร์ส</button>${plan === "rights" ? '<a class="course-step-action" href="/product.html?slug=course-selling-rights">ซื้อสิทธิ์</a>' : ""}</div><section id="coursePlanFlow" class="vision5-seller-flow course-plan-flow"><h2>แบบ ${config.number} · ขั้นตอนการเปิดคอร์ส</h2><div class="vision5-steps vision5-steps--compact">${config.steps.map((step, index) => `<div class="vision5-step${index === 0 ? " current" : ""}"><span>${index + 1}</span><b>${step}</b></div>`).join("")}</div><p class="vision5-next-action">เริ่มจากขั้นตอนที่ 1 ของรูปแบบ ${config.number} แล้วดำเนินการตามลำดับ</p></section>`,
  );
  const formHeading = createPanel.querySelector(":scope > h2");
  const condition = document.createElement("aside");
  condition.className = "course-plan-condition";
  condition.innerHTML = plan === "rights"
    ? "<b>เงื่อนไขแบบ 1</b><p>ลูกค้าชำระเข้าบัญชีผู้สอนโดยตรง ผู้สอนเลือกตรวจเองหรือใช้ EasySlip API ของผู้สอนได้</p>"
    : plan === "free"
      ? "<b>เงื่อนไขแบบ 2</b><p>ลูกค้าชำระเข้าบัญชีผู้สอนโดยตรง และผู้สอนต้องตรวจพร้อมอนุมัติสลิปเอง</p>"
      : "<b>เงื่อนไขแบบ 3</b><p>ลูกค้าชำระเข้าบัญชีบริษัท VisionD ระบบ VisionD ตรวจสลิปอัตโนมัติและแบ่งรายได้ 50/50</p>";
  createPanel.insertBefore(condition, formHeading);
  createPanel.classList.toggle("course-plan-legacy-form", plan === "rights");
  formHeading.textContent = `กรอกข้อมูลคอร์สแบบ ${config.number}`;
  createPanel.querySelector(":scope > p").textContent =
    plan === "rights"
      ? "ฟอร์มสร้างคอร์สเดิมถูกย้ายมาไว้ในแบบ 1 โดยเฉพาะ ระบบจะใช้ 1 เครดิตและสร้าง EP เริ่มต้นให้ 1 EP"
      : plan === "free"
        ? "หน้าสร้างแบบ 2 สำหรับเริ่มขายฟรีโดยเฉพาะ ไม่หักเครดิต จำกัด 3 คอร์สและคอร์สละไม่เกิน 5 EP"
        : "หน้าสร้างแบบ 3 สำหรับพาร์ตเนอร์ 50/50 โดยเฉพาะ ไม่หักเครดิตและไม่จำกัดคอร์สหรือ EP";
  const select = sellerCourseForm.elements.course_plan;
  select.replaceChildren(new Option(`แบบ ${config.number} · ${config.title}`, plan, true, true));
  select.closest("label").hidden = true;
  sellerCourseForm.querySelector('button[type="submit"]').textContent = config.submit;
  createPanel.querySelector("[data-start-course]")?.addEventListener("click", () => {
    formHeading.scrollIntoView({ behavior: "smooth", block: "start" });
    sellerCourseForm.elements.title.focus({ preventScroll: true });
  });
  document.title = `สร้างคอร์สแบบ ${config.number} | VisionD`;
}
async function load() {
  const r = await fetch("/api/course-seller", { cache: "no-store" });
  if (r.status === 401) {
    sessionStorage.setItem("vd_return_to", "/course-center?vision5=1");
    location.href = "/login.html";
    return;
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    licenseList.textContent = d.error || "โหลดไม่สำเร็จ";
    return;
  }
  render(d);
  const params = new URLSearchParams(location.search),
    id = Number(params.get("course_id")),
    flow = document.querySelector("#vision5SellerFlow");
  if (coursePlanPages[courseCreateMode]) {
    enterCourseCreatePage(courseCreateMode);
    return;
  }
  if (params.get("vision5") === "1" && flow && !flow.dataset.opened) {
    flow.dataset.opened = "1";
    flow.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!d.courses.length) {
      createPanel.hidden = false;
    }
  }
  if (id && !sellerLessonManager.dataset.autoOpened) {
    const course = d.courses.find((x) => Number(x.id) === id);
    if (course) {
      sellerLessonManager.dataset.autoOpened = "1";
      if (params.get("create") === "1") openPublish(course);
      else openLessons(course);
    }
  }
}
function openPublish(course) {
  const total = Math.max(
    1,
    Number(course.planned_lesson_count) ||
      Number(course.expected_episodes) ||
      1,
  );
  if (Number(course.lesson_count) !== total) {
    alert(
      "กรุณาอัปโหลดให้ครบ " +
        (Number(course.lesson_count) || 0) +
        "/" +
        total +
        " EP ก่อนเผยแพร่",
    );
    openLessons(course);
    return;
  }
  publishPanel.hidden = false;
  publishForm.reset();
  publishForm.elements.course_id.value = course.id;
  publishCourseTitle.value = course.title;
  publishForm.elements.price_baht.value = Number(course.price || 0) / 100 || "";
  publishForm.elements.contact_info.value = course.contact_info || "";
  publishMessage.textContent = "";
  publishPanel.scrollIntoView({ behavior: "smooth" });
}
async function reviewSlip(id, action) {
  const note = prompt(
    action === "approve"
      ? "หมายเหตุการอนุมัติ (ไม่บังคับ)"
      : "เหตุผลที่ปฏิเสธสลิป",
    "",
  );
  if (note === null) return;
  if (
    !confirm(
      action === "approve"
        ? "ยืนยันรับเงินและปลดล็อกคอร์สให้ผู้ซื้อใช่ไหม"
        : "ยืนยันปฏิเสธและให้ผู้ซื้อส่งสลิปใหม่ใช่ไหม",
    )
  )
    return;
  const r = await fetch(`/api/course-seller/orders/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    }),
    d = await r.json().catch(() => ({}));
  alert(d.error || d.message || "บันทึกแล้ว");
  if (r.ok) load();
}
function resetLessonEditor(courseId, hide = true) {
  sellerLessonForm.reset();
  sellerLessonForm.elements.course_id.value = courseId || "";
  sellerLessonForm.elements.lesson_id.value = "";
  sellerLessonForm.querySelector('button[type="submit"]').textContent =
    "บันทึก EP";
  sellerLessonFormTitle.textContent = "สร้าง EP ใหม่";
  sellerLessonMessage.textContent = "";
  sellerLessonForm.hidden = hide;
}
cancelLessonEdit.onclick = () =>
  resetLessonEditor(sellerLessonForm.elements.course_id.value, true);
addSellerLesson.onclick = () => {
  resetLessonEditor(sellerLessonForm.elements.course_id.value, false);
  sellerLessonForm.scrollIntoView({ behavior: "smooth", block: "start" });
  sellerLessonForm.elements.title.focus();
};
async function openLessons(course) {
  sellerLessonManager.hidden = false;
  sellerLessonCourseTitle.textContent = course.title;
  resetLessonEditor(course.id, true);
  sellerLessonManager.scrollIntoView({ behavior: "smooth" });
  await loadLessons(course.id);
}
async function loadLessons(id) {
  const r = await fetch(`/api/course-seller/${id}/lessons`, {
      cache: "no-store",
    }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) {
    sellerLessonList.textContent = d.error || "โหลดบทเรียนไม่สำเร็จ";
    return;
  }
  sellerLessonList.innerHTML = d.items.length
    ? d.items
        .map(
          (x, i) =>
            `<article class="seller-ep"><div class="seller-ep-number">${i + 1}</div><div><b>EP.${i + 1} · ${esc(x.title)}</b><small>${x.has_video ? "มีวิดีโอ" : ""}${x.has_video && x.file_count ? " · " : ""}${x.file_count ? `ไฟล์ประกอบ ${x.file_count} ไฟล์` : ""}${!x.has_video && !x.file_count ? "ยังไม่มีสื่อ" : ""}</small>${x.description ? `<p>${esc(x.description)}</p>` : ""}<div class="seller-file-list">${(x.files || []).map((f) => `<span>${esc(f.file_name)} <button type="button" data-file="${f.id}" data-lesson="${x.id}" ${d.editable ? "" : "disabled"}>ลบไฟล์</button></span>`).join("")}</div></div><div class="seller-ep-actions"><button type="button" data-edit="${x.id}" ${d.editable ? "" : "disabled"}>แก้ไข</button><button type="button" data-delete="${x.id}" ${d.editable ? "" : "disabled"}>ลบ EP</button></div></article>`,
        )
        .join("")
    : '<div class="seller-course-empty"><b>ยังไม่มี EP</b><p>กด “+ สร้าง EP เพิ่ม” เพื่อเริ่มบทเรียนแรก</p></div>';
  sellerLessonList.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        const lesson = d.items.find((x) => String(x.id) === b.dataset.edit);
        if (!lesson) return;
        sellerLessonForm.hidden = false;
        sellerLessonFormTitle.textContent = `แก้ไข EP.${d.items.indexOf(lesson) + 1}`;
        sellerLessonForm.elements.lesson_id.value = lesson.id;
        sellerLessonForm.elements.title.value = lesson.title || "";
        sellerLessonForm.elements.description.value = lesson.description || "";
        sellerLessonForm.elements.duration_seconds.value =
          Number(lesson.duration_seconds) || 0;
        sellerLessonForm.querySelector('button[type="submit"]').textContent =
          "บันทึกการแก้ไข EP";
        sellerLessonForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
  );
  sellerLessonList.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("ลบ EP และไฟล์ทั้งหมดใช่ไหม")) return;
        const x = await fetch(
            `/api/course-seller/${id}/lessons/${b.dataset.delete}`,
            { method: "DELETE" },
          ),
          y = await x.json().catch(() => ({}));
        alert(y.error || y.message || "ลบแล้ว");
        if (x.ok) {
          resetLessonEditor(id, true);
          await loadLessons(id);
          await load();
        }
      }),
  );
  sellerLessonList.querySelectorAll("[data-file]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("ลบไฟล์ประกอบนี้ใช่ไหม")) return;
        const x = await fetch(
            `/api/course-seller/${id}/lessons/${b.dataset.lesson}/files/${b.dataset.file}`,
            { method: "DELETE" },
          ),
          y = await x.json().catch(() => ({}));
        alert(y.error || y.message || "ลบแล้ว");
        if (x.ok) await loadLessons(id);
      }),
  );
}
paymentProfileForm.onsubmit = async (e) => {
  e.preventDefault();
  const b = e.submitter;
  b.disabled = true;
  const r = await fetch("/api/course-seller/payment-profile", {
      method: "POST",
      body: new FormData(paymentProfileForm),
    }),
    d = await r.json().catch(() => ({}));
  paymentProfileMessage.textContent = d.error || d.message || "";
  b.disabled = false;
  if (r.ok) load();
};
slipApiForm.elements.enabled.onchange = () =>
  paintSlipSwitch(slipApiForm.elements.enabled.checked);
slipApiForm.onsubmit = async (e) => {
  e.preventDefault();
  const b = e.submitter,
    form = new FormData(slipApiForm);
  b.disabled = true;
  const r = await fetch("/api/course-seller/slip-api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: form.get("enabled") === "on",
        api_key: form.get("api_key"),
      }),
    }),
    d = await r.json().catch(() => ({}));
  slipApiMessage.textContent = d.error || d.message || "";
  b.disabled = false;
  if (r.ok) {
    slipApiForm.elements.api_key.value = "";
    load();
  }
};
let sellerCoverObjectUrl = "";
function clearSellerCover() {
  if (sellerCoverObjectUrl) URL.revokeObjectURL(sellerCoverObjectUrl);
  sellerCoverObjectUrl = "";
  sellerCoverInput.value = "";
  sellerCoverPreview.hidden = true;
  sellerCoverPreview.querySelector("img").removeAttribute("src");
}
sellerCoverInput.onchange = () => {
  const file = sellerCoverInput.files?.[0];
  if (!file) return clearSellerCover();
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    clearSellerCover();
    sellerMessage.textContent = "รูปปกต้องเป็น JPG, PNG หรือ WEBP";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    clearSellerCover();
    sellerMessage.textContent = "รูปปกต้องไม่เกิน 8 MB";
    return;
  }
  if (sellerCoverObjectUrl) URL.revokeObjectURL(sellerCoverObjectUrl);
  sellerCoverObjectUrl = URL.createObjectURL(file);
  sellerCoverPreview.querySelector("img").src = sellerCoverObjectUrl;
  sellerCoverPreview.hidden = false;
  sellerMessage.textContent = "";
};
changeSellerCover.onclick = () => sellerCoverInput.click();
removeSellerCover.onclick = clearSellerCover;
sellerCourseForm.onsubmit = async (e) => {
  e.preventDefault();
  const selectedPlan = sellerCourseForm.elements.course_plan.value,
    confirmation = selectedPlan === "rights"
      ? "ยืนยันสร้างแบบ 1 ซื้อสิทธิ์ และใช้ 1 เครดิตหรือไม่"
      : selectedPlan === "free"
        ? "ยืนยันสร้างแบบ 2 เริ่มขายฟรีหรือไม่"
        : "ยืนยันสร้างแบบ 3 พาร์ตเนอร์ 50/50 หรือไม่";
  if (!confirm(confirmation)) return;
  const b = e.submitter;
  b.disabled = true;
  const r = await fetch("/api/course-seller", {
      method: "POST",
      body: new FormData(sellerCourseForm),
    }),
    d = await r.json().catch(() => ({}));
  sellerMessage.textContent = d.error || d.message || "";
  b.disabled = false;
  if (r.ok) {
    sellerCourseForm.reset();
    clearSellerCover();
    createPanel.hidden = true;
    if (coursePlanPages[courseCreateMode]) {
      location.href = `/course-seller.html?course_id=${encodeURIComponent(d.id)}`;
      return;
    }
    await load();
    const course = state.courses.find((x) => Number(x.id) === Number(d.id));
    if (course) openLessons(course);
  }
};
sellerLessonForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = sellerLessonForm.elements.course_id.value,
    lessonId = sellerLessonForm.elements.lesson_id.value,
    b = e.submitter;
  b.disabled = true;
  sellerLessonMessage.textContent =
    "กำลังบันทึกและอัปโหลด กรุณาอย่าปิดหน้านี้…";
  const r = await fetch(
      lessonId
        ? `/api/course-seller/${id}/lessons/${lessonId}`
        : `/api/course-seller/${id}/lessons`,
      {
        method: lessonId ? "PUT" : "POST",
        body: new FormData(sellerLessonForm),
      },
    ),
    d = await r.json().catch(() => ({}));
  sellerLessonMessage.textContent = d.error || d.message || "";
  b.disabled = false;
  if (r.ok) {
    resetLessonEditor(id);
    await loadLessons(id);
    await load();
  }
};
publishForm.onsubmit = async (e) => {
  e.preventDefault();
  if (
    !confirm(
      "ยืนยันว่า หลังมียอดขาย เปลี่ยนแปลงเนื้อหาทั้งหมดไม่ได้ หากแก้ข้อผิดพลาดภายในต้องติดต่อ VisionD เท่านั้น และต้องไม่เปลี่ยนสาระเดิม ใช่ไหม",
    )
  )
    return;
  const form = new FormData(publishForm),
    id = form.get("course_id"),
    b = e.submitter;
  b.disabled = true;
  publishMessage.textContent = "กำลังส่งให้ Boss ตรวจ…";
  const r = await fetch(`/api/course-seller/${id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        price_baht: form.get("price_baht"),
        contact_info: form.get("contact_info"),
        confirm_permanent: form.get("confirm_permanent") === "on",
      }),
    }),
    d = await r.json().catch(() => ({}));
  publishMessage.textContent = d.error || d.message || "";
  b.disabled = false;
  if (d.credit_required) {
    location.href = d.buy_url || "/product.html?slug=course-selling-rights";
    return;
  }
  if (d.payment_profile_required) {
    location.href = "/course-center#paymentProfilePanel";
    return;
  }
  if (d.slip_api_required) {
    location.href = "/course-center#slipApiPanel";
    return;
  }
  if (r.ok) {
    alert(d.message);
    publishPanel.hidden = true;
    history.replaceState(null, "", "/course-center");
    sellerLessonManager.dataset.autoOpened = "";
    await load();
  }
};
closeSellerLessons.onclick = () => (sellerLessonManager.hidden = true);
load();
