import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const src=readFileSync('public/tiktok-analyzer.js','utf8'),endpoint=readFileSync('functions/api/admin/tiktok-analyzer/index.js','utf8');
const cut=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const nodes=new Map(),make=()=>({hidden:false,dataset:{},innerHTML:'',textContent:'',querySelectorAll:()=>[],scrollIntoView(){},insertAdjacentHTML(){}}),$=q=>{if(!nodes.has(q))nodes.set(q,make());return nodes.get(q)};
const render={$,state:{},escapeHtml:String,arrayValue:x=>Array.isArray(x)?x:[],textValue:String,normalizeProductName:String,upgradeLegacyProductLinkCells(){}};
vm.createContext(render);vm.runInContext(cut(src,'function list(values, render)','function renderOwnedResult(')+cut(src,'function reconcileProductPrepInventory(','function renderReviewSchedule('),render);
render.renderResult({daily_product_list:Array.from({length:5},(_,i)=>({product:'Candidate'+i,product_type:'B',ranking_score:80}))});render.reconcileProductPrepInventory([]);
assert.doesNotMatch($('[data-list="plan"]').innerHTML,/Candidate|product-prep-item/,'original zero-kept candidate RED is green');
render.reconcileProductPrepInventory([{name:'Real kept',inventory_status:'kept',product_type:'D'},{name:'Not selected',inventory_status:'analyzed',product_type:'B'}]);
assert.match($('[data-list="plan"]').innerHTML,/Real kept/);assert.doesNotMatch($('[data-list="plan"]').innerHTML,/Not selected/);render.reconcileProductPrepInventory([]);assert.doesNotMatch($('[data-list="plan"]').innerHTML,/Real kept/);
for(const grade of ['D','D','B']){render.reconcileProductPrepInventory([{name:'Kept only',inventory_status:'kept',product_type:grade}]);assert.equal(($('[data-list="plan"]').innerHTML.match(/product-prep-item/g)||[]).length,1);assert.match($('#productPrepSummary').innerHTML,/1\/40/);assert.ok($('[data-list="plan"]').innerHTML.includes('grade-'+grade));}
render.reconcileProductPrepInventory([{name:'Kept only',inventory_status:'discarded',product_type:'F'}]);assert.doesNotMatch($('[data-list="plan"]').innerHTML,/Kept only/);assert.match($('#productPrepSummary').innerHTML,/0\/40/);

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE tiktok_analysis_runs(id TEXT PRIMARY KEY,created_at TEXT);CREATE TABLE tiktok_channel_products(id TEXT PRIMARY KEY,channel_id TEXT,name TEXT,name_key TEXT,product_url TEXT,product_type TEXT,source_kind TEXT,customer_gender TEXT,customer_age_range TEXT,score INTEGER,evidence TEXT,source_run_id TEXT,inventory_status TEXT DEFAULT 'analyzed',decided_at TEXT,review_started_at TEXT,next_review_at TEXT,review_cycle_days INTEGER,review_status TEXT,first_seen_at TEXT,last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(channel_id,name));CREATE TABLE tiktok_product_events(id TEXT,channel_id TEXT,product_name TEXT,event_type TEXT,product_type TEXT,inventory_status TEXT,detail TEXT,event_at TEXT,source_run_id TEXT);CREATE TABLE tiktok_channels(id TEXT,created_by INTEGER,archived_at TEXT);INSERT INTO tiktok_channels VALUES('A',1,NULL);`);
db.exec(readFileSync('migrations/0102_tiktok_kept_shortlist.sql','utf8'));
const adapter={prepare(sql){const st=db.prepare(sql);return{bind(...args){return{all:async()=>({results:st.all(...args)}),first:async()=>st.get(...args),run:async()=>st.run(...args),sql,args}}}},async batch(statements){db.exec('BEGIN');try{const out=statements.map(x=>db.prepare(x.sql).run(...x.args));db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
for(let i=0;i<60;i++)db.prepare('INSERT INTO tiktok_channel_products(id,channel_id,name,inventory_status,last_seen_at) VALUES(?,?,?,?,?)').run(String(i).padStart(3,'0'),i===59?'B':'A','P'+i,i<10?'analyzed':'kept','2026-09-11');
const api={};vm.createContext(api);vm.runInContext(cut(endpoint,'const PAGE_SIZE=24;','export async function onRequestGet'),api);
let cursor='',ids=[];do{const p=new URLSearchParams({limit:'24',...(cursor?{product_cursor:cursor}:{})}),page=await api.inventoryPage(adapter,'A',p,'shortlist');ids.push(...page.products.map(x=>x.id));cursor=page.pagination.products.next_cursor;}while(cursor);
assert.equal(ids.length,49);assert.equal(new Set(ids).size,49);assert.ok(ids.every(id=>Number(id)>=10&&Number(id)<59));
const plan=db.prepare("EXPLAIN QUERY PLAN SELECT id FROM tiktok_channel_products WHERE channel_id=? AND inventory_status='kept' AND (last_seen_at<? OR (last_seen_at=? AND id<?)) ORDER BY last_seen_at DESC,id DESC LIMIT ?").all('A','2026-09-11','2026-09-11','050',25);assert.match(JSON.stringify(plan),/idx_tiktok_products_channel_kept/);assert.doesNotMatch(JSON.stringify(plan),/TEMP B-TREE/);
assert.ok(readFileSync('functions/_tiktok_analyzer.js','utf8').includes('idx_tiktok_products_channel_kept'));

// Execute the exact analysis upsert against a decided row; no AI overwrite of provenance/review.
const upsert=endpoint.match(/`(INSERT INTO tiktok_channel_products\(id,channel_id,name,name_key,product_url,product_type,source_kind,customer_gender[^`]+)`/)[1];
for(const status of ['kept','discarded']){
 db.prepare("UPDATE tiktok_channel_products SET inventory_status=?,product_type=?,source_kind='sold_product_selection',score=7,evidence='real evidence',review_started_at='old',next_review_at='future',review_cycle_days=30,review_status='complete',last_seen_at='2020' WHERE id='010'").run(status,status==='kept'?'A':'F');
 const before=db.prepare("SELECT product_type,source_kind,score,evidence,review_started_at,next_review_at,review_cycle_days,review_status,last_seen_at FROM tiktok_channel_products WHERE id='010'").get();
 db.prepare(upsert).run('new','A','P10','p10','','B','candidate','','',99,'AI evidence','run','+3 days','+3 days',3,'scheduled');
 assert.deepEqual(db.prepare("SELECT product_type,source_kind,score,evidence,review_started_at,next_review_at,review_cycle_days,review_status,last_seen_at FROM tiktok_channel_products WHERE id='010'").get(),before);
}
const post={ctx:{env:{DB:adapter}},auth:{user:{id:1}},headers:{},crypto:{randomUUID:()=>crypto.randomUUID()},json:(body,status)=>({body,status})};
vm.createContext(post);vm.runInContext(cut(endpoint,'const text=','const PAGE_SIZE=24;')+`async function run(form,existingId){${cut(endpoint,"  if(action==='set_product_inventory'){","  if(action==='delete_channel'){").replace("if(action==='set_product_inventory')","if(true)")}}this.run=run;`,post);
for(const [id,type,kind,expected] of [['011','B','candidate','D'],['012','E','candidate','E'],['013','A','sold_product_selection','A']]){
 db.prepare("UPDATE tiktok_channel_products SET inventory_status='analyzed',product_type=?,source_kind=? WHERE id=?").run(type,kind,id);
 const out=await post.run(new Map([['product_name','P'+Number(id)],['product_type','A'],['inventory_status','kept']]),'A');assert.equal(out.status,200);assert.equal(db.prepare('SELECT product_type FROM tiktok_channel_products WHERE id=?').get(id).product_type,expected);
}
const denied=await post.run(new Map([['product_name','P11'],['inventory_status','kept']]),'B');assert.equal(denied.status,404);
const authQueries=[];const get={URL,ensureDatabase:async()=>{},ensureTikTokAnalyzerSchema:async()=>{},requireVxUser:async()=>({user:{id:1}}),headers:{'cache-control':'private, no-store'},text:x=>String(x||''),json:(body,status,headers)=>({body,status,headers})};
vm.createContext(get);vm.runInContext(cut(endpoint,'export async function onRequestGet','export async function onRequestPost').replace('export ',''),get);
const rejected=await get.onRequestGet({request:{url:'https://test/api/admin/tiktok-analyzer?channel_id=B&resource=shortlist'},env:{DB:{prepare:sql=>({bind:(...args)=>({first:async()=>{authQueries.push({sql,args});return null}})})}}});assert.equal(rejected.status,404);assert.equal(authQueries.length,1);assert.deepEqual(authQueries[0].args,['B',1]);assert.match(authQueries[0].sql,/c.created_by=\?/);assert.equal(rejected.headers['cache-control'],'private, no-store');
db.close();

// Actual loader: two internal pages, cap40, dedup, TTL, mutation invalidation, stale owner.
let calls=0,paints=0,hold=null;
const loader={pageViewerId:'owner',state:{},inventoryVersions:new Map(),shortlistRequests:new Map(),shortlistCache:new Map(),Date,URLSearchParams,escapeHtml:String,$,channelOwnership:{current:x=>x.channelId===loader.selected&&x.generation===loader.generation},selected:'A',generation:1,reconcileProductPrepInventory(){paints++},stampChannelOwnedActions(){},api:async url=>{calls++;if(hold)await hold;const p=new URL(url,'https://test').searchParams,start=p.get('product_cursor')?24:0,n=Number(p.get('limit'));return{channel_id:p.get('channel_id'),products:Array.from({length:n},(_,i)=>({id:String(start+i),inventory_status:'kept'})),pagination:{products:{has_more:true,next_cursor:String(start+n)}}}}};
vm.createContext(loader);vm.runInContext(cut(src,'async function refreshOwnedShortlist(','function channelContextFor('),loader);
await Promise.all([loader.refreshOwnedShortlist({channelId:'A',generation:1}),loader.refreshOwnedShortlist({channelId:'A',generation:1})]);assert.equal(calls,2);assert.equal(loader.state.shortlistProducts.length,40);assert.equal(loader.state.shortlistTruncated,true);
await loader.refreshOwnedShortlist({channelId:'A',generation:1});assert.equal(calls,2);
const key='owner:A';loader.shortlistCache.get(key).at=Date.now()-30001;await loader.refreshOwnedShortlist({channelId:'A',generation:1});assert.equal(calls,4,'expired TTL refreshes two bounded pages');
loader.inventoryVersions.set('A',1);await loader.refreshOwnedShortlist({channelId:'A',generation:1});assert.equal(calls,6);
let release;hold=new Promise(r=>release=r);loader.inventoryVersions.set('A',2);const pending=loader.refreshOwnedShortlist({channelId:'A',generation:1});const before=paints;loader.selected='B';loader.generation++;release();await pending;assert.equal(paints,before);assert.equal(calls,7,'stale selection must stop before next internal page');
console.log('PASS v93 actual empty/kept render, SQLite49-row keyset/index, decided upsert, D/E/sold grades, owner,40cap/dedup/TTL/invalidation/stale');
