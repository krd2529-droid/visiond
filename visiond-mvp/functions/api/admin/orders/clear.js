import {json,requireBoss} from '../../../_lib.js';

const CLEARABLE_STATUSES=['awaiting_payment','pending_review','rejected'];

export async function onRequestPost(ctx){
  const auth=await requireBoss(ctx);
  if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const clearAll=body.mode==='all';
  const requested=[...new Set((Array.isArray(body.ids)?body.ids:[]).map(Number).filter(Number.isInteger))].slice(0,2000);
  if(!clearAll&&!requested.length)return json({error:'กรุณาเลือกออเดอร์ที่ต้องการล้าง'},400);
  const statusMarks=CLEARABLE_STATUSES.map(()=>'?').join(',');
  const idClause=clearAll?'':` AND id IN (${requested.map(()=>'?').join(',')})`;
  const orders=(await ctx.env.DB.prepare(`SELECT id,slip_key FROM orders WHERE status IN (${statusMarks})${idClause}`).bind(...CLEARABLE_STATUSES,...(clearAll?[]:requested)).all()).results;
  if(!orders.length)return json({error:'ไม่พบออเดอร์เก่าที่สามารถล้างได้'},404);
  const ids=orders.map(order=>order.id),marks=ids.map(()=>'?').join(',');
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(`DELETE FROM verified_slips WHERE order_id IN (${marks})`).bind(...ids),
    ctx.env.DB.prepare(`DELETE FROM order_items WHERE order_id IN (${marks})`).bind(...ids),
    ctx.env.DB.prepare(`DELETE FROM orders WHERE id IN (${marks}) AND status IN (${statusMarks})`).bind(...ids,...CLEARABLE_STATUSES),
  ]);
  await Promise.all(orders.filter(order=>order.slip_key).map(order=>ctx.env.FILES.delete(order.slip_key).catch(()=>{})));
  return json({ok:true,deleted:ids.length,message:`ล้างออเดอร์แล้ว ${ids.length} รายการ`});
}
