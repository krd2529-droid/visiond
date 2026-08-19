import fs from "node:fs";
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const protocol = read("JARVIS-PATCH-PROTOCOL.md"), roadmap = read("VISIOND-ROADMAP.md"), featureMap = read("FEATURE-MAP.md");
const checks = [
  [read("VERSION.txt").trim() === "v0.14.303", "VERSION ต้องเป็น v0.14.303"],
  [protocol.includes("กฎตามตัวโค้ดและเจ้าของฟีเจอร์"), "โปรโตคอลต้องมีกฎ traceability"],
  [protocol.includes("DOMAIN-CAPABILITY-NNN"), "โปรโตคอลต้องกำหนดรูปแบบรหัสฟีเจอร์"],
  [roadmap.includes("v0.14.303 — Traceable Feature"), "โรดแมพต้องบันทึกแพตช์ v0.14.303"],
  [featureMap.includes("COURSE-EP-001"), "Feature Map ต้องมีรายการจริง"],
  ["หน้า,ไฟล์,API,ฐานข้อมูล / ตาราง / ฟิลด์,Input,Output,Reads,Writes,สิทธิ์,ห้ามกระทบ,การทดสอบ".split(",").every((field) => featureMap.includes(`- ${field}:`)), "Feature Map ต้องมีขอบเขตครบ"],
  [featureMap.includes("course_lessons.course_id"), "ต้องอ้าง foreign key จาก schema จริง"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, message] of failed) console.error(`FAIL: ${message}`); process.exit(1); }
console.log("PASS v0.14.303 traceable feature/code ownership protocol");
