import {json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {hashPassword,rateLimit,securityLog} from '../../_security.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const limited=await rateLimit(ctx.env,ctx.request,'reset_password_ip',10,30,30);if(limited.error)return limited.error;
  const body=await ctx.request.json().catch(()=>({})),token=String(body.token||''),password=String(body.password||''),confirm=String(body.confirm_password||'');
  if(!/^[A-Za-z0-9_-]{40,100}$/.test(token))return json({error:'ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'},400);
  if(password.length<10)return json({error:'รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัว'},400);
  if(password!==confirm)return json({error:'รหัสผ่านใหม่และคำยืนยันไม่ตรงกัน'},400);
  const tokenHash=await sha256(token),row=await ctx.env.DB.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now')").bind(tokenHash).first();
  if(!row){await securityLog(ctx.env,ctx.request,'password_reset_failed','warning','invalid expired or used token');return json({error:'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว'},400);}
  const consumeId=crypto.randomUUID(),passwordHash=await hashPassword(password);
  const results=await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP,consume_id=? WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now')").bind(consumeId,tokenHash),
    ctx.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=? AND EXISTS(SELECT 1 FROM password_reset_tokens WHERE token_hash=? AND consume_id=?)').bind(passwordHash,row.user_id,tokenHash,consumeId),
    ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM password_reset_tokens WHERE token_hash=? AND consume_id=?)').bind(row.user_id,tokenHash,consumeId)
  ]);
  if(!Number(results[0]?.meta?.changes)){return json({error:'ลิงก์ตั้งรหัสผ่านถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่'},409);}
  await securityLog(ctx.env,ctx.request,'password_reset_completed','info','all sessions revoked',row.user_id);
  return json({ok:true,message:'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง'});
}
