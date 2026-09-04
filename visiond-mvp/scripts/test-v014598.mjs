import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
assert.match(client, /TikTok API ไม่ส่งข้อมูลอายุและเพศ/);
assert.match(client, /id="uploadAudienceEvidence"/);
assert.match(client, /\$\("#screenshots"\)\.click\(\)/);
assert.equal(read("VERSION.txt").trim(), "v0.14.598");
console.log("Audience evidence upload fallback regression: PASS");
