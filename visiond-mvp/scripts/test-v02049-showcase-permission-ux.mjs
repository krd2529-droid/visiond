import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");

// A read-only Creator token can still select a result and invoke the action,
// but the client must explain the missing write scope and must not call shop_add.
assert.match(client, /addButton\.disabled = !selected/);
assert.doesNotMatch(client, /addButton\.disabled = !state\.shopConnection\?\.capabilities\?\.can_write_showcase/);
assert.match(client, /ตรวจสิทธิ์ก่อนเพิ่มสินค้าเข้า Showcase/);
assert.match(client, /ต้องเปิด creator\.showcase\.write หรือ creator\.video\.write/);
assert.match(client, /if \(!state\.shopConnection\.capabilities\?\.can_write_showcase\) \{[\s\S]*return showToast[\s\S]*\}\s*const ids/);
assert.match(client, /action: "shop_add"/);
assert.match(client, /scrollIntoView/);
assert.equal(read("VERSION.txt").trim(), "v0.20.49");

console.log("TikTok Showcase missing-write-scope action UX regression: PASS");
