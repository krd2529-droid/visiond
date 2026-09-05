import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.match(html, /<details id="history" class="history-disclosure" hidden><summary>ดูประวัติการวิเคราะห์<\/summary><div id="runs"><\/div><\/details>/);
assert.doesNotMatch(html, /<section id="history"/);
assert.match(client, /\$\("#history"\)\.open = false/);
assert.match(client, /\$\("#runs"\)\.addEventListener\("click"/);
assert.match(css, /\.history-disclosure summary/);
assert.equal(read("VERSION.txt").trim(), "v0.20.47");

console.log("TikTok collapsed analysis history regression: PASS");
