import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),api=read('functions/api/admin/courses/[id]/publish.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.453');assert.match(read('public/index.html'),/WEB v0\.14\.453/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.453/);assert.match(html,/admin-courses\.js\?v=014453/);
assert.doesNotMatch(html,/id="publishCompanyCourse"[^>]*disabled/);assert.match(ui,/publishCompanyCourse\.disabled = false/);assert.match(ui,/if\(!currentCourseId\).*createDraft\(\{allowPartial:true\}\)/);
for(const blocked of ['count<expected','กรุณากรอกชื่อคอร์ส','กรุณากรอกราคา','ข้อมูลบัญชีรับเงินของคอร์สไม่ครบ'])assert.ok(!api.includes(blocked),blocked);
assert.match(api,/requireAdmin/);assert.match(api,/course_origin,'company'/);assert.match(api,/status='published'/);
console.log('PASS v0.14.453 Boss can publish company course without content-completeness gates');
