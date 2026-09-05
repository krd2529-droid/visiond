import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

assert.match(css, /main\{grid-template-columns:minmax\(0,1fr\);gap:14px\}/);
assert.match(css, /\.sidebar\{display:grid;grid-template-columns:minmax\(250px,300px\) minmax\(0,1fr\)/);
assert.match(css, /\.sidebar \.channels\{grid-column:2;grid-row:1;grid-template-columns:repeat\(auto-fill,minmax\(260px,320px\)\)/);
assert.doesNotMatch(html, /เพิ่มช่อง 2, 3, 4/);
assert.doesNotMatch(css, /\.sidebar>\.hint/);
assert.match(css, /@media\(max-width:850px\)\{\.sidebar\{order:0;grid-template-columns:1fr/);
assert.match(css, /@media\(max-width:560px\)[\s\S]*\.sidebar \.channels\{grid-template-columns:1fr\}/);
assert.ok(html.indexOf('class="panel sidebar"') < html.indexOf('class="panel workspace"'), "channel selector must precede workspace");

console.log("TikTok horizontal channel selector layout: PASS");
