import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const rangeSummary = client.match(/function shopRangeSummary\(data, products, orders\) \{([\s\S]*?)\n\}/)?.[1] || "";

assert.ok(rangeSummary, "shopRangeSummary implementation must exist");
assert.doesNotMatch(rangeSummary, /ค่าคอมช่วงนี้|shop_portfolio\?\.commission|\$\{totals\}/);
assert.match(rangeSummary, /shop-range-kpis/);
assert.match(rangeSummary, /orders\.length\.toLocaleString\(\)/);
assert.match(rangeSummary, /soldProductSummaryTable\(products, orders\)/);

console.log("TikTok selected-range commission card removal: PASS");
