import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const render = client.match(/function renderShowcaseProducts[\s\S]*?\n\}/)?.[0] || "";

assert.ok(render, "Showcase renderer must exist");
assert.doesNotMatch(render, /ตรวจครั้งถัดไป|selection\.next_review_at/);
assert.doesNotMatch(render, /<th>ตรวจครั้งถัดไป<\/th>/);
assert.match(render, /colspan="\$\{columnCount\}"/);
assert.match(client, /function renderReviewSchedule/);
assert.match(client, /next_review_at/);
assert.equal(read("VERSION.txt").trim(), "v0.20.47");

console.log("TikTok Showcase next-review column removal regression: PASS");
