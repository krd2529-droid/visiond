import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const reconcile = client.match(/function reconcileProductPrepInventory[\s\S]*?\n\}/)?.[0] || "";

assert.ok(reconcile);
assert.match(reconcile, /discarded\.has\(normalizeProductName\(name\)\)\) item\.remove\(\)/);
assert.match(reconcile, /const visibleCount = list\.querySelectorAll\("\.product-prep-item"\)\.length/);
assert.match(reconcile, /const total = \$\("#productPrepSummary \.total b"\)/);
assert.match(reconcile, /total\.textContent = `\$\{visibleCount\}\/40`/);
assert.match(html, /tiktok-analyzer\.js\?v=02101/);

console.log("TikTok shortlist total matches visible cards after reconciliation: PASS");
