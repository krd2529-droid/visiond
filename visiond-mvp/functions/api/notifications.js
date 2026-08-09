import {json,requireUser} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
import {firstOrderPromoStatus} from '../_first_order_promo.js';

const notice=(key,type,title,message,href,created_at)=>({key,type,title,message,href,created_at});
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const [orders,courses,issues,reads]=await Promise.all([
    ctx.env.DB.prepare(`SELECT o.id,o.order_no,o.status,o.admin_note,o.updated_at,o.seller_course_id,
      (SELECT COALESCE(oi.product_title,p.title,'สินค้า') FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id ORDER BY oi.id LIMIT 1) title,
      (SELECT p.slug FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id ORDER BY oi.id LIMIT 1) slug,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) item_count
      FROM orders o WHERE o.user_id=? AND o.status IN ('awaiting_payment','pending_review','rejected','paid') ORDER BY o.id DESC LIMIT 100`).bind(auth.user.id).all(),
    ctx.env.DB.prepare(`SELECT c.id,c.review_status,c.review_note,c.edit_expires_at,c.license_entitlement_id,c.updated_at,p.title,p.slug FROM courses c JOIN products p ON p.id=c.product_id WHERE c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC`).bind(auth.user.id).all(),
    ctx.env.DB.prepare(`SELECT o.id,o.order_no,o.total,o.updated_at,p.title,u.username FROM orders o JOIN products p ON p.id=(SELECT product_id FROM order_items WHERE order_id=o.id LIMIT 1) JOIN users u ON u.id=o.user_id WHERE o.course_owner_user_id=? AND o.status='pending_review' AND o.slip_key IS NOT NULL AND o.slip_verification_status='manual' ORDER BY o.id DESC`).bind(auth.user.id).all(),
    ctx.env.DB.prepare('SELECT notification_key FROM notification_reads WHERE user_id=?').bind(auth.user.id).all()
  ]);
  const items=[];
  const firstOrder=await firstOrderPromoStatus(ctx.env,auth.user.id);
  if(firstOrder.stage==='teaser')items.push(notice('first-order-teaser','danger','🎁 มีของขวัญสมาชิกใหม่รออยู่','กลับมาอีกครั้งเพื่อรับสิทธิพิเศษสำหรับการซื้อครั้งแรก','/',''));
  if(firstOrder.stage==='offer'&&firstOrder.active)items.push(notice('first-order-offer','danger','🔥 ส่วนลดพิเศษของคุณมาแล้ว','ลด 50% สูงสุด 200 บาท เมื่อยอดสินค้าที่ร่วมรายการ 399 บาทขึ้นไป · ระบบใช้ให้อัตโนมัติ · ไม่รวมสิทธิ์ลงขายคอร์สออนไลน์','/digital-products.html',firstOrder.expires_at));
  for(const o of orders.results||[]){const course=Boolean(o.seller_course_id),href=course?'/dashboard.html#orders':`/product.html?slug=${encodeURIComponent(o.slug||'')}`,label=`${o.title||'สินค้า'}${Number(o.item_count)>1?` และรายการอื่น รวม ${Number(o.item_count)} ชิ้น`:''}`;
    if(o.status==='rejected')items.push(notice(`order-rejected-${o.id}`,'danger','สลิปไม่ผ่าน',`${label}: ${o.admin_note||'กรุณาตรวจสอบและส่งสลิปใหม่'}`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='pending_review')items.push(notice(`order-pending-${o.id}`,'warning','กำลังตรวจสลิป',course?`${label} กำลังรอเจ้าของคอร์สตรวจ`:`${label} กำลังรอตรวจสอบ`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='awaiting_payment')items.push(notice(`order-payment-${o.id}`,'warning','ออเดอร์รอชำระเงิน',`${label} · ${o.order_no}`,'/dashboard.html#orders',o.updated_at));
    else if(o.status==='paid')items.push(notice(`order-paid-${o.id}`,'success',course?'คอร์สพร้อมเรียนแล้ว':'สินค้าปลดล็อกแล้ว',label,course?'/my-courses.html':href,o.updated_at));
  }
  for(const c of courses.results||[]){if(c.review_status==='suspended')items.push(notice(`course-suspended-${c.id}`,'danger','ตะกร้าคอร์สถูกระงับ',`${c.title}: ${c.review_note||'กรุณาติดต่อ VisionD'}`,'/course-seller.html',c.updated_at));else if(c.review_status==='changes_requested')items.push(notice(`course-changes-${c.id}`,'danger','Boss ขอให้แก้คอร์ส',`${c.title}: ${c.review_note||'กรุณาเปิดดูรายละเอียด'}`,`/course-basket-edit.html?id=${c.id}`,c.updated_at));else if(c.review_status==='pending')items.push(notice(`course-pending-${c.id}`,'warning','คอร์สรอ Boss ตรวจ',c.title,'/course-seller.html',c.updated_at));else if(c.review_status==='approved')items.push(notice(`course-approved-${c.id}`,'success','คอร์สเปิดขายแล้ว',c.title,`/product.html?slug=${c.slug||''}`,c.updated_at));
    if(c.edit_expires_at&&c.license_entitlement_id!==null){const days=Math.ceil((Date.parse(c.edit_expires_at)-Date.now())/86400000);if(days<=7)items.push(notice(`course-edit-${c.id}-${days<=0?'expired':'ending'}`,days<=0?'danger':'warning',days<=0?'หมดเวลาแก้ไขคอร์สแล้ว':`เหลือเวลาแก้ไข ${days} วัน`,c.title,`/course-basket-edit.html?id=${c.id}`,c.edit_expires_at));}
  }
  for(const x of issues.results||[])items.push(notice(`seller-slip-${x.id}`,'danger',`มีสลิปยอด ${new Intl.NumberFormat('th-TH').format((Number(x.total)||0)/100)} บาทรอคุณตรวจ`,`ผู้ใช้ @${x.username||'สมาชิก'} · ${x.title} · ${x.order_no}`,'/course-seller.html#slipIssueRows',x.updated_at));
  const read=new Set((reads.results||[]).map(x=>x.notification_key)),unread=items.filter(x=>!read.has(x.key)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  return json({count:unread.length,items:unread},200,{'cache-control':'no-store'});
}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({}));
  const keys=(body.keys||[body.key]).map(x=>String(x||'').slice(0,180)).filter(Boolean);if(!keys.length)return json({error:'ไม่พบรายการแจ้งเตือน'},400);
  await ctx.env.DB.batch(keys.slice(0,100).map(key=>ctx.env.DB.prepare('INSERT OR REPLACE INTO notification_reads(user_id,notification_key,read_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(auth.user.id,key)));
  return json({ok:true,count:keys.length});
}
