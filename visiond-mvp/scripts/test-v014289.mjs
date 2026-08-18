import fs from "node:fs";

const html = fs.readFileSync("public/index.html", "utf8");
const version = fs.readFileSync("VERSION.txt", "utf8").trim();
const required = [
  "/assets/vlearning-partner-home-v014289.png",
  "/assets/course-partner-50-50-v014289.png",
  "พาร์ตเนอร์คอร์สออนไลน์ 50/50",
  "ผู้สอน 50% • VisionD 50%",
  "ไม่จำกัดจำนวนคอร์สและ EP",
  "/course-seller?type=partner",
];

if (version !== "v0.14.289") throw new Error(`VERSION mismatch: ${version}`);
if (!html.includes("WEB v0.14.289")) throw new Error("homepage visible patch must be v0.14.289");
for (const text of required) if (!html.includes(text)) throw new Error(`missing homepage partner contract: ${text}`);
for (const retired of ["course-rights-999-to-499-online-mobile.png", "courseOwnerAddCart", "จ่ายครั้งเดียว", "รับยอดขายเต็ม", "ลดเหลือ <span>499 บาท</span>"])
  if (html.includes(retired)) throw new Error(`retired homepage offer remains: ${retired}`);
for (const asset of ["public/assets/vlearning-partner-home-v014289.png", "public/assets/course-partner-50-50-v014289.png"])
  if (!fs.existsSync(asset) || fs.statSync(asset).size < 100_000) throw new Error(`missing generated partner asset: ${asset}`);

console.log("v0.14.289 homepage partner replacement contracts: PASS");
