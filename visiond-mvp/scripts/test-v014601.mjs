import assert from "node:assert/strict";
import fs from "node:fs";
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html"), client = read("public/tiktok-analyzer.js");
assert.doesNotMatch(html, /ข้อมูลที่ยังขาด|data-list="gaps"/);
assert.doesNotMatch(client, /\[data-list="gaps"\]/);
assert.equal(read("VERSION.txt").trim(), "v0.14.601");
console.log("Removed missing-data panel regression: PASS");
