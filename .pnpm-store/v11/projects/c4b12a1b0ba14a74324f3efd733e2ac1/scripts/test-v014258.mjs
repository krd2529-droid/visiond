import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, ui, css] = await Promise.all([
  "VERSION.txt", "public/index.html", "public/admin.html", "public/course-seller.js", "public/course-seller.css",
].map(read));
assert.ok(Number(version.trim().split(".").at(-1)) >= 258);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
for (const token of [
  "select.replaceChildren(new Option",
  "ซื้อเครดิต",
  "data-start-course",
  "+ สร้างตะกร้าคอร์ส",
  "sellerCourseForm.elements.title.focus",
]) assert.ok(ui.includes(token), token);
for (const selector of ["#createCourseBasket[hidden]", ".course-create-page label[hidden]", ".course-step-action"])
  assert.ok(css.includes(selector), selector);
console.log("v0.14.258 plan 1 actions inside steps: PASS");
