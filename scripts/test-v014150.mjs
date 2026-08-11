import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [version, home, admin, html, seller, edit, notifications, elon, requirements] = await Promise.all([
  read("VERSION.txt"), read("public/index.html"), read("public/admin.html"),
  read("public/course-center.html"), read("public/course-seller.js"),
  read("public/course-basket-edit.js"), read("functions/api/notifications.js"),
  read("functions/_elon.js"), read("requirements-ledger.json"),
]);

assert.equal(version.trim(), "v0.14.150");
assert.match(home, /WEB v0\.14\.150/);
assert.match(admin, /ADMIN v0\.14\.150/);
assert.match(html, /aria-labelledby="slipSwitchTitle" \/><i aria-hidden="true"><\/i><\/label>\s*<p id="slipManualHelp"/);
assert.equal((html.match(/id="salesTotal"/g) || []).length, 1);
assert.ok(!html.includes('id="salesTableTotal"'));
assert.match(html, /id="pendingSlipPanel"[\s\S]*?ต่อจาก PART 6/);
const order = ["#vision5CreditSummary", "#createPanel", "#paymentProfilePanel", "#slipApiPanel", "#myCoursesPanel", "#sellerLessonManager", "#publishPanel", "#customerSalesPanel", "#pendingSlipPanel"];
let cursor = 0;
for (const hook of order) {
  const at = seller.indexOf(`document.querySelector("${hook}")`, cursor);
  assert.ok(at >= cursor, `${hook} must remain in the approved order`);
  cursor = at + 1;
}
assert.ok(!seller.includes("salesTableTotal"));
assert.match(seller, /file\.size > 8 \* 1024 \* 1024/);
assert.match(edit, /file\.size > 8 \* 1024 \* 1024/);
assert.ok(!notifications.includes("/course-seller.html"));
assert.match(notifications, /\/course-center#slipIssueRows/);
assert.ok(!elon.includes("'/course-seller'"));
assert.match(elon, /'\/course-center'/);
assert.ok(!requirements.includes('"public/course-seller.html"'));
for (const id of ["paymentProfileMessage", "slipApiMessage", "sellerMessage", "sellerLessonMessage", "publishMessage"])
  assert.match(html, new RegExp(`id="${id}"[^>]*role="status"[^>]*aria-live="polite"`));
console.log("v0.14.150 deploy-safe Course Center repair: PASS");
