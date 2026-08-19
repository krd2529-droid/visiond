import { json, requireAdmin } from "../../../_lib.js";
import { putTrash } from "../../../_trash.js";
import { ensureDatabase } from "../../../_schema.js";
// Feature: PROD-ADMIN-001 — อ่าน แก้ไข และ soft delete ตะกร้าสินค้า
const ext = (name, type) =>
  type === "image/png"
    ? "png"
    : type === "image/webp"
      ? "webp"
      : type === "application/zip"
        ? "zip"
        : name?.toLowerCase().endsWith(".zip")
          ? "zip"
          : type === "application/pdf"
            ? "pdf"
            : "jpg";
const validFile = (file, max, types) =>
  file &&
  typeof file.arrayBuffer === "function" &&
  file.size > 0 &&
  file.size <= max &&
  types.includes(file.type);
const vision5Product = (env, id) => env.DB.prepare(`SELECT p.id FROM products p WHERE p.id=? AND (p.category='resale-rights' OR EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')))`)
  .bind(id).first();

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const item = await ctx.env.DB.prepare("SELECT * FROM products WHERE id=?")
    .bind(ctx.params.id)
    .first();
  if (!item) return json({ error: "ไม่พบสินค้า" }, 404);
  if (await vision5Product(ctx.env,item.id)) return json({error:"สินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const storedFiles = await ctx.env.DB.prepare(
    "SELECT id,object_key FROM product_files WHERE product_id=? ORDER BY id DESC",
  ).bind(item.id).all();
  for (const duplicate of (storedFiles.results || []).slice(1)) {
    await ctx.env.DB.prepare("DELETE FROM downloads WHERE product_file_id=?").bind(duplicate.id).run();
    await ctx.env.DB.prepare("DELETE FROM product_files WHERE id=?").bind(duplicate.id).run();
    await ctx.env.FILES.delete(duplicate.object_key);
  }
  const { results } = await ctx.env.DB.prepare(
      "SELECT id,label,mime_type,file_size,version,created_at FROM product_files WHERE product_id=? ORDER BY id DESC",
    )
      .bind(item.id)
      .all(),
    bundle = await ctx.env.DB.prepare(
      "SELECT p.id,p.slug,p.title,p.cover_url,b.sort_order FROM product_bundle_items b JOIN products p ON p.id=b.source_product_id WHERE b.bundle_product_id=? ORDER BY b.sort_order",
    )
      .bind(item.id)
      .all();
  return json({
    item,
    files: results.map((file) => ({
      ...file,
      file_name: `${item.slug || "product"}-${file.id}.${file.mime_type === "application/zip" ? "zip" : "pdf"}`,
    })),
    bundle_items: bundle.results || [],
  });
}

