import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {ensureDatabase} from '../functions/_schema.js';
import {ensureVision7Schema} from '../functions/_vision7_schema.js';
import {catalogPageQuery,onRequestGet} from '../functions/api/vision7/apps/index.js';

const sqlite=new DatabaseSync(':memory:');
class Bound{constructor(sql){this.sql=sql;this.args=[]}bind(...args){this.args=args;return this}async first(){return sqlite.prepare(this.sql).get(...this.args)||null}async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}
const env={DB:{prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql)}};
await ensureDatabase(env);await ensureVision7Schema(env);
const migration=await readFile(new URL('../migrations/0139_vtools_catalog_indexes.sql',import.meta.url),'utf8');sqlite.exec(migration);sqlite.exec(migration);
const kinds=['windows','mac','web','android','veasy','cross-platform'];
for(let id=1;id<=64;id++){
  const kind=kinds[id%kinds.length],name=id===61?'พิเศษกลางชื่อเครื่องมือ':`เครื่องมือ ${String(id).padStart(3,'0')}`;
  sqlite.prepare('INSERT INTO vision7_programs(id,code,platform_type,app_name,app_description) VALUES(?,?,?,?,?)').run(id,`tool-${id}`,kind,name,id===60?'วิเคราะห์ค่าคอมแบบพิเศษ':'เครื่องมือทั่วไป');
  sqlite.prepare("INSERT INTO vision7_releases(program_id,version,minimum_version,object_key,file_name,file_size,sha256) VALUES(?,'1.0.0','1.0.0',?, 'test.zip',100,?)").run(id,`test-${id}.zip`,`${id}`.repeat(64).slice(0,64));
}
const request=(params={})=>new Request(`https://visiondonline.com/api/vision7/apps?${new URLSearchParams(params)}`);
async function page(params={}){const response=await onRequestGet({env,request:request(params)});return{status:response.status,data:await response.json()}}
const first=await page({category:'desktop',limit:'7'});assert.equal(first.status,200);assert.equal(first.data.items.length,7);assert.ok(first.data.items.every(row=>['windows','mac'].includes(row.platform_type)));let cursor=first.data.next_cursor,ids=first.data.items.map(row=>row.id);
while(cursor){const next=await page({category:'desktop',limit:'7',cursor});ids.push(...next.data.items.map(row=>row.id));assert.ok(next.data.items.length<=7);cursor=next.data.next_cursor}assert.equal(ids.length,new Set(ids).size,'keyset pages never duplicate');assert.equal(ids.length,21,'keyset pages retain every desktop app');
const reused=await page({category:'mobile',cursor:first.data.next_cursor});assert.equal(reused.status,400,'cursor cannot cross platform groups');
assert.equal((await page({category:'desktop',q:'กลางชื่อ',cursor:first.data.next_cursor})).status,400,'cursor cannot cross search terms');assert.equal((await page({category:'desktop',limit:'25'})).status,400,'more than 24 rows per request is rejected');assert.equal((await page({category:'desktop',cursor:'not-a-cursor'})).status,400,'malformed cursor is rejected');
const full=await page({category:'desktop',q:'กลางชื่อ'});assert.deepEqual(full.data.items.map(row=>row.id),[61],'indexed trigram finds middle of Thai title');const desc=await page({category:'desktop',q:'พิเศษ'});assert.deepEqual(desc.data.items.map(row=>row.id),[61,60],'trigram finds title and description');const description=await page({category:'desktop',q:'ค่าคอม'});assert.deepEqual(description.data.items.map(row=>row.id),[60],'trigram finds description substring');const code=await page({category:'desktop',q:'tool-55'});assert.deepEqual(code.data.items.map(row=>row.id),[55],'trigram finds code substring');
const short=await page({category:'desktop',q:'เค'});assert.match(short.data.search_note,/ต้นชื่อ/);
let shortCursor=(await page({category:'desktop',q:'เค',limit:'5'})).data.next_cursor,shortIds=[];while(shortCursor){const result=await page({category:'desktop',q:'เค',limit:'5',cursor:shortCursor});shortIds.push(...result.data.items.map(item=>item.id));shortCursor=result.data.next_cursor}assert.equal(shortIds.length,new Set(shortIds).size,'short prefix keyset does not duplicate');
const other=await page({category:'web'});assert.equal(other.data.has_other,true,'unknown or cross-platform group only appears when published');
for(const [params,indexName] of [[{category:'desktop'},'idx_v7_storefront_group_id'],[{category:'all'},'idx_v7_storefront_active_id'],[{category:'desktop',q:'เค'},'idx_v7_storefront_group_name']]){const {sql,args}=catalogPageQuery(params),plan=sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>row.detail).join(' ');assert.match(plan,new RegExp(indexName),plan)}
const fullPlan=catalogPageQuery({category:'desktop',q:'กลางชื่อ'}),explain=sqlite.prepare(`EXPLAIN QUERY PLAN ${fullPlan.sql}`).all(...fullPlan.args).map(row=>row.detail).join(' ');assert.match(explain,/VIRTUAL TABLE INDEX/,explain);
sqlite.prepare("UPDATE vision7_programs SET app_name='เปลี่ยนชื่อใหม่' WHERE id=61").run();assert.equal((await page({category:'desktop',q:'กลางชื่อ'})).data.items.length,0,'trigger invalidates old search tokens');assert.deepEqual((await page({category:'desktop',q:'ชื่อใหม่'})).data.items.map(row=>row.id),[61],'trigger indexes changed name');
console.log('PASS Vtools catalog: bounded grouped keyset, cursor isolation, FTS5 substring/indexes, trigger invalidation');
