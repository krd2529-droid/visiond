import {json, requireAdmin} from '../../../../_lib.js';
import {ensureToyPostSchema, noStore} from '../../../../_toy_post.js';
const types = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const row = await ctx.env.DB.prepare('SELECT photo_key,photo_type FROM toy_post_products WHERE id=? AND deleted_at IS NULL AND photo_key IS NOT NULL').bind(ctx.params.id).first();
  if (!row) return new Response('Not found',{status:404,headers:noStore});
  const object = await ctx.env.FILES.get(row.photo_key);
  return object ? new Response(object.body,{headers:{...noStore,'content-type':row.photo_type,'x-content-type-options':'nosniff'}}) : new Response('Not found',{status:404,headers:noStore});
}

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const id = Number(ctx.params.id);
  const row = Number.isSafeInteger(id) && id > 0 ? await ctx.env.DB.prepare('SELECT id,photo_key FROM toy_post_products WHERE id=? AND deleted_at IS NULL').bind(id).first() : null;
  if (!row) return json({error:'ไม่พบสินค้า'},404,noStore);
  if (!ctx.env.FILES) return json({error:'ที่เก็บรูปยังไม่พร้อม'},503,noStore);
  const form = await ctx.request.formData(), file = form.get('file');
  if (!file || !types[file.type] || !file.size || file.size > 5 * 1024 * 1024) return json({error:'รูปต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB'},400,noStore);
  const key = `toy-post/${id}/${crypto.randomUUID()}.${types[file.type]}`;
  await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
  const changed = await ctx.env.DB.prepare('UPDATE toy_post_products SET photo_key=?,photo_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL').bind(key,file.type,id).run();
  if (!changed.meta?.changes) { await ctx.env.FILES.delete(key); return json({error:'สินค้าได้ถูกลบแล้ว'},409,noStore); }
  let warning = null;
  if (row.photo_key && row.photo_key !== key) {
    try { await ctx.env.FILES.delete(row.photo_key); }
    catch { warning = 'บันทึกรูปใหม่แล้ว แต่ลบไฟล์รูปเก่าไม่สำเร็จ กรุณาแจ้งผู้ดูแล'; }
  }
  return json({ok:true,photo_url:`/api/admin/toy-post-products/${id}/photo`,warning},200,noStore);
}
