import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');let fails=0;
const order=read('functions/api/orders/index.js'),grant=read('functions/_orders.js'),fulfill=read('functions/_vision7_orders.js'),crypto=read('functions/_vision7_license_crypto.js'),schema=read('functions/_vision7_schema.js'),road=read('work-history/visiond/roadmap/VISIOND-ROADMAP.md'),mine=read('functions/api/vision7/my-programs.js');
const checks=[
 ['version',Number(read('VERSION.txt').trim().split('.').at(-1))>=52],
 ['QA every patch',road.includes('Every patch — mandatory Patch Smoke Check')],
 ['QA 3/6/10 cadence',road.includes('Every 3 delivered patches')&&road.includes('Every 6 delivered patches')&&road.includes('Every 10 delivered patches')],
 ['urgent escalation',road.includes('Immediate escalation to Event Case')],
 ['Vision7 plan-product mapping',schema.includes('product_id INTEGER UNIQUE')&&order.includes('vision7_plan_id')],
 ['quantity allowed for Vision7',order.includes("&&!p?.vision7_plan_id")&&order.includes("&&!p.vision7_plan_id")],
 ['explicit renewal',order.includes('renew_license_id')&&fulfill.includes("action:'renewed'")],
 ['separate keys per order item',fulfill.includes('for(const item of items)')&&fulfill.includes('issueLicense')],
 ['idempotent fulfillment',schema.includes('order_item_id INTEGER PRIMARY KEY')&&fulfill.includes('vision7_order_fulfillments')],
 ['paid order hook',grant.includes('fulfillVision7Order(env,order,actor)')],
 ['AES-GCM encrypted key',crypto.includes("name:'AES-GCM'")&&crypto.includes('VISION7_LICENSE_ENCRYPTION_KEY')],
 ['owner can retrieve key',mine.includes('requireUser')&&mine.includes('decryptVision7Key')&&mine.includes('WHERE l.user_id=?')]
];for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fails++}if(fails)process.exit(1);
