import { json, requireUser } from "../../_lib.js";
import { ensureDatabase } from "../../_schema.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const bangkokDay = (offset = 0) => {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000 + offset * 86400000);
  return date.toISOString().slice(0, 10);
};
const validDay = (value) => {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const url = new URL(ctx.request.url);
  const to = String(url.searchParams.get("to") || bangkokDay());
  const from = String(url.searchParams.get("from") || bangkokDay(-29));
  if (!validDay(from) || !validDay(to) || from > to)
    return json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, 400);
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > 60) return json({ error: "เลือกดูยอดขายได้ครั้งละไม่เกิน 60 วัน" }, 400);
  if (to > bangkokDay()) return json({ error: "วันที่สิ้นสุดต้องไม่เกินวันนี้" }, 400);

  const where = "o.course_owner_user_id=? AND o.status='paid' AND date(o.updated_at,'+7 hours') BETWEEN ? AND ?";
  const rows = await ctx.env.DB.prepare(
    `SELECT o.id,o.order_no,o.updated_at paid_at,o.total gross_total,
      CASE WHEN o.course_plan='partner' THEN o.teacher_revenue ELSE o.total END teacher_total,
      o.course_plan,COALESCE((SELECT product_title FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1),p.title,'สินค้าเดิม') course_title,
      COALESCE(NULLIF(TRIM(u.name),''),NULLIF(TRIM(u.username),''),'สมาชิก') buyer_name
     FROM orders o JOIN users u ON u.id=o.user_id
     LEFT JOIN products p ON p.id=(SELECT product_id FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1)
     WHERE ${where} ORDER BY o.updated_at DESC,o.id DESC LIMIT 500`,
  ).bind(auth.user.id, from, to).all();
  const summary = await ctx.env.DB.prepare(
    `SELECT COUNT(*) orders,COUNT(DISTINCT o.user_id) buyers,COALESCE(SUM(o.total),0) gross_total,
      COALESCE(SUM(CASE WHEN o.course_plan='partner' THEN o.teacher_revenue ELSE o.total END),0) teacher_total
     FROM orders o WHERE ${where}`,
  ).bind(auth.user.id, from, to).first();
  return json({
    from,
    to,
    max_days: 60,
    items: rows.results || [],
    limited: (rows.results || []).length >= 500,
    summary: {
      orders: Number(summary?.orders) || 0,
      buyers: Number(summary?.buyers) || 0,
      gross_total: Number(summary?.gross_total) || 0,
      teacher_total: Number(summary?.teacher_total) || 0,
    },
  }, 200, { "cache-control": "no-store" });
}
