import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const nested = new URL("visiond-mvp/", root);
const read = (base, path) => readFile(new URL(path, base), "utf8");
for (const base of [root, nested]) {
  assert.equal((await read(base, "VERSION.txt")).trim(), "v0.14.152");
  assert.match(await read(base, "public/index.html"), /WEB v0\.14\.152/);
  assert.match(await read(base, "public/admin.html"), /ADMIN v0\.14\.152/);
  const roadmap = await read(base, "work-history/visiond/roadmap/VISIOND-ROADMAP.md");
  assert.match(roadmap, /visiond-mvp.*Production tree ถาวร/);
  assert.doesNotMatch(roadmap, /ย้าย Cloudflare ไปใช้ราก/);
}
const lock = await read(root, "ACTIVE-PRODUCTION-TREE.md");
assert.match(lock, /Cloudflare Root directory: `visiond-mvp`/);
assert.match(lock, /ห้ามย้าย เปลี่ยนชื่อ กักกัน หรือลบ/);
console.log("v0.14.152 permanent Cloudflare tree lock: PASS");
