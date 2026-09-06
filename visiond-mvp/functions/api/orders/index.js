import {ensureVxAccess,VX_PLANS} from '../../_vx_access.js';
import { json, requireUser, statusLabel } from "../../_lib.js";
import { loadPaymentSettings, publicPaymentSettings } from "../../_payment.js";
import { ensureDatabase } from "../../_schema.js";
import { ensureVision7Schema } from "../../_vision7_schema.js";
import { vision7LicenseEncryptionConfigured } from "../../_vision7_license_crypto.js";
import { rateLimit } from "../../_security.js";
import {applyPromotion,loadPromotion} from '../../_promotion.js';
import {loadSellerToken} from '../../_seller_token.js';
import {firstOrderPromoStatus,calculateFirstOrderDiscount} from '../../_first_order_promo.js';
import {courseRevenue} from '../../_course_plans.js';
import {ensureLifetimeMemberPlan} from '../../_member_plan.js';
import {activeReferralAttribution,ensureVxReferralSchema} from '../../_vx_referrals.js';
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
  await ensureLifetimeMemberPlan(ctx.env);
  await ensureVxAccess(ctx.env);
  await ensureVision7Schema(ctx.env);
  await ensureVxReferralSchema(ctx.env);
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
  const b = await ctx.request.json().catch(()=>null);
  if(!b||!Array.isArray(b.productSlugs)||b.productSlugs.length>30||(b.quantities!==undefined&&(b.quantities===null||typeof b.quantities!=='object'||Array.isArray(b.quantities))))return json({error:'ข้อมูลตะกร้าไม่ถูกต้อง'},400);
  const invalidQuantity=b.productSlugs.some(x=>{const slug=String(x||'').trim(),raw=b.quantities?.[slug];if(raw===undefined||raw===null||raw==='')return false;const quantity=Number(raw);return !Number.isInteger(quantity)||quantity<1||quantity>30});
  if(invalidQuantity)return json({error:'จำนวนสินค้าต้องเป็นเลขจำนวนเต็ม 1–30'},400);
  const requestedSlugs = b.productSlugs
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
    `SELECT p.id,p.slug,p.title,p.price,p.product_kind,p.category,p.member_category,p.member_duration_months,c.id seller_course_id,c.owner_user_id course_owner_user_id,c.course_plan,c.payment_bank_name,c.payment_account_name,c.payment_account_number,c.payment_qr_url,
      (SELECT q.id FROM vision7_plans q WHERE q.product_id=p.id AND q.active=1 AND q.plan_code IN ('monthly','yearly','lifetime') LIMIT 1) vision7_plan_id,
      (SELECT q.offer_price FROM vision7_plans q WHERE q.product_id=p.id AND q.active=1 AND q.plan_code IN ('monthly','yearly','lifetime') LIMIT 1) vision7_offer_price
     FROM products p LEFT JOIN courses c ON c.product_id=p.id AND c.course_type='online_course'
     WHERE p.slug IN (${qs}) AND p.status='published' AND p.deleted_at IS NULL`,
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
  if([...repeated].some(slug=>{const p=bySlug.get(slug);return p?.category!=='resale-rights'&&!p?.vision7_plan_id}))return json({error:'สินค้าดิจิทัลแต่ละตะกร้าซื้อได้ 1 ชิ้น รายการที่ซื้อซ้ำได้มีเฉพาะสิทธิ์ลงขายคอร์สและโปรแกรม Vision 7'},409);
  const orderedResults=requestedSlugs.map(slug=>bySlug.get(slug));
  if(orderedResults.some(product=>product.product_kind==='vision7-key'&&(!product.vision7_plan_id||!Number.isSafeInteger(Number(product.vision7_offer_price))||Number(product.vision7_offer_price)<=0||Number(product.price)!==Number(product.vision7_offer_price))))return json({error:'ราคาตะกร้าคีย์มีการเปลี่ยนแปลงหรือยังไม่พร้อมขาย กรุณาโหลดรายการใหม่',code:'VISION7_KEY_OFFER_PRICE_MISMATCH'},409);
  const vxItems=orderedResults.filter(p=>p.product_kind==='vx-access');
  if(vxItems.length && (orderedResults.length!==1||!VX_PLANS.some(p=>p.slug===vxItems[0].slug&&p.price===Number(vxItems[0].price))))return json({error:'สิทธิ์ VX ต้องชำระแยกครั้งละ 1 แพ็กเกจ กรุณาตรวจสอบตะกร้า'},400);
  const hasVision7=orderedResults.some(product=>product.vision7_plan_id);
  if(hasVision7&&!vision7LicenseEncryptionConfigured(ctx.env))return json({error:'Vision 7 ยังไม่ได้ตั้งค่า Secret เข้ารหัสคีย์ กรุณาติดต่อผู้ดูแลระบบ',code:'VISION7_LICENSE_ENCRYPTION_NOT_CONFIGURED'},503);
  const renewLicenseId=String(b.renew_license_id||'').trim();
  if(renewLicenseId){
    if(orderedResults.length!==1||!orderedResults[0].vision7_plan_id)return json({error:'การต่ออายุต้องเลือกแพ็กเกจ Vision 7 ครั้งละ 1 รายการ'},400);
    const renewal=await ctx.env.DB.prepare(`SELECT l.id FROM vision7_licenses l JOIN vision7_plans old_plan ON old_plan.id=l.plan_id JOIN vision7_plans new_plan ON new_plan.id=? WHERE l.id=? AND l.user_id=? AND l.program_id=new_plan.program_id AND old_plan.plan_code<>'lifetime' AND new_plan.plan_code<>'lifetime'`).bind(orderedResults[0].vision7_plan_id,renewLicenseId,a.user.id).first();
    if(!renewal)return json({error:'คีย์นี้ไม่สามารถต่ออายุด้วยแพ็กเกจที่เลือก'},409);
  }
  if(orderedResults.some(product=>product.category==='resale-rights')){
    if(payment.vision5_rights_auto_verify){
      let buyerApi='';try{buyerApi=await loadSellerToken(ctx.env,a.user.id)}catch(error){return json({error:String(error?.message)==='TOKEN_ENCRYPTION_NOT_CONFIGURED'?'ระบบยังไม่ได้ตั้งค่า Secret สำหรับถอดรหัส EasySlip Token กรุณาติดต่อผู้ดูแลระบบ':'EasySlip Token ใช้งานไม่ได้ กรุณาบันทึกใหม่',code:String(error?.message||'TOKEN_DECRYPT_FAILED')},503)}
      if(buyerApi.length<20)return json({error:'กรุณาบันทึก EasySlip API ของคุณเองในหน้าสิทธิ์ลงขายคอร์สก่อนสั่งซื้อ'},409);
    }
  }
  const sellerItems=orderedResults.filter(p=>p.course_owner_user_id);
  const companyCourseItems=orderedResults.filter(p=>p.seller_course_id&&!p.course_owner_user_id);
  const memberItems=orderedResults.filter(p=>p.product_kind==='member');
  if(memberItems.length&&(memberItems.length!==1||orderedResults.length!==1))return json({error:'ตะกร้า Member ต้องชำระแยกครั้งละ 1 แพ็กเกจ'},400);
  if(companyCourseItems.length&&(companyCourseItems.length!==1||orderedResults.length!==1))return json({error:'คอร์ส VisionD ต้องชำระแยกครั้งละ 1 คอร์ส'},400);
  if(sellerItems.length && (orderedResults.length!==1||sellerItems.length!==1))return json({error:'คอร์สจากผู้ขายต้องชำระแยกครั้งละ 1 คอร์ส'},400);
  if(sellerItems.some(product=>!Number.isFinite(Number(product.price))||Number(product.price)<100))return json({error:'คอร์สจากผู้ขายต้องมีราคาอย่างน้อย 1 บาท กรุณาแจ้งผู้ขายให้แก้ราคา'},409);
  if(sellerItems.some(product=>Number(product.course_owner_user_id)===Number(a.user.id)))return json({error:'ไม่สามารถซื้อคอร์สของบัญชีตนเองได้'},409);
  for (const product of results) {
    if(product.category==='resale-rights'||product.vision7_plan_id||product.product_kind==='vx-access')continue;
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
  const promotion=await loadPromotion(ctx.env),normalProducts=orderedResults.filter(p=>!['vision7-key','vx-access'].includes(p.product_kind)),promotedById=new Map(applyPromotion(normalProducts,promotion).map(p=>[Number(p.id),p])),pricedResults=orderedResults.map(p=>['vision7-key','vx-access'].includes(p.product_kind)?{...p,original_price:p.price,sale_price:p.price,promotion_percent:0}:promotedById.get(Number(p.id))),
    subtotal = pricedResults.reduce((sum, p) => sum + Number(p.sale_price), 0),
    discountableItems = pricedResults.filter(p=>p.category!=='resale-rights'&&p.category!=='bundle-deals'&&!['vision7-key','vx-access'].includes(p.product_kind)&&(!p.product_kind||p.product_kind==='product')),
    discountableCount = discountableItems.length,
    discountRate =
      discountableCount >= 30
        ? 75
        : discountableCount >= 20
          ? 50
          : discountableCount >= 10
            ? 25
            : discountableCount >= 5
              ? 15
              : 0,
    discountBase = discountableItems.reduce((sum,p)=>sum+Number(p.sale_price),0),
    bundleDiscount = Math.round((discountBase * discountRate) / 100),
    firstOrderStatus=await firstOrderPromoStatus(ctx.env,a.user.id),
    firstOrderDiscount=calculateFirstOrderDiscount(firstOrderStatus,discountBase),
    discount=firstOrderDiscount>0?firstOrderDiscount:bundleDiscount,
    appliedDiscountRate=firstOrderDiscount>0?50:discountRate,
    discountKind=firstOrderDiscount>0?'first_order_50':'bundle',
    total = subtotal - discount,
    orderNo =
      "VD-" +
      Date.now().toString().slice(-10) +
      "-" +
      Math.floor(Math.random() * 90 + 10);
  const seller=sellerItems[0],companyCourse=companyCourseItems[0],partnerCourse=seller?.course_plan==='partner',paymentTarget=companyCourse?{active_account:'bank',bank_name:companyCourse.payment_bank_name,account_name:companyCourse.payment_account_name,account_number:companyCourse.payment_account_number,qr_url:''}:seller&&!partnerCourse?{active_account:seller.payment_qr_url?'qr':'bank',bank_name:seller.payment_bank_name,account_name:seller.payment_account_name,account_number:seller.payment_account_number,qr_url:seller.payment_qr_url}:payment,revenue=courseRevenue(seller?.course_plan,total);
  const guardedProductIds=[...new Set(orderedResults.filter(p=>p.category!=='resale-rights'&&!p.vision7_plan_id&&p.product_kind!=='vx-access').map(p=>Number(p.id)))],guardJson=JSON.stringify(guardedProductIds);
  const referralAttribution=await activeReferralAttribution(ctx.env,a.user.id);
  const statements=[ctx.env.DB.prepare(`INSERT INTO orders(order_no,user_id,total,payment_account_type,payment_bank_name,payment_account_number,payment_account_name,course_owner_user_id,seller_course_id,payment_qr_url,discount_kind,discount_amount,course_plan,teacher_revenue,visiond_revenue,course_api_fee,vx_referral_attribution_id)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    WHERE (?='[]' OR NOT EXISTS(
      SELECT 1 FROM orders existing_order JOIN order_items existing_item ON existing_item.order_id=existing_order.id
      WHERE existing_order.user_id=? AND existing_order.status IN ('awaiting_payment','pending_review','paid')
      AND existing_item.product_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
    )) AND (?=0 OR NOT EXISTS(SELECT 1 FROM orders vo JOIN order_items vi ON vi.order_id=vo.id JOIN products vp ON vp.id=vi.product_id WHERE vo.user_id=? AND vo.status IN ('awaiting_payment','pending_review') AND vp.product_kind='vx-access'))`).bind(orderNo,a.user.id,total,paymentTarget.active_account,paymentTarget.bank_name,paymentTarget.account_number,paymentTarget.account_name,seller?.course_owner_user_id||null,seller?.seller_course_id||null,paymentTarget.qr_url||'',discountKind,discount,seller?.course_plan||'rights',seller?revenue.teacher:0,seller?revenue.visiond:0,seller?revenue.apiFee:0,referralAttribution?.id||null,guardJson,a.user.id,guardJson,vxItems.length,a.user.id)];
  for(const p of pricedResults)statements.push(ctx.env.DB.prepare('INSERT INTO order_items(order_id,product_id,product_title,price,vision7_renew_license_id) SELECT id,?,?,?,? FROM orders WHERE order_no=? AND user_id=?').bind(p.id,p.title,p.sale_price,renewLicenseId||null,orderNo,a.user.id));
  try{await ctx.env.DB.batch(statements)}catch(error){return json({error:'สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่'},409)}
  const created=await ctx.env.DB.prepare('SELECT id FROM orders WHERE order_no=? AND user_id=?').bind(orderNo,a.user.id).first(),orderId=created?.id;if(!orderId)return json({error:'มีสินค้าบางรายการซื้อแล้วหรือมีคำสั่งซื้อค้างอยู่ กรุณาตรวจสอบรายการของคุณ'},409);
  if(firstOrderDiscount>0)await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE first_order_promo_state SET used_order_id=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_order_id IS NULL').bind(orderId,a.user.id),
    ctx.env.DB.prepare("INSERT INTO user_activity_log(user_id,event_type,path,metadata) VALUES(?,'first_order_promo_applied','/cart',?)").bind(a.user.id,JSON.stringify({order_id:orderId,discount:firstOrderDiscount}))
  ]);
  return json(
    {
      ok: true,
      id: orderId,
      orderNo,
      subtotal,
      discountRate:appliedDiscountRate,
      discount,
      discountKind,
      total,
      items: pricedResults.map(p=>({...p,price:p.sale_price})),
      promotion,
      bank: seller||companyCourse?paymentTarget:publicPaymentSettings(payment),coursePlan:seller?.course_plan||null,revenue:seller?revenue:null,
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
    const lines=(await ctx.env.DB.prepare(`SELECT oi.order_id,oi.product_id id,p.slug,COALESCE(oi.product_title,p.title,'สินค้าเดิม') title,p.product_kind,p.category,c.id seller_course_id,oi.price,COUNT(*) quantity,SUM(oi.price) line_total FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id LEFT JOIN courses c ON c.product_id=oi.product_id AND c.course_type='online_course' WHERE oi.order_id IN (${ids.map(()=>'?').join(',')}) GROUP BY oi.order_id,oi.product_id,p.slug,COALESCE(oi.product_title,p.title,'สินค้าเดิม'),p.product_kind,p.category,c.id,oi.price ORDER BY oi.order_id DESC,MIN(oi.id)`).bind(...ids).all()).results||[];
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
// Feature: COMMERCE-ORDER-001 — server-owned pricing and order boundary
