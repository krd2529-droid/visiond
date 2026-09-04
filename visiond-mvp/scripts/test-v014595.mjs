import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("public/tiktok-analyzer.css");

for (const grade of ["A", "B", "C", "D", "E", "F"]) assert.match(css, new RegExp(`\\.type-pill\\.type-${grade}\\{background:`));
assert.match(read("public/tiktok-analyzer.html"), /v0\.14\.595/);
assert.equal(read("VERSION.txt").trim(), "v0.14.595");

console.log("v0.14.595 grade color checks passed");
