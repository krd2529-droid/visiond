import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
assert.match(client, /function displayDate\(value\)/);
const displayDateSource = client.match(/function displayDate\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(displayDateSource);
const displayDate = Function(`${displayDateSource}; return displayDate;`)();
assert.equal(displayDate("2026-09-05"), "05/09/2026");
assert.match(client, /const rangeLabel = `\$\{displayDate\(range\.from\)\}–\$\{displayDate\(range\.to\)\}`/);
assert.match(client, /sold-products-heading[\s\S]*?\$\{escapeHtml\(rangeLabel\)\}/);
assert.match(client, /const range = data\.date_range \|\| \{ from: state\.shopDateFrom, to: state\.shopDateTo \}/);
assert.match(html, /tiktok-analyzer\.js\?v=02050/);
console.log("Sold-products heading date range regression: PASS");
