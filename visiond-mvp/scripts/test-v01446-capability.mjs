import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const version=read('VERSION.txt');
const roadmap=read('VISIOND-ROADMAP.md');
const marketing=read('VISIOND-MARKETING-PLAN.md');
const data=read('CUSTOMER-DATA-ANALYSIS.md');
const protocol=read('JARVIS-PATCH-PROTOCOL.md');
const patch=read('PATCH-v0.14.46-LIVING-ROADMAP-DATA-PROTOCOL.md');
const checks=[
 ['version is v0.14.46 or newer',Number(version.trim().split('.').pop())>=46],
 ['roadmap living handoff',/IMPLEMENTED/i.test(roadmap)&&/DEPLOYED/i.test(roadmap)&&/VALIDATED/i.test(roadmap)],
 ['roadmap next phase retained',roadmap.includes('Conversion Intelligence')],
 ['marketing KPI plan',marketing.includes('Paid conversion rate')&&marketing.includes('ROAS')],
 ['data privacy rule',data.includes('Do not copy names, email, phone')&&data.includes('No production D1 customer dataset')],
 ['no fabricated production conclusion',protocol.includes('Never invent production findings')],
 ['every patch updates project brain',protocol.includes('Update roadmap statuses')&&protocol.includes('Update marketing plan')&&protocol.includes('Update customer-data analysis')],
 ['next phase auto proposal',protocol.includes('draft the next phase automatically')],
 ['patch note present',patch.includes('Base: v0.14.45 Ads Intelligence')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
