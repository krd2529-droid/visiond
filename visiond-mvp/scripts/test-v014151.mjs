import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (base, path) => readFile(new URL(path, base), "utf8");
const nested = new URL("visiond-mvp/", root);
const runtime = [
  "functions/_elon.js",
  "functions/api/notifications.js",
  "public/course-basket-edit.html",
  "public/course-basket-edit.js",
  "public/course-center.html",
  "public/course-seller.js",
  "requirements-ledger.json",
];

assert.equal((await read(root, "VERSION.txt")).trim(), "v0.14.151");
assert.equal((await read(nested, "VERSION.txt")).trim(), "v0.14.151");
assert.match(await read(root, "public/index.html"), /WEB v0\.14\.151/);
assert.match(await read(nested, "public/index.html"), /WEB v0\.14\.151/);
assert.match(await read(root, "public/admin.html"), /ADMIN v0\.14\.151/);
assert.match(await read(nested, "public/admin.html"), /ADMIN v0\.14\.151/);
for (const path of runtime)
  assert.equal(await read(nested, path), await read(root, path), `active Cloudflare tree differs: ${path}`);
console.log("v0.14.151 root and active visiond-mvp trees are synchronized: PASS");
