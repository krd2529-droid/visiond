import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, ui, css, api] = await Promise.all([
  "VERSION.txt", "public/index.html", "public/admin.html", "public/course-seller.js", "public/course-seller.css", "functions/api/course-seller/index.js",
].map(read));
assert.ok(Number(version.trim().split(".").at(-1)) >= 257);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
for (const token of ["seller-course-plan", "coursePlanPages[c.course_plan]", "เลือกสร้างคอร์สแบบ 1, 2 หรือ 3 ด้านบน"])
  assert.ok(ui.includes(token), token);
assert.match(css, /\.seller-course-plan/);
const ownerQuery = api.match(/SELECT c\.id,c\.license_entitlement_id,c\.course_plan[\s\S]+?ORDER BY c\.id DESC/)?.[0] || "";
assert.ok(ownerQuery, "owner course query");
assert.ok(!/c\.course_plan\s*=/.test(ownerQuery), "owner catalog must not filter course plan");
console.log("v0.14.257 unified owner course catalog: PASS");
