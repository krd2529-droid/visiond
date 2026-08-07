import { json, requireUser, statusLabel } from "../../_lib.js";
import { loadPaymentSettings, publicPaymentSettings } from "../../_payment.js";
import { ensureDatabase } from "../../_schema.js";
import { rateLimit } from "../../_security.js";
const starterProducts = [1, 2, 3, 4].map((n) => ({
  slug: `dinosaur-coloring-200-set-${n}`,
  title: `ชุดรวมระบายสีไดโนเสาร์ 200 แผ่นชุดที่ ${n}`,
  cover: `/assets/dinosaur-set-${n}.jpeg`,
}));
async function ensureStarterProducts(env, slugs) {
  return { env, slugs };
}
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const a = await requireUser(ctx);
  if (a.error) return a.error;
  if (a.user.role !== "boss") {
    const limited = await rateLimit(
      ctx.env,
      ctx.request,
      "create_order",
      20,
      60,
      60,
    );
    if (limited.error) return limited.error;
  }
  const payment = await loadPaymentSettings(ctx.env);
  if (!payment.accepting_orders)
    return json(
      { error: "ขณะนี้ VisionD ปิดรับคำสั่งซื้อชั่วคราว กรุณาติดต่อ LINE" },
      503,
    );
  const b = await ctx.request.json();
  const requestedSlugs = (b.productSlugs || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const slugs = [
    ...new Set(
      requestedSlugs,
    ),
  ];
  if (!slugs.length) return json({ error: "ไม่มีสินค้าในตะกร้า" }, 400);
  if (slugs.length !== requestedSlugs.length)
    return json(
      { error: "สินค้าดิจิทัลแต่ละตะกร้าซื้อได้ 1 ชิ้น ห้ามใส่รายการเดิมซ้ำ" },
      409,
    );
  if (slugs.length > 30)
    return json({ error: "เลือกสินค้าได้สูงสุด 30 ตะกร้าต่อคำสั่งซื้อ" }, 400);
  await ensureStarterProducts(ctx.env, slugs);
  const qs = slugs.map(() => "?").join(",");
  const { results } = await ctx.env.DB.prepare(
    `SELECT id,slug,title,price FROM products WHERE slug IN (${qs}) AND status='published' AND deleted_at IS NULL`,
  )
    .bind(...slugs)
    .all();
  if (results.length !== slugs.length)
    return json(
      { error: "มีสินค้าบางรายการไม่พร้อมขาย กรุณาลบสินค้าออกแล้วเพิ่มใหม่" },
      400,
    );
  for (const product of results) {
    const entitlement = await ctx.env.DB.prepare(
      "SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND active=1 LIMIT 1",
    )
      .bind(a.user.id, product.id)
      .first();
    const existing = entitlement
      ? { status: "paid" }
      : await ctx.env.DB.prepare(
          "SELECT o.status FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=? AND oi.product_id=? AND o.status IN ('awaiting_payment','pending_review','paid') ORDER BY o.id DESC LIMIT 1",
        )
          .bind(a.user.id, product.id)
          .first();
    if (existing) {
      const message =
        existing.status === "paid"
          ? "สินค้านี้ซื้อแล้วและอยู่ในสินค้าของฉัน"
          : existing.status === "pending_review"
            ? "สินค้านี้ส่งสลิปแล้วและกำลังรอตรวจสอบ"
            : "สินค้านี้มีคำสั่งซื้อที่รอชำระเงินอยู่แล้ว";
      return json(
        { error: message, status: existing.status, slug: product.slug },
        409,
      );
    }
  }
  const subtotal = results.reduce((sum, p) => sum + Number(p.price), 0),
    discountRate =
      results.length >= 30
        ? 20
        : results.length >= 20
          ? 15
          : results.length >= 10
            ? 10
            : results.length >= 5
              ? 5
              : 0,
    discount = Math.round((subtotal * discountRate) / 100),
    total = subtotal - discount,
    orderNo =
      "VD-" +
      Date.now().toString().slice(-10) +
      "-" +
      Math.floor(Math.random() * 90 + 10);
  const r = await ctx.env.DB.prepare(
    "INSERT INTO orders(order_no,user_id,total,payment_account_type,payment_bank_name,payment_account_name,payment_account_number) VALUES(?,?,?,?,?,?,?)",
  )
    .bind(orderNo, a.user.id, total, payment.active_account, payment.bank_name, payment.account_name, payment.account_number)
    .run();
  const orderId = r.meta.last_row_id;
  for (const p of results)
    await ctx.env.DB.prepare(
      "INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,?)",
    )
      .bind(orderId, p.id, p.price)
      .run();
  return json(
    {
      ok: true,
      id: orderId,
      orderNo,
      subtotal,
      discountRate,
      discount,
      total,
      items: results,
      bank: publicPaymentSettings(payment),
    },
    201,
  );
}
export async function onRequestGet(ctx) {
  const a = await requireUser(ctx);
  if (a.error) return a.error;
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM orders WHERE user_id=? ORDER BY id DESC",
  )
    .bind(a.user.id)
    .all();
  for (const o of results) {
    const x = await ctx.env.DB.prepare(
      "SELECT p.id,p.slug,p.title,oi.price FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?",
    )
      .bind(o.id)
      .all();
    o.items = x.results;
    o.status_label = statusLabel(o.status);
    o.bank = o.payment_account_name ? {
      active_account: o.payment_account_type,
      bank_name: o.payment_bank_name,
      account_name: o.payment_account_name,
      account_number: o.payment_account_number,
    } : null;
  }
  return json({ items: results, bank: publicPaymentSettings(await loadPaymentSettings(ctx.env)) },200,{"cache-control":"no-store"});
}
