const licenseList = document.querySelector("#licenseList");
const salesFilter = document.querySelector("#courseSalesFilter");
const salesSummary = document.querySelector("#courseSalesSummary");
const salesRows = document.querySelector("#courseSalesRows");
const salesRange = document.querySelector("#courseSalesRange");
const ownedCourseList = document.querySelector("#ownedCourseList");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = (satang) => `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(satang) || 0) / 100)} บาท`;
const localDay = (offset = 0) => {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000 + offset * 86400000);
  return date.toISOString().slice(0, 10);
};

function openCoursePlan(plan) {
  const number = { partner: 1 }[plan];
  if (number) location.href = `/course-seller?type=${number}`;
}

function renderCoursePlans(data) {
  licenseList.innerHTML = `<div class="vision5-credit-grid">
    <article><small>รูปแบบเดียว · พาร์ตเนอร์ 50/50</small><b>ผู้สอน 50% / VisionD 50%</b><span>เงินเข้า VisionD · ระบบตรวจสลิปและแบ่งรายได้อัตโนมัติ</span><button type="button" data-course-plan="partner">สร้างคอร์สพาร์ตเนอร์</button></article>
  </div>`;
  licenseList.querySelectorAll("[data-course-plan]").forEach((button) => {
    button.addEventListener("click", () => openCoursePlan(button.dataset.coursePlan));
  });
}

function renderOwnedCourses(items = []) {
  const status = {
    draft: "แบบร่าง",
    pending: "รอ Boss ตรวจ",
    approved: "เปิดขายแล้ว",
    changes_requested: "ต้องแก้ไขและส่งตรวจใหม่",
    suspended: "ระงับการขาย",
  };
  ownedCourseList.innerHTML = items.length
    ? items.map((course) => `<a class="course-center-owned-card" href="/course-basket-edit?id=${Number(course.id)}"><img src="${esc(course.cover_url || "/assets/product-placeholder.svg")}" alt="ปก ${esc(course.title)}"><span><small>ตะกร้าคอร์สพาร์ตเนอร์ 50/50</small><b>${esc(course.title)}</b><em data-status="${esc(course.review_status || "draft")}">${esc(status[course.review_status] || "แบบร่าง")}</em><span>EP พร้อม ${Number(course.lesson_count) || 0}/${Number(course.planned_lesson_count) || 0} · แก้ไขล่าสุด ${new Date(`${course.updated_at}Z`).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>${course.review_note ? `<strong>หมายเหตุ: ${esc(course.review_note)}</strong>` : ""}</span></a>`).join("")
    : '<p class="course-sales-empty">ยังไม่มีตะกร้าคอร์ส กด “สร้างคอร์สพาร์ตเนอร์” เพื่อเริ่มสร้าง</p>';
}

async function loadCoursePlans() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch("/api/course-seller/plans", {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("โหลดรูปแบบคอร์สนานเกินไป กรุณาลองใหม่");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401) {
    sessionStorage.setItem("vd_return_to", "/course-center");
    location.href = "/login.html";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "โหลดรูปแบบคอร์สไม่สำเร็จ");
  renderCoursePlans(data);
}

async function loadOwnedCourses() {
  const response = await fetch("/api/course-seller", { cache: "no-store" });
  if (response.status === 401) {
    sessionStorage.setItem("vd_return_to", "/course-center");
    location.href = "/login.html";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "โหลดตะกร้าคอร์สไม่สำเร็จ");
  renderOwnedCourses(Array.isArray(data.courses) ? data.courses : []);
}

loadCoursePlans().catch((error) => {
  licenseList.innerHTML = `<p>${error.message || "โหลดรูปแบบคอร์สไม่สำเร็จ"}</p><button type="button" id="retryCoursePlans">ลองโหลดใหม่</button>`;
  document.querySelector("#retryCoursePlans")?.addEventListener("click", () => {
    licenseList.textContent = "กำลังโหลดรูปแบบคอร์ส…";
    loadCoursePlans().catch((retryError) => {
      licenseList.textContent = retryError.message || "โหลดรูปแบบคอร์สไม่สำเร็จ";
    });
  });
});

loadOwnedCourses().catch((error) => {
  if (ownedCourseList) ownedCourseList.textContent = error.message || "โหลดตะกร้าคอร์สไม่สำเร็จ";
});

function renderSales(data) {
  const summary = data.summary || {};
  salesRange.textContent = `ช่วง ${new Date(`${data.from}T12:00:00`).toLocaleDateString("th-TH", { dateStyle: "medium" })} – ${new Date(`${data.to}T12:00:00`).toLocaleDateString("th-TH", { dateStyle: "medium" })}`;
  salesSummary.innerHTML = `<article><small>ยอดขายรวม</small><b>${money(summary.gross_total)}</b></article><article><small>รายได้ส่วนผู้สอน</small><b>${money(summary.teacher_total)}</b></article><article><small>คำสั่งซื้อ</small><b>${Number(summary.orders) || 0}</b></article><article><small>สมาชิกที่ซื้อ</small><b>${Number(summary.buyers) || 0}</b></article>`;
  salesRows.innerHTML = data.items?.length
    ? `<div class="course-sales-row course-sales-head"><b>วันเวลา</b><b>สมาชิกที่ซื้อ</b><b>คอร์ส</b><b>ยอดขาย</b><b>ส่วนผู้สอน</b></div>${data.items.map((item) => `<div class="course-sales-row"><time>${new Date(`${item.paid_at}Z`).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</time><b>${esc(item.buyer_name)}</b><span>${esc(item.course_title)}</span><span>${money(item.gross_total)}</span><strong>${money(item.teacher_total)}</strong></div>`).join("")}${data.limited ? '<p class="course-sales-note">แสดง 500 รายการล่าสุดในช่วงที่เลือก</p>' : ""}`
    : '<p class="course-sales-empty">ช่วงวันที่เลือกยังไม่มียอดขายคอร์ส</p>';
}

async function loadCourseSales() {
  const params = new URLSearchParams(new FormData(salesFilter));
  salesRows.textContent = "กำลังโหลดยอดขาย…";
  const response = await fetch(`/api/course-seller/sales?${params}`, { cache: "no-store" });
  if (response.status === 401) {
    sessionStorage.setItem("vd_return_to", "/course-center");
    location.href = "/login.html";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "โหลดยอดขายไม่สำเร็จ");
  renderSales(data);
}

if (salesFilter) {
  salesFilter.elements.to.value = localDay();
  salesFilter.elements.from.value = localDay(-29);
  salesFilter.elements.to.max = localDay();
  salesFilter.elements.from.max = localDay();
  salesFilter.addEventListener("submit", (event) => {
    event.preventDefault();
    loadCourseSales().catch((error) => { salesRows.textContent = error.message || "โหลดยอดขายไม่สำเร็จ"; });
  });
  loadCourseSales().catch((error) => { salesRows.textContent = error.message || "โหลดยอดขายไม่สำเร็จ"; });
}
