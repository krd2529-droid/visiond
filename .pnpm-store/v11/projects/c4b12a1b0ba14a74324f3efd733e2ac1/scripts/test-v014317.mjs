import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const version = read("VERSION.txt"), html = read("public/admin.html"), js = read("public/paper-doll-set-builder.js"), css = read("public/paper-doll-set-builder.css");
const createBlock = js.slice(js.indexOf("const createDrafts = async"), js.indexOf('button.addEventListener("click"'));

assert.equal(version.trim(), "v0.14.317");
assert.match(html, /paper-doll-set-builder\.js\?v=014317/);
assert.match(html, /paper-doll-set-builder\.css\?v=014317/);
assert.match(js, /results: \[\]/);
assert.match(js, /for \(const basketIndex of pendingIndexes\)/);
assert.doesNotMatch(createBlock, /Promise\.all/);
assert.match(createBlock, /result\.status === "success" \? -1 : index/);
assert.match(createBlock, /if \(result\.status !== "success"\) setBasketStatus/);
assert.match(createBlock, /catch \(error\)[\s\S]*failures\.push/);
assert.match(createBlock, /ลองใหม่เฉพาะที่ไม่สำเร็จ/);
assert.match(createBlock, /สร้างตะกร้าร่างครบแล้ว/);
assert.doesNotMatch(js, /state\.created/);
assert.match(css, /paper-doll-queue-status\[data-status="running"\]/);
assert.match(css, /paper-doll-queue-status\[data-status="success"\]/);
assert.match(css, /paper-doll-queue-status\[data-status="error"\]/);

console.log("v0.14.317 sequential paper-doll basket queue: PASS");
