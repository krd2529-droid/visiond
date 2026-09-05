import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.doesNotMatch(html, /id="history"|id="runs"|ดูประวัติการวิเคราะห์/);
assert.doesNotMatch(client, /\$\("#history"\)|\$\("#runs"\)|data-run/);
assert.doesNotMatch(css, /history-disclosure|#history/);
assert.match(client, /if \(data\.runs\[0\]\) renderResult\(data\.runs\[0\]\.result\)/);
assert.equal(read("VERSION.txt").trim(), "v0.20.49");

console.log("TikTok hidden analysis history regression: PASS");
