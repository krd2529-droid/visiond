import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url), nested = new URL("visiond-mvp/", root);
const read = (base, path) => readFile(new URL(path, base), "utf8");
for (const base of [root, nested]) {
  assert.equal((await read(base, "VERSION.txt")).trim(), "v0.14.153");
  assert.match(await read(base, "public/index.html"), /WEB v0\.14\.153/);
  assert.match(await read(base, "public/admin.html"), /ADMIN v0\.14\.153/);
  const roadmap = await read(base, "work-history/visiond/roadmap/VISIOND-ROADMAP.md");
  assert.match(roadmap, /แตก ZIP แล้ววางทับอย่างเดียว/);
  assert.match(roadmap, /ไม่มี PowerShell, CMD/);
  assert.match(roadmap, /ไม่เปลี่ยนการตั้งค่า Cloudflare/);
}
console.log("v0.14.153 overlay-only patch contract: PASS");
