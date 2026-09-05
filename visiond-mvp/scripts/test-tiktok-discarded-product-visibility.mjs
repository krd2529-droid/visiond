import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const reconcile = client.match(/function reconcileProductPrepInventory[\s\S]*?\n\}/)?.[0] || "";

assert.ok(reconcile, "discarded-product reconciliation must exist");
assert.match(reconcile, /inventory_status === "discarded"/);
assert.match(reconcile, /normalizeProductName\(product\.name\)/);
assert.match(reconcile, /item\.remove\(\)/);
assert.match(reconcile, /order\.textContent = String\(index \+ 1\)/);
assert.match(reconcile, /const visibleCount = list\.querySelectorAll\("\.product-prep-item"\)\.length/);
assert.match(reconcile, /total\.textContent = `\$\{visibleCount\}\/40`/);
assert.match(reconcile, /#productPrepSummary/);
assert.equal((client.match(/reconcileProductPrepInventory\([^)]*products \|\| \[\]\)/g) || []).length, 2);

console.log("TikTok discarded products leave the selection list: PASS");
