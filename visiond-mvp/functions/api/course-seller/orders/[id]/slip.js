import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const order=await ctx.env.DB.prepare('SELECT slip_key FROM orders WHERE id=? AND course_owner_user_id=? AND seller_course_id IS NOT NULL').bind(ctx.params.id,auth.user.id).first();
  if(!order?.slip_key)return json({error:'ไม่พบสลิปของออเดอร์นี้'},404);
  const object=await ctx.env.FILES.get(order.slip_key);if(!object)return json({error:'ไม่พบไฟล์สลิป'},404);
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','private, no-store');headers.set('content-disposition','inline');
  return new Response(object.body,{headers});
}
