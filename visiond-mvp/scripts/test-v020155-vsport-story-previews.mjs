import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet,onRequestPost} from '../functions/api/admin/vsport.js';

class Statement {
  constructor(owner,sql,args=[]){this.owner=owner;this.sql=sql;this.args=args}
  bind(...args){return new Statement(this.owner,this.sql,args)}
  async first(){return this.owner.db.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:this.owner.db.prepare(this.sql).all(...this.args)}}
  async run(){const result=this.owner.db.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes)}}}
}
class D1 {
  constructor(db){this.db=db}
  prepare(sql){return new Statement(this,sql)}
  async batch(statements){this.db.exec('BEGIN');try{for(const statement of statements)await statement.run();this.db.exec('COMMIT')}catch(error){this.db.exec('ROLLBACK');throw error}}
}

const db=new DatabaseSync(':memory:');
db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT); CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT); CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT); CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER); CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER,course_type TEXT); CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER); INSERT INTO users VALUES(1,'admin@example.com','admin','Admin','','admin','2026-01-01'); INSERT INTO sessions VALUES('admin-session',1,'2099-01-01');");
for(const migration of ['0111_vsport.sql','0115_vsport_project_delete.sql','0116_vsport_asset_delete.sql','0117_vsport_headline_lookup.sql','0118_vsport_script_people.sql','0119_vsport_script_subjects.sql','0120_vsport_story_previews.sql'])db.exec(await readFile(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
const env={DB:new D1(db)},waits=[],calls=[],originalFetch=globalThis.fetch;
const projectId=Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes,narration_script) VALUES(1,'Preview regression','2026-10-03','all_teams_for_day','',30,'ข่าวฟุตบอลวันนี้') RETURNING id").get().id);
const ids=[1,2,3].map(index=>Number(db.prepare("INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,?,'Premier League soccer match','Arsenal','Fixture',?,'2026-10-03','2026-10-03',?,0,?) RETURNING id").get(projectId,`Arsenal football article ${index}`,`https://news.example.test/article-${index}`,`article-${index}`,index*10).id));
const post=body=>onRequestPost({request:new Request('https://visiondonline.com/api/admin/vsport',{method:'POST',headers:{cookie:'vd_session=admin-session','content-type':'application/json'},body:JSON.stringify({project_id:projectId,...body})}),env,waitUntil(value){waits.push(value)}});
const detail=()=>onRequestGet({request:new Request(`https://visiondonline.com/api/admin/vsport?id=${projectId}&include=stories`,{headers:{cookie:'vd_session=admin-session'}}),env});

try {
  globalThis.fetch=async input=>{const url=new URL(String(input));assert.equal(url.host,'news.example.test');calls.push(url.pathname);const number=Number(url.pathname.split('-')[1]);return new Response(number===3?'<html>no image</html>':`<meta property="og:image" content="https://images.example.test/article-${number}-preview.jpg"><img src="https://images.example.test/article-${number}-alternate.jpg">`,{status:200,headers:{'content-type':'text/html'}})};
  const first=await post({action:'preview_news_stories',story_ids:ids});assert.equal(first.status,200);const items=(await first.json()).items;assert.deepEqual(items.map(item=>item.preview_status),['found','found','empty']);assert.deepEqual(items.map(item=>item.preview_image_url),['https://images.example.test/article-1-preview.jpg','https://images.example.test/article-2-preview.jpg','']);assert.equal(calls.length,3,'at most three article requests per preview batch');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vsport_image_candidates').get().n,0,'unchecked previews never create cover candidates');
  const page=(await(await detail()).json()).stories;assert.deepEqual(page.map(item=>item.preview_image_url),items.map(item=>item.preview_image_url));assert.ok(page.every(item=>item.selected===0));
  await post({action:'preview_news_stories',story_ids:ids});assert.equal(calls.length,3,'fresh project/story cache avoids duplicate fetches');
  db.prepare("UPDATE vsport_story_previews SET checked_at='2020-01-01T00:00:00Z' WHERE project_id=? AND story_id=?").run(projectId,ids[2]);await post({action:'preview_news_stories',story_ids:[ids[2]]});assert.equal(calls.length,4,'expired empty result is checked again');
  db.prepare("UPDATE vsport_stories SET source_url='https://news.example.test/article-22' WHERE id=?").run(ids[1]);const changed=(await(await detail()).json()).stories.find(item=>item.id===ids[1]);assert.equal(changed.preview_status,null,'changed article URL hides stale image');const refreshed=await post({action:'preview_news_stories',story_ids:[ids[1]]});assert.equal((await refreshed.json()).items[0].preview_image_url,'https://images.example.test/article-22-preview.jpg');assert.equal(calls.length,5);
  db.prepare('UPDATE vsport_stories SET selected=1 WHERE id=?').run(ids[0]);const signature=createHash('sha256').update(String(ids[0])).digest('hex').slice(0,16),key=`vsport:1:admin:${projectId}:nimg:1780000000001:cursor:start:selection:${signature}`;const job=await post({action:'discover_news_images',selected_story_ids:[ids[0]],news_cursor:'start',idempotency_key:key});assert.equal(job.status,202);await waits.shift();const candidates=db.prepare("SELECT story_id,source_url,source_page_url FROM vsport_image_candidates WHERE project_id=? AND story_association='news_cover' ORDER BY id").all(projectId);assert.deepEqual(candidates.map(row=>row.source_url),['https://images.example.test/article-1-preview.jpg','https://images.example.test/article-1-alternate.jpg']);assert.ok(candidates.every(row=>row.story_id===ids[0]&&row.source_page_url==='https://news.example.test/article-1'));assert.equal(calls.length,5,'fresh preview set avoids second article fetch after selection');
  const plan=db.prepare('EXPLAIN QUERY PLAN SELECT image_url FROM vsport_story_previews WHERE project_id=? AND story_id=?').all(projectId,ids[0]);assert.ok(plan.some(row=>String(row.detail).includes('sqlite_autoindex_vsport_story_previews_1')),'preview lookup uses project/story primary key');
  console.log('PASS v0.20.155 Step1 per-story previews, bounded fetch, TTL, stale source, selected-only cover alternatives, indexed lookup');
} finally {globalThis.fetch=originalFetch;db.close()}
