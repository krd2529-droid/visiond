import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureDatabase} from '../functions/_schema.js';
import {ensureTikTokAnalyzerSchema} from '../functions/_tiktok_analyzer.js';
import {ensureVxAccess,VX_PLANS,vxAccess,requireVxUser,vxChannelInsert,vxChannelRestore} from '../functions/_vx_access.js';
import {requireAdmin} from '../functions/_lib.js';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {onRequestGet as catalog} from '../functions/api/vtools.js';
import {grantOrder} from '../functions/_orders.js';
import {onRequestPost as marketplace} from '../functions/api/admin/tiktok-connections/marketplace.js';
import {onRequestPost as analyzer} from '../functions/api/admin/tiktok-analyzer/index.js';

const sqlite=new DatabaseSync(':memory:');
class Bound{
  constructor(sql){this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}
}
const DB={prepare:s=>new Bound(s),exec:async s=>sqlite.exec(s),async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const env={DB};await ensureDatabase(env);await ensureTikTokAnalyzerSchema(env);await ensureVxAccess(env);
for(let id=1;id<=4;id++){
  sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,'test',?)").run(id,`vx${id}@example.invalid`,`VX Test ${id}`,id===4?'admin':'customer');
  sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(`vx-${id}`,id);
}
const ctx=(path,id=1,body,form=false)=>({env,request:new Request('https://visiondonline.com'+path,{method:body?'POST':'GET',headers:{cookie:`vd_session=vx-${id}`,...(body&&!form?{'content-type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined})});
const buy=async(slug,id=1,extra={})=>{const r=await checkout(ctx('/api/orders',id,{productSlugs:[slug],...extra}));return {...await r.json(),status:r.status}};
const approve=async id=>{sqlite.prepare("UPDATE orders SET status='pending_review' WHERE id=?").run(id);return grantOrder(env,sqlite.prepare('SELECT * FROM orders WHERE id=?').get(id))};
const products=await (await catalog(ctx('/api/vtools'))).json();
assert.deepEqual(products.items.map(x=>[x.account_limit,x.price]),[[10,49000],[20,98000],[30,129000]]);
assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections'))).error.status,403);
const first=await buy(VX_PLANS[0].slug,1,{price:1,total:1});assert.equal(first.status,201,JSON.stringify(first));assert.equal(first.total,49000);
assert.equal((await vxAccess(env,{id:1,role:'customer'})).active,false);
assert.equal((await buy(VX_PLANS[1].slug)).status,409,'pending VX purchase blocks second order');
assert.equal(await approve(first.id),1);
const grant=sqlite.prepare('SELECT * FROM vx_access_grants WHERE order_id=?').get(first.id);
assert.equal(Date.parse(grant.expires_at)-Date.parse(grant.starts_at),30*86400000);
assert.equal(await grantOrder(env,sqlite.prepare('SELECT * FROM orders WHERE id=?').get(first.id)),0,'approval replay');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vx_access_grants').get().n,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM entitlements WHERE product_id=?').get(products.items[0].id).n,0,'no permanent download entitlement');
assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections'))).vx.account_limit,10);
assert.equal((await requireAdmin(ctx('/api/admin/users'))).error.status,403,'purchase never gives admin role');
assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections',2))).error.status,403,'owner isolation');
assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections',4))).vx.admin,true);
for(let n=0;n<10;n++)assert.equal((await vxChannelInsert(env,1,10,`ch-${n}`,'Test').run()).meta.changes,1);
assert.equal((await vxChannelInsert(env,1,10,'ch-11','Test').run()).meta.changes,0);
assert.equal((await vxChannelRestore(env,1,10,'ch-0','Same').run()).meta.changes,1,'existing active channel can reconnect at limit');
sqlite.prepare("UPDATE tiktok_channels SET archived_at=CURRENT_TIMESTAMP WHERE id='ch-0'").run();
assert.equal((await vxChannelInsert(env,1,10,'ch-new','Test').run()).meta.changes,1);
assert.equal((await vxChannelRestore(env,1,10,'ch-0','Test').run()).meta.changes,0,'restore cannot bypass quota');
assert.equal((await marketplace(ctx('/api/admin/tiktok-connections/marketplace',1,{connection_id:'someone-else',channel_id:'other'}))).status,404,'paid users cannot search through another owner');
const manual=new FormData();manual.set('action','save_channel');manual.set('channel_name','Bypass');assert.equal((await analyzer(ctx('/api/admin/tiktok-analyzer',1,manual,true))).status,400,'manual channel cannot bypass quota');
await vxChannelInsert(env,1,null,'over-limit','Test').run();
assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections'))).error.status,403,'downgrade overquota blocks use');
assert.ok(!(await requireVxUser(ctx('/api/admin/tiktok-analyzer'))).error,'overquota owners can list channels to remove excess');
sqlite.prepare("DELETE FROM tiktok_channels WHERE id='over-limit'").run();
const renewal=await buy(VX_PLANS[1].slug);assert.equal(renewal.status,201,JSON.stringify(renewal));assert.equal(renewal.total,98000);await approve(renewal.id);
const next=sqlite.prepare('SELECT * FROM vx_access_grants WHERE order_id=?').get(renewal.id);assert.equal(next.starts_at,grant.expires_at);assert.equal((await vxAccess(env,{id:1,role:'customer'})).account_limit,10);
sqlite.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(first.id);assert.equal((await vxAccess(env,{id:1,role:'customer'})).active,false,'refund revokes current rights');
const third=await buy(VX_PLANS[2].slug,2);assert.equal(third.total,129000);await approve(third.id);
sqlite.prepare("UPDATE vx_access_grants SET expires_at=CURRENT_TIMESTAMP WHERE order_id=?").run(third.id);assert.equal((await requireVxUser(ctx('/api/admin/tiktok-connections',2))).error.status,403,'exact expiry boundary');
const remove=new FormData();remove.set('action','delete_channel');assert.ok(!(await requireVxUser(ctx('/api/admin/tiktok-analyzer',2,remove,true))).error,'expired owners may remove channels');
assert.ok(!(await requireVxUser(ctx('/api/admin/tiktok-connections',2,{action:'disconnect'}))).error,'expired owners may revoke consent');
const mixed=await buy(VX_PLANS[0].slug,3,{productSlugs:[VX_PLANS[0].slug,VX_PLANS[1].slug]});assert.equal(mixed.status,400);
assert.equal((await buy(VX_PLANS[0].slug,3,{quantities:{[VX_PLANS[0].slug]:2}})).status,409);
sqlite.prepare("INSERT INTO products(slug,title,price,category,product_kind,status) VALUES('ordinary-test','Ordinary',10000,'digital-product','product','published')").run();
const ordinary=await buy('ordinary-test',3);assert.equal(ordinary.status,201,JSON.stringify(ordinary));await approve(ordinary.id);assert.equal((await buy('ordinary-test',3)).status,409,'ordinary permanent products stay protected');
console.log('PASS Vtools: catalog, all prices, checkout tamper protection, pending guard, real payment grant/replay, renewal, refund, expiry, quota, restore, owner isolation and admin separation');
export {env};
