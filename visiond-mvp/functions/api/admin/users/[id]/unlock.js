import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData().catch(()=>null);if(!form)return json({error:'ข้อมูลรายการขายไม่ถูกต้อง'},400);
  const requestedIds=[...new Set(form.getAll('product_id').map(Number).filter(Number.isInteger))],userId=Number(ctx.params.id),rawSalePrice=String(form.get('sale_price')||'').trim(),hasSalePrice=rawSalePrice!=='',enteredSaleTotal=hasSalePrice?Math.round(Number(rawSalePrice)*100):null,slip=form.get('slip');
  if(!requestedIds.length)return json({error:'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'},400);
  if(hasSalePrice&&(!Number.isInteger(enteredSaleTotal)||enteredSaleTotal<0))return json({error:'ราคาขายจริงไม่ถูกต้อง'},400);
  if(slip&&(!(slip instanceof File)||!slip.type.startsWith('image/')||slip.size>10*1024*1024))return json({error:'สลิปต้องเป็นรูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 10 MB'},400);
  const user=await ctx.env.DB.prepare('SELECT id,name,username,role FROM users WHERE id=?').bind(userId).first();if(!user)return json({error:'ไม่พบบัญชีลูกค้า'},404);
  const placeholders=requestedIds.map(()=>'?').join(','),products=(await ctx.env.DB.prepare(`SELECT id,title,price,category FROM products WHERE id IN (${placeholders}) AND status='published' AND deleted_at IS NULL`).bind(...requestedIds).all()).results;
  if(!products.length)return json({error:'ไม่พบสินค้าที่พร้อมปลดล็อก'},404);
  const existing=(await ctx.env.DB.prepare(`SELECT product_id FROM entitlements WHERE user_id=? AND active=1 AND product_id IN (${placeholders})`).bind(user.id,...requestedIds).all()).results;
  const existingIds=new Set(existing.map(item=>Number(item.product_id))),newProducts=products.filter(product=>product.category==='resale-rights'||!existingIds.has(Number(product.id))),skipped=products.filter(product=>product.category!=='resale-rights'&&existingIds.has(Number(product.id)));
  if(!newProducts.length)return json({error:'ลูกค้ามีสิทธิ์สินค้าที่เลือกทั้งหมดอยู่แล้ว'},409);
  const orderNo=`VD-MANUAL-${Date.now()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const saleTotal=hasSalePrice?enteredSaleTotal:newProducts.reduce((sum,product)=>sum+Number(product.price||0),0),userNote=String(form.get('note')||'').slice(0,300),note=`ปลดล็อกโดย ${auth.user.username||auth.user.email||auth.user.id}${userNote?' · '+userNote:''}`,packageNote=`${note} · แพ็กเกจ ${newProducts.length} สินค้า`;
  let slipKey=null;if(slip&&slip.size){if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อม R2 binding ชื่อ FILES'},503);slipKey=`slips/manual/${user.id}/${orderNo}-${crypto.randomUUID()}.${slip.type.split('/')[1]||'jpg'}`;await ctx.env.FILES.put(slipKey,slip.stream(),{httpMetadata:{contentType:slip.type}})}
  const order=await ctx.env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,status,slip_key,admin_note,sale_price_recorded,updated_at) VALUES(?,?,?,'paid',?,?,?,CURRENT_TIMESTAMP) RETURNING id`).bind(orderNo,user.id,saleTotal,slipKey,packageNote,hasSalePrice?1:0).first();
  const actorName=auth.user.name||auth.user.username||auth.user.email||String(auth.user.id),base=Math.floor(saleTotal/newProducts.length),remainder=saleTotal-(base*newProducts.length),statements=[];newProducts.forEach((product,index)=>{const itemPrice=base+(index===0?remainder:0);statements.push(ctx.env.DB.prepare('INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,?)').bind(order.id,product.id,itemPrice));statements.push(product.category==='resale-rights'?ctx.env.DB.prepare('INSERT INTO course_right_credits(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(user.id,product.id,order.id):ctx.env.DB.prepare('INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(?,?,?,1)').bind(user.id,product.id,order.id));statements.push(ctx.env.DB.prepare('INSERT INTO unlock_logs(actor_user_id,actor_name,actor_role,target_user_id,target_name,product_id,product_title,order_id,order_no,method,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(auth.user.id,actorName,auth.user.role,user.id,user.name||user.username,product.id,product.title,order.id,orderNo,'manual',userNote))});await ctx.env.DB.batch(statements);
  return json({ok:true,order_no:orderNo,user:user.name,count:newProducts.length,products:newProducts.map(product=>product.title),skipped:skipped.map(product=>product.title),total:hasSalePrice?saleTotal:null,slip_saved:Boolean(slipKey)});
}
