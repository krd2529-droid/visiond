import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

// PROD-SAMPLE-001
// Read-only source manifest for a regular standalone product basket.
// Reads: products, product_files. Writes: none.
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const product=await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.category,p.source,p.file_type,p.pages
    FROM products p
    WHERE p.id=? AND p.deleted_at IS NULL
      AND COALESCE(p.product_kind,'product')='product'
      AND p.category<>'resale-rights'
      AND COALESCE(p.source,'')<>'bundle'
      AND NOT EXISTS(SELECT 1 FROM product_bundle_items b WHERE b.bundle_product_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id)
    LIMIT 1`).bind(ctx.params.id).first();
  if(!product)return json({error:'เลือกได้เฉพาะตะกร้าเดี่ยวปกติ ไม่รองรับตะกร้าชุดรวมหรือตะกร้าคอร์ส'},404,{'cache-control':'private, no-store'});
  const {results}=await ctx.env.DB.prepare(`SELECT id,label,mime_type,file_size,created_at
    FROM product_files WHERE product_id=? ORDER BY id`).bind(product.id).all();
  const files=(results||[]).map(file=>({...file,url:`/api/admin/product-files/${file.id}`}));
  if(!files.length)return json({error:'ตะกร้านี้ยังไม่มีไฟล์สินค้า'},404,{'cache-control':'private, no-store'});
  return json({product,files},200,{'cache-control':'private, no-store'});
}
