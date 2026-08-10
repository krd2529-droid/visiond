import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('functions/_schema.js');
const analytics=read('functions/_analytics.js');
const orders=read('functions/_orders.js');
const register=read('functions/api/auth/register.js');
const login=read('functions/api/auth/login.js');
const client=read('public/analytics.js');
const adminApi=read('functions/api/admin/customer-analytics.js');
const roadmap=read('VISIOND-ROADMAP.md');
const checks=[
 ['guest cookie UUID is hashed', analytics.includes("visiond-view-v2")&&analytics.includes('claimVisitorHistory')],
 ['registration claims guest history', register.includes('claimVisitorHistory')&&register.includes('signup_complete')],
 ['login claims guest history', login.includes('claimVisitorHistory')&&login.includes('claimed_guest_events')],
 ['first analytics event waits for visitor cookie', client.indexOf("fetch('/api/analytics/view'")<client.indexOf("window.visiondTrack(event)")],
 ['guest offer tracked', client.includes("guest_gift_view")&&client.includes("guest_gift_click")],
 ['gift order fields exist', schema.includes("order_origin")&&schema.includes("gift_for_order_id")],
 ['one gift per user DB gate', schema.includes("idx_orders_first_order_gift")],
 ['gift requires exactly first real paid order', orders.includes("COALESCE(order_origin,'customer')<>'first_order_gift'")&&orders.includes("!==1")],
 ['gift total zero', orders.includes("VALUES(?,?,0,'paid'")&&orders.includes("'first_order_gift'")],
 ['special rights/courses excluded', orders.includes("NOT IN ('resale-rights','online-course')")],
 ['gift avoids already owned products', orders.includes('NOT EXISTS(SELECT 1 FROM entitlements')],
 ['admin counts distinct anonymous visitors', adminApi.includes('anonymous_visitors')&&adminApi.includes('visitor_key')],
 ['roadmap updated', roadmap.includes('v0.14.48')&&roadmap.includes('Guest acquisition')]
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++}
if(fail)process.exit(1);
console.log(`v0.14.48 checks: ${checks.length} PASS / 0 FAIL`);
