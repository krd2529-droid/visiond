import {json,requireUser} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {rateLimit,securityLog} from '../../../_security.js';
import {grantOrder} from '../../../_orders.js';
import {loadPaymentSettings} from '../../../_payment.js';
import {loadSellerToken} from '../../../_seller_token.js';

const accepted=new Set(['image/jpeg','image/png','image/gif','image/webp']);
const clean=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/^(นาย|นางสาว|นาง|บริษัท|บจก\.?|หจก\.?)/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const digits=s=>String(s||'').replace(/\D/g,'');
export const slipReceiverMatches=(expectedName,expectedNumber,matched)=>{
  if(!matched)return false;
  const expected=digits(expectedNumber),actual=digits(matched.bankNumber),a=clean(expectedName),names=[matched.nameTh,matched.nameEn].map(clean).filter(Boolean);
  // Never auto-approve from a four-digit suffix or a short substring. Some banks
  // mask account numbers, so those slips safely fall back to manual review.
  const numberOk=expected===actual||(expected.length>=6&&actual.length>=6&&expected.slice(-6)===actual.slice(-6));
  const nameOk=a.length>=4&&names.some(name=>name.length>=4&&name===a);
  return Boolean(expected&&actual&&numberOk&&nameOk);
};

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const limited=await rateLimit(ctx.env,ctx.request,'verify_slip',8,10,15);if(limited.error)return limited.error;
  const order=await ctx.env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(ctx.params.id,auth.user.id).first();
  if(!order)return json({error:'ไม่พบออเดอร์'},404);
  if(order.status==='paid')return json({ok:true,auto_approved:true,message:'ออเดอร์นี้ชำระเงินแล้ว'});
  if(!['awaiting_payment','rejected','pending_review'].includes(order.status))return json({error:'ออเดอร์นี้ไม่สามารถส่งสลิปได้'},409);
  const fd=await ctx.request.formData(),file=fd.get('slip');
  if(!(file instanceof File)||!accepted.has(file.type))return json({error:'กรุณาแนบสลิป JPG, PNG, GIF หรือ WEBP'},400);
  if(file.size>4*1024*1024)return json({error:'รูปสลิปต้องมีขนาดไม่เกิน 4 MB'},400);
  if(!ctx.env.FILES)return json({error:'ระบบเก็บไฟล์ยังไม่พร้อม'},503);
  const ext={'image/png':'png','image/gif':'gif','image/webp':'webp'}[file.type]||'jpg';
  const key=`slips/${auth.user.id}/${order.order_no}-${crypto.randomUUID()}.${ext}`;
  await ctx.env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
  const note=String(fd.get('note')||'').slice(0,300);await ctx.env.DB.batch([ctx.env.DB.prepare('INSERT INTO order_slip_evidence(order_id,object_key,mime_type,file_size,uploaded_by_user_id,source,note) VALUES(?,?,?,?,?,?,?)').bind(order.id,key,file.type,file.size,auth.user.id,'buyer_upload',note),ctx.env.DB.prepare("UPDATE orders SET slip_key=?,transfer_note=?,status='pending_review',slip_verification_status='checking',slip_verification_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(key,note,order.id)]);
  const paymentSettings=await loadPaymentSettings(ctx.env);
  const rightsOrder=await ctx.env.DB.prepare("SELECT 1 found FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND p.category='resale-rights' LIMIT 1").bind(order.id).first();
  const vxOrder=await ctx.env.DB.prepare("SELECT 1 found FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND p.product_kind='vx-access' LIMIT 1").bind(order.id).first();
  const sellerSettings=order.course_owner_user_id?await ctx.env.DB.prepare('SELECT seller_slip_auto_verify,vision5_test_account FROM users WHERE id=?').bind(order.course_owner_user_id).first():null;
  const partnerCourse=order.course_owner_user_id&&order.course_plan==='partner';
  let apiKey='',tokenError='';
  try{apiKey=partnerCourse?String(ctx.env.EASYSLIP_API_KEY||''):order.course_owner_user_id&&Number(sellerSettings?.seller_slip_auto_verify)===1&&Number(sellerSettings?.vision5_test_account)!==1?await loadSellerToken(ctx.env,order.course_owner_user_id):rightsOrder?(paymentSettings.vision5_rights_auto_verify?await loadSellerToken(ctx.env,auth.user.id):''):String(ctx.env.EASYSLIP_API_KEY||'')}catch(error){tokenError=String(error?.message||'TOKEN_DECRYPT_FAILED')}
  const autoEnabled=vxOrder?Boolean(apiKey):partnerCourse?paymentSettings.vision3_auto_verify&&Boolean(apiKey):order.course_owner_user_id?Number(sellerSettings?.seller_slip_auto_verify)===1&&Number(sellerSettings?.vision5_test_account)!==1&&Boolean(apiKey):rightsOrder?paymentSettings.vision5_rights_auto_verify&&Boolean(apiKey):paymentSettings.vision3_auto_verify&&Boolean(apiKey);
  if(!autoEnabled){
    const code=vxOrder?'API_NOT_CONFIGURED':Number(sellerSettings?.vision5_test_account)===1?'VISION5_TEST_ACCOUNT_BOSS_REVIEW':tokenError==='TOKEN_ENCRYPTION_NOT_CONFIGURED'?'TOKEN_ENCRYPTION_NOT_CONFIGURED':tokenError?'TOKEN_DECRYPT_FAILED':partnerCourse?'PARTNER_BOSS_REVIEW':order.course_owner_user_id?(Number(sellerSettings?.seller_slip_auto_verify)===1?'SELLER_API_NOT_CONFIGURED':'SELLER_MANUAL_MODE'):rightsOrder?(paymentSettings.vision5_rights_auto_verify?'BUYER_API_NOT_CONFIGURED':'VISION5_RIGHTS_MANUAL_MODE'):paymentSettings.vision3_auto_verify?'API_NOT_CONFIGURED':'VISION3_MANUAL_MODE';
    await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code=? WHERE id=?").bind(code,order.id).run();
    return json({ok:true,auto_approved:false,message:Number(sellerSettings?.vision5_test_account)===1?'รับสลิปแล้ว · บัญชีทดสอบกำลังรอ Boss ตรวจและอนุมัติ':partnerCourse?'รับสลิปแล้ว ระบบส่งให้ VisionD ตรวจและอนุมัติ':order.course_owner_user_id?'รับสลิปแล้ว เจ้าของคอร์สต้องตรวจและอนุมัติเอง':rightsOrder?(paymentSettings.vision5_rights_auto_verify?'EasySlip ไม่พร้อม ระบบส่งสลิปให้ Boss ตรวจแทนแล้ว':'รับสลิปแล้ว กำลังรอ Boss ตรวจและอนุมัติสิทธิ์'):'รับสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ'});
  }
  try{
    const verifyForm=new FormData();verifyForm.set('image',file,file.name||`slip.${ext}`);verifyForm.set('remark',order.order_no);verifyForm.set('matchAccount','true');verifyForm.set('matchAmount',(Number(order.total)/100).toFixed(2));verifyForm.set('checkDuplicate','true');
    const response=await fetch('https://api.easyslip.com/v2/verify/bank',{method:'POST',headers:{authorization:`Bearer ${apiKey}`},body:verifyForm});
    const result=await response.json().catch(()=>({success:false,error:{code:'INVALID_RESPONSE'}}));
    if(!response.ok||!result.success){
      const code=result?.error?.code||`HTTP_${response.status}`;
      await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code=? WHERE id=?").bind(code,order.id).run();
      await securityLog(ctx.env,ctx.request,'slip_verify_failed','warning',`${order.order_no}:${code}`,auth.user.id);
      return json({ok:true,auto_approved:false,message:code==='SLIP_PENDING'?'ธนาคารกำลังยืนยันรายการ กรุณาลองส่งอีกครั้งในอีกสักครู่':partnerCourse?'API ตรวจไม่สำเร็จ ระบบส่งให้ VisionD ตรวจแล้ว':order.course_owner_user_id?'API ตรวจไม่สำเร็จ ระบบส่งสลิปให้เจ้าของคอร์สตรวจเองแล้ว':'รับสลิปแล้ว ระบบส่งให้เจ้าหน้าที่ตรวจสอบ'});
    }
    const data=result.data||{},raw=data.rawSlip||{},transRef=String(raw.transRef||'').trim(),amount=Math.round(Number(data.amountInSlip??raw.amount?.amount)*100);
    const accountOk=Boolean(data.matchedAccount)&&slipReceiverMatches(order.payment_account_name,order.payment_account_number,data.matchedAccount);
    const amountOk=data.isAmountMatched===true&&amount===Number(order.total),duplicate=Boolean(data.isDuplicate)||!transRef;
    if(!accountOk||!amountOk||duplicate){
      const code=duplicate?'DUPLICATE_OR_NO_REF':!amountOk?'AMOUNT_MISMATCH':'ACCOUNT_MISMATCH';
      await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code=?,slip_trans_ref=?,slip_verified_at=CURRENT_TIMESTAMP WHERE id=?").bind(code,transRef||null,order.id).run();
      await securityLog(ctx.env,ctx.request,'slip_mismatch','warning',`${order.order_no}:${code}`,auth.user.id);
      return json({ok:true,auto_approved:false,message:partnerCourse?'ข้อมูลสลิปไม่ตรงครบทุกข้อ ระบบส่งให้ VisionD ตรวจแล้ว':order.course_owner_user_id?'ข้อมูลสลิปไม่ตรงครบทุกข้อ ระบบส่งให้เจ้าของคอร์สตรวจเองแล้ว':'ข้อมูลสลิปไม่ตรงครบทุกข้อ ส่งให้เจ้าหน้าที่ตรวจสอบแล้ว'});
    }
    const used=await ctx.env.DB.prepare('SELECT order_id FROM verified_slips WHERE trans_ref=?').bind(transRef).first();
    if(used&&Number(used.order_id)!==Number(order.id)){
      await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code='LOCAL_DUPLICATE',slip_trans_ref=? WHERE id=?").bind(transRef,order.id).run();
      return json({ok:true,auto_approved:false,message:order.course_owner_user_id?'สลิปนี้เคยใช้กับคำสั่งซื้ออื่น ระบบส่งให้เจ้าของคอร์สตรวจเองแล้ว':'สลิปนี้เคยใช้กับคำสั่งซื้ออื่นแล้ว ส่งให้เจ้าหน้าที่ตรวจสอบ'});
    }
    const verified=await ctx.env.DB.batch([ctx.env.DB.prepare("INSERT INTO verified_slips(trans_ref,order_id,amount,receiver_name,receiver_account) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM verified_slips WHERE trans_ref=?)").bind(transRef,order.id,amount,data.matchedAccount.nameTh||data.matchedAccount.nameEn||'',data.matchedAccount.bankNumber||'',transRef),ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='verified',slip_verification_code='OK',slip_trans_ref=?,slip_verified_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review' AND EXISTS(SELECT 1 FROM verified_slips WHERE trans_ref=? AND order_id=?)").bind(transRef,order.id,transRef,order.id)]);
    if(!verified[1]?.meta?.changes){await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code='LOCAL_DUPLICATE',slip_trans_ref=? WHERE id=? AND status='pending_review'").bind(transRef,order.id).run();return json({ok:true,auto_approved:false,message:order.course_owner_user_id?'สลิปนี้ถูกใช้กับคำสั่งซื้ออื่น ระบบส่งให้เจ้าของคอร์สตรวจเองแล้ว':'สลิปนี้เคยใช้กับคำสั่งซื้ออื่นแล้ว ส่งให้เจ้าหน้าที่ตรวจสอบ'})}
    const count=await grantOrder(ctx.env,{...order,status:'pending_review'},{name:'VisionD Auto',role:'system',method:'slip_auto',note:'EasySlip ยืนยันสลิปอัตโนมัติ'});
    await securityLog(ctx.env,ctx.request,'slip_auto_approved','info',`${order.order_no}:${transRef}`,auth.user.id);
    return json({ok:true,auto_approved:true,count,message:vxOrder?'EasySlip ยืนยันการชำระเงินแล้ว เปิดสิทธิ์ VX ตามแพ็กเกจเรียบร้อย':`ชำระเงินสำเร็จ ปลดล็อก ${count} สินค้าแล้ว`});
  }catch(error){
    await ctx.env.DB.prepare("UPDATE orders SET slip_verification_status='manual',slip_verification_code='VERIFY_ERROR' WHERE id=?").bind(order.id).run();
    await securityLog(ctx.env,ctx.request,'slip_verify_error','error',`${order.order_no}:${String(error).slice(0,180)}`,auth.user.id);
    return json({ok:true,auto_approved:false,message:partnerCourse?'รับสลิปแล้ว ระบบตรวจอัตโนมัติขัดข้อง จึงส่งให้ VisionD ตรวจ':order.course_owner_user_id?'รับสลิปแล้ว ระบบตรวจอัตโนมัติขัดข้อง จึงส่งให้เจ้าของคอร์สตรวจเอง':'รับสลิปแล้ว ระบบตรวจอัตโนมัติขัดข้อง จึงส่งให้เจ้าหน้าที่ตรวจสอบ'});
  }
}
