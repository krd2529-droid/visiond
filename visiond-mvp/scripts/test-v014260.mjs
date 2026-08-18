import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, ui, css] = await Promise.all([
  "VERSION.txt", "public/index.html", "public/admin.html", "public/course-seller.js", "public/course-seller.css",
].map(read));
assert.equal(version.trim(), "v0.14.260");
assert.match(index, /WEB v0\.14\.260/);
assert.match(admin, /ADMIN v0\.14\.260/);
const headerEnd = ui.indexOf('</header><div class="course-plan-head-actions">');
const flowStart = ui.indexOf('<section id="coursePlanFlow"');
assert.ok(headerEnd > 0 && flowStart > headerEnd, "actions must be directly below plan header and above flow");
assert.match(ui, /course-plan-head-actions[\s\S]*\+ สร้างตะกร้าคอร์ส[\s\S]*ซื้อสิทธิ์/);
assert.doesNotMatch(ui, /index === 0 \? '<a class="course-step-action"/);
assert.match(css, /\.course-plan-head-actions/);
console.log("v0.14.260 plan actions below header: PASS");
