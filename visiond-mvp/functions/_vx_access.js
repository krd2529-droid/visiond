import {json, requireUser} from './_lib.js';

export const VX_PLANS = [
  {slug:'vx-30-days-10', account_limit:10, price:49000},
  {slug:'vx-30-days-20', account_limit:20, price:98000},
  {slug:'vx-30-days-30', account_limit:30, price:129000},
].map(plan=>({...plan, duration_days:30, title:`VX · ${plan.account_limit} บัญชี · 30 วัน`}));
const ready = new WeakSet();
export async function ensureVxAccess(env) {
  if(ready.has(env.DB)) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vx_access_grants (
    order_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, plan_slug TEXT NOT NULL,
    account_limit INTEGER NOT NULL CHECK(account_limit IN (10,20,30)),
    starts_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_vx_access_user ON vx_access_grants(user_id,expires_at)').run();
  await env.DB.batch(VX_PLANS.map(plan=>env.DB.prepare(`INSERT INTO products
    (slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
    VALUES(?,?,?,?,?,'/assets/vx-vtools.svg','[]','vtools','สิทธิ์ใช้งาน',0,'published','vtools','vx-access')
    ON CONFLICT(slug) DO UPDATE SET title=excluded.title,price=excluded.price,product_kind='vx-access',category='vtools'`)
    .bind(plan.slug,plan.title,`เชื่อม TikTok สูงสุด ${plan.account_limit} บัญชี อายุสิทธิ์ 30 วัน`,
      'เริ่มเมื่อยืนยันชำระเงิน หากมีสิทธิ์เหลือ แพ็กเกจใหม่เริ่มต่อจากวันหมดอายุเดิม ไม่บวกจำนวนบัญชี',plan.price)));
  ready.add(env.DB);
}
export function vxGrantStatement(env, order, slug) {
  const plan=VX_PLANS.find(p=>p.slug===slug);
  if(!plan) throw new Error('VX_PLAN_INVALID');
  return env.DB.prepare(`INSERT OR IGNORE INTO vx_access_grants(order_id,user_id,plan_slug,account_limit,starts_at,expires_at)
    SELECT ?,?,?,?,start_at,datetime(start_at,'+30 days') FROM (
      SELECT MAX(CURRENT_TIMESTAMP,COALESCE(MAX(g.expires_at),CURRENT_TIMESTAMP)) start_at
      FROM vx_access_grants g JOIN orders o ON o.id=g.order_id AND o.status='paid' WHERE g.user_id=?
    ) WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND user_id=? AND status='pending_review')`)
    .bind(order.id,order.user_id,plan.slug,plan.account_limit,order.user_id,order.id,order.user_id);
}
export async function vxAccess(env, user) {
  await ensureVxAccess(env);
  if(['boss','admin'].includes(user.role)) return {active:true,admin:true,account_limit:null};
  const grant=await env.DB.prepare(`SELECT g.* FROM vx_access_grants g JOIN orders o ON o.id=g.order_id
    WHERE g.user_id=? AND o.status='paid' AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP
    ORDER BY g.expires_at DESC LIMIT 1`).bind(user.id).first();
  return grant?{...grant,active:true,admin:false}:{active:false,admin:false,account_limit:0};
}
export async function requireVxUser(ctx) {
  const auth=await requireUser(ctx); if(auth.error) return auth;
  const access=await vxAccess(ctx.env,auth.user);
  const url=new URL(ctx.request.url),path=url.pathname.replace(/\/$/,'');
  // Owners must still be able to remove channels and revoke consent after expiry.
  if(path==='/api/admin/tiktok-analyzer'){
    if(ctx.request.method==='GET'&&!url.searchParams.get('channel_id')&&!url.searchParams.get('run_id'))return {...auth,vx:access};
    if(ctx.request.method==='POST'&&(await ctx.request.clone().formData().catch(()=>null))?.get('action')==='delete_channel')return {...auth,vx:access};
  }
  if(path==='/api/admin/tiktok-connections'&&ctx.request.method==='POST'){
    const body=await ctx.request.clone().json().catch(()=>null);
    if(['disconnect','shop_disconnect'].includes(body?.action))return {...auth,vx:access};
  }
  if(!access.active) return {error:json({error:'ไม่มีสิทธิ์ VX ที่ใช้งานอยู่หรือสิทธิ์หมดอายุ กรุณาเลือกแพ็กเกจที่ Vtools',code:'VX_ACCESS_REQUIRED',url:'/vtools'},403)};
  if(!access.admin){
    const count=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM tiktok_channels WHERE created_by=? AND archived_at IS NULL').bind(auth.user.id).first();
    if(Number(count?.count)>access.account_limit)return {error:json({error:`มีช่องเกินสิทธิ์ ${access.account_limit} บัญชี กรุณาลบช่องส่วนเกินออกก่อนใช้งาน`,code:'VX_ACCOUNT_LIMIT'},403)};
  }
  return {...auth,vx:access};
}

// Conditional writes prevent concurrent OAuth callbacks from exceeding the quota.
export function vxChannelInsert(env, userId, limit, id, name) {
  return env.DB.prepare(`INSERT INTO tiktok_channels(id,name,channel_url,handle,created_by)
    SELECT ?,?,'','',? WHERE ? IS NULL OR
    (SELECT COUNT(*) FROM tiktok_channels WHERE created_by=? AND archived_at IS NULL)<?`)
    .bind(id,name,userId,limit,userId,limit);
}
export function vxChannelRestore(env, userId, limit, id, name) {
  return env.DB.prepare(`UPDATE tiktok_channels SET name=?,archived_at=NULL,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND created_by=? AND (archived_at IS NULL OR ? IS NULL OR
    (SELECT COUNT(*) FROM tiktok_channels WHERE created_by=? AND archived_at IS NULL)<?)`)
    .bind(name,id,userId,limit,userId,limit);
}
