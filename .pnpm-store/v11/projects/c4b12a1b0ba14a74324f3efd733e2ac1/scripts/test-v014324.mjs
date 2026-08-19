import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [
  version,
  home,
  admin,
  featureMap,
  courseHtml,
  courseApi,
  publishApi,
  reviewApi,
  catalogApi,
  orderApi,
  slipApi,
  packageText,
] = await Promise.all([
  read('VERSION.txt'),
  read('public/index.html'),
  read('public/admin.html'),
  read('FEATURE-MAP.md'),
  read('public/course-seller.html'),
  read('functions/api/course-seller/index.js'),
  read('functions/api/course-seller/[id]/publish.js'),
  read('functions/api/admin/course-seller-reviews/[id].js'),
  read('functions/api/courses/index.js'),
  read('functions/api/orders/index.js'),
  read('functions/api/orders/[id]/slip.js'),
  read('package.json'),
]);

assert.equal(version.trim(), 'v0.14.324');
assert.match(home, /WEB v0\.14\.324/);
assert.match(admin, /ADMIN v0\.14\.324/);

for (const featureId of [
  'COURSE-BASKET-001',
  'COURSE-EP-001',
  'COURSE-REVIEW-001',
  'COURSE-PARTNER-CHECKOUT-001',
]) {
  assert.match(featureMap, new RegExp(featureId));
}

assert.match(featureMap, /PUT\/DELETE \/api\/course-seller\/\:courseId\/lessons\/\:lessonId/);
assert.match(featureMap, /รับเฉพาะแผน `partner`/);
assert.match(featureMap, /บัญชีกลาง VisionD/);
assert.match(courseHtml, /id="addLessonButton"[^>]*type="button"/);
assert.match(courseApi, /selectedPlan\.code\s*!==\s*['"]partner['"]/);
assert.match(publishApi, /review_status[\s\S]{0,120}pending|pending[\s\S]{0,120}review_status/);
assert.match(reviewApi, /approve_course/);
assert.match(reviewApi, /published/);
assert.match(catalogApi, /c\.active=1 AND p\.status='published'/);
assert.match(orderApi, /courseRevenue/);
assert.match(slipApi, /EASYSLIP_API_KEY/);
assert.equal(JSON.parse(packageText).scripts['test:v014324'], 'node scripts/test-v014324.mjs');

console.log('v0.14.324 course partner feature map: PASS');
