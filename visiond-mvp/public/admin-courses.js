const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
let courses = [], currentCourseId = 0;
async function auth() { const r = await fetch("/api/auth/me"), d = await r.json().catch(() => ({})); if (!r.ok || !["boss", "admin"].includes(d.user?.role)) { location.href = "/login.html"; return false; } return true; }
async function loadCourses() {
  const r = await fetch("/api/admin/courses", { cache: "no-store" }), d = await r.json(); courses = d.items || [];
  adminCourseList.innerHTML = courses.length ? courses.map((c) => { const lessons = Number(c.lesson_count) || 0, expected = Number(c.expected_episodes) || 1; return `<article class="admin-course-item"><div><b>${esc(c.title)}</b><p>${money(c.price)} · ${lessons}/${expected} EP · ${Number(c.total_minutes) || 0} นาที</p><small>คอร์ส VisionD · ${c.status === "published" ? "เปิดขายแล้ว" : "ฉบับร่าง"} · รับเงิน ${esc(c.payment_bank_name || "-")} ${esc(c.payment_account_name || "")}</small></div><button data-lessons="${c.id}">จัดการ EP</button></article>`; }).join("") : "<p>ยังไม่มีคอร์ส</p>";
  adminCourseList.querySelectorAll("[data-lessons]").forEach((b) => b.onclick = () => openLessons(Number(b.dataset.lessons)));
}
courseForm.onsubmit = (e) => e.preventDefault();
async function createDraft() {
  if (!courseForm.reportValidity()) throw new Error('กรอกข้อมูลคอร์สให้ครบก่อนเพิ่ม EP');
  courseMessage.textContent='กำลังสร้างฉบับร่างอัตโนมัติ…';
  const r=await fetch('/api/admin/courses',{method:'POST',body:new FormData(courseForm)}),d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'สร้างฉบับร่างไม่สำเร็จ');currentCourseId=Number(d.id);lessonForm.elements.course_id.value=d.id;coursePaymentForm.hidden=false;closeLessons.hidden=false;lessonCourseTitle.textContent=courseForm.elements.title.value;courseMessage.textContent='สร้างฉบับร่างแล้ว · เพิ่ม EP ต่อได้';await loadCourses();return currentCourseId;
}
async function openLessons(id) { currentCourseId = id; const course = courses.find((c) => Number(c.id) === Number(id)); lessonManager.hidden = false; closeLessons.hidden=false;coursePaymentForm.hidden=false; lessonCourseTitle.textContent = course?.title || ""; lessonForm.elements.course_id.value = id; lessonManager.scrollIntoView({ behavior: "smooth" }); await loadLessons(id); }
async function loadLessons(id) {
  const r = await fetch(`/api/admin/courses/${id}/lessons`, { cache: "no-store" }), d = await r.json(), items = d.items || [], course = courses.find((c) => Number(c.id) === Number(id));
  lessonList.innerHTML = items.length ? items.map((l, i) => `<div class="lesson-admin-item"><span><b>EP ${i + 1} · ${esc(l.title)}</b><small> ${l.has_video ? "คลิป " : ""}${l.has_pdf ? "เอกสาร PDF" : ""}</small></span><button data-delete="${l.id}">ลบ</button></div>`).join("") : "<p>ยังไม่มี EP</p>";
  lessonFormTitle.textContent = `EP ${items.length + 1} · ชื่อ EP`; const expected = Number(course?.expected_episodes) || 1, complete = items.filter((l) => l.has_video || l.has_pdf).length;
  coursePublishSummary.innerHTML = `<b>${items.length}/${expected} EP</b><span>เวลาเนื้อหา ${Number(course?.total_minutes) || 0} นาที</span><span>บัญชีรับเงิน: ${esc(course?.payment_bank_name || "-")} · ${esc(course?.payment_account_name || "-")} · ${esc(course?.payment_account_number || "-")}</span>`;
  const bossAccount = String(course?.payment_account_number || '').replace(/\D/g, '') === '4441181181';
  coursePaymentForm.elements.payment_account.value = bossAccount ? 'boss_krungsri' : 'visiond';
  const published = course?.status === "published"; publishCompanyCourse.disabled = published || complete < expected; publishCompanyCourse.textContent = published ? "เผยแพร่แล้ว" : complete < expected ? `เพิ่ม EP ที่มีไฟล์อีก ${expected - complete} EP` : "เผยแพร่ตะกร้าทันที · ไม่ต้องส่งตรวจ";
  lessonList.querySelectorAll("[data-delete]").forEach((b) => b.onclick = async () => { if (!confirm("ลบ EP นี้และไฟล์ที่แนบใช่ไหม")) return; await fetch(`/api/admin/courses/${id}/lessons/${b.dataset.delete}`, { method: "DELETE" }); await loadCourses(); await loadLessons(id); });
}
lessonForm.onsubmit = async (e) => {
  e.preventDefault(); const btn = lessonForm.querySelector("button[type=submit]"), original = btn.textContent; btn.disabled = true; btn.textContent = "กำลังอัปโหลด…"; lessonMessage.textContent = "กำลังอัปโหลด กรุณาอย่าปิดหน้านี้…";
  let id=currentCourseId;try{if(!id)id=await createDraft()}catch(error){btn.disabled=false;btn.textContent=original;lessonMessage.textContent=error.message;return}
  const r = await fetch(`/api/admin/courses/${id}/lessons`, { method: "POST", body: new FormData(lessonForm) }), d = await r.json().catch(() => ({})); btn.disabled = false; btn.textContent = original; lessonMessage.textContent = r.ok ? "เพิ่ม EP เรียบร้อย" : d.error || "อัปโหลดไม่สำเร็จ";
  if (r.ok) { lessonForm.reset(); lessonForm.elements.course_id.value = id; await loadCourses(); await loadLessons(id); }
};
coursePaymentForm.onsubmit = async (e) => {
  e.preventDefault(); if (!currentCourseId) return; const btn=coursePaymentForm.querySelector('button[type=submit]'),original=btn.textContent; btn.disabled=true;btn.textContent='กำลังบันทึก…';coursePaymentMessage.textContent='';
  const r=await fetch(`/api/admin/courses/${currentCourseId}/payment`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payment_account:coursePaymentForm.elements.payment_account.value})}),d=await r.json().catch(()=>({}));
  btn.disabled=false;btn.textContent=original;coursePaymentMessage.textContent=r.ok?'เปลี่ยนบัญชีรับเงินแล้ว ออเดอร์ใหม่จะใช้บัญชีนี้':d.error||'บันทึกไม่สำเร็จ';if(r.ok){await loadCourses();await loadLessons(currentCourseId);}
};
publishCompanyCourse.onclick = async () => {
  if (!currentCourseId || !confirm("เผยแพร่ตะกร้าคอร์สนี้และเปิดขายทันทีใช่ไหม")) return; const original = publishCompanyCourse.textContent; publishCompanyCourse.disabled = true; publishCompanyCourse.textContent = "กำลังเผยแพร่…"; publishCourseMessage.textContent = "";
  const r = await fetch(`/api/admin/courses/${currentCourseId}/publish`, { method: "POST" }), d = await r.json().catch(() => ({})); publishCourseMessage.textContent = r.ok ? "เผยแพร่ตะกร้าและเปิดขายเรียบร้อย" : d.error || "เผยแพร่ไม่สำเร็จ"; if (r.ok) await loadCourses(); else { publishCompanyCourse.disabled = false; publishCompanyCourse.textContent = original; } await loadLessons(currentCourseId);
};
closeLessons.onclick = () => { currentCourseId=0;lessonForm.reset();courseForm.reset();lessonCourseTitle.textContent='คอร์สใหม่';lessonFormTitle.textContent='EP 1 · ชื่อ EP';lessonList.innerHTML='';coursePaymentForm.hidden=true;closeLessons.hidden=true;coursePublishSummary.innerHTML='<b>ยังไม่มี EP</b><span>เพิ่ม EP แรกเพื่อสร้างฉบับร่างอัตโนมัติ</span>';publishCompanyCourse.disabled=true;publishCompanyCourse.textContent='เผยแพร่ตะกร้าทันที · ไม่ต้องส่งตรวจ';courseMessage.textContent='ยังไม่สร้างฉบับร่าง · กด “เพิ่ม EP” ด้านล่างเมื่อกรอกข้อมูลครบ'; };
(async () => { if (await auth()) await loadCourses(); })();
import("/i18n.js?v=014407");
