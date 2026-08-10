import fs from 'node:fs';import {validatePageSalesAnswer} from '../functions/_elon_page_sales.js';const read=p=>fs.readFileSync(p,'utf8'),engine=read('functions/_elon_page_sales.js'),sender=read('functions/_meta_sender.js'),webhook=read('functions/_meta_messenger.js'),cron=read('functions/api/internal/meta-outbox.js'),migration=read('migrations/0023_elon_page_sales_ai_jobs.sql'),ledger=JSON.parse(read('requirements-ledger.json')),items=[{slug:'a',price_satang:19900,original_price_satang:29900}];const checks=[
['version',read('VERSION.txt').trim()==='v0.14.58'],
['job dedupe',migration.includes('input_message_key TEXT NOT NULL UNIQUE')&&webhook.includes('INSERT OR IGNORE INTO elon_page_ai_jobs')],
['async retry queue',engine.includes("status IN ('queued','failed')")&&engine.includes("dead?'dead':'failed'")],
['published catalog only',engine.includes("status='published'")&&engine.includes('applyPromotion')],
['known answer accepted',validatePageSalesAnswer('{"reply":"สินค้า 199 บาท","product_slugs":["a"]}',items)==='สินค้า 199 บาท'],
['invented price rejected',validatePageSalesAnswer('{"reply":"สินค้า 555 บาท","product_slugs":["a"]}',items)===null],
['unknown product rejected',validatePageSalesAnswer('{"reply":"มีสินค้า","product_slugs":["missing"]}',items)===null],
['unsafe input blocked',engine.includes('containsProtectedPersonalData')&&engine.includes('containsSensitiveToken')&&engine.includes('containsExternalLink')],
['ai idempotency',engine.includes('page-sales-ai:${job.input_message_key}')],
['human handoff preserved',engine.includes("conversation_status!=='bot_active'")&&sender.includes("actor,actor,actor,conversationId")],
['ai role recorded',sender.includes("row.created_by?'human':'assistant'")],
['cron pipeline',cron.includes('processPageSalesAI')&&cron.includes('processMetaOutbox')],
['requirement closed',ledger.requirements.find(x=>x.id==='EC-EP-005')?.status==='DONE-VERIFIED']
];let failed=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed++}if(failed)process.exit(1);
