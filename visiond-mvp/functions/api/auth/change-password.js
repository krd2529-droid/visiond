import {cookie,json,requireUser} from '../../_lib.js';
import {hashPassword,rateLimit,securityLog,verifyPassword} from '../../_security.js';
import {ensureVision7AuthSchema} from '../../_vision7_auth.js';

export async function onRequestPost(ctx){
  const auth=await requireUser(ctx);
  if(auth.error)return auth.error;
  const limited=await rateLimit(ctx.env,ctx.request,'change_password',5,15,30);
  if(limited.error)return limited.error;
  const body=await ctx.request.json().catch(()=>({}));
  const current=String(body.current_password||''),next=String(body.new_password||''),confirm=String(body.confirm_password||'');
  if(!current||!next||!confirm)return json({error:'กรุณากรอกรหัสผ่านให้ครบ'},400);
  if(next.length<10)return json({error:'รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัว'},400);
  if(next!==confirm)return json({error:'รหัสผ่านใหม่และคำยืนยันไม่ตรงกัน'},400);
  if(current===next)return json({error:'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน'},400);
  const row=await ctx.env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(auth.user.id).first();
  if(!row||!await verifyPassword(current,row.password_hash)){
    await securityLog(ctx.env,ctx.request,'password_change_failed','warning','current password mismatch',auth.user.id);
    return json({error:'รหัสผ่านปัจจุบันไม่ถูกต้อง'},401);
  }
  const passwordHash=await hashPassword(next),sessionId=cookie(ctx.request,'vd_session');
  await ensureVision7AuthSchema(ctx.env);
  await ctx.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(passwordHash,auth.user.id).run();
  await ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').bind(auth.user.id,sessionId).run();
  await ctx.env.DB.prepare("UPDATE vision7_app_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL").bind(auth.user.id).run();
  await securityLog(ctx.env,ctx.request,'password_changed','info','other sessions revoked',auth.user.id);
  return json({ok:true,message:'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'});
}
