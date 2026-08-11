import { json, requireUser } from "../../_lib.js";
import { ensureDatabase } from "../../_schema.js";
const canEdit = (course) =>
    !course.edit_expires_at || Date.parse(course.edit_expires_at) > Date.now(),
  slugTags = new Set([
    "Shopee",
    "TikTok",
    "Lazada",
    "Kalodata",
    "YouTube",
    "Gemini",
    "Grok",
    "ChatGPT",
    "Facebook",
    "Canva",
    "อื่น ๆ",
  ]);
const ext = (file) =>
  file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : "jpg";
async function owned(ctx, user) {
  return ctx.env.DB.prepare(
    `SELECT c.*,p.title,p.short_description,p.description,p.price,p.cover_url,p.slug FROM courses c JOIN products p ON p.id=c.product_id WHERE c.id=? AND c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL`,
  )
    .bind(ctx.params.id, user.id)
    .first();
}
async function hasPaidSale(ctx, courseId) {
  return Boolean(
    await ctx.env.DB.prepare(
      "SELECT id FROM orders WHERE seller_course_id=? AND status IN ('pending_review','paid') LIMIT 1",
    )
      .bind(courseId)
      .first(),
  );
}
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const course = await owned(ctx, auth.user);
  if (!course) return json({ error: "ไม่พบคอร์ส" }, 404);
  return json(
    {
      item: course,
      editable: canEdit(course),
      content_locked: await hasPaidSale(ctx, course.id),
    },
    200,
    { "cache-control": "no-store" },
  );
}
export async function onRequestPut(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const course = await owned(ctx, auth.user);
  if (!course) return json({ error: "ไม่พบคอร์ส" }, 404);
  const form = await ctx.request.formData(),
    price = Math.round(Number(form.get("price_baht")) * 100),
    contact = String(form.get("contact_info") || "")
      .trim()
      .slice(0, 200);
  if (await hasPaidSale(ctx, course.id)) {
    if (!Number.isFinite(price) || price < 100)
      return json({ error: "กรุณาระบุราคาขายอย่างน้อย 1 บาท" }, 400);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        "UPDATE products SET price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(price, course.product_id),
      ctx.env.DB.prepare(
        "UPDATE courses SET contact_info=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(contact, course.id),
    ]);
    return json({
      ok: true,
      content_locked: true,
      message:
        "บันทึกข้อมูลการขายแล้ว หลังมียอดขายเปลี่ยนแปลงเนื้อหาทั้งหมดไม่ได้ หากแก้ข้อผิดพลาดภายในต้องติดต่อ VisionD เท่านั้น",
    });
  }
  if (!canEdit(course))
    return json({ error: "หมดระยะเวลาแก้ไข 30 วันแล้ว" }, 403);
  const title = String(form.get("title") || "").trim(),
    teacher = String(form.get("teacher_name") || "").trim(),
    description = String(form.get("description") || "").trim();
  if (
    !title ||
    !teacher ||
    !description ||
    !Number.isFinite(price) ||
    price < 100
  )
    return json(
      { error: "กรุณากรอกข้อมูลให้ครบและตั้งราคาอย่างน้อย 1 บาท" },
      400,
    );
  const tags = [
      ...new Set(
        form
          .getAll("platform_tags")
          .map(String)
          .filter((x) => slugTags.has(x)),
      ),
    ],
    other = String(form.get("platform_other") || "")
      .trim()
      .slice(0, 60);
  if (tags.includes("อื่น ๆ") && other) tags.push(other);
  if (!tags.length) return json({ error: "กรุณาเลือกหัวข้อที่สอน" }, 400);
  let coverUrl = course.cover_url,
    newKey;
  const cover = form.get("cover");
  if (cover instanceof File && cover.size) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(cover.type) ||
      cover.size > 8 * 1024 * 1024
    )
      return json(
        { error: "รูปปกต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 8 MB" },
        400,
      );
    newKey = `seller-course-cover-${crypto.randomUUID()}.${ext(cover)}`;
    await ctx.env.FILES.put(newKey, await cover.arrayBuffer(), {
      httpMetadata: { contentType: cover.type },
    });
    coverUrl = "/api/media/" + newKey;
  }
  const lessonCount = await ctx.env.DB.prepare(
      "SELECT COUNT(*) n FROM course_lessons WHERE course_id=?",
    )
      .bind(course.id)
      .first(),
    episodes = Math.max(1, Number(lessonCount?.n) || 0),
    statements = [];
  statements.push(
    ctx.env.DB.prepare(
      `UPDATE products SET title=?,short_description=?,description=?,price=?,cover_url=?,preview_urls=?,pages=?,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(
      title,
      String(form.get("short_description") || ""),
      description,
      price,
      coverUrl,
      JSON.stringify([coverUrl]),
      episodes,
      course.product_id,
    ),
    ctx.env.DB.prepare(
      `UPDATE courses SET teacher_name=?,contact_info=?,platform_tags=?,learner_level=?,expected_episodes=?,review_status=CASE WHEN review_status IN ('pending','approved','changes_requested') THEN 'pending' ELSE 'draft' END,review_note='',submitted_at=CASE WHEN review_status IN ('pending','approved','changes_requested') THEN CURRENT_TIMESTAMP ELSE NULL END,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(
      teacher,
      contact,
      JSON.stringify(tags),
      ["beginner", "intermediate", "advanced", "all"].includes(
        String(form.get("learner_level")),
      )
        ? String(form.get("learner_level"))
        : "beginner",
      episodes,
      course.id,
    ),
  );
  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    if (newKey) await ctx.env.FILES.delete(newKey).catch(() => {});
    return json({ error: "บันทึกข้อมูลคอร์สไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
  if (newKey && course.cover_url?.startsWith("/api/media/"))
    await ctx.env.FILES.delete(
      course.cover_url.slice("/api/media/".length),
    ).catch(() => {});
  return json({
    ok: true,
    message: "บันทึกข้อมูลตะกร้าคอร์สแล้ว จำนวน EP นับจากบทเรียนที่สร้างจริง",
  });
}
export async function onRequestDelete(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const course = await owned(ctx, auth.user);
  if (!course) return json({ error: "ไม่พบคอร์ส" }, 404);
  const order = await ctx.env.DB.prepare(
    "SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.product_id=? LIMIT 1",
  )
    .bind(course.product_id)
    .first();
  if (order)
    return json(
      { error: "คอร์สนี้มีประวัติออเดอร์แล้ว จึงห้ามลบออกจากระบบ" },
      409,
    );
  const lessons = await ctx.env.DB.prepare(
      "SELECT video_key,pdf_key FROM course_lessons WHERE course_id=?",
    )
      .bind(course.id)
      .all(),
    files = await ctx.env.DB.prepare(
      "SELECT f.object_key FROM course_lesson_files f JOIN course_lessons l ON l.id=f.lesson_id WHERE l.course_id=?",
    )
      .bind(course.id)
      .all(),
    keys = [
      course.cover_url?.startsWith("/api/media/")
        ? course.cover_url.slice("/api/media/".length)
        : null,
      ...(lessons.results || []).flatMap((x) => [x.video_key, x.pdf_key]),
      ...(files.results || []).map((x) => x.object_key),
    ].filter(Boolean);
  await ctx.env.DB.prepare("DELETE FROM products WHERE id=?")
    .bind(course.product_id)
    .run();
  for (const key of new Set(keys)) await ctx.env.FILES.delete(key);
  return json({
    ok: true,
    message:
      course.license_entitlement_id === null
        ? "ลบคอร์สร่างและไฟล์ออกถาวรแล้ว"
        : "ลบคอร์สและไฟล์ออกถาวรแล้ว เครดิตไม่ถูกคืน",
  });
}
