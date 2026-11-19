import { json, requireAdmin } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { ensureAutoInviteSchema } from '../../../_auto_invite.js';

export const autoInviteAdminPageSql = `SELECT oi.id order_item_id,o.id order_id,o.order_no,o.user_id,o.status order_status,
    u.name user_name,u.email,oi.price,i.machine_id,i.key_last4,i.issued_at
    FROM vision7_programs p JOIN vision7_plans q ON q.program_id=p.id AND q.plan_code='lifetime'
    CROSS JOIN order_items oi INDEXED BY idx_auto_invite_order_items_product
    JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.user_id
    LEFT JOIN auto_invite_issues i ON i.order_item_id=oi.id
    WHERE p.code='auto-invite' AND oi.product_id=q.product_id AND oi.price=69000
      AND (o.status='paid' OR i.order_item_id IS NOT NULL) AND (? IS NULL OR oi.id<?)
    ORDER BY oi.id DESC LIMIT 25`;

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  await ensureAutoInviteSchema(ctx.env);
  const rawCursor = new URL(ctx.request.url).searchParams.get('cursor');
  const cursor = rawCursor && /^[1-9]\d*$/.test(rawCursor) ? Number(rawCursor) : null;
  if (rawCursor !== null && (cursor === null || !Number.isSafeInteger(cursor))) return json({ error:'cursor ไม่ถูกต้อง' },400,{'cache-control':'private, no-store'});
  const rows = (await ctx.env.DB.prepare(autoInviteAdminPageSql).bind(cursor,cursor).all()).results || [];
  return json({ items:rows.slice(0,24),next_cursor:rows.length>24?rows[23].order_item_id:null },200,{'cache-control':'private, no-store'});
}
