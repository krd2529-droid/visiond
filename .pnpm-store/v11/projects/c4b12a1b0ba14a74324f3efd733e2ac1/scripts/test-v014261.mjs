import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, sellerHtml, stampScript] = await Promise.all([
  "VERSION.txt",
  "public/index.html",
  "public/admin.html",
  "public/course-seller.html",
  "scripts/release-stamp-assets.mjs",
].map(read));

assert.ok(Number(version.trim().split(".").at(-1)) >= 261);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
assert.match(sellerHtml, /course-seller\.js\?v=014\d+/);
assert.match(sellerHtml, /course-seller\.css\?v=014\d+/);
assert.doesNotMatch(sellerHtml, /\?v=014131/);
assert.match(stampScript, /"course-seller\.html"/);
console.log("v0.14.261 course seller cache stamp coverage: PASS");
