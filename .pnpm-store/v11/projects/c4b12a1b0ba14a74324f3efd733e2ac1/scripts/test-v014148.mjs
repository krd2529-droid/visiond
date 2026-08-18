import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [version, detailCss, sellerCss, center, edit, detail, api, home, admin] =
  await Promise.all([
    read("VERSION.txt"),
    read("public/course-detail.css"),
    read("public/course-seller.css"),
    read("public/course-center.html"),
    read("public/course-basket-edit.html"),
    read("public/course.html"),
    read("functions/api/course-seller/index.js"),
    read("public/index.html"),
    read("public/admin.html"),
  ]);

assert.equal(version.trim(), "v0.14.148");
assert.match(home, /WEB v0\.14\.148/);
assert.match(admin, /ADMIN v0\.14\.148/);
assert.match(detailCss, /grid-template-columns:250px minmax\(0,1fr\)/);
assert.match(detailCss, /height:290px;object-fit:contain/);
assert.match(sellerCss, /\.course-cover-preview img[\s\S]*height: 290px;[\s\S]*object-fit: contain/);
assert.match(center, /1000 × 1160 px \(25:29\).*ไม่เกิน 8 MB/);
assert.match(edit, /1000 × 1160 px \(25:29\).*ไม่เกิน 8 MB/);
assert.match(detail, /header-shell\.css\?v=014148/);
assert.match(detail, /shared-nav\.js\?v=014148/);
assert.match(api, /course_right_credits own_credit/);
assert.match(api, /own_credit\.used_course_id=c\.id AND own_credit\.user_id=\?/);
assert.match(api, /\.bind\(auth\.user\.id, auth\.user\.id\)/);
console.log("v0.14.148 course detail, cover input, published ownership: PASS");
