const licenseList = document.querySelector("#licenseList");

function openCoursePlan(plan) {
  location.href = `/course-seller.html?create=${encodeURIComponent(plan)}`;
}

function renderCoursePlans(data) {
  licenseList.innerHTML = `<div class="vision5-credit-grid">
    <article><small>1 · ซื้อสิทธิ์</small><b>${Number(data.credit_balance) || 0} เครดิต</b><button type="button" data-course-plan="rights">เข้าแบบ 1 · ผู้สอนรับ 100%</button></article>
    <article><small>2 · เริ่มขายฟรี</small><b>${Number(data.free_course_count) || 0}/3 คอร์ส</b><span>จำกัด 3 คอร์ส · คอร์สละไม่เกิน 5 EP</span><button type="button" data-course-plan="free">เข้าแบบ 2 · ผู้สอนรับ 100%</button></article>
    <article><small>3 · พาร์ตเนอร์ 50/50</small><b>ไม่จำกัดคอร์ส</b><button type="button" data-course-plan="partner">เข้าแบบ 3 · ผู้สอน 50% / VisionD 50%</button></article>
  </div>`;
  licenseList.querySelectorAll("[data-course-plan]").forEach((button) => {
    button.addEventListener("click", () => openCoursePlan(button.dataset.coursePlan));
  });
}

async function loadCoursePlans() {
  const response = await fetch("/api/course-seller", { cache: "no-store" });
  if (response.status === 401) {
    sessionStorage.setItem("vd_return_to", "/course-center");
    location.href = "/login.html";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "โหลดรูปแบบคอร์สไม่สำเร็จ");
  renderCoursePlans(data);
}

loadCoursePlans().catch((error) => {
  licenseList.textContent = error.message || "โหลดรูปแบบคอร์สไม่สำเร็จ";
});
