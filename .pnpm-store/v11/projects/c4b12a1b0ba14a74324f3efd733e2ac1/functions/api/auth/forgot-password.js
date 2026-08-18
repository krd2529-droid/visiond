import {json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {rateLimit,rateLimitIdentity,securityLog,verifyTurnstile} from '../../_security.js';
import {createResetToken,passwordResetEmailReady,sendPasswordResetEmail} from '../../_password-reset-email.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  if(!passwordResetEmailReady(ctx.env))return json({error:'ระบบส่งอีเมลตั้งรหัสผ่านใหม่ยังไม่ได้เปิดใช้งาน กรุณาติดต่อเจ้าหน้าที่ VisionD'},503);
  const body=await ctx.request.json().catch(()=>({})),email=String(body.email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))return json({error:'กรุณากรอกอีเมลให้ถูกต้อง'},400);
  const ipLimit=await rateLimit(ctx.env,ctx.request,'forgot_password_ip',10,30,30);if(ipLimit.error)return ipLimit.error;
  const identity=(await sha256(email)).slice(0,24),identityLimit=await rateLimitIdentity(ctx.env,ctx.request,'forgot_password_email',identity,3,30,30);if(identityLimit.error)return identityLimit.error;
  const turnstile=await verifyTurnstile(ctx.env,ctx.request,body.turnstile_token);if(turnstile.error)return turnstile.error;
  const user=await ctx.env.DB.prepare('SELECT id,email,name FROM users WHERE lower(email)=? LIMIT 1').bind(email).first();
  const message='หากอีเมลนี้เป็นสมาชิก VisionD ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ โปรดตรวจกล่องจดหมายและสแปม';
  if(!user){await securityLog(ctx.env,ctx.request,'password_reset_requested','info','account not disclosed');return json({ok:true,message});}
  const {token,tokenHash}=await createResetToken();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("DELETE FROM password_reset_tokens WHERE expires_at<datetime('now','-7 days') OR used_at<datetime('now','-7 days')"),
    ctx.env.DB.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL").bind(user.id),
    ctx.env.DB.prepare("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 minutes'))").bind(user.id,tokenHash)
  ]);
  try{await sendPasswordResetEmail(ctx.env,{email:user.email,name:user.name,token});}
  catch(error){
    await ctx.env.DB.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?').bind(tokenHash).run();
    await securityLog(ctx.env,ctx.request,'password_reset_email_failed','error',String(error).slice(0,120),user.id);
    return json({error:'ส่งอีเมลตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อเจ้าหน้าที่ VisionD'},502);
  }
  await securityLog(ctx.env,ctx.request,'password_reset_requested','info','email dispatched',user.id);
  return json({ok:true,message});
}
