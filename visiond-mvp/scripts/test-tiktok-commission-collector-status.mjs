import assert from'node:assert/strict';import fs from'node:fs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const schema=read('functions/_tiktok_analyzer.js'),migration=read('migrations/0083_tiktok_commission_collector_status.sql'),statusApi=read('functions/api/internal/tiktok-commission-collector-status.js'),commissionApi=read('functions/api/admin/tiktok-commissions.js'),ui=read('public/tiktok-analyzer.js');
for(const column of['collector_session_secret_name','collector_status','collector_last_attempt_at','collector_last_success_at','collector_last_error']){assert.match(schema,new RegExp(column));assert.match(migration,new RegExp(column))}
assert.match(statusApi,/verifyCollectorRequest/);assert.match(statusApi,/reconnect_required/);assert.match(commissionApi,/collector_channels/);assert.match(ui,/สถานะตัวอ่านค่าคอม/);assert.match(ui,/ต้องเชื่อมใหม่/);
console.log('TikTok commission collector status lifecycle: PASS');
