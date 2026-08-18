import { json,requireUser } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare(`SELECT c.id course_id,c.product_id,c.owner_user_id,u.seller_payment_qr_url
    FROM courses c JOIN users u ON u.id=c.owner_user_id WHERE c.license_entitlement_id=?`).bind(ctx.params.entitlementId).first();
  if(!row?.seller_payment_qr_url)return json({error:'ไม่พบ QR'},404);
  const staff=['boss','admin'].includes(auth.user.role),owner=Number(row.owner_user_id)===Number(auth.user.id);
  const buyer=staff||owner?true:await ctx.env.DB.prepare(`SELECT 1 allowed FROM orders o JOIN order_items oi ON oi.order_id=o.id
    WHERE o.user_id=? AND o.course_owner_user_id=? AND oi.product_id=?
      AND o.status IN ('awaiting_payment','rejected','pending_review') LIMIT 1`).bind(auth.user.id,row.owner_user_id,row.product_id).first();
  if(!staff&&!owner&&!buyer)return json({error:'ไม่มีสิทธิ์เปิด QR นี้'},403);
  const object=await ctx.env.FILES.get(row.seller_payment_qr_url);if(!object)return json({error:'ไม่พบ QR'},404);
  const h=new Headers();object.writeHttpMetadata(h);h.set('cache-control','private, no-store');h.set('x-content-type-options','nosniff');return new Response(object.body,{headers:h});
}
