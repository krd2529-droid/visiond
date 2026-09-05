import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.match(client, /async function selectChannel\(id\)[\s\S]*?form\.classList\.add\("existing-channel"\)/);
assert.match(client, /function newChannel\(\)[\s\S]*?form\.classList\.remove\("existing-channel"\)/);
assert.match(css, /\.api-focused-form\.existing-channel>\.title/);
assert.match(css, />\.grid>label:nth-child\(-n\+2\)/);
assert.match(css, /\.api-focused-form\.existing-channel #saveChannel\{display:none\}/);

console.log("TikTok selected-channel redundant setup removal: PASS");
