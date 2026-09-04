import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
assert.match(client, /function mergeAnalysisResults\(results\)/);
assert.match(client, /selectedFiles\.length > 5/);
assert.match(client, /slice\(index \* 5, index \* 5 \+ 5\)/);
assert.match(client, /กำลังวิเคราะห์ชุด \$\{index \+ 1\}\/\$\{batches\.length\}/);
assert.match(client, /payload\.set\("clips_per_day", "20"\)/);
assert.equal(read("VERSION.txt").trim(), "v0.14.599");
console.log("TikTok image batch analysis regression: PASS");
