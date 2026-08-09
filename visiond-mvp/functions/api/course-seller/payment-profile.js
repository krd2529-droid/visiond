import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const imageTypes=new Set(['image/jpeg','image/png','image/webp']);
const ext=(file)=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
const normalizedName=value=>String(value||'').toLowerCase().replace(/^(นาย|นางสาว|นาง|mr\.?|mrs\.?|miss)\s*/i,'').replace(/[^a-zก-๙]/g,'');
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const user=await ctx.env.DB.prepare('SELECT name,seller_payment_status FROM users WHERE id=?').bind(auth.user.id).first();
  if(user.seller_payment_status!=='unset')return json({error:'ข้อมูลบัญชีรับเงินถูกล็อกแล้ว หากต้องการเปลี่ยนกรุณาติดต่อ VisionD หลังไมค์'},409);
  const form=await ctx.request.formData(),bank=String(form.get('bank_name')||'').trim(),accountName=String(form.get('account_name')||'').trim(),accountNumber=String(form.get('account_number')||'').trim().replace(/[^0-9-]/g,''),qr=form.get('payment_qr');
  if(!bank||!accountName||accountNumber.replace(/\D/g,'').length<6)return json({error:'กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ'},400);
  if(normalizedName(accountName)!==normalizedName(user.name))return json({error:'ชื่อบัญชีธนาคารต้องตรงกับชื่อ–นามสกุลที่สมัคร VisionD'},400);
  if(!(qr instanceof File)||!qr.size||!imageTypes.has(qr.type)||qr.size>8*1024*1024)return json({error:'กรุณาแนบ QR รับเงิน JPG, PNG หรือ WEBP ไม่เกิน 8 MB'},400);
  const key=`seller-payment-qr-${auth.user.id}-${crypto.randomUUID()}.${ext(qr)}`;await ctx.env.FILES.put(key,await qr.arrayBuffer(),{httpMetadata:{contentType:qr.type}});
  const result=await ctx.env.DB.prepare("UPDATE users SET seller_bank_name=?,seller_account_name=?,seller_account_number=?,seller_payment_qr_url=?,seller_payment_status='pending',seller_payment_submitted_at=CURRENT_TIMESTAMP WHERE id=? AND seller_payment_status='unset'").bind(bank,accountName,accountNumber,key,auth.user.id).run();
  if(!result.meta.changes){await ctx.env.FILES.delete(key);return json({error:'ข้อมูลบัญชีถูกบันทึกไปแล้ว'},409)}
  return json({ok:true,status:'pending',message:'ส่งข้อมูลแล้วและถูกล็อก กรุณารอ Boss ตรวจสอบ'},201);
}
