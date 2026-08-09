import { json, requireUser, statusLabel } from "../../_lib.js";
import { loadPaymentSettings, publicPaymentSettings } from "../../_payment.js";
import { ensureDatabase } from "../../_schema.js";
import { rateLimit } from "../../_security.js";
import {applyPromotion,loadPromotion} from '../../_promotion.js';
import {loadSellerToken} from '../../_seller_token.js';
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
  const invalidQuantity=(b.productSlugs||[]).some(x=>{const slug=String(x||'').trim(),raw=b.quantities?.[slug];if(raw===undefined||raw===null||raw==='')return false;const quantity=Number(raw);return !Number.isInteger(quantity)||quantity<1||quantity>30});
  if(invalidQuantity)return json({error:'จำนวนสินค้าต้องเป็นเลขจำนวนเต็ม 1–30'},400);
  const requestedSlugs = (b.productSlugs || [])
    .flatMap((x) => {const slug=String(x || "").trim(),quantity=Number(b.quantities?.[slug]||1);return Array(quantity).fill(slug)})
    .filter(Boolean);
  const slugs = [
    ...new Set(
      requestedSlugs,
    ),
  ];
  if (!slugs.length) return json({ error: "ไม่มีสินค้าในตะกร้า" }, 400);
  if (requestedSlugs.length > 30)
    return json({ error: "เลือกสินค้าได้สูงสุด 30 ตะกร้าต่อคำสั่งซื้อ" }, 400);
  await ensureStarterProducts(ctx.env, slugs);
  const qs = slugs.map(() => "?").join(",");
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.id,p.slug,p.title,p.price,p.product_kind,p.category,c.id seller_course_id,c.owner_user_id course_owner_user_id,c.payment_bank_name,c.payment_account_name,c.payment_account_number,c.payment_qr_url
     FROM products p LEFT JOIN courses c ON c.product_id=p.id AND c.owner_user_id IS NOT NULL
     WHERE p.slug IN (${qs}) AND p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product')<>'member'`,
  )
    .bind(...slugs)
    .all();
  if (results.length !== slugs.length)
    return json(
      { error: "มีสินค้าบางรายการไม่พร้อมขาย กรุณาลบสินค้าออกแล้วเพิ่มใหม่" },
      400,
    );
  const bySlug=new Map(results.map(product=>[product.slug,product]));
  const repeated=new Set(requestedSlugs.filter((slug,index,list)=>list.indexOf(slug)!==index));
  if([...repeated].some(slug=>bySlug.get(slug)?.category!=='resale-rights'))return json({error:'สินค้าดิจิทัลแต่ละตะกร้าซื้อได้ 1 ชิ้น รายการที่ซื้อซ้ำได้มีเฉพาะสิทธิ์ลงขายคอร์ส'},409);
  const orderedResults=requestedSlugs.map(slug=>bySlug.get(slug));
  if(orderedResults.some(product=>product.category==='resale-rights')){
    let buyerApi='';try{buyerApi=await loadSellerToken(ctx.env,a.user.id)}catch(error){return json({error:String(error?.message)==='TOKEN_ENCRYPTION_NOT_CONFIGURED'?'ระบบยังไม่ได้ตั้งค่า Secret สำหรับถอดรหัส EasySlip Token กรุณาติดต่อผู้ดูแลระบบ':'EasySlip Token ใช้งานไม่ได้ กรุณาบันทึกใหม่',code:String(error?.message||'TOKEN_DECRYPT_FAILED')},503)}
    if(buyerApi.length<20)return json({error:'กรุณาบันทึก EasySlip API ของคุณเองในหน้าสิทธิ์ลงขายคอร์สก่อนสั่งซื้อ'},409);
  }
  const sellerItems=orderedResults.filter(p=>p.course_owner_user_id);
  if(sellerItems.length && (orderedResults.length!==1||sellerItems.length!==1))return json({error:'คอร์สจากผู้ขายต้องชำระแยกครั้งละ 1 คอร์ส'},400);
  if(sellerItems.some(product=>!Number.isFinite(Number(product.price))||Number(product.price)<100))return json({error:'คอร์สจากผู้ขายต้องมีราคาอย่างน้อย 1 บาท กรุณาแจ้งผู้ขายให้แก้ราคา'},409);
  if(sellerItems.some(product=>Number(product.course_owner_user_id)===Number(a.user.id)))return json({error:'ไม่สามารถซื้อคอร์สของบัญชีตนเองได้'},409);
  for (const product of results) {
    if(product.category==='resale-rights')continue;
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
  const promotion=await loadPromotion(ctx.env),pricedResults=applyPromotion(orderedResults,promotion),
    subtotal = pricedResults.reduce((sum, p) => sum + Number(p.sale_price), 0),
    discountableItems = pricedResults.filter(p=>p.category!=='resale-rights'&&(!p.product_kind||p.product_kind==='product')),
    discountableCount = discountableItems.length,
    discountRate =
      discountableCount >= 30
        ? 30
        : discountableCount >= 20
          ? 20
          : discountableCount >= 10
            ? 10
            : discountableCount >= 5
              ? 5
              : 0,
    discountBase = discountableItems.reduce((sum,p)=>sum+Number(p.sale_price),0),
    discount = Math.round((discountBase * discountRate) / 100),
    total = subtotal - discount,
    orderNo =
      "VD-" +
      Date.now().toString().slice(-10) +
      "-" +
      Math.floor(Math.random() * 90 + 10);
  const seller=sellerItems[0],paymentTarget=seller?{active_account:seller.payment_qr_url?'qr':'bank',bank_name:seller.payment_bank_name,account_name:seller.payment_account_name,account_number:seller.payment_account_number,qr_url:seller.payment_qr_url}:payment;
  const guardedProductIds=[...new Set(orderedResults.filter(p=>p.category!=='resale-rights').map(p=>Number(p.id)))],guardJson=JSON.stringify(guardedProductIds);
  const statements=[ctx.env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,payment_account_type,payment_bank_name,payment_account_name,payment_account_number,course_owner_user_id,seller_course_id,payment_qr_url)
    SELECT ?,?,?,?,?,?,?,?,?,?
    WHERE ?='[]' OR NOT EXISTS(
      SELECT 1 FROM orders existing_order JOIN order_items existing_item ON existing_item.order_id=existing_order.id
      WHERE existing_order.user_id=? AND existing_order.status IN ('awaiting_payment','pending_review','paid')
      AND existing_item.product_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
    )`).bind(orderNo,a.user.id,total,paymentTarget.active_account,paymentTarget.bank_name,paymentTarget.account_name,paymentTarget.account_number,seller?.course_owner_user_id||null,seller?.seller_course_id||null,paymentTarget.qr_url||'',guardJson,a.user.id,guardJson)];
  for(const p of pricedResults)statements.push(ctx.env.DB.prepare('INSERT INTO order_items(order_id,product_id,product_title,price) SELECT id,?,?,? FROM orders WHERE order_no=? AND user_id=?').bind(p.id,p.title,p.sale_price,orderNo,a.user.id));
  try{await ctx.env.DB.batch(statements)}catch(error){return json({error:'สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่'},409)}
  const created=await ctx.env.DB.prepare('SELECT id FROM orders WHERE order_no=? AND user_id=?').bind(orderNo,a.user.id).first(),orderId=created?.id;if(!orderId)return json({error:'มีสินค้าบางรายการซื้อแล้วหรือมีคำสั่งซื้อค้างอยู่ กรุณาตรวจสอบรายการของคุณ'},409);
  return json(
    {
      ok: true,
      id: orderId,
      orderNo,
      subtotal,
      discountRate,
      discount,
      total,
      items: pricedResults.map(p=>({...p,price:p.sale_price})),
      promotion,
      bank: seller?paymentTarget:publicPaymentSettings(payment),
    },
    201,
  );
}
export async function onRequestGet(ctx) {
  const a = await requireUser(ctx);
  if (a.error) return a.error;
  const url=new URL(ctx.request.url),limit=Math.min(100,Math.max(1,Number.parseInt(url.searchParams.get('limit'),10)||30)),rawCursor=url.searchParams.get('cursor'),cursor=rawCursor===null?null:Number(rawCursor);
  if(rawCursor!==null&&(!/^\d+$/.test(rawCursor)||!Number.isSafeInteger(cursor)||cursor<1))return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400);
  const query=cursor
    ? ctx.env.DB.prepare("SELECT * FROM orders WHERE user_id=? AND id<? ORDER BY id DESC LIMIT ?").bind(a.user.id,cursor,limit+1)
    : ctx.env.DB.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT ?").bind(a.user.id,limit+1);
  const page=await query.all(),results=page.results||[],hasMore=results.length>limit;
  if(hasMore)results.pop();
  const byOrder=new Map();
  if(results.length){
    const ids=results.map(order=>Number(order.id));
    const lines=(await ctx.env.DB.prepare(`SELECT oi.order_id,oi.product_id id,p.slug,COALESCE(oi.product_title,p.title,'สินค้าเดิม') title,p.product_kind,p.category,oi.price,COUNT(*) quantity,SUM(oi.price) line_total FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id IN (${ids.map(()=>'?').join(',')}) GROUP BY oi.order_id,oi.product_id,p.slug,COALESCE(oi.product_title,p.title,'สินค้าเดิม'),p.product_kind,p.category,oi.price ORDER BY oi.order_id DESC,MIN(oi.id)`).bind(...ids).all()).results||[];
    for(const item of lines){const items=byOrder.get(Number(item.order_id))||[];items.push(item);byOrder.set(Number(item.order_id),items)}
  }
  for (const o of results) {
    o.items = byOrder.get(Number(o.id))||[];
    o.status_label = statusLabel(o.status);
    o.bank = o.payment_account_name ? {
      active_account: o.payment_account_type,
      bank_name: o.payment_bank_name,
      account_name: o.payment_account_name,
      account_number: o.payment_account_number,
      qr_url: o.payment_qr_url || '',
    } : null;
  }
  const last=results.at(-1);
  return json({items:results,bank:publicPaymentSettings(await loadPaymentSettings(ctx.env)),pagination:{limit,has_more:hasMore,next_cursor:hasMore&&last?String(last.id):null}},200,{"cache-control":"no-store"});
}
