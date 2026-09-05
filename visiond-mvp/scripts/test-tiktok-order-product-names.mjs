import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeTikTokOrderProducts } from "../functions/_tiktok_shop_api.js";

assert.deepEqual(normalizeTikTokOrderProducts({ skus: [{ product_id: "101", product_name: "เสื้อสีขาว" }] }), [
  { product_id: "101", name: "เสื้อสีขาว", image_url: "" }
]);
assert.deepEqual(normalizeTikTokOrderProducts(JSON.stringify({ products: [{ product: { id: "202", title: "กางเกงสีขาว", image_url: "https://example.com/202.jpg" } }] })), [
  { product_id: "202", name: "กางเกงสีขาว", image_url: "https://example.com/202.jpg" }
]);
assert.equal(normalizeTikTokOrderProducts("not-json").length, 0);

const endpoint = fs.readFileSync(new URL("../functions/api/admin/tiktok-connections/index.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
assert.match(endpoint, /product_details: normalizeTikTokOrderProducts\(rawJson\)/);
assert.match(endpoint, /WHERE connection_id=\?/);
assert.match(client, /arrayValue\(order\.product_details\)/);
assert.doesNotMatch(client, /name: `\\u0E2A\\u0E34\\u0E19\\u0E04\\u0E49\\u0E32 \$\{id\}`/);

console.log("TikTok sold product name resolution regression: PASS");
