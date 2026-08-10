import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
import {verifyMetaSignature,withinMetaReplyWindow} from '../functions/_meta_messenger.js';
const read=p=>fs.readFileSync(p,'utf8'),raw='{"object":"page","entry":[]}',secret='meta-app-secret-for-test-only-123456';
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const ledger=JSON.parse(read('requirements-ledger.json')),webhook=read('functions/api/meta/messenger.js'),core=read('functions/_meta_messenger.js'),schema=read('migrations/0019_elon_page_meta_webhook.sql'),road=read('VISIOND-ROADMAP.md');let fail=0;
const checks=[
 ['version',Number(read('VERSION.txt').trim().split('.').at(-1))>=53],
 ['valid signature accepted',await verifyMetaSignature(secret,raw,`sha256=${sig}`)],
 ['invalid signature rejected',!await verifyMetaSignature(secret,raw,`sha256=${'0'.repeat(64)}`)],
 ['payload size and page object guard',webhook.includes('1024*1024')&&webhook.includes("payload?.object!=='page'")],
 ['webhook dedupe',schema.includes('event_key TEXT PRIMARY KEY')&&core.includes('ON CONFLICT(event_key) DO UPDATE')],
 ['participant encrypted',core.includes('encryptMetaParticipant')&&core.includes('participant_ciphertext')&&core.includes("conversationId,participantHash,'',ciphertext,eventAt")],
 ['configured page recipient guard',core.includes('META_PAGE_ID')&&core.includes('recipient!==expectedPage')],
 ['24-hour helper',withinMetaReplyWindow(new Date(Date.now()-3600000).toISOString().replace('T',' ').slice(0,19))&&!withinMetaReplyWindow(new Date(Date.now()-25*3600000).toISOString().replace('T',' ').slice(0,19))],
 ['ledger statuses',ledger.requirements.length>=20&&ledger.requirements.every(x=>x.id&&x.source&&x.status)],
 ['no missing or uncertain',!ledger.requirements.some(x=>['MISSING','UNCERTAIN'].includes(x.status))],
 ['anti-drop roadmap',road.includes('Requirement Ledger')&&road.includes('Patch Coverage Check')&&road.includes('ห้ามปิด Event Case')]
];for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)fail++}if(fail)process.exit(1);
