const clean = (value, max = 180) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
const slugPart = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const storefrontPlanCodes = new Set(["monthly", "yearly", "lifetime"]);

export async function syncVision7KeyProducts(env, programId) {
  const program = await env.DB.prepare("SELECT id,code,app_name,app_description,cover_url,active FROM vision7_programs WHERE id=?").bind(programId).first();
  if (!program) throw new Error("VISION7_PROGRAM_NOT_FOUND");
  const rows = (await env.DB.prepare("SELECT id,plan_code,name,duration_days,offer_price,product_id,active FROM vision7_plans WHERE program_id=? ORDER BY id").bind(program.id).all()).results || [];
  const createdProductIds = [];
  try { for (const offer of rows) {
    if (!storefrontPlanCodes.has(String(offer.plan_code))) continue;
    const slug = `vbot-key-${slugPart(program.code)}-${slugPart(offer.plan_code)}`;
    const positive = Number.isSafeInteger(Number(offer.offer_price)) && Number(offer.offer_price) > 0;
    const status = positive && Number(program.active) !== 0 && Number(offer.active) !== 0 ? "published" : "draft";
    const price = positive ? Number(offer.offer_price) : 0;
    const title = `${clean(program.app_name || program.code, 120)} · ${clean(offer.name || offer.plan_code, 80)}`;
    const description = clean(program.app_description, 2000);
    let product = offer.product_id ? await env.DB.prepare("SELECT id,source,product_kind FROM products WHERE id=? AND deleted_at IS NULL").bind(offer.product_id).first() : null;
    if (product && product.product_kind !== "vision7-key") continue;
    if (!product) product = await env.DB.prepare("SELECT id FROM products WHERE slug=? AND deleted_at IS NULL").bind(slug).first();
    if (!product) {
      product = await env.DB.prepare(`INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
        VALUES(?,?,?,?,?,?,?,'vbot-key','LICENSE',0,?,'vision7','vision7-key') RETURNING id`).bind(slug,title,clean(description,180),description,price,program.cover_url||"",JSON.stringify(program.cover_url?[program.cover_url]:[]),status).first();
      if (!product?.id) throw new Error("VISION7_KEY_PRODUCT_CREATE_FAILED");
      createdProductIds.push(Number(product.id));
    } else {
      await env.DB.prepare(`UPDATE products SET title=?,short_description=?,description=?,price=?,cover_url=?,preview_urls=?,category='vbot-key',file_type='LICENSE',pages=0,status=?,source='vision7',product_kind='vision7-key',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(title,clean(description,180),description,price,program.cover_url||"",JSON.stringify(program.cover_url?[program.cover_url]:[]),status,product.id).run();
    }
    await env.DB.prepare("UPDATE vision7_plans SET product_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND program_id=?").bind(product.id,offer.id,program.id).run();
  }} catch (error) { error.createdProductIds = createdProductIds; throw error; }
  return { createdProductIds };
}

export async function rollbackVision7KeyProducts(env, productIds) {
  for (const id of [...new Set(productIds || [])]) await env.DB.prepare("DELETE FROM products WHERE id=? AND source='vision7' AND product_kind='vision7-key'").bind(id).run().catch(() => {});
}
