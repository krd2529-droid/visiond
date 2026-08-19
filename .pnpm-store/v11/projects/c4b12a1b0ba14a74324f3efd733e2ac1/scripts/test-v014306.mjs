import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/course-seller.html");
const ui = read("public/course-seller.js");
const lessons = read("functions/api/course-seller/[id]/lessons.js");
const publish = read("functions/api/course-seller/[id]/publish.js");
const lessonForm = html.match(/<form\s+id="sellerLessonForm"[\s\S]*?<\/form>/)?.[0] || "";

const checks = [
  [read("VERSION.txt").trim() === "v0.14.306", "VERSION ต้องเป็น v0.14.306"],
  [(lessonForm.match(/>เพิ่ม EP<\/button/g) || []).length === 1, "ต้องมีปุ่มเพิ่ม EP เพียงปุ่มเดียว"],
  [!/\brequired\b/.test(lessonForm), "ปุ่มเพิ่ม EP ต้องไม่ถูกขวางด้วย required"],
  [!ui.includes("กรุณาใส่ชื่อ EP ก่อนเพิ่ม") && !ui.includes("กรุณาแนบคลิปหรือเอกสารอย่างน้อย 1 ไฟล์ก่อนเพิ่ม EP"), "หน้าเว็บต้องไม่ตรวจช่องก่อนเพิ่ม EP"],
  [!lessons.includes("if(!title)return") && !lessons.includes("if(!video?.size&&!documents.length&&!videoPending)"), "API เพิ่ม EP ต้องรับคำขอที่ยังไม่ได้กรอกข้อมูล"],
  [!lessons.includes("DELETE FROM course_lessons WHERE course_id=? AND TRIM(COALESCE(title,''))=''"), "การโหลดหน้าต้องไม่ลบ EP ที่เพิ่งเพิ่ม"],
  [lessons.includes("message:complete?") && lessons.includes("'เพิ่ม EP แล้ว'"), "API ต้องยืนยันว่าเพิ่ม EP แล้ว"],
  [ui.includes("completeItems=d.items.filter") && ui.includes("ready=completeItems.length>0"), "ปุ่มส่งตรวจต้องนับเฉพาะ EP ที่มีข้อมูลจริง"],
  [publish.includes("complete: lessons.length >= required"), "API ส่งตรวจต้องตรวจเฉพาะ EP ที่สมบูรณ์"],
  [html.includes('/course-seller.js?v=014306'), "หน้าต้องโหลด JavaScript แพตล่าสุด"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log("PASS v0.14.306 add EP immediately and count completed EP on review");
