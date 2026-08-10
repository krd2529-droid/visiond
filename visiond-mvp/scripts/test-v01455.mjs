import fs from 'node:fs';import {metaEventTime} from '../functions/_meta_messenger.js';
const read=p=>fs.readFileSync(p,'utf8'),api=read('functions/api/meta/messenger.js'),worker=read('functions/_meta_messenger.js'),schema=read('migrations/0021_meta_webhook_qa_hardening.sql'),road=read('VISIOND-ROADMAP.md');
const actual=metaEventTime(1767225600000,1767229200000);const checks=[
 ['version',Number(read('VERSION.txt').trim().split('.').pop())>=55],
 ['utf8 byte limit',api.includes('TextEncoder().encode(raw).byteLength')],
 ['page id required',worker.includes('META_PAGE_ID_NOT_CONFIGURED')&&worker.includes("recipient!==expectedPage")],
 ['failed event reclaim',worker.includes("WHERE elon_page_webhook_events.status='failed'")&&worker.includes('attempts=elon_page_webhook_events.attempts+1')],
 ['event timestamp',actual==='2026-01-01 00:00:00'&&worker.includes('last_customer_message_at=CASE')],
 ['retry schema',schema.includes('attempts')&&schema.includes('event_timestamp')],
 ['source recheck',fs.existsSync('scripts/source-to-ledger-recheck.mjs')&&fs.existsSync('source-captures/elon-page-vision7-v1.json')],
 ['patch capacity policy',road.includes('3–7')&&road.includes('1–3')&&road.includes('QA-only')]
];let fail=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fail++}if(fail)process.exit(1);
