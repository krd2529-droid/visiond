import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bangkokDay,createDailySeoPages,DAILY_SEO_PAGE_LIMIT} from '../functions/_daily_seo.js';

assert.equal(DAILY_SEO_PAGE_LIMIT,5);
assert.equal(bangkokDay(new Date('2026-09-06T18:30:00Z')),'2026-09-07');

const state={runs:new Map(),batches:[],products:Array.from({length:7},(_,index)=>({id:index+1,slug:`worksheet-${index+1}`,title:`แบบฝึกหัดเสริมทักษะชุดที่ ${index+1}`,category:'worksheet',category_name:'แบบฝึกหัด'}))};
const DB={
  async exec(){},
  prepare(sql){
    const statement={sql,args:[],bind(...args){this.args=args;return this},async run(){
      if(sql.startsWith('INSERT OR IGNORE INTO daily_seo_runs')){const [day,limit]=this.args;if(state.runs.has(day))return{meta:{changes:0}};state.runs.set(day,{run_day:day,requested_limit:limit,created_count:0,page_ids:'[]',status:'running'});return{meta:{changes:1}}}
      if(sql.startsWith("UPDATE daily_seo_runs SET status='running'")){state.runs.get(this.args[0]).status='running';return{meta:{changes:1}}}
      if(sql.startsWith("UPDATE daily_seo_runs SET status='failed'")){const [error,day]=this.args;Object.assign(state.runs.get(day),{status:'failed',error_code:error});return{meta:{changes:1}}}
      return{meta:{changes:1}};
    },async first(){
      if(sql.startsWith('SELECT run_day'))return state.runs.get(this.args[0]);
      if(sql.includes("FROM users WHERE role IN"))return{id:1};
      if(sql.includes("FROM sales_page_templates WHERE page_type='seo_automation'"))return{id:2};
      return null;
    },async all(){if(sql.includes('FROM products p LEFT JOIN categories'))return{results:state.products.slice(0,this.args[0])};return{results:[]}}};
    return statement;
  },
  async batch(statements){
    state.batches.push(statements);
    const finish=statements.at(-1);if(finish.sql.startsWith("UPDATE daily_seo_runs SET status='completed'")){const [count,pageIds,day]=finish.args;Object.assign(state.runs.get(day),{status:'completed',created_count:count,page_ids:pageIds,completed_at:'now'})}
    return statements.map(()=>({success:true}));
  }
};

const env={DB},now=new Date('2026-09-06T18:30:00Z');
const first=await createDailySeoPages(env,{now,limit:99});
assert.equal(first.created_count,5,'hard limit must stay at five pages');
assert.equal(first.slugs.length,5);
assert.equal(new Set(first.slugs).size,5,'generated slugs must be unique');
assert.equal(state.batches[0].filter(item=>item.sql.startsWith('INSERT INTO sales_pages')).length,5);
for(const statement of state.batches[0].filter(item=>item.sql.startsWith('INSERT INTO sales_pages'))){
  assert.match(statement.sql,/'published',1/,'daily pages publish and become indexable atomically');
}
const retry=await createDailySeoPages(env,{now});
assert.equal(retry.already_ran,true);
assert.equal(retry.created_count,5);
assert.equal(state.batches.length,1,'a retry on the same Bangkok day must not create more pages');

const endpoint=fs.readFileSync(new URL('../functions/api/internal/daily-seo-pages.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/maintenance/src/index.js',import.meta.url),'utf8');
const sitemap=fs.readFileSync(new URL('../functions/sitemap.xml.js',import.meta.url),'utf8');
for(const token of ['SEO_AUTOMATION_TOKEN','DAILY_SEO_PAGE_LIMIT','ใช้ POST เท่านั้น'])assert.ok(endpoint.includes(token),token);
for(const token of ['daily-seo-pages','SEO_AUTOMATION_TOKEN'])assert.ok(worker.includes(token),token);
for(const token of ["page_type='seo_automation'","robots_index=1",'approved_revision_no=revision_no'])assert.ok(sitemap.includes(token),token);
console.log('PASS v0.20.51 daily SEO creates at most five real-product pages and retries idempotently');
