import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = p => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const [version, css, home, admin, card] = await Promise.all([
  read("VERSION.txt"), read("public/home-modern-ai.css"),
  read("public/index.html"), read("public/admin.html"),
  read("public/home-course-catalog.js"),
]);
assert.equal(version.trim(), "v0.14.147");
assert.match(home, /home-modern-ai\.css\?v=014147/);
assert.match(home, /WEB v0\.14\.147/);
assert.match(admin, /ADMIN v0\.14\.147/);
assert.match(css, /\.home-course-cover\{[^}]*height:290px!important/);
assert.match(css, /\.home-course-cover img\{[^}]*object-fit:contain!important/);
assert.match(css, /\.home-course-cover img\{[^}]*object-position:center!important/);
assert.ok(!card.includes("vd-slide-prev"));
assert.ok(!card.includes("vd-slide-next"));
assert.equal((card.match(/class="vd-cover home-course-cover"/g) || []).length, 1);
console.log("v0.14.147 course cover digital card ratio: PASS");
