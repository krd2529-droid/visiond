import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {grantOrder} from '../../../../_orders.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const order=await ctx.env.DB.prepare("SELECT o.* FROM orders o JOIN users owner ON owner.id=o.course_owner_user_id WHERE o.id=? AND o.course_owner_user_id=? AND owner.vision5_test_account=0 AND o.seller_course_id IS NOT NULL AND o.status='pending_review' AND o.slip_verification_status='manual'").bind(ctx.params.id,auth.user.id).first();
  if(!order?.slip_key)return json({error:'ไม่พบสลิปที่รอเจ้าของคอร์สตรวจ'},404);
  const body=await ctx.request.json().catch(()=>({}));
  const count=await grantOrder(ctx.env,order,{...auth.user,role:'course_owner',method:'course_owner_slip_approval',note:String(body.note||'เจ้าของคอร์สตรวจสลิปเอง').slice(0,300)});
  return json({ok:true,count,message:'อนุมัติสลิปและปลดล็อกคอร์สให้ผู้ซื้อแล้ว'});
}
