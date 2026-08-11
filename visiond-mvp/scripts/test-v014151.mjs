import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [version, home, admin, html, seller, notifications] = await Promise.all([
  read("VERSION.txt"), read("public/index.html"), read("public/admin.html"),
  read("public/course-center.html"), read("public/course-seller.js"),
  read("functions/api/notifications.js"),
]);
assert.equal(version.trim(), "v0.14.151");
assert.match(home, /WEB v0\.14\.151/);
assert.match(admin, /ADMIN v0\.14\.151/);
assert.match(html, /ต่อจาก PART 6/);
assert.ok(!html.includes('id="salesTableTotal"'));
assert.match(seller, /file\.size > 8 \* 1024 \* 1024/);
assert.ok(!notifications.includes("/course-seller.html"));
console.log("v0.14.151 active Cloudflare tree: PASS");
