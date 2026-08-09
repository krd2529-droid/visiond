import {json,requireUser} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';

const notice=(key,type,title,message,href,created_at)=>({key,type,title,message,href,created_at});
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const [orders,courses,issues,reads]=await Promise.all([
    ctx.env.DB.prepare(`SELECT o.id,o.order_no,o.status,o.admin_note,o.updated_at,o.seller_course_id,p.title,p.slug,p.category FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.user_id=? AND o.status IN ('awaiting_payment','pending_review','rejected','paid') GROUP BY o.id ORDER BY o.id DESC LIMIT 100`).bind(auth.user.id).all(),
    ctx.env.DB.prepare(`SELECT c.id,c.review_status,c.review_note,c.edit_expires_at,c.license_entitlement_id,c.updated_at,p.title,p.slug FROM courses c JOIN products p ON p.id=c.product_id WHERE c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC`).bind(auth.user.id).all(),
    ctx.env.DB.prepare(`SELECT o.id,o.order_no,o.updated_at,p.title FROM orders o JOIN products p ON p.id=(SELECT product_id FROM order_items WHERE order_id=o.id LIMIT 1) WHERE o.course_owner_user_id=? AND o.status='pending_review' AND o.slip_key IS NOT NULL AND o.slip_verification_status='manual' ORDER BY o.id DESC`).bind(auth.user.id).all(),
    ctx.env.DB.prepare('SELECT notification_key FROM notification_reads WHERE user_id=?').bind(auth.user.id).all()
  ]);
  const items=[];
  for(const o of orders.results||[]){const course=Boolean(o.seller_course_id),href=course?'/dashboard.html#orders':`/product.html?slug=${encodeURIComponent(o.slug)}`;
    if(o.status==='rejected')items.push(notice(`order-rejected-${o.id}`,'danger','สลิปไม่ผ่าน',`${o.title}: ${o.admin_note||'กรุณาตรวจสอบและส่งสลิปใหม่'}`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='pending_review')items.push(notice(`order-pending-${o.id}`,'warning','กำลังตรวจสลิป',course?`${o.title} กำลังรอเจ้าของคอร์สตรวจ`:`${o.title} กำลังรอตรวจสอบ`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='awaiting_payment')items.push(notice(`order-payment-${o.id}`,'warning','ออเดอร์รอชำระเงิน',`${o.title} · ${o.order_no}`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='paid')items.push(notice(`order-paid-${o.id}`,'success',course?'คอร์สพร้อมเรียนแล้ว':'สินค้าปลดล็อกแล้ว',o.title,course?'/my-courses.html':href,o.updated_at));
  }
  for(const c of courses.results||[]){if(c.review_status==='rejected')items.push(notice(`course-rejected-${c.id}`,'danger','Boss ขอให้แก้คอร์ส',`${c.title}: ${c.review_note||'กรุณาเปิดดูรายละเอียด'}`,`/course-basket-edit.html?id=${c.id}`,c.updated_at));else if(c.review_status==='pending')items.push(notice(`course-pending-${c.id}`,'warning','คอร์สรอ Boss ตรวจ',c.title,'/course-seller.html',c.updated_at));else if(c.review_status==='approved')items.push(notice(`course-approved-${c.id}`,'success','คอร์สเปิดขายแล้ว',c.title,`/product.html?slug=${c.slug||''}`,c.updated_at));
    if(c.edit_expires_at&&c.license_entitlement_id!==null){const days=Math.ceil((Date.parse(c.edit_expires_at)-Date.now())/86400000);if(days<=7)items.push(notice(`course-edit-${c.id}-${days<=0?'expired':'ending'}`,days<=0?'danger':'warning',days<=0?'หมดเวลาแก้ไขคอร์สแล้ว':`เหลือเวลาแก้ไข ${days} วัน`,c.title,`/course-basket-edit.html?id=${c.id}`,c.edit_expires_at));}
  }
  for(const x of issues.results||[])items.push(notice(`seller-slip-${x.id}`,'danger','มีสลิปรอคุณตรวจ',`${x.title} · ${x.order_no}`,'/course-seller.html',x.updated_at));
  const read=new Set((reads.results||[]).map(x=>x.notification_key)),unread=items.filter(x=>!read.has(x.key)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  return json({count:unread.length,items:unread},200,{'cache-control':'no-store'});
}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({}));
  const keys=(body.keys||[body.key]).map(x=>String(x||'').slice(0,180)).filter(Boolean);if(!keys.length)return json({error:'ไม่พบรายการแจ้งเตือน'},400);
  await ctx.env.DB.batch(keys.slice(0,100).map(key=>ctx.env.DB.prepare('INSERT OR REPLACE INTO notification_reads(user_id,notification_key,read_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(auth.user.id,key)));
  return json({ok:true,count:keys.length});
}
