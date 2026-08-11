import fs from 'node:fs';
import assert from 'node:assert/strict';

const api=fs.readFileSync('functions/api/admin/course-integrity.js','utf8');
const ui=fs.readFileSync('public/course-integrity.js','utf8');
const version=fs.readFileSync('VERSION.txt','utf8').trim();

assert.equal(version,'v0.14.159');
assert.ok(api.indexOf("searchParams.get('event_case')==='1'") < api.indexOf('await ensureDatabase(ctx.env)'),'focused gate must bypass schema initialization');
assert.match(api,/Promise\.race\(\[sampleEventCase\(ctx\.env\)/);
assert.match(api,/EVENT_CASE_QUERY_TIMEOUT/);
assert.match(api,/setTimeout\(\(\)=>resolve\(eventCaseTimeout\(\)\),5000\)/);
assert.match(ui,/AbortController/);
assert.match(ui,/controller\.abort\(\), 8000/);
assert.match(ui,/ระบบหยุดรอแล้วและไม่ค้างหน้าจอ/);
console.log('PASS v0.14.159 integrity timeout recovery');
