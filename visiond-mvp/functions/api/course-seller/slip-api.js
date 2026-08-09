import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare("SELECT CASE WHEN LENGTH(seller_slip_api_key)>=20 THEN 1 ELSE 0 END configured,seller_slip_api_provider provider,seller_slip_api_updated_at updated_at FROM users WHERE id=?").bind(auth.user.id).first();
  return json(row||{configured:0,provider:'easyslip'},{headers:{'cache-control':'no-store'}});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),key=String(body.api_key||'').trim();
  if(key.length<20||key.length>500)return json({error:'กรุณากรอก EasySlip API Access Token ให้ถูกต้อง'},400);
  await ctx.env.DB.prepare("UPDATE users SET seller_slip_api_key=?,seller_slip_api_provider='easyslip',seller_slip_api_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(key,auth.user.id).run();
  return json({ok:true,configured:true,message:'บันทึก API ตรวจสลิปแล้ว ระบบจะตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติ'});
}
