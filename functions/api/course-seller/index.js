import { json, requireUser } from "../../_lib.js";
import { ensureDatabase } from "../../_schema.js";
import { sellerTokenStatus } from "../../_seller_token.js";
const imageTypes = ["image/jpeg", "image/png", "image/webp"],
  ext = (name, type) =>
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() ||
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type] ||
    "bin",
  slugify = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || `course-${Date.now()}`;
async function putImage(env, file) {
  if (!(file instanceof File) || !file.size) return null;
  if (!imageTypes.includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error("IMAGE_INVALID");
  const key = `user-course-cover-${crypto.randomUUID()}.${ext(file.name, file.type)}`;
  await env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return key;
}
function episodePlan(form) {
  const expected = Number(form.get("expected_episodes"));
  if (!Number.isInteger(expected) || expected < 1 || expected > 200)
    throw new Error("EP_COUNT");
  const raw = String(form.get("episodes_json") || "").trim();
  if (!raw)
    return Array.from({ length: expected }, (_, index) => ({
      title: `EP.${index + 1}`,
      description: "",
      duration_seconds: 0,
    }));
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    throw new Error("EP_JSON");
  }
  if (!Array.isArray(items) || items.length !== expected)
    throw new Error("EP_LENGTH");
  return items.map((item, index) => {
    const title = String(item?.title || "")
        .trim()
        .slice(0, 200),
      description = String(item?.description || "")
        .trim()
        .slice(0, 5000),
      duration = Number(item?.duration_seconds || 0);
    if (!title) throw new Error(`EP_TITLE_${index + 1}`);
    if (!Number.isInteger(duration) || duration < 0 || duration > 86400)
      throw new Error(`EP_DURATION_${index + 1}`);
    return { title, description, duration_seconds: duration };
  });
}
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const profile = await ctx.env.DB.prepare(
    `SELECT seller_bank_name bank_name,seller_account_name account_name,seller_account_number account_number,seller_payment_status status,seller_slip_api_key FROM users WHERE id=?`,
  )
    .bind(auth.user.id)
    .first();
  const tokenStatus=sellerTokenStatus(ctx.env,profile?.seller_slip_api_key);
  if(profile){delete profile.seller_slip_api_key;profile.slip_api_configured=tokenStatus.configured?1:0;profile.token_encryption_configured=tokenStatus.encryption_configured;profile.token_requires_configuration=tokenStatus.requires_configuration}
  const credits = await ctx.env.DB.prepare(
    `SELECT cr.id credit_id,cr.active,cr.used_at,cr.granted_at,p.title license_title FROM course_right_credits cr JOIN products p ON p.id=cr.product_id WHERE cr.user_id=? ORDER BY cr.id DESC`,
  )
    .bind(auth.user.id)
    .all();
  const licenses = (credits.results || []).map((x) => ({
    ...x,
    entitlement_id: `credit-${x.credit_id}`,
    available: Boolean(x.active),
    credit: 1,
  }));
  const courses = await ctx.env.DB.prepare(
    `SELECT c.id,c.license_entitlement_id,c.seller_plan,c.slip_fee_cents,c.visiond_share_percent,c.seller_share_percent,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.status,c.teacher_name,c.contact_info,c.platform_tags,c.learner_level,c.expected_episodes,c.review_status,c.review_note,c.submitted_at,c.edit_expires_at,COALESCE((SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id),0) planned_lesson_count,COALESCE((SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id AND TRIM(COALESCE(l.title,''))<>'' AND (l.video_key IS NOT NULL OR l.pdf_key IS NOT NULL OR EXISTS(SELECT 1 FROM course_lesson_files f WHERE f.lesson_id=l.id))),0) lesson_count FROM courses c JOIN products p ON p.id=c.product_id WHERE c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC`,
  )
    .bind(auth.user.id)
    .all();
  const sales = await ctx.env.DB.prepare(
    `SELECT o.id,o.order_no,o.total,o.updated_at paid_at,COALESCE((SELECT product_title FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1),p.title,'สินค้าเดิม') course_title,u.name buyer_name FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN products p ON p.id=(SELECT product_id FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) WHERE o.course_owner_user_id=? AND o.status='paid' ORDER BY o.updated_at DESC LIMIT 200`,
  )
    .bind(auth.user.id)
    .all();
  const salesTotal = await ctx.env.DB.prepare(
    `SELECT COUNT(*) orders,COALESCE(SUM(total),0) amount FROM orders WHERE course_owner_user_id=? AND status='paid'`,
  )
    .bind(auth.user.id)
    .first();
  const issues = await ctx.env.DB.prepare(
    `SELECT o.id,o.order_no,o.total,o.slip_verification_code,o.updated_at,COALESCE((SELECT product_title FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1),p.title,'สินค้าเดิม') course_title,u.name buyer_name FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN products p ON p.id=(SELECT product_id FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) WHERE o.course_owner_user_id=? AND o.status='pending_review' AND o.slip_key IS NOT NULL AND o.slip_verification_status='manual' ORDER BY o.updated_at DESC LIMIT 100`,
  )
    .bind(auth.user.id)
    .all();
  const items = courses.results || [],
    saleItems = sales.results || [],
    issueItems = issues.results || [],
    assignedDrafts = items.filter((x) => x.license_entitlement_id !== null);
  return json(
    {
      payment_profile: profile,
      licenses,
      courses: items,
      sales: saleItems,
      sales_list_limited: saleItems.length >= 200,
      slip_issues: issueItems,
      totals: {
        amount: Number(salesTotal?.amount) || 0,
        orders: Number(salesTotal?.orders) || 0,
      },
      course_draft_limit: null,
      course_draft_count: assignedDrafts.length,
      credit_balance: licenses.filter((x) => x.available).length,
    },
    200,
    { "cache-control": "no-store" },
  );
}
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const form = await ctx.request.formData(),sellerPlan=['paid_rights','free_manual','partner_50'].includes(String(form.get('seller_plan')))?String(form.get('seller_plan')):'paid_rights';
  const credit = await ctx.env.DB.prepare(
    "SELECT id FROM course_right_credits WHERE user_id=? AND active=1 AND used_course_id IS NULL ORDER BY id LIMIT 1",
  )
    .bind(auth.user.id)
    .first();
  if (sellerPlan==='paid_rights'&&!credit)
    return json(
      {
        error: "ต้องมีเครดิตอย่างน้อย 1 แต้มก่อนสร้างร่างตะกร้าคอร์ส",
        credit_required: true,
        buy_url: "/product.html?slug=course-selling-rights",
      },
      409,
    );
  const title = String(form.get("title") || "").trim(),
    teacher = String(form.get("teacher_name") || "").trim(),
    description = String(form.get("description") || "").trim(),
    draftPrice = Math.round(Number(form.get("price_baht")) * 100);
  if (!title || !teacher || !description)
    return json(
      { error: "กรุณากรอกชื่อคอร์ส ชื่อผู้สอน และรายละเอียดให้ครบ" },
      400,
    );
  if (!Number.isFinite(draftPrice) || draftPrice < 100)
    return json({ error: "กรุณาระบุราคาขายอย่างน้อย 1 บาท" }, 400);
  let plan;
  try {
    plan = episodePlan(form);
  } catch (error) {
    const code = String(error.message || "");
    return json(
      {
        error:
          code === "EP_COUNT"
            ? "จำนวน EP ต้องเป็นเลขจำนวนเต็ม 1–200"
            : code === "EP_JSON" || code === "EP_LENGTH"
              ? "ข้อมูล EP ไม่ตรงกับจำนวนที่ระบุ"
              : code.startsWith("EP_TITLE_")
                ? `กรุณาใส่ชื่อ ${code.replace("EP_TITLE_", "EP.")}`
                : "ระยะเวลา EP ต้องเป็นวินาทีจำนวนเต็ม 0–86,400",
      },
      400,
    );
  }
  const episodes = plan.length;
  if(sellerPlan==='free_manual'){
    if(episodes>5)return json({error:'แผนเริ่มขายฟรีจำกัดไม่เกิน 5 EP ต่อคอร์ส'},400);
    const used=await ctx.env.DB.prepare("SELECT COUNT(*) total FROM courses WHERE owner_user_id=? AND course_origin='seller_rights' AND seller_plan='free_manual'").bind(auth.user.id).first();
    if(Number(used?.total)>=3)return json({error:'ใช้สิทธิ์คอร์สฟรีครบ 3 คอร์สแล้ว กรุณาเลือกซื้อสิทธิ์หรือพาร์ตเนอร์ 50/50'},409);
  }
  let coverKey;
  try {
    coverKey = await putImage(ctx.env, form.get("cover"));
  } catch {
    return json(
      { error: "รูปปกต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 8 MB" },
      400,
    );
  }
  if (!coverKey) return json({ error: "กรุณาแนบรูปปกคอร์ส" }, 400);
  const allowed = new Set([
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
    ]),
    tags = [
      ...new Set(
        form
          .getAll("platform_tags")
          .map(String)
          .filter((x) => allowed.has(x)),
      ),
    ],
    other = String(form.get("platform_other") || "")
      .trim()
      .slice(0, 60);
  if (tags.includes("อื่น ๆ") && other) tags.push(other);
  let slug = slugify(title),
    n = 1;
  while (
    await ctx.env.DB.prepare("SELECT id FROM products WHERE slug=?")
      .bind(slug)
      .first()
  )
    slug = `${slugify(title)}-${++n}`;
  const coverUrl = "/api/media/" + coverKey,
    short = String(form.get("short_description") || "").slice(0, 1000),
    contact = String(form.get("contact_info") || "")
      .trim()
      .slice(0, 200),
    level = ["beginner", "intermediate", "advanced", "all"].includes(
      String(form.get("learner_level")),
    )
      ? String(form.get("learner_level"))
      : "beginner",
    planJson = JSON.stringify(plan);
  try {
    const bindingId = sellerPlan==='paid_rights'?-Number(credit.id):null,slipFee=sellerPlan==='partner_50'?100:0,visiondShare=sellerPlan==='partner_50'?50:0,sellerShare=sellerPlan==='partner_50'?50:100, statements = [
      ctx.env.DB.prepare(
        `INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) SELECT ?,?,?,?,?,?,?,'online-course','คอร์สออนไลน์',?,'draft','user-course-draft','course' WHERE ?<>'paid_rights' OR EXISTS(SELECT 1 FROM course_right_credits WHERE id=? AND user_id=? AND active=1 AND used_course_id IS NULL)`,
      ).bind(
        slug,
        title,
        short,
        description,
        draftPrice,
        coverUrl,
        JSON.stringify([coverUrl]),
        episodes,
        sellerPlan,
        sellerPlan==='paid_rights'?credit.id:0,
        auth.user.id,
      ),
      ctx.env.DB.prepare(
        `INSERT INTO courses(product_id,subtitle,teacher_name,active,course_type,license_edit_days,owner_user_id,license_entitlement_id,edit_expires_at,contact_info,platform_tags,learner_level,expected_episodes,review_status,course_origin,basket_binding_locked,basket_bound_at,seller_plan,slip_fee_cents,visiond_share_percent,seller_share_percent) SELECT id,?,?,0,'online_course',30,?,?,NULL,?,?,?,?,'draft','seller_rights',1,CURRENT_TIMESTAMP,?,?,?,? FROM products WHERE slug=?`,
      ).bind(
        short,
        teacher,
        auth.user.id,
        bindingId,
        contact,
        JSON.stringify(tags),
        level,
        episodes,
        sellerPlan,slipFee,visiondShare,sellerShare,slug,
      ),
      sellerPlan==='paid_rights'?ctx.env.DB.prepare(
        `UPDATE course_right_credits SET active=0,used_at=CURRENT_TIMESTAMP,used_course_id=(SELECT c.id FROM courses c JOIN products p ON p.id=c.product_id WHERE p.slug=? AND c.owner_user_id=? AND c.license_entitlement_id=?) WHERE id=? AND user_id=? AND active=1 AND used_course_id IS NULL AND EXISTS(SELECT 1 FROM courses c JOIN products p ON p.id=c.product_id WHERE p.slug=? AND c.owner_user_id=? AND c.license_entitlement_id=?)`,
      ).bind(slug,auth.user.id,bindingId,credit.id,auth.user.id,slug,auth.user.id,bindingId):ctx.env.DB.prepare('SELECT 1'),
      ctx.env.DB.prepare(
        `INSERT INTO course_lessons(course_id,title,description,sort_order,duration_seconds) SELECT c.id,json_extract(ep.value,'$.title'),json_extract(ep.value,'$.description'),(CAST(ep.key AS INTEGER)+1)*10,CAST(json_extract(ep.value,'$.duration_seconds') AS INTEGER) FROM courses c JOIN products p ON p.id=c.product_id CROSS JOIN json_each(?) ep WHERE p.slug=? AND c.owner_user_id=?`,
      ).bind(planJson, slug, auth.user.id),
    ];
    const results=await ctx.env.DB.batch(statements);
    if(!results[0].meta.changes||!results[1].meta.changes||(sellerPlan==='paid_rights'&&!results[2].meta.changes))throw new Error("COURSE_PLAN_ASSIGNMENT_CONFLICT");
    const course = await ctx.env.DB.prepare(
      "SELECT c.id FROM courses c JOIN products p ON p.id=c.product_id WHERE p.slug=? AND c.owner_user_id=?",
    )
      .bind(slug, auth.user.id)
      .first();
    if (!course) throw new Error("COURSE_MISSING");
    return json(
      {
        ok: true,
        id: course.id,
        slug,
        episode_count: episodes,
        seller_plan:sellerPlan,credit_used:sellerPlan==='paid_rights'?1:0,slip_fee_cents:slipFee,visiond_share_percent:visiondShare,seller_share_percent:sellerShare,
        message: sellerPlan==='paid_rights'?`สร้างร่างตะกร้าคอร์สและเตรียม ${episodes} EP แล้ว หัก 1 เครดิตเรียบร้อย`:sellerPlan==='free_manual'?`สร้างคอร์สฟรี ${episodes} EP แล้ว ตรวจสลิปด้วยตนเอง`:`สร้างคอร์สพาร์ตเนอร์ ${episodes} EP แล้ว ระบบจะหักค่าตรวจสลิป 1 บาทก่อนแบ่ง 50/50`,
      },
      201,
    );
  } catch (error) {
    await ctx.env.FILES.delete(coverKey).catch(() => {});
    return json(
      { error: "สร้างร่างตะกร้าคอร์สไม่สำเร็จ เครดิตไม่ถูกหัก กรุณาลองใหม่" },
      409,
    );
  }
}
