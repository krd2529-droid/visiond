const licenseList = document.querySelector("#licenseList");

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

loadCoursePlans().catch((error) => {
  licenseList.innerHTML = `<p>${error.message || "โหลดรูปแบบคอร์สไม่สำเร็จ"}</p><button type="button" id="retryCoursePlans">ลองโหลดใหม่</button>`;
  document.querySelector("#retryCoursePlans")?.addEventListener("click", () => {
    licenseList.textContent = "กำลังโหลดรูปแบบคอร์ส…";
    loadCoursePlans().catch((retryError) => {
      licenseList.textContent = retryError.message || "โหลดรูปแบบคอร์สไม่สำเร็จ";
    });
  });
});
