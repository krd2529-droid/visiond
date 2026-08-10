import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const sync=read("functions/_vision7_key_storefront.js");
const programs=read("functions/api/admin/vision7/programs.js");
const orders=read("functions/api/orders/index.js");
const list=read("functions/api/vision7/apps/index.js");
const detail=read("functions/api/vision7/apps/[code]/index.js");
for(const token of ["vbot-key","vision7-key","offer_price","published","draft","UPDATE vision7_plans SET product_id","createdProductIds"])assert.ok(sync.includes(token),token);
assert.match(sync,/new Set\(\["monthly", "yearly", "lifetime"\]\)/);
assert.match(sync,/storefrontPlanCodes\.has/);
assert.match(sync,/product_kind !== "vision7-key"\) continue/);
assert.match(programs,/syncVision7KeyProducts/);
assert.match(programs,/rollbackVision7KeyProducts/);
assert.match(programs,/baht > 0 \? Math\.round\(baht \* 100\) : null/);
assert.match(orders,/VISION7_KEY_OFFER_PRICE_MISMATCH/);
assert.match(orders,/Number\(product\.price\)!==Number\(product\.vision7_offer_price\)/);
assert.match(orders,/p\.product_kind!=='vision7-key'/);
assert.match(orders,/promotion_percent:0/);
assert.equal((orders.match(/q\.plan_code IN \('monthly','yearly','lifetime'\)/g)||[]).length,2);
for(const source of [list,detail]){
  assert.match(source,/q\.plan_code IN \('monthly','yearly','lifetime'\)/);
  assert.match(source,/q\.offer_price>0/);
  assert.match(source,/x\.status='published'/);
  assert.match(source,/x\.product_kind='vision7-key'/);
}
assert.match(detail,/download_ready/);
assert.doesNotMatch(detail,/installer_download_url/);
console.log("v0.14.109 VBot key storefront backend passed");
