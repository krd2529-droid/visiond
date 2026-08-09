import {json,requireBoss} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),userId=Number(ctx.params.id),credits=Math.min(100,Math.max(1,Math.floor(Number(body.credits)||1))),note=String(body.note||'').trim().slice(0,300);
  const user=await ctx.env.DB.prepare("SELECT id,name,username,email,role FROM users WHERE id=? AND role IN ('user','customer')").bind(userId).first();
  if(!user)return json({error:'ไม่พบบัญชี User ที่ต้องการเพิ่มแต้มสิทธิ์'},404);
  const product=await ctx.env.DB.prepare("SELECT id,title FROM products WHERE slug='course-selling-rights' AND deleted_at IS NULL").first();
  if(!product)return json({error:'ไม่พบตะกร้าสิทธิ์ลงขายคอร์สออนไลน์'},404);
  const orderNo=`VD-CREDIT-${Date.now()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const order=await ctx.env.DB.prepare("INSERT INTO orders(order_no,user_id,total,status,admin_note,sale_price_recorded,updated_at) VALUES(?,?,0,'paid',?,0,CURRENT_TIMESTAMP) RETURNING id").bind(orderNo,user.id,`Boss เพิ่ม ${credits} เครดิต${note?' · '+note:''}`).first();
  const actorName=auth.user.name||auth.user.username||auth.user.email||String(auth.user.id),statements=[
    ctx.env.DB.prepare('WITH RECURSIVE amount(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM amount WHERE n<?) INSERT INTO order_items(order_id,product_id,product_title,price) SELECT ?,?,?,0 FROM amount').bind(credits,order.id,product.id,product.title),
    ctx.env.DB.prepare('WITH RECURSIVE amount(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM amount WHERE n<?) INSERT INTO course_right_credits(user_id,product_id,order_id,active) SELECT ?,?,?,1 FROM amount').bind(credits,user.id,product.id,order.id),
    ctx.env.DB.prepare('INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(auth.user.id,actorName,auth.user.role,user.id,user.name||user.username||user.email,product.id,`${product.title} × ${credits} เครดิต`,order.id,orderNo,'manual_course_credit',note)
  ];
  await ctx.env.DB.batch(statements);
  const balance=await ctx.env.DB.prepare('SELECT COUNT(*) total FROM course_right_credits WHERE user_id=? AND active=1 AND used_course_id IS NULL').bind(user.id).first();
  return json({ok:true,user_id:user.id,credits_added:credits,credit_balance:Number(balance.total)||0,is_course_owner:true,order_no:orderNo},201);
}
