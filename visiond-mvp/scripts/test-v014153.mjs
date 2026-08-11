import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal((await read("VERSION.txt")).trim(), "v0.14.153");
assert.match(await read("public/index.html"), /WEB v0\.14\.153/);
assert.match(await read("public/admin.html"), /ADMIN v0\.14\.153/);
const roadmap = await read("work-history/visiond/roadmap/VISIOND-ROADMAP.md");
assert.match(roadmap, /แตก ZIP แล้ววางทับอย่างเดียว/);
assert.match(roadmap, /ไม่เปลี่ยนการตั้งค่า Cloudflare/);
console.log("v0.14.153 active tree overlay contract: PASS");
