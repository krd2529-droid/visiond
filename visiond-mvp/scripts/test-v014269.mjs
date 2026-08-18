import assert from "node:assert/strict";
import fs from "node:fs";
const read=file=>fs.readFileSync(file,"utf8"),legacy=read("public/course-seller.html"),center=read("public/course-center.html"),ui=read("public/course-seller.js");
assert.equal(read("VERSION.txt").trim(),"v0.14.269");
for(const id of ["sellerActionRequired","mySellerCourses","customerSalesPanel","pendingSlipPanel"])assert.doesNotMatch(legacy,new RegExp(`id="${id}"`));
for(const id of ["myCoursesPanel","mySellerCourses","customerSalesPanel","pendingSlipPanel"])assert.doesNotMatch(center,new RegExp(`id="${id}"`));
assert.match(ui,/if \(mySellerCourses\)/);assert.match(ui,/if \(salesRows\)/);assert.match(ui,/if \(slipIssueRows\)/);
console.log("v0.14.269 course-center surfaces removed from DOM safely: PASS");
