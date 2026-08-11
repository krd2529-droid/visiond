import {json} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {rateLimit,rateLimitIdentity,securityLog,verifyPassword} from '../../../_security.js';
import {ensureVision7AuthSchema,issueVision7AppSession} from '../../../_vision7_auth.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVision7AuthSchema(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),login=String(body.login||body.email||'').trim().toLowerCase(),deviceId=String(body.device_id||'').trim();
  if(!login||!body.password||deviceId.length<8)return json({error:'กรุณากรอกไอดี รหัสผ่าน และรหัสเครื่อง',code:'VISION7_LOGIN_INPUT_INVALID'},400);
  const ipLimited=await rateLimit(ctx.env,ctx.request,'vision7_login_ip',30,15,30);if(ipLimited.error)return ipLimited.error;
  const identityLimited=await rateLimitIdentity(ctx.env,ctx.request,'vision7_login_name',login,10,15,30);if(identityLimited.error)return identityLimited.error;
  const user=await ctx.env.DB.prepare('SELECT id,email,username,name,password_hash FROM users WHERE lower(email)=? OR lower(username)=? ORDER BY CASE WHEN lower(username)=? THEN 0 ELSE 1 END,id LIMIT 1').bind(login,login,login).first();
  if(!user||!await verifyPassword(String(body.password),user.password_hash)){await securityLog(ctx.env,ctx.request,'vision7_login_failed','warning',login,user?.id||null);return json({error:'ไอดีหรือรหัสผ่านไม่ถูกต้อง',code:'VISION7_LOGIN_FAILED'},401)}
  const session=await issueVision7AppSession(ctx.env,user.id,{deviceId,deviceName:body.device_name,appVersion:body.app_version});
  await securityLog(ctx.env,ctx.request,'vision7_login_success','info','app session issued',user.id);
  return json({ok:true,access_token:session.token,token_type:'Bearer',expires_in:session.expires_in,user:{id:user.id,username:user.username,name:user.name,email:user.email}},200,{'cache-control':'no-store'});
}
