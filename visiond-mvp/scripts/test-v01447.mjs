import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const schema=read('functions/_schema.js'),api=read('functions/api/admin/customer-analytics.js'),admin=read('public/admin.js'),roadmap=read('work-history/visiond/roadmap/VISIOND-ROADMAP.md');
const checks=[
 ['inventory origin schema',schema.includes('inventory_origin')&&schema.includes('premade_stock')],
 ['family fields',schema.includes('family_key')&&schema.includes('series_no')],
 ['family parser',api.includes('familyFromTitle')&&api.includes('seriesFromTitle')],
 ['paid product aggregation',api.includes("o.status='paid'")&&api.includes('order_items')],
 ['production recommendation',api.includes("recommendation='PRODUCE'")&&api.includes("recommendation='TEST'")],
 ['admin demand surface',admin.includes('Production Intelligence · Product Family')],
 ['privacy minimized journey',!api.includes('u.email')],
 ['roadmap next personalization',roadmap.includes('v0.14.48: interest profile')]
];
let fail=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fail++}if(fail)process.exit(1);
