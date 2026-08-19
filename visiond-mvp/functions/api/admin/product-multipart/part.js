import { json, requireAdmin } from "../../../_lib.js";
// Feature: PROD-FILE-001 — รับแต่ละ part ของ multipart upload
const vision5Product = (env,id) => env.DB.prepare(`SELECT p.id FROM products p WHERE p.id=? AND (p.category='resale-rights' OR EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')))`)
  .bind(id).first();

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const url = new URL(ctx.request.url), key = url.searchParams.get("key") || "", uploadId = url.searchParams.get("upload_id") || "", partNumber = Number(url.searchParams.get("part_number"));
  if (!/^(?:product-\d+|vision4-pending)-[0-9a-f-]+\.(pdf|zip)$/i.test(key) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !ctx.request.body) return json({ error: "ข้อมูลชิ้นส่วนไม่ถูกต้อง" }, 400);
  const productMatch=key.match(/^product-(\d+)-/i);if(productMatch&&await vision5Product(ctx.env,Number(productMatch[1])))return json({error:"ไฟล์ของสินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const part = await ctx.env.FILES.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, ctx.request.body);
  return json({ part_number: part.partNumber, etag: part.etag });
}
