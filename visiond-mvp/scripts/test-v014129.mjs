import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const css = read("public/vision5-flow.css");
const js = read("public/course-seller.js");
const html = read("public/course-center.html");

assert.equal(read("VERSION.txt").trim(), "v0.14.129");
assert.match(css, /\.vision5-step\s*\{[\s\S]*?border:\s*1px solid #50b895;[\s\S]*?background:\s*#e9fff5;/);
assert.match(css, /\.vision5-step\.complete\s*\{[\s\S]*?border-color:\s*#50b895;[\s\S]*?background:\s*#e9fff5;/);
assert.match(css, /\.vision5-step\.current\s*\{[\s\S]*?outline:[\s\S]*?border-color:\s*#50b895;/);
assert.match(js, /vision5-flow\.css\?v=014129/);
assert.match(html, /course-seller\.js\?v=014129/);

console.log("v0.14.129 Vision 5 unified three-step colors PASS");
