import assert from "node:assert/strict";import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),html=read("public/vision7-admin.html"),js=read("public/vision7-admin.js"),api=read("functions/api/admin/vision7/licenses.js"),core=read("functions/_vision7.js");
assert.ok(Number(read("VERSION.txt").trim().split(".").at(-1))>=106);
for(const heading of ["ลูกค้า","แอป / เลขคีย์","แพ็กเกจ / อายุคีย์","ค่าใช้จ่าย","วันที่ออก","ผู้ออก","สถานะ","จัดการ"])assert.ok(js.includes(heading),heading);
for(const token of ["user_id","user_name","issuer_name","display_cost","duration_days","issuance_type","created_at"])assert.ok(api.includes(token),token);
for(const token of ["issueCost","issuanceType","issue_cost","issuance_type"])assert.ok(core.includes(token),token);
assert.ok(!api.includes("ORDER BY l.created_at DESC LIMIT 500"));assert.ok(html.includes("ทุกคีย์ในระบบ"));assert.ok(fs.existsSync("migrations/0030_vision7_license_issue_ledger.sql"));
console.log("v0.14.106 complete license issue ledger passed");
