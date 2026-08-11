import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const schema=read('functions/_schema.js'),orders=read('functions/_orders.js'),api=read('functions/api/admin/ad-intelligence.js'),admin=read('public/admin.js'),html=read('public/admin.html'),retention=read('functions/_analytics.js');
const checks=[
 ['campaign spend table',schema.includes('CREATE TABLE IF NOT EXISTS ad_campaign_costs')],
 ['purchase attribution is backend-only path',orders.includes("event_type<>'purchase'")&&orders.includes("'purchase','/checkout'")],
 ['30-day attribution window',orders.includes("-30 days")],
 ['admin auth',api.includes('requireAdmin(ctx)')],
 ['campaign ROAS',api.includes('roas:x.spend>0?x.revenue/x.spend:null')],
 ['source normalization',api.includes("'facebook.com'")&&api.includes("return 'facebook'")],
 ['admin form',html.includes('campaignAdCostForm')&&html.includes('utm_campaign')],
 ['admin loader',admin.includes('loadAdsIntelligence')&&admin.includes('/api/admin/ad-intelligence')],
 ['customer event retention',retention.includes('customer_events_removed')&&retention.includes('DELETE FROM customer_events')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}if(failed)process.exit(1);
