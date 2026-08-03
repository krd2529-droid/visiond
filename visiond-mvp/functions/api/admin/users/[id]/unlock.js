import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),productId=Number(body.product_id),userId=Number(ctx.params.id);
  const user=await ctx.env.DB.prepare('SELECT id,name,username,role FROM users WHERE id=?').bind(userId).first();if(!user)return json({error:'ไม่พบบัญชีลูกค้า'},404);
  const product=await ctx.env.DB.prepare('SELECT id,title,price FROM products WHERE id=?').bind(productId).first();if(!product)return json({error:'ไม่พบสินค้า'},404);
  const existing=await ctx.env.DB.prepare('SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND active=1').bind(user.id,product.id).first();if(existing)return json({error:'ลูกค้ามีสิทธิ์สินค้านี้อยู่แล้ว'},409);
  const orderNo=`VD-MANUAL-${Date.now()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const note=`ปลดล็อกโดย ${auth.user.username||auth.user.email||auth.user.id}${body.note?' · '+String(body.note).slice(0,300):''}`;
  const order=await ctx.env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,status,admin_note,updated_at) VALUES(?,?,?,'paid',?,CURRENT_TIMESTAMP) RETURNING id`).bind(orderNo,user.id,product.price,note).first();
  await ctx.env.DB.prepare('INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,?)').bind(order.id,product.id,product.price).run();
  await ctx.env.DB.prepare('INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(user.id,product.id,order.id).run();
  return json({ok:true,order_no:orderNo,user:user.name,product:product.title});
}
