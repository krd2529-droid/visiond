import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const version = read("VERSION.txt"), html = read("public/admin.html"), js = read("public/paper-doll-set-builder.js");

assert.equal(version.trim(), "v0.14.316");
assert.match(html, /paper-doll-set-builder\.js\?v=014316/);
assert.doesNotMatch(js, /MAX_ZIP_ENTRIES/);
assert.doesNotMatch(js, /500 รายการ/);
assert.match(js, /if \(!total\) throw new Error\(`\$\{file\.name\} ไม่มีรายการไฟล์`\)/);
assert.match(js, /entries\.push\(\{ name, data \}\)/);
assert.match(js, /pdfBytes\.byteLength > 95 \* 1024 \* 1024/);
assert.match(js, /กรุณาเพิ่มจำนวนตะกร้าแล้ว Preview ใหม่/);

console.log("v0.14.316 unlimited paper-doll ZIP entries: PASS");
