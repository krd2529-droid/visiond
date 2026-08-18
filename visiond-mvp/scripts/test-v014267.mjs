import assert from "node:assert/strict";
import fs from "node:fs";
const read=file=>fs.readFileSync(file,"utf8"),ui=read("public/admin-pdf-cover.js"),css=read("public/admin-pdf-cover.css");
assert.equal(read("VERSION.txt").trim(),"v0.14.267");
assert.match(ui,/#d71920/);assert.match(ui,/#17171b/);
assert.match(ui,/kind==="modern"\?\{x:100,y:430,w:800,h:720,r:0\}/);
assert.match(ui,/ctx\.lineTo\(box\.x\+95,box\.y\)/);
assert.match(css,/linear-gradient\(135deg,#17171b/);
console.log("v0.14.267 red angular modern PDF cover: PASS");
