(() => {
  const root = document.querySelector("#courseDetail"), params = new URLSearchParams(location.search);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const money = (value) => new Intl.NumberFormat("th-TH").format((Number(value) || 0) / 100) + " บาท";
  const planLabel = (course) => course.course_plan === "partner" ? "แบบ 2 · พาร์ตเนอร์ 50/50" : "แบบ 1 · ผู้สอนรับ 100%";
  const tags = (course) => { try { return JSON.parse(course.platform_tags || "[]"); } catch { return []; } };
  function addCart(course) {
    let cart = []; try { cart = JSON.parse(localStorage.getItem("vd_cart") || "[]"); } catch {}
    if (!Array.isArray(cart)) cart = [];
    const line = {...course, id: course.product_id, course_id: course.id, product_kind:"course", category:"online-course", category_label:"คอร์สออนไลน์", pages:course.lesson_count, quantity:1};
    if (course.course_origin === "seller_rights") {
      if (cart.length && !confirm("คอร์สจากผู้ขายต้องชำระแยก ระบบจะเก็บคอร์สนี้ไว้รายการเดียวในตะกร้า ดำเนินการต่อหรือไม่?")) return;
      cart = [line];
    } else {
      cart = cart.filter((item) => item.slug !== course.slug); cart.push(line);
    }
    localStorage.setItem("vd_cart", JSON.stringify(cart)); location.href = "/cart";
  }
  function render(course) {
    const total = Number(course.lesson_count) || 0, done = Math.min(total, Number(course.completed_lessons) || 0), percent = Number(course.progress_percent) || 0;
    document.title = `${course.title} | VisionD V-Learning`;
    root.innerHTML = `<a class="course-detail-back" href="/courses.html">← กลับรายการคอร์ส</a><article class="course-detail-card"><figure><img src="${esc(course.cover_url || "/assets/product-placeholder.svg")}" alt="ปก ${esc(course.title)}"></figure><section><div class="course-detail-tags">${tags(course).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><h1>${esc(course.title)}</h1><p class="course-detail-lead">${esc(course.short_description || course.subtitle || "เรียนออนไลน์ตามเวลาของคุณ")}</p><p>${esc(course.description || "")}</p><dl class="course-detail-facts"><div><dt>ผู้สอน</dt><dd>${esc(course.teacher_name || "VisionD")}</dd></div><div><dt>บทเรียน</dt><dd>${total} EP</dd></div><div><dt>เวลาเรียน</dt><dd>${Number(course.total_minutes) || 0} นาที</dd></div><div><dt>ระดับ</dt><dd>${esc(course.learner_level === "all" ? "เรียนได้ทุกระดับ" : course.learner_level || "ทุกระดับ")}</dd></div></dl>${course.owned ? `<section class="course-owned-progress"><div><b>ความคืบหน้า ${percent}%</b><span>เรียนแล้ว ${done}/${total} EP</span></div><progress max="${Math.max(1,total)}" value="${done}"></progress></section><a class="vds-btn vds-btn--primary vds-btn--large" href="/learn.html?course=${course.id}">${percent === 100 ? "ทบทวนบทเรียน" : done ? "เรียนต่อจากเดิม" : "เริ่มเรียน"}</a>` : `<aside class="course-ep-lock"><b>🔒 EP ถูกล็อกก่อนซื้อ</b><p>หน้านี้แสดงข้อมูลการขายและจำนวน EP เท่านั้น ชื่อ EP วิดีโอ และไฟล์ประกอบจะเปิดหลังชำระเงินและอนุมัติแล้ว</p></aside><div class="course-buy-row"><strong>${money(course.price)}</strong><button id="courseAddCart" class="vds-btn vds-btn--primary vds-btn--large" type="button">ใส่ตะกร้าคอร์ส</button></div>`}</section></article>`;
    root.querySelector(".course-detail-card section")?.insertAdjacentHTML("afterbegin", `<span class="course-plan-public" data-plan="${esc(course.course_plan || "rights")}">${planLabel(course)}</span>`);
    root.querySelector("#courseAddCart")?.addEventListener("click", () => addCart(course));
  }
  fetch("/api/courses", {cache:"no-store"}).then(async (response) => {
    const data = await response.json().catch(() => ({items:[]})); if (!response.ok) throw new Error(data.error || "โหลดคอร์สไม่สำเร็จ");
    const id = Number(params.get("id")), slug = params.get("slug");
    const course = (data.items || []).find((item) => id ? Number(item.id) === id : slug && item.slug === slug);
    if (!course) throw new Error("ไม่พบคอร์สนี้ หรือคอร์สยังไม่เปิดขาย"); render(course);
  }).catch((error) => { root.innerHTML = `<div class="course-detail-error"><b>${esc(error.message)}</b><a href="/courses.html">กลับรายการคอร์ส</a></div>`; });
})();
