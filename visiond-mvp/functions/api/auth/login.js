import {json} from '../../_lib.js';
import {rateLimit,verifyTurnstile,verifyPassword,hashPassword,securityLog} from '../../_security.js';

export async function onRequestPost(ctx){
  if(!ctx.env.DB)return json({error:'ยังไม่ได้เชื่อมฐานข้อมูลสมาชิก'},503);
  const limited=await rateLimit(ctx.env,ctx.request,'login',8,15,30);if(limited.error)return limited.error;
  const b=await ctx.request.json().catch(()=>({})),turnstile=await verifyTurnstile(ctx.env,ctx.request,b.turnstile_token);if(turnstile.error)return turnstile.error;
  const login=String(b.login||b.email||'').trim().toLowerCase();
  if(!login||!b.password)return json({error:'กรุณากรอกไอดีและรหัสผ่าน'},400);
  const u=await ctx.env.DB.prepare('SELECT * FROM users WHERE lower(email)=? OR lower(username)=?').bind(login,login).first();
  if(!u||!await verifyPassword(String(b.password||''),u.password_hash)){await securityLog(ctx.env,ctx.request,'login_failed','warning',login);return json({error:'ไอดีหรือรหัสผ่านไม่ถูกต้อง'},401)}
  if(!String(u.password_hash).startsWith('pbkdf2:'))await ctx.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(b.password),u.id).run();
  const id=crypto.randomUUID();await ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(id,u.id).run();
  await securityLog(ctx.env,ctx.request,'login_success','info','',u.id);
  return json({ok:true},200,{'set-cookie':`vd_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`});
}
