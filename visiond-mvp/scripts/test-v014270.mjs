import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const js = read("public/course-seller.js");
assert.equal(read("VERSION.txt").trim(), "v0.14.270");
for (const number of [1, 2, 3]) {
  assert.match(js, new RegExp(`>เข้าแบบ ${number}<`));
  assert.doesNotMatch(js, new RegExp(`data-course-plan=\\"[^\\"]+\\">สร้างคอร์สแบบ ${number}<`));
}
assert.match(js, /เริ่มสร้างคอร์สแบบ \$\{config\.number\}/);
assert.match(js, /ซื้อเครดิต/);
console.log("v0.14.270 course plan entry navigation: PASS");
