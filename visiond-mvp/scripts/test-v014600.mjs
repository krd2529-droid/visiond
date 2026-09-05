import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js"), shop = read("functions/_tiktok_shop_api.js");
assert.match(client, /function productNameSimilarity\(left, right\)/);
assert.match(client, /const productIdentityIds =/);
assert.match(client, /candidateIds\.includes\(String\(product\.product_id\)\)/);
assert.match(client, /const mergedProducts = showcaseProducts\.sort/);
assert.doesNotMatch(client, /const analyzedOnly = inventory\.filter/);
assert.doesNotMatch(client, /อ่านจากรายงาน · ยังจับคู่ Showcase ไม่ได้/);
assert.match(client, /evidenceSales/);
assert.match(client, /จาก \$\{mergedProducts\.length\.toLocaleString\(\)\}/);
assert.match(shop, /p\?\.main_images\?\.\[0\]\?\.url/);
assert.match(shop, /p\?\.product\?\.image\?\.url_list/);
assert.equal(read("VERSION.txt").trim(), "v0.20.49");
console.log("Showcase authoritative matching regression: PASS");
