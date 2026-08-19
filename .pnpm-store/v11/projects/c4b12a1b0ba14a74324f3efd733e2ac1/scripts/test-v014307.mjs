import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/course-seller.html");
const ui = read("public/course-seller.js");
const addHandler = ui.match(/function addCourseEpEditor\(\)[\s\S]*?\n}/)?.[0] || "";
const finalHandler = ui.match(/async function submitCurrentCourseForReview\(\)[\s\S]*?\n}/)?.[0] || "";

const checks = [
  [read("VERSION.txt").trim() === "v0.14.307", "VERSION ต้องเป็น v0.14.307"],
  [html.includes('id="addLessonButton"') && html.includes('type="button">+ เพิ่ม EP'), "ปุ่มเพิ่ม EP ต้องเป็น type=button"],
  [html.includes('/course-seller.js?v=014307'), "HTML ต้องโหลด JavaScript แพตล่าสุด"],
  [addHandler.includes("insertAdjacentHTML") && addHandler.includes("courseEpEditorMarkup"), "กดเพิ่ม EP ต้องสร้างกล่องใหม่ทันที"],
  [!/(fetch|reportValidity|checkValidity|ensureCourseDraft|scrollIntoView)/.test(addHandler), "ปุ่มเพิ่ม EP ห้ามเรียก API ตรวจฟอร์ม หรือเลื่อนหน้า"],
  [finalHandler.includes('querySelectorAll(".course-ep-draft")'), "ส่งตรวจต้องอ่าน EP ทุกกล่อง"],
  [finalHandler.includes(".filter((ep) =>"), "ส่งตรวจต้องข้าม EP ว่าง"],
  [finalHandler.includes('fetch("/api/course-seller"') && finalHandler.includes('/publish`'), "ส่งตรวจครั้งเดียวต้องสร้างตะกร้าและส่ง Boss"],
];
const failed = checks.filter(([ok]) => !ok);
failed.forEach(([, message]) => console.error(`FAIL: ${message}`));
if (failed.length) process.exit(1);
console.log("PASS v0.14.307 continuous course basket and EP review flow");
