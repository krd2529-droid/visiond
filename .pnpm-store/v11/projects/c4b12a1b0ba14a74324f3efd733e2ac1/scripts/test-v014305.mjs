import fs from "node:fs";
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/course-seller.html");
const lessonFormHtml = html.match(/<form id="sellerLessonForm"[\s\S]*?<\/form>/)?.[0] || "";
const ui = read("public/course-seller.js");
const lessons = read("functions/api/course-seller/[id]/lessons.js");
const publish = read("functions/api/course-seller/[id]/publish.js");
const admin = read("functions/api/admin/course-seller-reviews/[id].js");
const auto = read("functions/api/admin/course-seller-reviews/auto.js");
const adminIndex = read("functions/api/admin/course-seller-reviews/index.js");
const courseIndex = read("functions/api/course-seller/index.js");
const checks = [
  [read("VERSION.txt").trim() === "v0.14.305", "VERSION ต้องเป็น v0.14.305"],
  [!html.includes('id="addSellerLesson"'), "ต้องไม่มีปุ่มเพิ่ม EP ซ้ำบนหัว"],
  [(html.match(/>เพิ่ม EP<\/button/g) || []).length === 1, "ต้องมีปุ่มเพิ่ม EP ที่ใช้งานจริงเพียงปุ่มเดียว"],
  [!/name="title"[^>]*required/.test(lessonFormHtml), "ชื่อ EP ต้องไม่เรียก native required tooltip"],
  [ui.includes("กรุณาใส่ชื่อ EP ก่อนเพิ่ม") && ui.includes("กรุณาแนบคลิปหรือเอกสารอย่างน้อย 1 ไฟล์ก่อนเพิ่ม EP"), "หน้าเว็บต้องตรวจข้อมูล EP ด้วยข้อความของระบบ"],
  [!ui.includes("addSellerLesson"), "JavaScript ต้องไม่มีเศษปุ่มเพิ่ม EP เก่า"],
  [!lessons.includes("const placeholder=") && !lessons.includes("filled_placeholder"), "API ต้องไม่เติมสล็อต EP ว่างเก่า"],
  [lessons.includes("DELETE FROM course_lessons") && lessons.includes("TRIM(COALESCE(title,''))=''"), "API ต้องลบสล็อต EP ว่างเก่า"],
  [lessons.includes("TRIM(COALESCE(title,''))<>''") && lessons.includes("expected_episodes=(SELECT COUNT(*)"), "จำนวน EP ต้องนับเฉพาะรายการที่มีข้อมูล"],
  [ui.includes("completeItems=d.items.filter") && ui.includes("ready=completeItems.length>0"), "หน้าเว็บต้องพร้อมส่งเมื่อมี EP จริงและไม่ติดสล็อตว่าง"],
  [courseIndex.includes("planned_lesson_count") && (courseIndex.match(/TRIM\(COALESCE\(l\.title,''\)\)<>''/g) || []).length >= 2, "รายการคอร์สต้องนับเฉพาะ EP จริง"],
  [publish.includes(".filter(") && publish.includes("complete: lessons.length >= required"), "ส่งตรวจต้องไม่นับสล็อตว่าง"],
  [admin.includes(".filter(") && admin.includes("complete:lessons.length>=required"), "หลังบ้านต้องใช้กฎ EP จริงเดียวกัน"],
  [auto.includes("actual<required") && !auto.includes("incomplete_lesson_count"), "ตรวจอัตโนมัติต้องไม่ปฏิเสธเพราะสล็อตว่าง"],
  [adminIndex.includes("TRIM(COALESCE(l.title,''))<>''") && adminIndex.includes("incomplete_lesson_count"), "รายการหลังบ้านต้องไม่นับสล็อตว่างเป็น EP"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, message] of failed) console.error(`FAIL: ${message}`); process.exit(1); }
console.log("PASS v0.14.305 single EP action and complete-only review counting");
