import {json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {requireVision7User} from '../../_vision7_auth.js';
import {ensureVEasyRuntimeSchema,requireAppSession} from '../../_veasy_runtime.js';

const noStore={'cache-control':'no-store'};
const projection={
  order_cancelled:{category:'orders',priority:6,title:'ออเดอร์ถูกยกเลิก',summary:'คืนสต็อกและบันทึกการยกเลิกแล้ว'},
  product_updated:{category:'stock',priority:2,title:'แก้ไขสินค้าแล้ว',summary:'ข้อมูลสินค้าในร้านได้รับการอัปเดต'},
  product_deleted:{category:'stock',priority:3,title:'ลบสินค้าแล้ว',summary:'สินค้าที่ไม่มีประวัติขายถูกลบแล้ว'},
  product_hidden_with_history:{category:'stock',priority:4,title:'ซ่อนสินค้าแล้ว',summary:'เก็บสินค้าไว้ในประวัติออเดอร์'},
  bot_state_changed:{category:'botErrors',priority:5,title:'สถานะบอทเปลี่ยนแปลง',summary:'เปิด V Easy เพื่อตรวจสถานะล่าสุด'}
};
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyRuntimeSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;const appError=requireAppSession(auth.user);if(appError)return appError;
  const raw=new URL(ctx.request.url).searchParams.get('limit')||'30',limit=Number(raw);if(!Number.isInteger(limit)||limit<1||limit>50)return json({error:'limit ต้องอยู่ระหว่าง 1–50',code:'VEASY_EVENT_LIMIT_INVALID'},400,noStore);
  const rows=await ctx.env.DB.prepare(`SELECT a.id,a.event_type,a.entity_type,a.entity_id,a.created_at FROM veasy_audit_log a JOIN veasy_shops s ON s.id=a.shop_id JOIN vision7_licenses l ON l.id=s.license_id AND l.user_id=s.user_id WHERE s.user_id=? AND s.status='active' AND l.status IN ('active','trial') ORDER BY a.created_at DESC,a.id DESC LIMIT ?`).bind(auth.user.id,limit).all();
  const events=(rows.results||[]).map(row=>{const safe=projection[row.event_type]||{category:'messages',priority:1,title:'เหตุการณ์ของร้าน',summary:'เปิด V Easy เพื่อดูรายละเอียด'};return {id:row.id,...safe,entityType:row.entity_type||null,entityId:row.entity_id||null,createdAt:row.created_at}});
  return json({events,privacy:'no_customer_pii',limit},200,noStore);
}