export async function onRequestPut(ctx) {
  await ensureDatabase(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const old = await ctx.env.DB.prepare("SELECT * FROM products WHERE id=?")
    .bind(ctx.params.id)
    .first();
  if (!old) return json({ error: "ไม่พบสินค้า" }, 404);
  if (await vision5Product(ctx.env,old.id)) return json({error:"สินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const form = await ctx.request.formData();
  const title = String(form.get("title") || "").trim();
  let slug = String(form.get("slug") || "")
      .trim()
      .toLowerCase();
  const price = Number(form.get("price_cents"));
  const pages = Math.max(0, Math.floor(Number(form.get("pages")) || 0));
  if (!title || !slug)
    return json({ error: "กรุณากรอกชื่อสินค้าและ Slug" }, 400);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return json({ error: "Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง" }, 400);
  if (!Number.isInteger(price) || price < 0)
    return json({ error: "ราคาไม่ถูกต้อง" }, 400);
  const duplicate = await ctx.env.DB.prepare(
    "SELECT id,title FROM products WHERE lower(trim(title))=lower(trim(?)) AND id<>? LIMIT 1",
  ).bind(title, old.id).first();
  if (duplicate)
    return json({ error: `ชื่อสินค้า “${duplicate.title}” มีอยู่แล้ว กรุณาใช้ชื่ออื่น` }, 409);
  try {
    const category = String(form.get("category") || "dinosaur"),
      isBundle = form.get("bundle_mode") === "1",
      ids = [
        ...new Set(
          String(form.get("bundle_product_ids") || "")
            .split(",")
            .map(Number)
            .filter(Number.isInteger),
        ),
      ],
      size = Number(form.get("bundle_size")),
      previewCount = Number(form.get("bundle_preview_count")) || ids.length,
      requestedFileType = String(form.get("file_type") || "PDF"),
      fileType = ["PDF", "ZIP", "JPG/PNG", "ชุดรวมหลายประเภท"].includes(requestedFileType) ? requestedFileType : "PDF";
    if(category==='resale-rights')return json({error:'ตะกร้าสิทธิ์ Vision 5 ต้องจัดการผ่านระบบ Vision 5 เท่านั้น'},403);
    if (category !== old.category) {
      const prefix = `${category}-`,
        current = await ctx.env.DB.prepare("SELECT slug FROM products WHERE id<>? AND slug LIKE ?").bind(old.id,`${prefix}%`).all(),
        history = await ctx.env.DB.prepare("SELECT old_slug slug FROM product_slug_history WHERE old_slug LIKE ?").bind(`${prefix}%`).all(),
        highest = [...(current.results||[]),...(history.results||[])].reduce((max,row)=>Math.max(max,Number(String(row.slug||'').slice(prefix.length))||0),0);
      slug = `${prefix}${String(highest+1).padStart(3,'0')}`;
    }
    if (slug !== old.slug)
      await ctx.env.DB.prepare("INSERT OR REPLACE INTO product_slug_history(old_slug,product_id,changed_at) VALUES(?,?,CURRENT_TIMESTAMP)").bind(old.slug,old.id).run();
    if (isBundle) {
      const promotionBundle=category==="bundle-deals";
      if (!promotionBundle&&(!/^set-[a-z0-9][a-z0-9-]{0,75}$/.test(category) || category.slice(4).startsWith("set-") || category.slice(4) === "resale-rights"))
        return json({ error: "กรุณาเลือกหมวดชุดรวมที่ถูกต้อง" }, 400);
      if (!Number.isInteger(size) || size < 2 || size > 30 || ids.length !== size)
        return json(
          { error: `กรุณาเลือกตะกร้าให้ครบ ${size || 5} รายการ` },
          400,
        );
      const sourceCategory=promotionBundle?"":category.slice(4),sourceCategoryRow=promotionBundle?await ctx.env.DB.prepare("SELECT name FROM categories WHERE slug='bundle-deals' AND active=1").first():await ctx.env.DB.prepare("SELECT name FROM categories WHERE slug=? AND active=1").bind(sourceCategory).first(),marks = ids.map(() => "?").join(","),categoryClause=promotionBundle?"p.category IN ('worksheet','coloring','development-game')":"p.category=?",bindings=promotionBundle?[...ids,old.id,old.id]:[...ids,old.id,sourceCategory,old.id],
        valid = await ctx.env.DB.prepare(
          `SELECT id,title,price,pages,cover_url FROM products p WHERE id IN (${marks}) AND id<>? AND status='published' AND deleted_at IS NULL AND ${categoryClause} AND COALESCE(product_kind,'product')='product' AND NOT EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')) AND NOT EXISTS(SELECT 1 FROM bundle_source_allocations a WHERE a.source_product_id=p.id AND a.bundle_product_id<>?)`,
        )
          .bind(...bindings)
          .all();
      if(!sourceCategoryRow)return json({error:"ไม่พบหมวดต้นทางที่เปิดใช้งาน"},400);
      if (valid.results.length !== ids.length)
        return json(
          { error: "มีตะกร้าต้นทางที่ไม่พร้อมขาย กรุณาเลือกใหม่" },
          400,
        );
      const byId = new Map(
        valid.results.map((item) => [Number(item.id), item]),
      );
      if(!promotionBundle)await ctx.env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES(?,?,NULL,'ชุด PDF',1,900)").bind(category,`ชุดรวม ${sourceCategoryRow.name||sourceCategory}`).run();
      const ordered=ids.map(id=>byId.get(id)),totalPages=ordered.reduce((sum,item)=>sum+Number(item.pages||0),0);
      await ctx.env.DB.prepare(
        `UPDATE products SET slug=?,title=?,short_description=?,description=?,price=?,category=?,pages=?,file_type=?,status=?,source='bundle',updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
        .bind(
          slug,
          title,
          String(form.get("short_description") || ""),
          String(form.get("description") || ""),
          price,
          category,
          totalPages,
          fileType,
          form.get("status") === "published" ? "published" : "draft",
          old.id,
        )
        .run();
      await ctx.env.DB.prepare(
        "DELETE FROM product_bundle_items WHERE bundle_product_id=?",
      )
        .bind(old.id)
        .run();
      await ctx.env.DB.prepare("DELETE FROM bundle_source_allocations WHERE bundle_product_id=?").bind(old.id).run();
      for (let index = 0; index < ids.length; index++)
        {await ctx.env.DB.prepare("INSERT OR IGNORE INTO bundle_source_allocations(source_product_id,bundle_product_id) VALUES(?,?)").bind(ids[index],old.id).run();const allocation=await ctx.env.DB.prepare("SELECT bundle_product_id FROM bundle_source_allocations WHERE source_product_id=?").bind(ids[index]).first();if(Number(allocation?.bundle_product_id)!==Number(old.id))throw new Error("ตะกร้าบางใบถูกใช้สร้างชุดอื่นแล้ว กรุณาโหลดใหม่");await ctx.env.DB.prepare(
          "INSERT INTO product_bundle_items(bundle_product_id,source_product_id,sort_order) VALUES(?,?,?)",
        )
          .bind(old.id, ids[index], index)
          .run();}
      const previews = ordered.map(item=>item.cover_url).filter(Boolean).slice(0,Math.max(1,Math.min(previewCount,ids.length)));
      await ctx.env.DB.prepare(
        "UPDATE products SET cover_url=?,preview_urls=? WHERE id=?",
      )
        .bind(
          previews[0] || "/assets/product-placeholder.svg",
          JSON.stringify(previews),
          old.id,
        )
        .run();
      return json({
        item: await ctx.env.DB.prepare("SELECT * FROM products WHERE id=?")
          .bind(old.id)
          .first(),
      });
    }
    await ctx.env.DB.prepare(
      `UPDATE products SET slug=?,title=?,short_description=?,description=?,price=?,category=?,pages=?,file_type=?,status=?,source=CASE WHEN source='vision4' AND status='draft' THEN 'vision4' ELSE 'admin' END,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
      .bind(
        slug,
        title,
        String(form.get("short_description") || ""),
        String(form.get("description") || ""),
        price,
        category,
        pages,
        String(form.get("file_type") || "PDF"),
        form.get("status") === "published" ? "published" : "draft",
        old.id,
      )
      .run();
    let oldPreviews = [];
    try {
      oldPreviews = JSON.parse(old.preview_urls || "[]");
    } catch (error) {
      oldPreviews = [];
    }
    if (!oldPreviews.length && old.cover_url) oldPreviews = [old.cover_url];
    const imageTypes = ["image/jpeg", "image/png", "image/webp"],
      uploadImage = async (file, prefix) => {
        if (!file || !file.size) return "";
        if (!validFile(file, 5 * 1024 * 1024, imageTypes))
          throw new Error(
            "รูปสินค้าแต่ละรูปต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB",
          );
        const key = `${prefix}-${old.id}-${crypto.randomUUID()}.${ext(file.name, file.type)}`;
        await ctx.env.FILES.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
        });
        return "/api/media/" + key;
      },
      newCover = await uploadImage(form.get("cover"), "cover"),
      newPreview2 = await uploadImage(form.get("preview_2"), "preview-2"),
      newPreview3 = await uploadImage(form.get("preview_3"), "preview-3"),
      finalCover =
        newCover || old.cover_url || "/assets/product-placeholder.svg",
      finalPreviews = [
        finalCover,
        newPreview2 || oldPreviews[1],
        newPreview3 || oldPreviews[2],
      ].filter(Boolean);
    for (const [slot, [next, previous]] of [
      [newCover, old.cover_url],
      [newPreview2, oldPreviews[1]],
      [newPreview3, oldPreviews[2]],
    ].entries())
      if (next && previous?.startsWith("/api/media/") && previous !== next)
        await putTrash(ctx.env,{item_type:'product_image',title:`รูปสินค้าช่อง ${slot+1} รุ่นก่อน`,product_id:old.id,object_key:previous.slice('/api/media/'.length),payload:{slot}});
    await ctx.env.DB.prepare(
      "UPDATE products SET cover_url=?,preview_urls=? WHERE id=?",
    )
      .bind(finalCover, JSON.stringify(finalPreviews), old.id)
      .run();
    const file = form.get("product_file");
    if (file && file.size) {
      if (
        !validFile(file, 100 * 1024 * 1024, [
          "application/pdf",
          "application/zip",
        ])
      )
        return json(
          { error: "ไฟล์สินค้าต้องเป็น PDF หรือ ZIP ไม่เกิน 100 MB" },
          400,
        );
      const key = `product-${old.id}-${crypto.randomUUID()}.${ext(file.name, file.type)}`;
      await ctx.env.FILES.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      const previous = await ctx.env.DB.prepare(
          "SELECT * FROM product_files WHERE product_id=? ORDER BY id DESC",
        )
          .bind(old.id)
          .all(),
        inserted = await ctx.env.DB.prepare(
          "INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?) RETURNING id",
        )
        .bind(
          old.id,
          String(form.get("file_label") || "ไฟล์สินค้าฉบับเต็ม"),
          key,
          file.type,
          file.size,
          "1.0",
        )
        .first();
      for (const previousFile of previous.results || []) {
        if (Number(previousFile.id) === Number(inserted.id)) continue;
        await putTrash(ctx.env,{item_type:'product_file',title:previousFile.label||'ไฟล์สินค้ารุ่นก่อน',product_id:old.id,object_key:previousFile.object_key,payload:{label:previousFile.label,mime_type:previousFile.mime_type,file_size:previousFile.file_size,version:previousFile.version}});
        await ctx.env.DB.prepare("DELETE FROM downloads WHERE product_file_id=?")
          .bind(previousFile.id)
          .run();
        await ctx.env.DB.prepare("DELETE FROM product_files WHERE id=?")
          .bind(previousFile.id)
          .run();
      }
    }
    return json({
      item: await ctx.env.DB.prepare("SELECT * FROM products WHERE id=?")
        .bind(old.id)
        .first(),
    });
  } catch (error) {
    return json(
      {
        error: String(error).includes("UNIQUE")
          ? "Slug นี้ถูกใช้แล้ว"
          : "บันทึกสินค้าไม่สำเร็จ",
      },
      400,
    );
  }
}

export async function onRequestDelete(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const item = await ctx.env.DB.prepare("SELECT id,title,deleted_at FROM products WHERE id=?")
    .bind(ctx.params.id)
    .first();
  if (!item) return json({ error: "ไม่พบสินค้า" }, 404);
  if (await vision5Product(ctx.env,item.id)) return json({error:"สินค้า Vision 5 ต้องลบหรือระงับผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  if (item.deleted_at) return json({ error: "สินค้านี้อยู่ในถังขยะแล้ว" }, 409);
  await ctx.env.DB.prepare("UPDATE products SET deleted_at=CURRENT_TIMESTAMP,deleted_prev_status=status,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(item.id)
    .run();
  return json({ ok: true, trashed: true, retention_days: 30 });
}
