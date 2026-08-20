import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ensurePartnerSchema} from '../functions/_partner_api.js';
import {VisionDPartnerClient} from '../integrations/web2/visiond-partner-client.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.397');
assert.match(read('public/index.html'),/WEB v0\.14\.397/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.397/);

const calls=[];
const DB={prepare(sql){calls.push(sql);return {first:async()=>({version:66})}},async exec(){throw new Error('DDL_MUST_NOT_RUN')}};
await ensurePartnerSchema({DB});await ensurePartnerSchema({DB});
assert.deepEqual(calls,["SELECT version FROM runtime_schema_state WHERE schema_key='core'"],'ready partner schema must use one probe per isolate');

const endpoint=read('functions/api/partner/v1/products/index.js');
assert.match(endpoint,/const integer=\(value,fallback,min,max\)/);
assert.match(endpoint,/limit=integer\(url\.searchParams\.get\('limit'\),50,1,100\)/);
assert.match(endpoint,/cursor=integer\(url\.searchParams\.get\('cursor'\),0,0,Number\.MAX_SAFE_INTEGER\)/);
assert.match(endpoint,/pagination:\{limit,has_more:hasMore,next_cursor:/);
assert.match(endpoint,/p\.id>\?[\s\S]*?ORDER BY p\.id LIMIT \?/);

const requested=[];
const fetch=async url=>{const cursor=Number(new URL(url).searchParams.get('cursor'));requested.push(cursor);const start=cursor+1,end=Math.min(cursor+100,250),items=Array.from({length:Math.max(0,end-start+1)},(_,i)=>({id:start+i})),has_more=end<250;return new Response(JSON.stringify({items,pagination:{limit:100,has_more,next_cursor:has_more?end:null}}),{status:200,headers:{'content-type':'application/json'}})};
const client=new VisionDPartnerClient({baseUrl:'https://visiond.test/api/partner/v1',clientId:'client',clientSecret:'x'.repeat(16),fetch});
let total=0;for await(const page of client.productPages({limit:100}))total+=page.items.length;
assert.equal(total,250);assert.deepEqual(requested,[0,100,200]);

assert.match(read('VISIOND-PARTNER-API-PROTOCOL.md'),/Pagination:[\s\S]*?has_more/);
assert.match(read('docs/PARTNER-API-WEB2-INTEGRATION.md'),/productPages\(\)/);
console.log('PASS v0.14.397 partner products scale safety');
