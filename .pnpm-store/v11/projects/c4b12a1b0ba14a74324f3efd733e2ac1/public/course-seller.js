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
    partner: {
      number: "1",
      title: "พาร์ตเนอร์ 50/50",
      detail: "VisionD รับเงินและตรวจสลิปอัตโนมัติ แบ่งรายได้ผู้สอน 50% / VisionD 50%",
      submit: "บันทึกข้อมูลและไปจัดการ EP",
      steps: ["กรอกข้อมูลคอร์ส", "เพิ่ม EP พร้อมวิดีโอหรือเอกสาร", "ตรวจความพร้อมและส่งให้ Boss ตรวจ"],
    },
  },
  legacyCoursePlan = { number: "เดิม", title: "ซื้อสิทธิ์เดิม (ปิดรับใหม่)" },
  coursePlanByNumber = { "1": "partner" },
  courseParams = new URLSearchParams(location.search),
  courseCreateMode = coursePlanByNumber[courseParams.get("type")] || courseParams.get("create");
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="/vision5-flow.css?v=014297">',
);
const sellerShell = document.querySelector(".seller-shell");
if (coursePlanPages[courseCreateMode]) {
  const config = coursePlanPages[courseCreateMode];
  document.title = "สร้างคอร์สพาร์ตเนอร์ 50/50 | VisionD";
  document.body.dataset.coursePlan = config.number;
  const heroTitle = sellerShell?.querySelector(".seller-hero h1");
  const heroDescription = sellerShell?.querySelector(".seller-hero h1 + p");
  if (heroTitle) heroTitle.textContent = "สร้างคอร์สพาร์ตเนอร์ 50/50";
  if (heroDescription) heroDescription.textContent = config.detail;
}
const licenseList = document.querySelector("#licenseList"),
  createCourseBasket = document.querySelector("#createCourseBasket"),
  mySellerCourses = document.querySelector("#mySellerCourses"),
  salesTotal = document.querySelector("#salesTotal"),
  salesCount = document.querySelector("#salesCount"),
  salesRows = document.querySelector("#salesRows"),
  slipIssueRows = document.querySelector("#slipIssueRows");
