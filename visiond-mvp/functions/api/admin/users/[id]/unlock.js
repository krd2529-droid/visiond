import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),requestedIds=[...new Set((Array.isArray(body.product_ids)?body.product_ids:[body.product_id]).map(Number).filter(Number.isInteger))],userId=Number(ctx.params.id);
  if(!requestedIds.length)return json({error:'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'},400);
  const user=await ctx.env.DB.prepare('SELECT id,name,username,role FROM users WHERE id=?').bind(userId).first();if(!user)return json({error:'ไม่พบบัญชีลูกค้า'},404);
  const placeholders=requestedIds.map(()=>'?').join(','),products=(await ctx.env.DB.prepare(`SELECT id,title,price FROM products WHERE id IN (${placeholders}) AND status='published'`).bind(...requestedIds).all()).results;
  if(!products.length)return json({error:'ไม่พบสินค้าที่พร้อมปลดล็อก'},404);
  const existing=(await ctx.env.DB.prepare(`SELECT product_id FROM entitlements WHERE user_id=? AND active=1 AND product_id IN (${placeholders})`).bind(user.id,...requestedIds).all()).results;
  const existingIds=new Set(existing.map(item=>Number(item.product_id))),newProducts=products.filter(product=>!existingIds.has(Number(product.id))),skipped=products.filter(product=>existingIds.has(Number(product.id)));
  if(!newProducts.length)return json({error:'ลูกค้ามีสิทธิ์สินค้าที่เลือกทั้งหมดอยู่แล้ว'},409);
  const orderNo=`VD-MANUAL-${Date.now()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const note=`ปลดล็อกโดย ${auth.user.username||auth.user.email||auth.user.id}${body.note?' · '+String(body.note).slice(0,300):''}`;
  const total=newProducts.reduce((sum,product)=>sum+Number(product.price||0),0),packageNote=`${note} · แพ็กเกจ ${newProducts.length} สินค้า`;
  const order=await ctx.env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,status,admin_note,updated_at) VALUES(?,?,?,'paid',?,CURRENT_TIMESTAMP) RETURNING id`).bind(orderNo,user.id,total,packageNote).first();
  const actorName=auth.user.name||auth.user.username||auth.user.email||String(auth.user.id),statements=[];for(const product of newProducts){statements.push(ctx.env.DB.prepare('INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,?)').bind(order.id,product.id,product.price));statements.push(ctx.env.DB.prepare('INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(user.id,product.id,order.id));statements.push(ctx.env.DB.prepare('INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(auth.user.id,actorName,auth.user.role,user.id,user.name||user.username,product.id,product.title,order.id,orderNo,'manual',String(body.note||'').slice(0,300)))}await ctx.env.DB.batch(statements);
  return json({ok:true,order_no:orderNo,user:user.name,count:newProducts.length,products:newProducts.map(product=>product.title),skipped:skipped.map(product=>product.title),total});
}
