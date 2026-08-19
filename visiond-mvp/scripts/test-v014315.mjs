import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const version = read("VERSION.txt"), html = read("public/admin.html"), js = read("public/paper-doll-set-builder.js");

assert.equal(version.trim(), "v0.14.315");
assert.match(html, /paper-doll-set-builder\.js\?v=014315/);
assert.match(html, /ไม่จำกัดขนาดไฟล์ต้นทาง/);
assert.doesNotMatch(js, /MAX_SOURCE_BYTES/);
assert.doesNotMatch(js, /เกิน 200 MB/);
assert.match(js, /pdfBytes\.byteLength > 95 \* 1024 \* 1024/);
assert.match(js, /กรุณาเพิ่มจำนวนตะกร้าแล้ว Preview ใหม่/);
assert.match(js, /pageCount < basketCount/);

console.log("v0.14.315 unlimited paper-doll source size: PASS");
