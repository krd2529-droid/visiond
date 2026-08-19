import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const order=await ctx.env.DB.prepare(`SELECT o.status,o.slip_key,o.slip_verification_status,o.course_owner_user_id,o.seller_course_id,o.course_plan,EXISTS(SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id AND p.category='resale-rights') has_resale_rights FROM orders o WHERE o.id=?`).bind(ctx.params.id).first();
  if(!order)return json({error:'ไม่พบออเดอร์'},404);
  const partnerCourse=order.course_plan==='partner';
  if((order.course_owner_user_id||order.seller_course_id)&&!partnerCourse)return json({error:'ออเดอร์คอร์สผู้ขายต้องให้เจ้าของคอร์สตรวจใน Vision 5 เท่านั้น'},403);
  if((partnerCourse||order.has_resale_rights)&&auth.user.role!=='boss')return json({error:partnerCourse?'เฉพาะ Boss ปฏิเสธสลิปคอร์สพาร์ตเนอร์ได้':'เฉพาะ Boss ปฏิเสธสลิปตะกร้าสิทธิ์ได้'},403);
  const note=String(body.note||'').trim().slice(0,300);
  if((partnerCourse||order.has_resale_rights)&&(order.slip_verification_status!=='manual'||!note||body.confirmed!==true))return json({error:'Boss ต้องเปิดดูสลิป ยืนยัน และระบุเหตุผลก่อนปฏิเสธ'},409);
  if(order.status!=='pending_review'||!order.slip_key)return json({error:'ลูกค้ายังไม่ได้ส่งสลิป จึงไม่มีสลิปให้ปฏิเสธ'},409);
  const result=await ctx.env.DB.prepare("UPDATE orders SET status='rejected',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review'").bind(note||'หลักฐานไม่ถูกต้อง',ctx.params.id).run();
  if(!result.meta.changes)return json({error:'ออเดอร์นี้ถูกดำเนินการแล้ว'},409);
  return json({ok:true,message:partnerCourse?'Boss ปฏิเสธสลิปพาร์ตเนอร์แล้ว ลูกค้าสามารถส่งสลิปใหม่ได้':'บันทึกการไม่อนุมัติเรียบร้อย'});
}
