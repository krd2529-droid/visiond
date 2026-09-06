import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
assert.match(client, /startsWith\("เป้าหมาย 30 สินค้าหลัก"\)\) hint\.remove\(\)/, "shortlist target note must be removed");
for (const label of ["สินค้าหลัก · ≥30 ชิ้น/เดือน", "สินค้ารอง · 16–29 ชิ้น/เดือน", "ขายได้เล็กน้อย · 1–15 ชิ้น/เดือน", "สินค้าทดสอบ · คัดเข้าลิสต์คัดสินค้า", "สินค้ากระแส · สินค้าแนะนำจาก AI", "สินค้าคัดออก"]) assert.ok(client.includes(label), `missing grade explanation: ${label}`);
assert.match(client, /class="grade-explanation"/);
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const reconcile = client.match(/function reconcileProductPrepInventory[\s\S]*?\n\}/)?.[0] || "";

assert.ok(reconcile);
assert.match(reconcile, /discarded\.has\(normalizeProductName\(name\)\)\) item\.remove\(\)/);
assert.match(reconcile, /const visibleCount = list\.querySelectorAll\("\.product-prep-item"\)\.length/);
assert.match(reconcile, /const total = \$\("#productPrepSummary \.total b"\)/);
assert.match(reconcile, /total\.textContent = `\$\{visibleCount\}\/40`/);
assert.match(html, /tiktok-analyzer\.js\?v=02109/);

console.log("TikTok shortlist total matches visible cards after reconciliation: PASS");
