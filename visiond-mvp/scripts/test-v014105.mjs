import assert from "node:assert/strict";import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),html=read("public/vision7-admin.html"),js=read("public/vision7-admin.js"),api=read("functions/api/admin/vision7/programs.js");
assert.ok(Number(read("VERSION.txt").trim().split(".").at(-1))>=105);
assert.ok(!html.includes('</div>\n        ><p id="programState"'));
const legacyProductPicker=html.includes("data-product-select");
for(const token of legacyProductPicker?["retryProductOptions","Promise.allSettled","fillProductSelects(false)","ยังสร้างโปรแกรมเพื่อออกคีย์โดยแอดมินได้","b.plans.forEach","keyMode","keyCostSummary"]:["new FormData(programForm)",'body.set("plans"',"keyMode","keyCostSummary"])assert.ok(js.includes(token),token);
for(const token of ["productOptionsAvailable","VISION7_PRODUCT_OPTIONS_UNAVAILABLE","product_price"])assert.ok(api.includes(token),token);
assert.match(html,/vision7-admin\.js\?v=\d+/);assert.ok(html.includes("คีย์ทดสอบ — ไม่มีค่าใช้จ่าย"));
console.log("v0.14.105 Vision 7 manual create and free test key fallback passed");
