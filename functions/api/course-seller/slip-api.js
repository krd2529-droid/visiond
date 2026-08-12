import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {encryptSellerToken,sellerTokenEncryptionConfigured,sellerTokenStatus} from '../../_seller_token.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare("SELECT seller_slip_api_key,seller_slip_api_provider provider,seller_slip_api_updated_at updated_at FROM users WHERE id=?").bind(auth.user.id).first(),status=sellerTokenStatus(ctx.env,row?.seller_slip_api_key);
  return json({configured:status.configured?1:0,provider:row?.provider||'easyslip',updated_at:row?.updated_at||null,encryption_configured:status.encryption_configured,requires_configuration:status.requires_configuration},200,{'cache-control':'no-store'});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),key=String(body.api_key||'').trim();
  if(key.length<20||key.length>500)return json({error:'กรุณากรอก EasySlip API Access Token ให้ถูกต้อง'},400);
  if(!sellerTokenEncryptionConfigured(ctx.env))return json({error:'ระบบยังไม่ได้ตั้งค่า Secret สำหรับเข้ารหัส Token กรุณาติดต่อผู้ดูแลระบบ ข้อมูลเดิมไม่ได้ถูกเปลี่ยน',code:'TOKEN_ENCRYPTION_NOT_CONFIGURED'},503);
  const encrypted=await encryptSellerToken(ctx.env,key);
  await ctx.env.DB.prepare("UPDATE users SET seller_slip_api_key=?,seller_slip_api_provider='easyslip',seller_slip_api_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(encrypted,auth.user.id).run();
  return json({ok:true,configured:true,message:'บันทึก API ตรวจสลิปแล้ว ระบบจะตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติ'});
}
