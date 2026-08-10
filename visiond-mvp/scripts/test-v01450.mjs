import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const api=read('functions/api/admin/customer-analytics.js');
const admin=read('public/admin.js');
const html=read('public/admin.html');
const road=read('VISIOND-ROADMAP.md');
const checks=[
 ['conversion payload',api.includes('conversion:{people:fp,rates,bottleneck')],
 ['view/cart rate',api.includes('view_to_cart')],
 ['checkout/paid rate',api.includes('checkout_to_paid')],
 ['buyer mix',api.includes('new_buyers')&&api.includes('returning_buyers')],
 ['minimum evidence',api.includes("filter(x=>x.from>=5)")],
 ['admin panel',html.includes('conversionDiagnostics')&&admin.includes('Conversion Intelligence')],
 ['roadmap rotation',road.includes('NEXT — Product/Production')],
 ['version',read('VERSION.txt').trim()==='v0.14.50']
];
let fail=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fail++}if(fail)process.exit(1);
