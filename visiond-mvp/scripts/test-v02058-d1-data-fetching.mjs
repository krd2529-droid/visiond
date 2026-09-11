import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [analyzerApi,analyzerClient,analyzerSchema,adminApi,adminClient,sampleClient,vision4,vision4Client,notes,links,trash,webhooks,webhookClient,previews,migration,tiktokHtml,notesHtml,linksHtml]=await Promise.all([
  read('functions/api/admin/tiktok-analyzer/index.js'),read('public/tiktok-analyzer.js'),read('functions/_tiktok_analyzer.js'),read('functions/api/admin/products/index.js'),read('public/admin.js'),read('public/product-sample-archive.js'),read('functions/api/admin/vision4-review/index.js'),read('public/vision3.js'),read('functions/api/admin/work-notes/index.js'),read('functions/api/admin/work-links/index.js'),read('functions/api/admin/trash/index.js'),read('functions/api/admin/webhook-hub.js'),read('public/webhook-hub.js'),read('functions/api/admin/product-previews.zip.js'),read('migrations/0088_tiktok_analyzer_pagination.sql'),read('public/tiktok-analyzer.html'),read('public/work-notes.html'),read('public/work-links.html'),
]);

assert.match(analyzerApi,/const PAGE_SIZE=24/);
for(const token of ["resource==='inventory'","resource==='products'","resource==='events'","resource==='runs'",'product_cursor','event_cursor','run_cursor','LIMIT ?'])assert.ok(analyzerApi.includes(token),token);
assert.doesNotMatch(analyzerApi,/tiktok_product_events[^;]+LIMIT 1000/);
assert.equal((analyzerClient.match(/resource=overview/g)||[]).length,1,'channel selection must issue one bounded overview request');
assert.equal((analyzerClient.match(/resource=inventory/g)||[]).length,1,'all inventory refreshes must share one bounded request helper');
assert.doesNotMatch(analyzerClient,/tiktok-analyzer\?channel_id=\$\{encodeURIComponent\([^)]*\)\}`/,'bare heavy channel aggregate must be removed');
assert.match(analyzerClient,/pending\?\.version===version/,'identical in-flight inventory requests must deduplicate');
assert.match(analyzerClient,/invalidateChannelInventory/,'product mutations must invalidate only the selected channel inventory cache');
assert.match(analyzerClient,/inventory=await selectChannelBase\(state\.selected, context\)/,'selection wrapper must reuse the base response for its captured channel');
for(const token of ['data-load-more-inventory','loadMoreInventoryResource','data-load-more-channels','inventory_counts'])assert.ok(analyzerClient.includes(token),token);
assert.ok(!analyzerClient.includes('loadMoreRuns'),'retired history UI does not fetch older runs; backend pagination remains covered above');
assert.match(analyzerApi,/channel_id=\? AND name_key=\?/,'normalized product matching must use the indexed canonical key');assert.match(analyzerSchema,/idx_tiktok_products_channel_name_key/);assert.match(migration,/idx_tiktok_products_channel_name_key/);

assert.match(adminApi,/Math\.min\(24/);
assert.doesNotMatch(adminApi,/\?500|:500/);
assert.doesNotMatch(adminClient,/limit:'500'|loadAllProductOptions/);
assert.match(adminClient,/purpose:'options',limit:'24'/);
for(const token of ['productOptionsNextCursor','loadMoreUnlockProducts','bundleProductLoadMore',"params.set\\('cursor'"])assert.ok(new RegExp(token).test(adminClient),token);
assert.match(adminClient,/invalidateProductList\(\).*productOptions=\[\].*productOptionsQuery=""/s,'mutations must invalidate only the product catalog caches');
assert.match(adminClient,/const bundleSelectedProducts = new Map\(\)/,'bundle selections must live outside replaceable search-result DOM');
assert.match(adminClient,/refreshBundleOptions\(append=false,preserveSelection=true\)\{if\(preserveSelection\)syncBundleSelectionFromDom\(\)/,'bundle search must persist visible selections before replacing results');
assert.match(adminClient,/bundleSelectedProducts\.clear\(\);bundleProductSearch\.value='';refreshBundleOptions\(false,false\)/,'category reset must not rehydrate stale checked DOM into the cleared selection');
assert.match(adminClient,/for\(const item of d\.bundle_items\|\|\[\]\)bundleSelectedProducts\.set/,'edit flow must hydrate every saved bundle item');
assert.match(adminClient,/bundleSelectedProducts\.set\(Number\(item\.id\),item\);\s*await refreshBundleOptions\(false,false\)/,'edit hydration must not be overwritten by stale prior editor DOM');
assert.match(adminClient,/merged=new Map\(\[\.\.\.bundleSelectedProducts\.values\(\),\.\.\.productOptions\]/,'selected products must remain rendered across server searches and cursor pages');
assert.match(adminClient,/selected = \[\.\.\.bundleSelectedProducts\.keys\(\)\]\.map\(String\)/,'bundle submission must serialize persistent selection rather than only current DOM inputs');
assert.match(adminClient,/for\(const item of d\.bundle_items\|\|\[\]\)bundleSelectedProducts\.set/,'editing a bundle must hydrate all saved selections before bounded search');
const syncBundleSource=adminClient.match(/function syncBundleSelectionFromDom\(\)\{[^\n]+\}/)?.[0];assert.ok(syncBundleSource,'bundle selection synchronizer must remain directly testable');const optionPage=[{id:101,title:'first search'}],visibleInputs=[{value:'101',checked:true}],persistentSelection=new Map(),syncBundleSelection=new Function('productOptions','bundleProductPicker','bundleSelectedProducts',`${syncBundleSource};return syncBundleSelectionFromDom`) (optionPage,{querySelectorAll:()=>visibleInputs},persistentSelection);syncBundleSelection();assert.deepEqual([...persistentSelection.keys()],[101]);optionPage.splice(0,1,{id:202,title:'second search'});visibleInputs.splice(0,1);assert.equal(persistentSelection.get(101).title,'first search','selection from first server search must survive replacement by a second result page');assert.deepEqual([...new Map([...persistentSelection.values(),...optionPage].map(item=>[Number(item.id),item])).keys()],[101,202],'persistent selections and new search results must render together');
assert.match(sampleClient,/purpose:'sample',limit:'24'/);
assert.match(sampleClient,/params\.set\('q'/,'sample search must execute server-side');
assert.doesNotMatch(sampleClient,/do\{[^]*next_cursor/,'sample dialog must not exhaust every catalog cursor');
for(const source of [vision4,notes,trash,webhooks]){assert.match(source,/Math\.min\(24/);assert.match(source,/LIMIT \?/)}
assert.match(links,/\^\(\?:\[1-9\]\|1\\d\|2\[0-4\]\)\$/);assert.match(links,/LIMIT \?/);assert.doesNotMatch(links,/CREATE TABLE|ALTER TABLE/);
assert.match(vision4Client,/data-v4-draft-next/);assert.match(vision4Client,/data-v4-pending-next/);assert.match(adminClient,/data-trash-more/);assert.match(webhookClient,/data-more/);
assert.match(previews,/productLimit=24/);assert.match(previews,/id<\?/);assert.match(previews,/LIMIT \?/);assert.match(adminClient,/previewExportCursor/);
assert.match(tiktokHtml,/tiktok-analyzer\.js\?v=02156/);assert.match(notesHtml,/work-notes\.js\?v=02058/);assert.match(linksHtml,/work-links\.js\?v=02067/);
for(const index of ['idx_tiktok_products_channel_seen','idx_tiktok_product_events_channel_page','idx_tiktok_runs_channel_page']){assert.ok(analyzerSchema.includes(index));assert.ok(migration.includes(index))}

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE tiktok_channel_products(id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,last_seen_at TEXT NOT NULL,name TEXT NOT NULL COLLATE NOCASE,name_key TEXT NOT NULL DEFAULT '',UNIQUE(channel_id,name));
CREATE TABLE tiktok_product_events(id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,event_at TEXT NOT NULL);
CREATE TABLE tiktok_analysis_runs(id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_tiktok_products_channel_seen ON tiktok_channel_products(channel_id,last_seen_at DESC,id DESC);
CREATE INDEX idx_tiktok_products_channel_name_key ON tiktok_channel_products(channel_id,name_key);
CREATE INDEX idx_tiktok_product_events_channel_page ON tiktok_product_events(channel_id,event_at DESC,id DESC);
CREATE INDEX idx_tiktok_runs_channel_page ON tiktok_analysis_runs(channel_id,created_at DESC,id DESC);`);
for(let index=1;index<=61;index++){const id=String(index).padStart(3,'0'),at=`2026-08-${String(Math.ceil(index/3)).padStart(2,'0')} 00:00:00`;db.prepare('INSERT INTO tiktok_channel_products VALUES(?,?,?,?,?)').run(id,'channel-1',at,`สินค้า ${index}`,`สินค้า${index}`);db.prepare('INSERT INTO tiktok_product_events VALUES(?,?,?)').run(id,'channel-1',at);db.prepare('INSERT INTO tiktok_analysis_runs VALUES(?,?,?)').run(id,'channel-1',at)}
const assertKeyset=(table,timeColumn,indexName)=>{let cursor=null,ids=[];do{const where=cursor?` AND (${timeColumn}<? OR (${timeColumn}=? AND id<?))`:'',args=cursor?['channel-1',cursor.at,cursor.at,cursor.id,25]:['channel-1',25],sql=`SELECT id,${timeColumn} page_at FROM ${table} WHERE channel_id=?${where} ORDER BY ${timeColumn} DESC,id DESC LIMIT ?`,rows=db.prepare(sql).all(...args),page=rows.slice(0,24);ids.push(...page.map(row=>row.id));cursor=rows.length>24?{at:page.at(-1).page_at,id:page.at(-1).id}:null;const plan=db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>String(row.detail));assert.ok(plan.some(detail=>detail.includes(indexName)),plan.join('\n'))}while(cursor);assert.equal(ids.length,61);assert.equal(new Set(ids).size,61)};
assertKeyset('tiktok_channel_products','last_seen_at','idx_tiktok_products_channel_seen');
assertKeyset('tiktok_product_events','event_at','idx_tiktok_product_events_channel_page');
assertKeyset('tiktok_analysis_runs','created_at','idx_tiktok_runs_channel_page');
const matchSql="SELECT id,name FROM tiktok_channel_products WHERE id=COALESCE((SELECT id FROM tiktok_channel_products WHERE channel_id=? AND name_key=? LIMIT 1),(SELECT id FROM tiktok_channel_products WHERE channel_id=? AND name=? COLLATE NOCASE LIMIT 1))",matchPlan=db.prepare(`EXPLAIN QUERY PLAN ${matchSql}`).all('channel-1','สินค้า1','channel-1','สินค้า 1').map(row=>String(row.detail));assert.ok(matchPlan.some(detail=>detail.includes('idx_tiktok_products_channel_name_key')),matchPlan.join('\n'));assert.equal(db.prepare(matchSql).get('channel-1','สินค้า1','channel-1','สินค้า 1').id,'001');

console.log('v0.20.58 ฐ1 data-fetch regression tests passed');
