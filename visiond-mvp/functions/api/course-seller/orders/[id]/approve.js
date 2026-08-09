import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {grantOrder} from '../../../../_orders.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const order=await ctx.env.DB.prepare("SELECT * FROM orders WHERE id=? AND course_owner_user_id=? AND seller_course_id IS NOT NULL AND status='pending_review'").bind(ctx.params.id,auth.user.id).first();
  if(!order?.slip_key)return json({error:'ไม่พบสลิปที่รอเจ้าของคอร์สตรวจ'},404);
  if(order.slip_verification_status==='verified')return json({error:'สลิปนี้ผ่าน API แล้วและกำลังปลดล็อก กรุณาโหลดหน้าใหม่'},409);
  const body=await ctx.request.json().catch(()=>({}));
  const count=await grantOrder(ctx.env,order,{...auth.user,role:'course_owner',method:'course_owner_slip_approval',note:String(body.note||'เจ้าของคอร์สตรวจสลิปเอง').slice(0,300)});
  return json({ok:true,count,message:'อนุมัติสลิปและปลดล็อกคอร์สให้ผู้ซื้อแล้ว'});
}
