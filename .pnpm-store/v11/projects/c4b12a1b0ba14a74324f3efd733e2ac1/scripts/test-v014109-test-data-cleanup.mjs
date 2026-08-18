import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("migrations/0031_remove_test_credit_order.sql","utf8");
assert.ok(sql.includes("VD-CREDIT-1786366955307-50BE"));
for(const last4 of ["F7HJ","UE65","IF6X"])assert.ok(sql.includes(`'${last4}'`),last4);
assert.ok(sql.includes("lower(p.platform_type)='veasy'"),"V Easy scope");
for(const table of ["veasy_shops","vision7_licenses","unlock_logs","course_right_credits","entitlements","verified_slips","order_slip_evidence","order_items","orders"])assert.ok(sql.includes(`DELETE FROM ${table}`),table);
assert.equal((sql.match(/VD-CREDIT-1786366955307-50BE/g)||[]).length>=7,true,"exact order target repeated");
console.log("v0.14.109 exact generated test data cleanup passed");
