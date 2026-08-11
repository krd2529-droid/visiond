import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {encryptSellerToken,sellerTokenEncryptionConfigured,sellerTokenStatus} from '../../_seller_token.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare("SELECT seller_slip_api_key,seller_slip_auto_verify enabled,seller_slip_api_provider provider,seller_slip_api_updated_at updated_at,vision5_test_account test_account FROM users WHERE id=?").bind(auth.user.id).first(),status=sellerTokenStatus(ctx.env,row?.seller_slip_api_key);
  return json({configured:status.configured?1:0,enabled:Number(row?.enabled)===1?1:0,test_account:Number(row?.test_account)===1?1:0,provider:row?.provider||'easyslip',updated_at:row?.updated_at||null,encryption_configured:status.encryption_configured,requires_configuration:status.requires_configuration},200,{'cache-control':'no-store'});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),enabled=body.enabled===true,key=String(body.api_key||'').trim();
  if(!enabled){await ctx.env.DB.prepare('UPDATE users SET seller_slip_auto_verify=0 WHERE id=?').bind(auth.user.id).run();return json({ok:true,enabled:false,message:'ปิดการตรวจอัตโนมัติแล้ว สลิปใหม่ต้องตรวจและอนุมัติเอง'})}
  const old=await ctx.env.DB.prepare('SELECT seller_slip_api_key FROM users WHERE id=?').bind(auth.user.id).first(),oldStatus=sellerTokenStatus(ctx.env,old?.seller_slip_api_key);
  if(!key&&oldStatus.configured){await ctx.env.DB.prepare('UPDATE users SET seller_slip_auto_verify=1 WHERE id=?').bind(auth.user.id).run();return json({ok:true,enabled:true,configured:true,message:'เปิดการตรวจสลิปอัตโนมัติแล้ว'})}
  if(key.length<20||key.length>500)return json({error:'เปิดตรวจอัตโนมัติแล้ว กรุณากรอก EasySlip API Access Token ให้ถูกต้อง'},400);
  if(!sellerTokenEncryptionConfigured(ctx.env))return json({error:'ระบบยังไม่ได้ตั้งค่า Secret สำหรับเข้ารหัส Token กรุณาติดต่อผู้ดูแลระบบ ข้อมูลเดิมไม่ได้ถูกเปลี่ยน',code:'TOKEN_ENCRYPTION_NOT_CONFIGURED'},503);
  const encrypted=await encryptSellerToken(ctx.env,key);
  await ctx.env.DB.prepare("UPDATE users SET seller_slip_api_key=?,seller_slip_auto_verify=1,seller_slip_api_provider='easyslip',seller_slip_api_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(encrypted,auth.user.id).run();
  return json({ok:true,configured:true,message:'บันทึก API ตรวจสลิปแล้ว ระบบจะตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติ'});
}
