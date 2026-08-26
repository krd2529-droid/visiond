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
  money = (n) =>
    new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
let courses = [];
async function auth() {
  const r = await fetch("/api/auth/me"),
    d = await r.json().catch(() => ({}));
  if (!r.ok || !["boss", "admin"].includes(d.user?.role)) {
    location.href = "/login.html";
    return false;
  }
  return true;
}
async function loadCourses() {
  const r = await fetch("/api/admin/courses", { cache: "no-store" }),
    d = await r.json();
  courses = d.items || [];
  adminCourseList.innerHTML = courses.length
    ? courses
        .map(
          (c) =>
            `<article class="admin-course-item"><div><b>${esc(c.title)}</b><p>${money(c.price)} · ${Number(c.lesson_count) || 0} บท · นักเรียน ${Number(c.student_count) || 0} คน</p><small>${c.course_type === "resale_rights" ? `สิทธิ์ลงขายคอร์สออนไลน์ · ${Number(c.license_edit_days)===0?'ตลอดอายุระบบ':Number(c.license_edit_days)===365?'1 ปี':'30 วัน'}` : c.course_plan==='partner'?'คอร์สพาร์ตเนอร์ 50/50':'คอร์สออนไลน์'} · ${c.status === "published" ? "เปิดขาย" : "แบบร่าง"}</small></div>${c.course_origin==='seller_rights'?'<span>ผู้สอนจัดการ EP ภายในตะกร้าคอร์ส</span>':`<button data-lessons="${c.id}">จัดการบทเรียน</button>`}</article>`,
        )
        .join("")
    : "<p>ยังไม่มีคอร์ส</p>";
  adminCourseList
    .querySelectorAll("[data-lessons]")
    .forEach((b) => (b.onclick = () => openLessons(Number(b.dataset.lessons))));
}
courseForm.onsubmit = async (e) => {
  e.preventDefault();
  const btn = courseForm.querySelector("button[type=submit]"), keepType=courseForm.elements.course_type.value,keepDays=courseForm.elements.license_edit_days.value;
  btn.disabled = true;
  const originalLabel=btn.textContent;btn.textContent="กำลังสร้างและลงขาย…";
  courseMessage.textContent = "กำลังสร้างตะกร้าคอร์ส VisionD และเปิดขาย…";
  const fd = new FormData(courseForm);
  fd.set("active", "1");
  const r = await fetch("/api/admin/courses", { method: "POST", body: fd }),
    d = await r.json().catch(() => ({}));
  btn.disabled = false;
  btn.textContent=originalLabel;
  courseMessage.textContent = r.ok
    ? "สร้างตะกร้าคอร์ส VisionD และเปิดขายเรียบร้อย"
    : d.error || "สร้างไม่สำเร็จ";
  if (r.ok) {
    courseForm.reset();
    courseForm.elements.course_type.value = keepType;
    courseForm.elements.license_edit_days.value = keepDays;
    await loadCourses();
    openLessons(d.id);
  }
};
async function openLessons(id) {
  const course = courses.find((c) => c.id === id);
  lessonManager.hidden = false;
  lessonCourseTitle.textContent = course?.title || "";
  lessonForm.elements.course_id.value = id;
  lessonManager.scrollIntoView({ behavior: "smooth" });
  await loadLessons(id);
}
async function loadLessons(id) {
  const r = await fetch(`/api/admin/courses/${id}/lessons`, {
      cache: "no-store",
    }),
    d = await r.json();
  lessonList.innerHTML = (d.items || []).length
    ? (d.items || [])
        .map(
          (l, i) =>
            `<div class="lesson-admin-item"><span><b>${i + 1}. ${esc(l.title)}</b><small> ${l.has_video ? "คลิป " : ""}${l.has_pdf ? "PDF" : ""}</small></span><button data-delete="${l.id}">ลบ</button></div>`,
        )
        .join("")
    : "<p>ยังไม่มีบทเรียน</p>";
  lessonList.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("ลบบทเรียนนี้และไฟล์ที่แนบใช่ไหม")) return;
        await fetch(`/api/admin/courses/${id}/lessons/${b.dataset.delete}`, {
          method: "DELETE",
        });
        loadLessons(id);
      }),
  );
}
lessonForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = lessonForm.elements.course_id.value,
    btn = lessonForm.querySelector("button[type=submit]");
  btn.disabled = true;
  lessonMessage.textContent = "กำลังอัปโหลด กรุณาอย่าปิดหน้านี้…";
  const r = await fetch(`/api/admin/courses/${id}/lessons`, {
      method: "POST",
      body: new FormData(lessonForm),
    }),
    d = await r.json().catch(() => ({}));
  btn.disabled = false;
  lessonMessage.textContent = r.ok
    ? "เพิ่มบทเรียนเรียบร้อย"
    : d.error || "อัปโหลดไม่สำเร็จ";
  if (r.ok) {
    const keep = id;
    lessonForm.reset();
    lessonForm.elements.course_id.value = keep;
    await loadLessons(id);
    loadCourses();
  }
};
closeLessons.onclick = () => (lessonManager.hidden = true);
(async () => {
  if (new URLSearchParams(location.search).get("category") === "resale-rights") courseForm.elements.course_type.value="resale_rights";
  if (await auth()) loadCourses();
})();
import("/i18n.js?v=014407");
