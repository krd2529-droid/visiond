import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

for (const selector of [".channel-shop-analysis>.result-head", "#shopDashboard>.result-head", "#result>.result-head", "#angelInventory>.result-head"]) {
  assert.ok(css.includes(selector), `missing page-heading treatment for ${selector}`);
}
for (const selector of ["#analysisForm>.title", "#result>article>h3", ".marketplace-panel>.showcase-heading h3", ".showcase-panel>.showcase-heading h3", ".permanent-list>h3", ".review-schedule-head h3"]) {
  assert.ok(css.includes(selector), `missing section-heading treatment for ${selector}`);
}
assert.match(css, /@media\(max-width:640px\)[\s\S]*\.channel-shop-analysis>\.result-head/, "heading hierarchy must include a compact mobile treatment");
assert.match(html, /tiktok-analyzer\.css\?v=02077/, "updated heading styles must bypass the browser cache");

console.log("TikTok feature heading hierarchy: PASS");
