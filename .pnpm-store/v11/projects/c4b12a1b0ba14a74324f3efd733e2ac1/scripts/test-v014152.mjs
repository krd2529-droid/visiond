import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal((await read("VERSION.txt")).trim(), "v0.14.152");
assert.match(await read("public/index.html"), /WEB v0\.14\.152/);
assert.match(await read("public/admin.html"), /ADMIN v0\.14\.152/);
const roadmap = await read("work-history/visiond/roadmap/VISIOND-ROADMAP.md");
assert.match(roadmap, /visiond-mvp.*Production tree ถาวร/);
assert.doesNotMatch(roadmap, /ย้าย Cloudflare ไปใช้ราก/);
console.log("v0.14.152 active production tree remains visiond-mvp: PASS");
