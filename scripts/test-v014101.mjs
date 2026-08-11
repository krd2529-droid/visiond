import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8"),html=read("public/vision7-admin.html"),ui=read("public/vision7-admin.js"),api=read("functions/api/admin/vision7/programs.js"),ledger=JSON.parse(read("requirements-ledger.json"));
const legacyMapping=(html.match(/data-product-select/g)||[]).length===4;
if(legacyMapping){
  for(const text of ["ใช้ดึงชื่อและรูปมาแสดงเท่านั้น","คีย์ไม่มีวันหมดอายุ","30 วัน","365 วัน","สร้างโปรแกรมและแพ็กเกจ"])assert.ok(html.includes(text),text);
  for(const name of ["product_id","lifetime_product_id","monthly_product_id","yearly_product_id"])assert.ok(html.includes(`name=\"${name}\"`),name);
  for(const token of ["product_options","แบบร่าง—ลูกค้ายังซื้อไม่ได้","validateProductChoices","ยังไม่ได้ผูกตะกร้าขาย"])assert.ok(ui.includes(token),token);
}else{
  for(const token of ['enctype="multipart/form-data"','name="price_30d"','name="price_1y"','name="price_lifetime"'])assert.ok(html.includes(token),`VBot successor: ${token}`);
  assert.ok(ui.includes('body.set("plans"'),"VBot successor preserves three duration plans");
}
for(const token of ["optionalProductId","Number.isSafeInteger","Product ID ต้องเป็นเลขจำนวนเต็ม","UNION ALL","duration_days"])assert.ok(api.includes(token),token);
assert.match(api,/p\.plan_code === "lifetime" \? null : p\.plan_code === "monthly" \? 30 : 365/);
for(const id of ["EC-V7-PRODUCT-SELECT-001","EC-V7-PRODUCT-PURPOSE-001","EC-V7-PACKAGE-DURATION-001","EC-V7-MANUAL-KEY-TEST-001","EC-V7-PRODUCT-VALIDATION-001"])assert.equal(ledger.requirements.find(x=>x.id===id)?.status,"DONE-VERIFIED",id);
assert.ok(Number(read("VERSION.txt").trim().split(".").at(-1))>=101);
console.log("v0.14.101 Vision 7 product package mapping passed");
