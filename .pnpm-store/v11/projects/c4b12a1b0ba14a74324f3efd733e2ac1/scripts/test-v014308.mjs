import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/course-seller.html");
const ui = read("public/course-seller.js");
const loadHandler = ui.match(/async function load\(\) \{[\s\S]*?\n\}/)?.[0] || "";
const enterHandler = ui.match(/function enterCourseCreatePage\(plan\) \{[\s\S]*?\n\}/)?.[0] || "";
const setupHandler = ui.match(/function setupContinuousLessonBuilder\(\) \{[\s\S]*?\n\}/)?.[0] || "";

const createGuard = loadHandler.indexOf("if (coursePlanPages[courseCreateMode])");
const dashboardRender = loadHandler.indexOf("render(d)");
const autoDraft = loadHandler.indexOf("latestEditableCourse");
const checks = [
  [read("VERSION.txt").trim() === "v0.14.308", "VERSION ต้องเป็น v0.14.308"],
  [html.includes('/course-seller.js?v=014308'), "HTML ต้องโหลด JavaScript แพต 014308"],
  [createGuard >= 0 && createGuard < dashboardRender, "หน้าสร้างต้องหยุดก่อน render dashboard"],
  [createGuard >= 0 && createGuard < autoDraft, "หน้าสร้างต้องหยุดก่อนค้นหา draft เก่า"],
  [loadHandler.includes("enterCourseCreatePage(courseCreateMode);") && /enterCourseCreatePage\(courseCreateMode\);[\s\S]*?return;/.test(loadHandler), "หน้าสร้างต้องเข้า editor แล้ว return ทันที"],
  [!enterHandler.includes("showLessonDraftGate()"), "หน้าสร้างใหม่ห้ามเรียก gate ของโครงสร้างเก่า"],
  [setupHandler.includes("sellerCourseForm.hidden = false") && setupHandler.includes("sellerLessonManager.hidden = false"), "รีเฟรชแล้วต้องคืนทั้งฟอร์มตะกร้าและ EP"],
  [setupHandler.includes('dataset.continuous === "1"') && setupHandler.includes("sendCourseReview.disabled = false"), "เรียก setup ซ้ำต้องไม่ทำให้ปุ่มส่งตรวจถูกปิด"],
];

const failed = checks.filter(([ok]) => !ok);
failed.forEach(([, message]) => console.error(`FAIL: ${message}`));
if (failed.length) process.exit(1);
console.log("PASS v0.14.308 create route survives refresh without legacy draft overwrite");
