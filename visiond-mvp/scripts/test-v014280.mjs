import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const version = read("VERSION.txt");
const center = read("public/course-center.js");
const plansApi = read("functions/api/course-seller/plans.js");
const plans = read("functions/_course_plans.js");

assert.equal(version.trim(), "v0.14.280");
assert.match(center, /fetch\("\/api\/course-seller\/plans"/);
assert.doesNotMatch(center, /fetch\("\/api\/course-seller"/);
assert.match(center, /new AbortController\(\)/);
assert.match(center, /setTimeout\(\(\) => controller\.abort\(\), 12000\)/);
assert.match(center, /id="retryCoursePlans"/);
assert.match(plansApi, /SELECT COUNT\(\*\) credit_balance/);
assert.match(plansApi, /used_course_id IS NULL/);
assert.match(plansApi, /Object\.values\(COURSE_PLANS\)/);
assert.match(plans, /rights:\{code:'rights',number:1/);
assert.match(plans, /partner:\{code:'partner',number:2/);

console.log("v0.14.280 lightweight course plan loading: PASS");
