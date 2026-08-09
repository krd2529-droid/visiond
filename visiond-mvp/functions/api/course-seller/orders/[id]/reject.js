import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const order=await ctx.env.DB.prepare("SELECT id,slip_key FROM orders WHERE id=? AND course_owner_user_id=? AND seller_course_id IS NOT NULL AND status='pending_review' AND slip_verification_status='manual'").bind(ctx.params.id,auth.user.id).first();
  if(!order?.slip_key)return json({error:'ไม่พบสลิปที่รอเจ้าของคอร์สตรวจ'},404);
  const body=await ctx.request.json().catch(()=>({})),note=String(body.note||'สลิปไม่ถูกต้อง กรุณาตรวจสอบแล้วส่งใหม่').trim().slice(0,300);
  await ctx.env.DB.prepare("UPDATE orders SET status='rejected',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND course_owner_user_id=?").bind(note,order.id,auth.user.id).run();
  return json({ok:true,message:'ปฏิเสธสลิปแล้ว ผู้ซื้อสามารถส่งสลิปใหม่ได้'});
}
