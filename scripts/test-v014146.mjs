import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const [version, html, js, css, api, home, admin] = await Promise.all([
  read("VERSION.txt"), read("public/course-center.html"),
  read("public/course-seller.js"), read("public/course-seller.css"),
  read("functions/api/course-seller/index.js"), read("public/index.html"),
  read("public/admin.html"),
]);

assert.equal(version.trim(), "v0.14.146");
assert.match(home, /WEB v0\.14\.146/);
assert.match(admin, /ADMIN v0\.14\.146/);
assert.match(html, /course-seller\.css\?v=014146/);
assert.match(html, /course-seller\.js\?v=014146/);
for (const token of [
  "ศูนย์จัดการคอร์ส", "สรุปยอดขาย", "ออเดอร์รออนุมัติ",
  "สร้างคอร์ส / เติมเครดิต", "คอร์สของฉัน",
  "ตารางลูกค้า สลิปจริง และยอดขาย", "salesTableTotal",
]) assert.ok(html.includes(token), `missing ${token}`);
assert.ok(!html.includes("seller-task-nav"));
assert.ok(!html.includes("sellerActionRequired"));
assert.ok(!css.includes("seller-card:has(#salesRows)"));
assert.ok(!css.includes("seller-card:has(#slipIssueRows)"));
assert.ok(!css.includes("seller-priority-card"));
const orderedHooks = [
  '#salesOverviewPanel', '#paymentProfilePanel', '#slipApiPanel',
  '#pendingSlipPanel', '#vision5CreditSummary', '#createPanel',
  '#myCoursesPanel', '#sellerLessonManager', '#publishPanel',
  '#customerSalesPanel',
];
let at = -1;
for (const hook of orderedHooks) {
  const next = js.indexOf(`document.querySelector("${hook}")`);
  assert.ok(next > at, `runtime order missing ${hook}`);
  at = next;
}
assert.match(js, /insertAdjacentHTML\(\s*"afterend"/);
assert.match(js, /salesTableTotal\.textContent/);
assert.match(js, /seller-slip-link/);
assert.match(api, /END has_slip/);
assert.match(api, /o\.slip_key/);
console.log("v0.14.146 course center information order: PASS");
