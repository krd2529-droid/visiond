import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const imageTypes=new Set(['image/jpeg','image/png','image/webp']);
const ext=(file)=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
const normalizedName=value=>String(value||'').toLowerCase().replace(/^(นาย|นางสาว|นาง|mr\.?|mrs\.?|miss)\s*/i,'').replace(/[^a-zก-๙]/g,'');
const banks=new Set(['กสิกรไทย','กรุงไทย','กรุงเทพ','ไทยพาณิชย์','กรุงศรีอยุธยา','ทหารไทยธนชาต','ออมสิน','ธ.ก.ส.','ธอส.','เกียรตินาคินภัทร','CIMB Thai','UOB','LH Bank','ไทยเครดิต','ธนาคารอิสลาม']);
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const user=await ctx.env.DB.prepare('SELECT name,is_test_user,seller_payment_status,seller_payment_qr_url FROM users WHERE id=?').bind(auth.user.id).first();
  const form=await ctx.request.formData(),bank=String(form.get('bank_name')||'').trim(),accountName=String(form.get('account_name')||'').trim(),accountNumber=String(form.get('account_number')||'').trim().replace(/[^0-9-]/g,''),qr=form.get('payment_qr');
  if(!banks.has(bank)||!accountName||accountNumber.replace(/\D/g,'').length<6)return json({error:'กรุณาเลือกธนาคารจากรายการ และกรอกชื่อบัญชีกับเลขบัญชีให้ครบ'},400);
  const acceptedNames=Number(user.is_test_user)===1?[user.name,'รัฐสิทธิ ดำรงรถการ','รัฐสิทธิ์ ดำรงรถการ']:[user.name];
  if(!acceptedNames.some(name=>normalizedName(accountName)===normalizedName(name)))return json({error:'ชื่อบัญชีธนาคารต้องตรงกับชื่อ–นามสกุลที่สมัคร VisionD'},400);
  if(qr instanceof File&&qr.size&&(!imageTypes.has(qr.type)||qr.size>8*1024*1024))return json({error:'QR รับเงินรองรับ JPG, PNG หรือ WEBP ไม่เกิน 8 MB'},400);
  const oldKey=String(user.seller_payment_qr_url||''),newKey=qr instanceof File&&qr.size?`seller-payment-qr-${auth.user.id}-${crypto.randomUUID()}.${ext(qr)}`:'',key=newKey||oldKey;
  if(newKey)await ctx.env.FILES.put(newKey,await qr.arrayBuffer(),{httpMetadata:{contentType:qr.type}});
  const result=await ctx.env.DB.prepare("UPDATE users SET seller_bank_name=?,seller_account_name=?,seller_account_number=?,seller_payment_qr_url=?,seller_payment_status='pending',seller_payment_submitted_at=CURRENT_TIMESTAMP WHERE id=?").bind(bank,accountName,accountNumber,key,auth.user.id).run();
  if(!result.meta.changes){if(newKey)await ctx.env.FILES.delete(newKey);return json({error:'บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ'},409)}
  if(newKey&&oldKey&&oldKey!==newKey)await ctx.env.FILES.delete(oldKey).catch(()=>{});
  return json({ok:true,status:'pending',message:'บันทึกข้อมูลแล้ว กรุณารอ Boss ตรวจสอบ'},200);
}
