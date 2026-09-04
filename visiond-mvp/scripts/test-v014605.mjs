import assert from "node:assert/strict";
import fs from "node:fs";
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
assert.match(client, /if \(!product\.analysisOnly\) return sales >= 30 \? "A" : sales >= 16 \? "B" : sales > 0 \? "C" : ""/);
assert.match(client, /const analyzed = String\(product\.selection\?\.product_type \|\| ""\)/);
assert.equal(read("VERSION.txt").trim(), "v0.14.605");
console.log("Official Showcase sales override AI grade regression: PASS");
