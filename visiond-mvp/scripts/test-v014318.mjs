import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const version = (await readFile(new URL("../VERSION.txt", import.meta.url), "utf8")).trim();
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const image = new URL("../public/assets/visiond-marketplace-partner-og-v014318.png", import.meta.url);
const imageUrl = "https://visiondonline.com/assets/visiond-marketplace-partner-og-v014318.png";

assert.equal(version, "v0.14.318");
assert.match(html, /<title>VisionD Online \| สินค้าดิจิทัลและพาร์ทเนอร์คอร์สออนไลน์<\/title>/);
assert.match(html, /ใบงาน ระบายสี เกมเสริมพัฒนาการ ตุ๊กตากระดาษ และไฟล์ PDF/);
assert.match(html, /พาร์ทเนอร์ลงคอร์สออนไลน์แบบ 50\/50/);
assert.equal(html.split(imageUrl).length - 1, 3, "OG, secure OG และ Twitter ต้องใช้ภาพเดียวกัน");
assert.match(html, /property="og:image:width" content="1731"/);
assert.match(html, /property="og:image:height" content="909"/);
assert.match(html, /property="og:url" content="https:\/\/visiondonline\.com\/"/);
assert.match(html, /name="facebook-domain-verification"/);
assert.ok((await stat(image)).size > 100_000, "ภาพพรีวิวต้องเป็นไฟล์จริงและไม่ใช่ placeholder");

console.log("v0.14.318 link preview metadata and image: PASS");
