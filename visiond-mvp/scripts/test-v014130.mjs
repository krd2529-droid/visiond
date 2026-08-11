import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sharedNav = read("public/shared-nav.js");
const home = read("public/index.html");
const seller = read("public/course-center.html");
const hub = read("public/my-hub.js");
const account = read("public/nav-account.js");
const sellerCss = read("public/course-seller.css");

assert.equal(read("VERSION.txt").trim(), "v0.14.130");
assert.match(sharedNav, /'\/course-seller\.html','ศูนย์จัดการคอร์ส'/);
assert.doesNotMatch(sharedNav, /'\/course-seller\.html','สร้างตะกร้าคอร์ส'/);
assert.match(home, />ศูนย์จัดการคอร์ส<\/a/);
assert.match(seller, /<title>ศูนย์จัดการคอร์ส \| VisionD<\/title>/);
assert.match(seller, /<h1>ศูนย์จัดการคอร์ส<\/h1>/);
assert.match(seller, /\+ สร้างตะกร้าคอร์ส<\/button/);
assert.match(hub, /<b>ศูนย์จัดการคอร์ส<\/b>/);
assert.match(account, /textContent:'ศูนย์จัดการคอร์ส'/);
assert.match(seller, /shared-nav\.js\?v=014130/);
assert.match(sellerCss, /\.seller-course-grid\s*\{[\s\S]*?minmax\(0, 250px\)[\s\S]*?justify-content:\s*start/);
assert.match(sellerCss, /\.seller-course-card > img\s*\{[\s\S]*?height:\s*320px;[\s\S]*?object-fit:\s*contain/);

console.log("v0.14.130 course management center naming PASS");
