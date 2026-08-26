import fs from 'node:fs';import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),admin=read('public/admin.html'),api=read('functions/api/admin/courses/index.js'),feature=read('FEATURE-MAP.md');
assert.equal(read('VERSION.txt').trim(),'v0.14.423');assert.match(read('public/index.html'),/WEB v0\.14\.423/);assert.match(admin,/ADMIN v0\.14\.423/);
assert.match(admin,/href="\/admin-courses\.html#companyCourseCreate"[^>]*data-feature="COURSE-ADMIN-001"/);assert.match(admin,/vds-btn vds-btn--primary/);
assert.match(html,/id="companyCourseCreate"/);assert.match(html,/สร้างตะกร้าและลงขายทันที/);assert.match(html,/name="active" type="hidden" value="1"/);assert.doesNotMatch(html,/name="active" type="checkbox"/);assert.match(html,/admin-courses\.js\?v=014423/);
assert.match(ui,/fd\.set\("active", "1"\)/);assert.match(ui,/btn\.disabled = true/);assert.match(ui,/btn\.textContent=originalLabel/);assert.match(ui,/สร้างตะกร้าคอร์ส VisionD และเปิดขายเรียบร้อย/);
assert.match(api,/requireAdmin\(ctx\)/);assert.match(api,/0,'published','course-admin'/);assert.match(api,/VALUES\(\?,\?,\?,1,\?,\?,'company','approved',CURRENT_TIMESTAMP,\?\)/);assert.doesNotMatch(api,/form\.get\('active'\)==='1'\?'published':'draft'/);assert.match(api,/courseType==='resale_rights'\)return json/);
assert.match(api,/status:'published',review_status:'approved'/);assert.match(feature,/direct publish ใช้เฉพาะ POST Admin company course/);assert.match(feature,/partner/);
console.log('PASS v0.14.423 VisionD company course direct publish');
