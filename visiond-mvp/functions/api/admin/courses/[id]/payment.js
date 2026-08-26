import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {loadPaymentSettings} from '../../../../_payment.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),mode=String(body.payment_account||'');
  if(!['boss_krungsri','visiond'].includes(mode))return json({error:'บัญชีรับเงินไม่ถูกต้อง'},400);
  const course=await ctx.env.DB.prepare("SELECT id FROM courses WHERE id=? AND owner_user_id IS NULL AND COALESCE(course_origin,'company')='company' AND course_type='online_course'").bind(ctx.params.id).first();
  if(!course)return json({error:'ไม่พบตะกร้าคอร์ส VisionD หรือคอร์สนี้ต้องผ่านระบบผู้ขาย'},403);
  const settings=await loadPaymentSettings(ctx.env),account=mode==='visiond'?settings.profiles.company:{bank_name:'ธนาคารกรุงศรีอยุธยา',account_name:'รัฐสิทธิ ดำรงรถการ',account_number:'444-118-1181'};
  if(!account.bank_name||!account.account_name||!account.account_number)return json({error:'บัญชีบริษัท VisionD ยังตั้งค่าไม่ครบ กรุณาตั้งค่าในหลังบ้านก่อน'},409);
  await ctx.env.DB.prepare('UPDATE courses SET payment_bank_name=?,payment_account_name=?,payment_account_number=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(account.bank_name,account.account_name,account.account_number,course.id).run();
  return json({ok:true,payment_account:mode,bank_name:account.bank_name,account_name:account.account_name,account_number:account.account_number},200,{'cache-control':'no-store'});
}
