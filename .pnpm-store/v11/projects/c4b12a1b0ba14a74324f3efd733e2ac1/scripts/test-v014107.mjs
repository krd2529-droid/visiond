import assert from "node:assert/strict";import fs from "node:fs";const read=p=>fs.readFileSync(p,"utf8"),html=read("public/vision7-admin.html"),js=read("public/vision7-admin.js"),api=read("functions/api/admin/vision7/licenses.js"),css=read("public/vision7.css");
assert.ok(Number(read("VERSION.txt").trim().split(".").at(-1))>=107);
for(const token of ["keyCustomerFields","testDurationField","keyPackageField","คีย์ทดสอบ — ไม่มีค่าใช้จ่าย","30 วัน","1 ปี","ตลอดอายุ","key-info","key-success"])assert.ok(html.includes(token),token);
for(const token of ["syncKeyMode","operatorUserId","testDuration","keyCustomerFields.hidden","keyPlan.required"])assert.ok(js.includes(token),token);
for(const token of ["a.user.id","test_duration",'["30", "365", "lifetime"]'])assert.ok(api.includes(token),token);
assert.ok(css.includes(".key-info,.key-success"));assert.ok(!html.includes('id="keyBindingPreview" class="notice"'));
console.log("v0.14.107 clear test and customer key modes passed");