[
  document.querySelector(".seller-hero"),
  document.querySelector("#vision5SellerFlow"),
  document.querySelector("#vision5CreditSummary"),
  document.querySelector("#createPanel"),
  document.querySelector("#myCoursesPanel"),
  document.querySelector("#sellerLessonManager"),
  document.querySelector("#publishPanel"),
  document.querySelector("#customerSalesPanel"),
  document.querySelector("#pendingSlipPanel"),
].forEach((section) => section && sellerShell?.append(section));
const sendCourseReview=document.querySelector("#sendCourseReview"),sendCourseReviewHelp=document.querySelector("#sendCourseReviewHelp");
let activeLessonCourse=null;
function updateVision5Flow(data) {
  const done = { credit: true, setup: true };
  for (const key of ["credit", "setup"]) {
    const el = document.querySelector('[data-v5-step="' + key + '"]');
    el?.classList.toggle("complete", done[key]);
    el?.classList.remove("current");
  }
  const courseStep = document.querySelector('[data-v5-step="course"]');
  courseStep?.classList.remove("complete", "current");
  const current = "course";
  document
    .querySelector('[data-v5-step="' + current + '"]')
    ?.classList.add("current");
  const next = document.querySelector("#vision5NextAction");
  if (next)
    next.textContent = "พร้อมแล้ว: สร้างคอร์สพาร์ตเนอร์ เพิ่ม EP แล้วส่งให้ Boss ตรวจ";
}
function render(data) {
  state = data;
  updateVision5Flow(data);
  const used = (data.licenses || []).filter((x) => !x.available).length;
  if (licenseList) licenseList.innerHTML = `<div class="vision5-credit-grid"><article><small>รูปแบบเดียว · พาร์ตเนอร์ 50/50</small><b>ผู้สอน 50% / VisionD 50%</b><span>VisionD รับเงิน ตรวจสลิป และแบ่งรายได้อัตโนมัติ</span><button type="button" data-course-plan="partner">สร้างคอร์สพาร์ตเนอร์</button></article></div><p>คอร์สซื้อสิทธิ์เดิมยังจัดการย้อนหลังได้ แต่ปิดรับการสร้างใหม่แล้ว</p>`;
  licenseList?.querySelectorAll("[data-course-plan]").forEach((button) => {
    button.onclick = () => openCoursePlan(button.dataset.coursePlan);
  });
  if (mySellerCourses) {
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
            plan = coursePlanPages[c.course_plan] || legacyCoursePlan;
          return `<article class="owned-course seller-course-card"><img src="${esc(c.cover_url || "/assets/product-placeholder.svg")}" alt="ปก ${esc(c.title)}"><div class="seller-course-card-body"><span class="seller-course-plan" data-plan="${esc(c.course_plan || "rights")}">${esc(plan.title)}</span><h3>${esc(c.title)}</h3><p class="seller-course-meta"><span>ผู้สอน ${esc(c.teacher_name || "-")}</span><b>${money(c.price)}</b></p><div class="seller-course-badges"><span class="seller-course-ep">สร้างแล้ว ${total} EP · พร้อมเผยแพร่ ${ready}/${total}</span><span class="seller-course-status" data-status="${esc(c.review_status || "draft")}">${c.review_status === "approved" ? "เปิดขายแล้ว" : c.review_status === "pending" ? "รอตรวจหลังเผยแพร่" : c.review_status === "changes_requested" ? "ต้องแก้ไขตามที่ Boss แจ้ง" : "กำลังจัดทำ"}</span></div><small>แก้ไขล่าสุด ${date(c.updated_at)}</small></div></article>`;
        })
        .join("")
    : '<div class="seller-course-empty"><b>ยังไม่มีตะกร้าคอร์ส</b><p>เริ่มสร้างคอร์สพาร์ตเนอร์ 50/50 ด้านบน</p></div>';
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
  }
  if (salesTotal) salesTotal.textContent = money(data.totals?.amount);
  if (salesCount) salesCount.textContent =
      (Number(data.totals?.orders) || 0) +
      (data.sales_list_limited ? " (ตาราง 200 ล่าสุด)" : "");
  if (salesRows) salesRows.innerHTML = data.sales?.length
    ? data.sales
        .map(
          (x) =>
            `<tr><td>${esc(x.order_no)}</td><td>${esc(x.buyer_name || "-")}</td><td>${esc(x.course_title)}</td><td>${x.has_slip ? `<a class="seller-slip-link" href="/api/course-seller/orders/${x.id}/slip" target="_blank" rel="noopener">เปิดดูสลิป</a>` : '<span class="seller-no-slip">ไม่มีสลิป</span>'}</td><td>${money(x.total)}</td><td>${date(x.paid_at)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6">ยังไม่มียอดขาย</td></tr>';
  if (slipIssueRows) slipIssueRows.innerHTML = data.slip_issues?.length
    ? data.slip_issues
        .map(
          (x) =>
            `<tr><td>${esc(x.order_no)}</td><td>${esc(x.buyer_name || "-")}</td><td>${esc(x.course_title)}</td><td>${money(x.total)}</td><td><small>${esc(x.slip_verification_code || "API ตรวจไม่ได้")}</small><div class="seller-slip-actions"><a href="/api/course-seller/orders/${x.id}/slip" target="_blank" rel="noopener">ดูสลิป</a><button type="button" data-slip-approve="${x.id}">อนุมัติ</button><button type="button" data-slip-reject="${x.id}">ปฏิเสธ</button></div></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5">ไม่มีรายการผิดปกติ</td></tr>';
  slipIssueRows
    ?.querySelectorAll("[data-slip-approve]")
    .forEach(
      (b) => (b.onclick = () => reviewSlip(b.dataset.slipApprove, "approve")),
    );
  slipIssueRows
    ?.querySelectorAll("[data-slip-reject]")
    .forEach(
      (b) => (b.onclick = () => reviewSlip(b.dataset.slipReject, "reject")),
    );
  if (createCourseBasket) createCourseBasket.hidden = true;
}
function openCoursePlan(plan) {
  if (!coursePlanPages[plan]) return;
  location.href = `/course-seller?type=${coursePlanPages[plan].number}`;
}
function enterCourseCreatePage(plan) {
  const config = coursePlanPages[plan];
  if (!config) return;
  document.body.classList.add("course-create-page");
  const planPanels = new Set([
    createPanel,
    sellerLessonManager,
    publishPanel,
  ]);
  [...sellerShell.children].forEach((section) => {
    if (!planPanels.has(section)) section.remove();
  });
  createPanel.hidden = false;
  createPanel.after(sellerLessonManager,publishPanel);
  sellerCourseForm.hidden = false;
  sellerLessonManager.hidden = true;
  publishPanel.hidden = true;
  if (!createPanel.querySelector("#coursePlanFlow")) {
    createPanel.insertAdjacentHTML(
      "afterbegin",
      `<a class="course-create-back" href="/course-center">← กลับศูนย์จัดการคอร์ส</a><header class="course-plan-page-head"><small>รูปแบบเดียว</small><h1>สร้างคอร์สพาร์ตเนอร์ 50/50</h1><p>${config.detail}</p></header><section id="coursePlanFlow" class="course-plan-flow" aria-label="ขั้นตอนสร้างคอร์สพาร์ตเนอร์">${config.steps.map((step,index)=>`<span><b>${index+1}</b>${step}</span>`).join("")}</section>`,
    );
  }
  const formHeading = createPanel.querySelector(":scope > h2");
  const condition = createPanel.querySelector(".course-plan-condition") || document.createElement("aside");
  condition.className = "course-plan-condition";
  condition.innerHTML = "<b>เงื่อนไขพาร์ตเนอร์ 50/50</b><p>ลูกค้าชำระเข้าบัญชีบริษัท VisionD ระบบตรวจสลิปอัตโนมัติ และแบ่งรายได้ผู้สอน 50% / VisionD 50%</p>";
  if (!condition.isConnected) createPanel.insertBefore(condition, formHeading);
  createPanel.classList.remove("course-plan-legacy-form");
  formHeading.textContent = "กรอกข้อมูลคอร์สพาร์ตเนอร์";
  createPanel.querySelector(":scope > p").textContent = "สร้างร่างคอร์สก่อน จากนั้นเพิ่ม EP พร้อมวิดีโอหรือเอกสาร แล้วส่งให้ Boss ตรวจ";
  sellerCourseForm.elements.course_plan.value = plan;
  sellerCourseForm.querySelector('button[type="submit"]').textContent = config.submit;
  sellerCourseForm.querySelector('button[type="submit"]').disabled=false;
  document.title = "สร้างคอร์สพาร์ตเนอร์ 50/50 | VisionD";
}
function showCurrentCourseEditAction(course) {
  const heading = createPanel.querySelector(".course-plan-page-head");
  if (!heading || !course?.id) return;
  let action = heading.querySelector("#currentCourseEditAction");
  if (!action) {
    action = document.createElement("a");
    action.id = "currentCourseEditAction";
    action.className = "course-step-action";
    heading.append(action);
  }
  action.href = `/course-basket-edit.html?id=${encodeURIComponent(course.id)}`;
  action.textContent = "แก้ไขข้อมูลตะกร้าคอร์สนี้";
  action.setAttribute("aria-label", `แก้ไขตะกร้าคอร์ส ${course.title || course.id}`);
}
async function load() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let r;
  try {
    r = await fetch("/api/course-seller", {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (coursePlanPages[courseCreateMode]) {
      createPanel.hidden = false;
      sellerCourseForm.hidden = true;
      createPanel.querySelector(":scope > h2").textContent = "โหลดตะกร้าคอร์สไม่สำเร็จ";
      createPanel.querySelector(":scope > p").textContent = error?.name === "AbortError"
        ? "ระบบใช้เวลาโหลดนานเกินไป กรุณารีเฟรชอีกครั้ง โดยข้อมูลร่างเดิมยังไม่ถูกลบ"
        : "เชื่อมต่อข้อมูลตะกร้าไม่ได้ กรุณารีเฟรชอีกครั้ง โดยข้อมูลร่างเดิมยังไม่ถูกลบ";
    }
    return;
  } finally {
    clearTimeout(timeout);
  }
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
    requestedId = Number(params.get("course_id")),
    rememberedId = Number(sessionStorage.getItem("vd_active_course_draft_id")),
    flow = document.querySelector("#vision5SellerFlow");
  if (coursePlanPages[courseCreateMode]) {
    enterCourseCreatePage(courseCreateMode);
  }
  if (params.get("vision5") === "1" && flow && !flow.dataset.opened) {
    flow.dataset.opened = "1";
    flow.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!d.courses.length) {
      createPanel.hidden = false;
    }
  }
  if (!sellerLessonManager.dataset.autoOpened) {
    const editableStatuses = ["draft", "changes_requested"];
    const requestedCourse = requestedId
      ? d.courses.find((x) => Number(x.id) === requestedId)
      : null;
    const rememberedCourse = !requestedId && rememberedId
      ? d.courses.find((x) =>
          Number(x.id) === rememberedId && editableStatuses.includes(x.review_status),
        )
      : null;
    const latestEditableCourse = !requestedId && !rememberedCourse
      ? d.courses.find((x) => editableStatuses.includes(x.review_status))
      : null;
    const course = requestedCourse || rememberedCourse || latestEditableCourse;
    if (rememberedId && !rememberedCourse && !requestedId) {
      sessionStorage.removeItem("vd_active_course_draft_id");
    }
    if (course) {
      sessionStorage.setItem("vd_active_course_draft_id", String(course.id));
      if (!requestedId) {
        params.set("course_id", String(course.id));
        history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
      }
      sellerLessonManager.dataset.autoOpened = "1";
      if(coursePlanPages[courseCreateMode]){
        showCurrentCourseEditAction(course);
        sellerCourseForm.hidden=true;
        createPanel.querySelector(":scope > h2").textContent="สร้างข้อมูลคอร์สแล้ว";
        createPanel.querySelector(":scope > p").textContent="เพิ่มรายละเอียด EP ต่อด้านล่าง จากนั้นกดส่งตรวจ";
      }
      if (params.get("publish") === "1") openPublish(course);
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
  activeLessonCourse=course;
  sellerLessonManager.hidden = false;
  sellerLessonCourseTitle.textContent = course.title;
  resetLessonEditor(course.id, false);
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
  const ready=d.items.length>0&&d.items.every(x=>Number(x.is_complete)===1&&String(x.title||"").trim()),hasCredit=activeLessonCourse?.course_plan!=="rights"||activeLessonCourse?.license_entitlement_id!=null||Number(state?.credit_balance)>0;
  if(sendCourseReview)sendCourseReview.disabled=!ready||!hasCredit;
  if(sendCourseReviewHelp)sendCourseReviewHelp.textContent=!ready?"ใส่ชื่อและอัปโหลดคลิปหรือเอกสารให้ครบทุก EP ก่อนส่งตรวจ":!hasCredit?"บันทึกร่างแล้ว — ต้องมี 1 เครดิตก่อนส่งเข้าหลังบ้านตรวจ":"ข้อมูลพร้อม กดส่งตรวจเพื่อกำหนดราคาและส่งไปเมนูตรวจคอร์สในหลังบ้าน";
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
const minimumCoursePriceBaht = 499;
for (const priceInput of document.querySelectorAll('input[name="price_baht"]')) {
  priceInput.min = String(minimumCoursePriceBaht);
  if (!priceInput.value || Number(priceInput.value) < minimumCoursePriceBaht)
    priceInput.value = String(minimumCoursePriceBaht);
  priceInput.addEventListener("change", () => {
    if (!Number.isFinite(Number(priceInput.value)) || Number(priceInput.value) < minimumCoursePriceBaht) {
      priceInput.value = String(minimumCoursePriceBaht);
      priceInput.setCustomValidity("ราคาคอร์สขั้นต่ำ 499 บาท");
      priceInput.reportValidity();
      priceInput.setCustomValidity("");
    }
  });
}
sellerCourseForm.onsubmit = async (e) => {
  e.preventDefault();
  if (Number(sellerCourseForm.elements.price_baht.value) < minimumCoursePriceBaht) {
    sellerMessage.textContent = "ราคาคอร์สขั้นต่ำ 499 บาท";
    return;
  }
  const confirmation = "ยืนยันบันทึกข้อมูลคอร์สและไปจัดการ EP หรือไม่";
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
      sessionStorage.setItem("vd_active_course_draft_id", String(d.id));
      location.href = `/course-seller?type=${coursePlanPages[courseCreateMode].number}&course_id=${encodeURIComponent(d.id)}`;
      return;
    }
    await load();
    const course = state.courses.find((x) => Number(x.id) === Number(d.id));
    if (course) openLessons(course);
  }
};
async function uploadLessonVideo(courseId, lessonId, file, quality) {
  const initResponse = await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/init`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ lesson_id: Number(lessonId), file_name: file.name, file_type: file.type, file_size: file.size, quality: Number(quality) }),
  });
  const init = await initResponse.json().catch(() => ({}));
  if (!initResponse.ok) throw new Error(init.error || "เริ่มอัปโหลดวิดีโอไม่สำเร็จ");
  const parts = [];
  try {
    for (let offset = 0, partNumber = 1; offset < file.size; offset += init.chunk_size, partNumber++) {
      const end = Math.min(file.size, offset + init.chunk_size);
      sellerLessonMessage.textContent = `กำลังอัปโหลดวิดีโอ ${Math.round((offset / file.size) * 100)}% กรุณาอย่าปิดหน้านี้…`;
      const partResponse = await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/part?key=${encodeURIComponent(init.key)}&upload_id=${encodeURIComponent(init.upload_id)}&part_number=${partNumber}`, { method: "PUT", body: file.slice(offset, end) });
      const part = await partResponse.json().catch(() => ({}));
      if (!partResponse.ok) throw new Error(part.error || `อัปโหลดส่วนที่ ${partNumber} ไม่สำเร็จ`);
      parts.push(part);
    }
    const completeResponse = await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: init.key, upload_id: init.upload_id, file_size: file.size, parts }) });
    const complete = await completeResponse.json().catch(() => ({}));
    if (!completeResponse.ok) throw new Error(complete.error || "รวมไฟล์วิดีโอไม่สำเร็จ");
    return complete;
  } catch (error) {
    await fetch(`/api/course-seller/${courseId}/lesson-video-multipart/abort`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: init.key, upload_id: init.upload_id }) }).catch(() => {});
    throw error;
  }
}
function readLessonVideoResolution(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video"), url = URL.createObjectURL(file);
    const finish = (callback) => { URL.revokeObjectURL(url); video.removeAttribute("src"); callback(); };
    video.preload = "metadata";
    video.onloadedmetadata = () => { const resolution = { width: Number(video.videoWidth), height: Number(video.videoHeight) }; finish(() => resolve(resolution)); };
    video.onerror = () => finish(() => reject(new Error("อ่านความละเอียดคลิปไม่ได้ กรุณาแปลงไฟล์เป็น MP4/WebM 720p แล้วลองใหม่")));
    video.src = url;
  });
}
async function validateLessonVideoResolution(file) {
  if (!file) return "";
  try {
    const { width, height } = await readLessonVideoResolution(file), landscape = width >= height;
    return (landscape && (width > 1280 || height > 720)) || (!landscape && (width > 720 || height > 1280))
      ? `คลิป ${width}×${height}px สูงเกิน 720p กรุณาแปลงเป็นไม่เกิน 1280×720 (แนวนอน) หรือ 720×1280 (แนวตั้ง)` : "";
  } catch (error) { return error.message; }
}
sellerLessonForm.elements.video.addEventListener("change", async () => {
  const input = sellerLessonForm.elements.video, error = await validateLessonVideoResolution(input.files?.[0]);
  if (error) { sellerLessonMessage.textContent = error; input.value = ""; }
});
sellerLessonForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = sellerLessonForm.elements.course_id.value,
    lessonId = sellerLessonForm.elements.lesson_id.value,
    b = e.submitter;
  b.disabled = true;
  sellerLessonMessage.textContent =
    "กำลังบันทึกและอัปโหลด กรุณาอย่าปิดหน้านี้…";
  const video = sellerLessonForm.elements.video.files?.[0];
  if (video && (video.size > 2 * 1024 * 1024 * 1024 || !["video/mp4", "video/webm"].includes(video.type))) {
    sellerLessonMessage.textContent = "คลิปต้องเป็น MP4/WEBM และมีขนาดไม่เกิน 2 GB";
    b.disabled = false;
    return;
  }
  const resolutionError = await validateLessonVideoResolution(video);
  if (resolutionError) {
    sellerLessonMessage.textContent = resolutionError;
    b.disabled = false;
    return;
  }
  const lessonData = new FormData(sellerLessonForm);
  if (video) { lessonData.delete("video"); lessonData.set("video_upload_pending", "1"); }
  const r = await fetch(
      lessonId
        ? `/api/course-seller/${id}/lessons/${lessonId}`
        : `/api/course-seller/${id}/lessons`,
      {
        method: lessonId ? "PUT" : "POST",
        body: lessonData,
      },
    ),
    d = await r.json().catch(() => ({}));
  sellerLessonMessage.textContent = d.error || d.message || "";
  if (r.ok) {
    if (video) {
      try {
        await uploadLessonVideo(id, d.id || lessonId, video, sellerLessonForm.elements.video_quality.value);
        sellerLessonMessage.textContent = "บันทึก EP และอัปโหลดวิดีโอสำเร็จ";
      } catch (error) {
        sellerLessonMessage.textContent = `${error.message} · ข้อมูล EP ถูกเก็บเป็นร่างแล้ว กดบันทึกใหม่เพื่ออัปโหลดซ้ำ`;
        b.disabled = false;
        await loadLessons(id);
        return;
      }
    }
    resetLessonEditor(id);
    await loadLessons(id);
    await load();
  }
  b.disabled = false;
};
publishForm.onsubmit = async (e) => {
  e.preventDefault();
  if (Number(publishForm.elements.price_baht.value) < minimumCoursePriceBaht) {
    publishMessage.textContent = "ราคาคอร์สขั้นต่ำ 499 บาท";
    return;
  }
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
  if (r.ok) {
    alert(d.message);
    sessionStorage.removeItem("vd_active_course_draft_id");
    publishPanel.hidden = true;
    history.replaceState(null, "", "/course-center");
    sellerLessonManager.dataset.autoOpened = "";
    await load();
  }
};
closeSellerLessons.onclick = () => (sellerLessonManager.hidden = true);
if(sendCourseReview)sendCourseReview.onclick=()=>{if(activeLessonCourse)openPublish(activeLessonCourse)};
if (coursePlanPages[courseCreateMode]) {
  createPanel.hidden = false;
  sellerCourseForm.hidden = true;
  createPanel.querySelector(":scope > h2").textContent = "กำลังโหลดตะกร้าคอร์ส…";
  createPanel.querySelector(":scope > p").textContent = "กำลังตรวจสถานะร่างเดิมก่อนแสดงขั้นตอนถัดไป";
}
load();
