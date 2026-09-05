import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.doesNotMatch(html, /showOverviewOutput|ภาพรวมทุกช่อง|ค่าคอมรวมและเปรียบเทียบแต่ละช่อง/);
assert.doesNotMatch(client, /showOverviewOutput/);
assert.doesNotMatch(css, /portfolio-nav/);
console.log("TikTok portfolio overview button removal regression: PASS");
