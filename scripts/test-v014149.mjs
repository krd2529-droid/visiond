import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [version, html, js, home, admin] = await Promise.all([
  read("VERSION.txt"), read("public/course-center.html"),
  read("public/course-seller.js"), read("public/index.html"), read("public/admin.html"),
]);

assert.equal(version.trim(), "v0.14.149");
assert.match(home, /WEB v0\.14\.149/);
assert.match(admin, /ADMIN v0\.14\.149/);
assert.ok(!html.includes("ส่วนที่ "), "section labels must not compete with Vision 5 steps");
for (let n = 1; n <= 6; n += 1) assert.match(html, new RegExp(`PART ${n}`));
assert.equal((html.match(/id="salesOverviewPanel"/g) || []).length, 0);
assert.equal((html.match(/id="salesTotal"/g) || []).length, 1);
assert.equal((html.match(/id="salesCount"/g) || []).length, 1);
const customer = html.indexOf('id="customerSalesPanel"');
assert.ok(customer > -1 && html.indexOf('id="salesTotal"', customer) > customer);
const expected = [
  "#vision5CreditSummary", "#createPanel", "#paymentProfilePanel",
  "#slipApiPanel", "#pendingSlipPanel", "#myCoursesPanel",
  "#sellerLessonManager", "#publishPanel", "#customerSalesPanel",
];
let cursor = 0;
for (const hook of expected) {
  const at = js.indexOf(`document.querySelector("${hook}")`, cursor);
  assert.ok(at >= cursor, `${hook} must remain in operational order`);
  cursor = at + 1;
}
assert.match(html, /course-seller\.js\?v=014149/);
console.log("v0.14.149 course center PART order: PASS");
