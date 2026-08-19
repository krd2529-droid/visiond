import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {grantOrder} from '../../../../_orders.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const a=await requireAdmin(ctx);if(a.error)return a.error;
  const b=await ctx.request.json().catch(()=>({}));
  const order=await ctx.env.DB.prepare(`SELECT o.*,EXISTS(SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id AND p.category='resale-rights') has_resale_rights,COALESCE(owner.vision5_test_account,0) vision5_test_account FROM orders o LEFT JOIN users owner ON owner.id=o.course_owner_user_id WHERE o.id=?`).bind(ctx.params.id).first();
  if(!order)return json({error:'ไม่พบออเดอร์'},404);
  const testSeller=Number(order.vision5_test_account)===1;
  const partnerCourse=order.course_plan==='partner';
  if((order.course_owner_user_id||order.seller_course_id)&&!testSeller&&!partnerCourse)return json({error:'ออเดอร์คอร์สผู้ขายต้องให้เจ้าของคอร์สตรวจใน Vision 5 เท่านั้น'},403);
  if(testSeller&&a.user.role!=='boss')return json({error:'บัญชีทดสอบ Vision 5 ต้องให้ Boss อนุมัติเท่านั้น'},403);
  if(partnerCourse&&a.user.role!=='boss')return json({error:'เฉพาะ Boss ตรวจสลิปคอร์สพาร์ตเนอร์แทน VisionD ได้'},403);
  if(order.has_resale_rights&&a.user.role!=='boss')return json({error:'เฉพาะ Boss อนุมัติสลิปตะกร้าสิทธิ์แทนได้'},403);
  if((order.has_resale_rights||testSeller||partnerCourse)&&(order.slip_verification_status!=='manual'||b.confirmed!==true))return json({error:'Boss ต้องเปิดดูสลิปและยืนยันการอนุมัติรายการแมนนวลก่อน'},409);
  if(order.status!=='pending_review'||!order.slip_key)return json({error:'ลูกค้ายังไม่ได้ส่งสลิป จึงยังอนุมัติไม่ได้'},409);
  const count=await grantOrder(ctx.env,order,{...a.user,note:b.note||'',method:partnerCourse?'boss_partner_slip_approval':testSeller?'boss_test_seller_slip_approval':order.has_resale_rights?'boss_rights_slip_approval':'slip_approval'});
  if(!count)return json({error:'ออเดอร์นี้ถูกดำเนินการแล้ว จึงไม่เพิ่มเครดิตซ้ำหรือปลดล็อกซ้ำ'},409);
  return json({ok:true,count,message:partnerCourse?'Boss อนุมัติสลิปพาร์ตเนอร์และปลดล็อกคอร์สแล้ว':testSeller?'Boss อนุมัติบัญชีทดสอบและปลดล็อกคอร์สแล้ว':order.has_resale_rights?`Boss อนุมัติแล้ว เพิ่ม ${count} เครดิตเรียบร้อย`:'อนุมัติและปลดล็อกเรียบร้อย'});
}
