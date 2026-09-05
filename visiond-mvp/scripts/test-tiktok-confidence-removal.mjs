import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");

assert.doesNotMatch(html, /id=["']confidence["']/);
assert.doesNotMatch(client, /#confidence|ความมั่นใจ/);
assert.match(html, /tiktok-analyzer\.js\?v=02084/);

console.log("TikTok analysis confidence display removal: PASS");
