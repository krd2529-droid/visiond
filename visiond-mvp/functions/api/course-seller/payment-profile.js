import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const imageTypes=new Set(['image/jpeg','image/png','image/webp']);
const ext=(file)=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
const banks=new Set(['กสิกรไทย','กรุงไทย','กรุงเทพ','ไทยพาณิชย์','กรุงศรีอยุธยา','ทหารไทยธนชาต','ออมสิน','ธ.ก.ส.','ธอส.','เกียรตินาคินภัทร','CIMB Thai','UOB','LH Bank','ไทยเครดิต','ธนาคารอิสลาม']);
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const user=await ctx.env.DB.prepare('SELECT seller_payment_qr_url FROM users WHERE id=?').bind(auth.user.id).first();
  const form=await ctx.request.formData(),bank=String(form.get('bank_name')||'').trim(),accountName=String(form.get('account_name')||'').trim(),accountNumber=String(form.get('account_number')||'').trim().replace(/[^0-9-]/g,''),qr=form.get('payment_qr');
  if(!banks.has(bank)||!accountName||accountNumber.replace(/\D/g,'').length<6)return json({error:'กรุณาเลือกธนาคารจากรายการ และกรอกชื่อบัญชีกับเลขบัญชีให้ครบ'},400);
  if(qr instanceof File&&qr.size&&(!imageTypes.has(qr.type)||qr.size>8*1024*1024))return json({error:'QR รับเงินรองรับ JPG, PNG หรือ WEBP ไม่เกิน 8 MB'},400);
  const oldKey=String(user.seller_payment_qr_url||''),newKey=qr instanceof File&&qr.size?`seller-payment-qr-${auth.user.id}-${crypto.randomUUID()}.${ext(qr)}`:'',key=newKey||oldKey;
  if(newKey)await ctx.env.FILES.put(newKey,await qr.arrayBuffer(),{httpMetadata:{contentType:qr.type}});
  const result=await ctx.env.DB.prepare("UPDATE users SET seller_bank_name=?,seller_account_name=?,seller_account_number=?,seller_payment_qr_url=?,seller_payment_status='approved',seller_payment_submitted_at=CURRENT_TIMESTAMP,seller_payment_verified_at=CURRENT_TIMESTAMP,seller_payment_verified_by=NULL WHERE id=?").bind(bank,accountName,accountNumber,key,auth.user.id).run();
  if(!result.meta.changes){if(newKey)await ctx.env.FILES.delete(newKey);return json({error:'บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ'},409)}
  if(newKey&&oldKey&&oldKey!==newKey)await ctx.env.FILES.delete(oldKey).catch(()=>{});
  return json({ok:true,status:'approved',message:'บันทึกบัญชีรับเงินแล้ว พร้อมใช้รับชำระเงิน'},200);
}
