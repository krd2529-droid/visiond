const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("th-TH").format((Number(n) || 0) / 100) + " บาท";
const saveCart = (item) => {
  localStorage.setItem("vd_cart", JSON.stringify([item]));
  location.href = "/cart.html";
};
async function load() {
  const r = await fetch("/api/courses", { cache: "no-store" }),
    d = await r.json().catch(() => ({ items: [] }));
  if (!r.ok) {
    courseList.innerHTML = `<p>${esc(d.error || "โหลดคอร์สไม่สำเร็จ")}</p>`;
    return;
  }
  const queryType=new URLSearchParams(location.search).get('category'),selected=queryType==='resale-rights'?'resale_rights':queryType==='online-course'?'online_course':'all';
  document.querySelectorAll('[data-course-type]').forEach(b=>b.classList.toggle('active',b.dataset.courseType===selected));
  const items=selected==='all'?d.items:d.items.filter(c=>c.course_type===selected);
  courseList.innerHTML = items.length
    ? items
        .map(
          (c) =>
            `<article class="course-card"><img src="${esc(c.cover_url || "/assets/product-placeholder.svg")}" alt="${esc(c.title)}"><div class="course-card-body"><small>${c.course_type==='resale_rights'?'สิทธิ์ขายคอร์ส':`${Number(c.lesson_count) || 0} บท · ${Number(c.total_minutes) || 0} นาที`}</small><h2>${esc(c.title)}</h2><p>${esc(c.short_description || c.subtitle || "เรียนออนไลน์ตามเวลาของคุณ")}</p>${c.teacher_name ? `<span>ผู้สอน ${esc(c.teacher_name)}</span>` : ""}<div class="course-card-action"><b>${money(c.price)}</b>${c.owned&&c.course_type!=='resale_rights' ? `<a class="primary" href="/learn.html?course=${c.id}">${Number(c.completed_lessons) ? "เรียนต่อ" : "เริ่มเรียน"}</a>` : c.owned?`<a class="primary" href="/course-seller.html">ใช้สิทธิ์</a>`:`<button class="primary" data-buy="${c.id}">${c.course_type==='resale_rights'?'ซื้อสิทธิ์':'ซื้อคอร์ส'}</button>`}</div>${c.owned&&c.course_type!=='resale_rights' ? `<progress max="${Math.max(1, Number(c.lesson_count) || 1)}" value="${Number(c.completed_lessons) || 0}"></progress><small>เรียนแล้ว ${Number(c.completed_lessons) || 0}/${Number(c.lesson_count) || 0} บท</small>` : ""}</div></article>`,
        )
        .join("")
    : '<div class="course-empty"><b>กำลังเตรียมคอร์สแรก</b><p>เมื่อเปิดขายแล้ว คอร์สจะแสดงที่หน้านี้</p></div>';
  courseList.querySelectorAll("[data-buy]").forEach(
    (btn) =>
      (btn.onclick = () => {
        const c = d.items.find((x) => String(x.id) === btn.dataset.buy);
        saveCart({
          ...c,
          category_label: c.course_type==='resale_rights'?"สิทธิ์ขายคอร์ส":"คอร์สออนไลน์",
          category: c.course_type==='resale_rights'?"resale-rights":"online-course",
          pages: c.lesson_count,
        });
      }),
  );
}
document.querySelectorAll('[data-course-type]').forEach(b=>b.onclick=()=>{const q=b.dataset.courseType==='resale_rights'?'resale-rights':b.dataset.courseType==='online_course'?'online-course':'';location.href='/courses.html'+(q?'?category='+q:'')});
load();
