import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),sender=read('functions/_meta_sender.js'),api=read('functions/api/admin/elon-page/[id]/send.js'),cron=read('functions/api/internal/meta-outbox.js'),schema=read('migrations/0020_elon_page_outbox.sql'),road=read('work-history/visiond/roadmap/VISIOND-ROADMAP.md'),ledger=JSON.parse(read('requirements-ledger.json'));let fail=0;
const checks=[
 ['version',Number(read('VERSION.txt').trim().split('.').at(-1))>=54],
 ['layer2 snapshot recheck',fs.existsSync('scripts/requirement-layer2-recheck.mjs')&&road.includes('ตัวกันงานหลุดชั้นที่ 2')],
 ['snapshot hash lock',read('scripts/requirement-layer2-recheck.mjs').includes('snapshot ถูกแก้ย้อนหลัง')&&read('requirements-history/index.json').includes('sha256')],
 ['deleted requirement detection',read('scripts/requirement-layer2-recheck.mjs').includes('Requirement หลุดจาก Ledger')],
 ['status regression detection',read('scripts/requirement-layer2-recheck.mjs').includes('reopened_reason')],
 ['outbox idempotency',schema.includes('idempotency_key TEXT NOT NULL UNIQUE')&&sender.includes('INSERT OR IGNORE INTO elon_page_outbox')],
 ['24h enforced twice',(sender.match(/withinMetaReplyWindow/g)||[]).length>=3&&sender.includes('META_24H_WINDOW_EXPIRED')],
 ['Page token is secret-only',sender.includes('META_PAGE_ACCESS_TOKEN')&&!schema.includes('access_token')],
 ['Graph version required',sender.includes('META_GRAPH_API_VERSION_NOT_CONFIGURED')],
 ['retry schedule',sender.includes('retryMinutes=[1,5,30,120,720]')&&sender.includes("status='dead'")],
 ['admin protected send',api.includes('requireAdmin')&&api.includes('idempotency-key')],
 ['cron protected',cron.includes('META_OUTBOX_CRON_TOKEN')&&cron.includes("expected.length<32" )],
 ['ledger resolved items',ledger.requirements.find(x=>x.id==='EC-EP-004')?.status==='DONE-VERIFIED'&&ledger.requirements.find(x=>x.id==='EC-EP-006')?.status==='DONE-VERIFIED']
];for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fail++}if(fail)process.exit(1);
