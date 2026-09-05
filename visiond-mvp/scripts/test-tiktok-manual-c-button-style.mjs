import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

assert.match(css, /\.manual-c-form button\{min-height:42px;padding:0 20px;border:1px solid #08a99f;border-radius:10px;background:#08a99f;color:#fff;font:inherit;font-weight:900;cursor:pointer/);
assert.match(css, /\.manual-c-form button:hover\{border-color:#087f78;background:#087f78\}/);
assert.match(css, /\.manual-c-form button:focus-visible\{outline:3px solid rgba\(8,169,159,\.25\)/);
assert.match(css, /\.manual-c-form button:disabled\{opacity:\.55;cursor:wait\}/);
assert.match(css, /@media\(max-width:640px\)[\s\S]*\.manual-c-form button\{width:100%\}/);
assert.match(html, /tiktok-analyzer\.css\?v=02081/);

console.log("TikTok manual C button visual consistency: PASS");
