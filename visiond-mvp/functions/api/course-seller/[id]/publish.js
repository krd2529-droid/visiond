import { json, requireUser } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";
import {loadSellerToken} from '../../../_seller_token.js';
async function lessonValidation(env, courseId, expected) {
  const rows = await env.DB.prepare(
    `SELECT l.id,l.title,l.sort_order,
    CASE WHEN l.video_key IS NOT NULL OR l.pdf_key IS NOT NULL OR EXISTS(SELECT 1 FROM course_lesson_files f WHERE f.lesson_id=l.id) THEN 1 ELSE 0 END has_media
    FROM course_lessons l WHERE l.course_id=? ORDER BY l.sort_order,l.id`,
  )
    .bind(courseId)
    .all();
  const lessons = rows.results || [],
    required = Math.max(1, Number(expected) || 1),
    missing = [];
  for (let index = 0; index < lessons.length; index++)
    if (
      !String(lessons[index].title || "").trim() ||
      !Number(lessons[index].has_media)
    )
      missing.push(index + 1);
  if (lessons.length < required)
    for (let index = lessons.length; index < required; index++)
      missing.push(index + 1);
  return {
    complete: lessons.length === required && !missing.length,
    actual: lessons.length,
    required,
    missing: [...new Set(missing)],
  };
}
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({})),
    price = Math.round(Number(body.price_baht) * 100),
    contact = String(body.contact_info || "")
      .trim()
      .slice(0, 200);
  if (!Number.isFinite(price) || price < 100)
    return json({ error: "กรุณาระบุราคาขายอย่างน้อย 1 บาท" }, 400);
  if (!contact) return json({ error: "กรุณาระบุช่องทางติดต่อ" }, 400);
  if (body.confirm_permanent !== true)
    return json(
      {
        error: "กรุณายืนยันการผูกตะกร้าถาวรและกฎห้ามเปลี่ยนเนื้อหาหลังมียอดขาย",
      },
      400,
    );
  const course = await ctx.env.DB.prepare(
    `SELECT c.id,c.product_id,c.license_entitlement_id,c.basket_binding_locked,c.expected_episodes,p.title FROM courses c JOIN products p ON p.id=c.product_id WHERE c.id=? AND c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL`,
  )
    .bind(ctx.params.id, auth.user.id)
    .first();
  if (!course) return json({ error: "ไม่พบคอร์สของคุณ" }, 404);
  if (course.license_entitlement_id !== null || course.basket_binding_locked)
    return json(
      { error: "คอร์สนี้เคยผูกตะกร้าแล้ว ไม่สามารถผูกซ้ำหรือเปลี่ยนตะกร้าได้" },
      409,
    );
  const validation = await lessonValidation(
    ctx.env,
    course.id,
    course.expected_episodes,
  );
  if (!validation.complete) {
    const detail = validation.missing.length
      ? ` EP ที่ยังไม่พร้อม: ${validation.missing.join(", ")}`
      : "";
    return json(
      {
        error: `บทเรียนยังไม่ครบ (${validation.actual}/${validation.required} EP)${detail}`,
        lesson_validation: validation,
      },
      409,
    );
  }
  const owner = await ctx.env.DB.prepare(
    "SELECT seller_bank_name,seller_account_name,seller_account_number,seller_payment_status FROM users WHERE id=?",
  )
    .bind(auth.user.id)
    .first();
  if (owner?.seller_payment_status !== "approved")
    return json(
      {
        error: "กรุณาตั้งค่าบัญชีรับเงินและรอ Boss อนุมัติก่อนเผยแพร่",
        payment_profile_required: true,
      },
      409,
    );
  let sellerToken='';try{sellerToken=await loadSellerToken(ctx.env,auth.user.id)}catch(error){return json({error:String(error?.message)==='TOKEN_ENCRYPTION_NOT_CONFIGURED'?'ระบบยังไม่ได้ตั้งค่า Secret สำหรับถอดรหัส EasySlip Token กรุณาติดต่อผู้ดูแลระบบ':'EasySlip Token ใช้งานไม่ได้ กรุณาบันทึกใหม่',code:String(error?.message||'TOKEN_DECRYPT_FAILED')},503)}
  if (sellerToken.length < 20)
    return json(
      {
        error: "กรุณาตั้งค่า EasySlip API ของคุณก่อนเผยแพร่",
        slip_api_required: true,
      },
      409,
    );
  const credit = await ctx.env.DB.prepare(
    "SELECT id FROM course_right_credits WHERE user_id=? AND active=1 AND used_course_id IS NULL ORDER BY id LIMIT 1",
  )
    .bind(auth.user.id)
    .first();
  if (!credit)
    return json(
      {
        error: "เครดิตตะกร้าไม่พอ กรุณาซื้อสิทธิ์ก่อน",
        credit_required: true,
        buy_url: "/product.html?slug=course-selling-rights",
      },
      409,
    );
  const bindingId = -Number(credit.id),
    expires = new Date(Date.now() + 30 * 86400000).toISOString(),
    paymentQrUrl = `/api/course-seller/payment-qr/${bindingId}`;
  try {
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        "UPDATE courses SET license_entitlement_id=?,basket_binding_locked=1,basket_bound_at=CURRENT_TIMESTAMP,edit_expires_at=?,license_edit_days=30,contact_info=?,payment_bank_name=?,payment_account_name=?,payment_account_number=?,payment_qr_url=?,review_status='pending',review_note='',submitted_at=CURRENT_TIMESTAMP,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=? AND license_entitlement_id IS NULL AND basket_binding_locked=0 AND EXISTS(SELECT 1 FROM course_right_credits WHERE id=? AND user_id=? AND active=1 AND used_course_id IS NULL)",
      ).bind(
        bindingId,
        expires,
        contact,
        owner.seller_bank_name,
        owner.seller_account_name,
        owner.seller_account_number,
        paymentQrUrl,
        course.id,
        auth.user.id,
        credit.id,
        auth.user.id,
      ),
      ctx.env.DB.prepare(
        "UPDATE course_right_credits SET active=0,used_at=CURRENT_TIMESTAMP,used_course_id=? WHERE id=? AND user_id=? AND active=1 AND used_course_id IS NULL AND EXISTS(SELECT 1 FROM courses WHERE id=? AND owner_user_id=? AND license_entitlement_id=? AND basket_binding_locked=1)",
      ).bind(
        course.id,
        credit.id,
        auth.user.id,
        course.id,
        auth.user.id,
        bindingId,
      ),
      ctx.env.DB.prepare(
        "UPDATE products SET price=?,status='draft',source='course-seller',updated_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS(SELECT 1 FROM courses WHERE id=? AND license_entitlement_id=?)",
      ).bind(price, course.product_id, course.id, bindingId),
    ]);
    if (
      !results[0].meta.changes ||
      !results[1].meta.changes ||
      !results[2].meta.changes
    )
      throw new Error("BINDING_CONFLICT");
    return json({
      ok: true,
      course_id: course.id,
      edit_expires_at: expires,
      review_status: "pending",
      message: "ผูกคอร์สกับตะกร้าถาวร หัก 1 เครดิต และส่งให้ Boss ตรวจแล้ว",
    });
  } catch (error) {
    return json(
      { error: "ผูกตะกร้าไม่สำเร็จ เครดิตไม่ถูกหัก กรุณาลองใหม่" },
      409,
    );
  }
}
