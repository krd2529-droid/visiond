import { json, requireBoss } from '../../../_lib.js';

// Bounded exception queue: only paid VSMS items without a fulfillment marker.
export async function onRequestGet(ctx) {
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const cursorText = new URL(ctx.request.url).searchParams.get('cursor');
  const cursor = cursorText == null ? null : Number(cursorText);
  const privateHeaders = { 'cache-control': 'private, no-store' };
  if (cursorText != null && (!Number.isSafeInteger(cursor) || cursor < 1)) return json({ error: 'cursor ไม่ถูกต้อง' }, 400, privateHeaders);
  const rows = (await ctx.env.DB.prepare(`SELECT oi.id missing_item_id,o.id order_id,o.order_no,o.total,u.name customer_name,u.email customer_email
    FROM vision7_programs p JOIN vision7_plans q ON q.program_id=p.id
    CROSS JOIN order_items oi ON oi.product_id=q.product_id
    JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.user_id
    LEFT JOIN vision7_order_fulfillments f ON f.order_item_id=oi.id
    WHERE p.code='sms-mix' AND o.status='paid' AND f.order_item_id IS NULL AND (? IS NULL OR oi.id<?)
    ORDER BY oi.id DESC LIMIT 25`).bind(cursor,cursor).all()).results || [];
  const items = rows.slice(0,24);
  return json({ items, next_cursor: rows.length > 24 ? items.at(-1).missing_item_id : null }, 200, privateHeaders);
}
