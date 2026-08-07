import {json} from '../../_lib.js';
import {rateLimit,verifyTurnstile,verifyPassword,hashPassword,securityLog} from '../../_security.js';

export async function onRequestPost(ctx){
  if(!ctx.env.DB)return json({error:'ยังไม่ได้เชื่อมฐานข้อมูลสมาชิก'},503);
  const userColumns=(await ctx.env.DB.prepare('PRAGMA table_info(users)').all()).results.map(column=>column.name);
  if(!userColumns.includes('username'))await ctx.env.DB.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
  if(!userColumns.includes('phone'))await ctx.env.DB.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  await ctx.env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await ctx.env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_rate_limits (rate_key TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 0,window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,blocked_until TEXT)`).run();
  await ctx.env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'info',user_id INTEGER,ip TEXT,path TEXT,detail TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  const b=await ctx.request.json().catch(()=>({}));
  const login=String(b.login||b.email||'').trim().toLowerCase();
  const bossIdentities=new Set(['visiondboss','krd2529@gmail.com','krd2529+boss@gmail.com']);
  const isBossLogin=bossIdentities.has(login);
  if(!isBossLogin){const limited=await rateLimit(ctx.env,ctx.request,'login',5,15,30);if(limited.error)return limited.error;}
  const turnstile=await verifyTurnstile(ctx.env,ctx.request,b.turnstile_token);if(turnstile.error)return turnstile.error;
  if(!login||!b.password)return json({error:'กรุณากรอกไอดีและรหัสผ่าน'},400);
  const u=isBossLogin
    ?await ctx.env.DB.prepare("SELECT * FROM users WHERE lower(username)='visiondboss' OR lower(email) IN ('krd2529@gmail.com','krd2529+boss@gmail.com') OR role='boss' ORDER BY CASE WHEN lower(username)='visiondboss' THEN 0 WHEN lower(email) IN ('krd2529@gmail.com','krd2529+boss@gmail.com') THEN 1 ELSE 2 END,id LIMIT 1").first()
    :await ctx.env.DB.prepare('SELECT * FROM users WHERE lower(email)=? OR lower(username)=?').bind(login,login).first();
  if(!u||!await verifyPassword(String(b.password||''),u.password_hash)){await securityLog(ctx.env,ctx.request,'login_failed','warning',login);return json({error:'ไอดีหรือรหัสผ่านไม่ถูกต้อง'},401)}
  if(!String(u.password_hash).startsWith('pbkdf2:'))await ctx.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(b.password),u.id).run();
  const id=crypto.randomUUID();await ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(id,u.id).run();
  await securityLog(ctx.env,ctx.request,'login_success','info','',u.id);
  return json({ok:true},200,{'set-cookie':`vd_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`});
}
