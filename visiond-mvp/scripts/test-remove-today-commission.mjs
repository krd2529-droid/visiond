import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
assert.doesNotMatch(client, /total_today/);
assert.doesNotMatch(client, /\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49/);
assert.match(client, /commission-kpis article:nth-child\(1\) small/);
assert.match(css, /\.commission-kpis\{display:grid;grid-template-columns:repeat\(2,1fr\)/);
console.log("Remove today commission card regression: PASS");
