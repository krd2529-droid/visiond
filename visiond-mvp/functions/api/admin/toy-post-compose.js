import {json, requireAdmin} from '../../_lib.js';
import {ensureToyPostSchema, noStore, photoUrl} from '../../_toy_post.js';

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const body = await ctx.request.json().catch(() => ({}));
  const lineId = Number(body.line_id), heading = String(body.heading ?? '');
  if (!Number.isSafeInteger(lineId) || lineId < 1 || !heading.trim() || heading.length > 1000) return json({error:'กรุณาระบุหัวโพสต์และไลน์'},400,noStore);
  const line = await ctx.env.DB.prepare('SELECT id,name,destinations FROM toy_post_lines WHERE id=?').bind(lineId).first();
  if (!line) return json({error:'ไม่พบไลน์'},404,noStore);
  // This endpoint alone reads the full selected line, in bounded keyset batches.
  const products = [];
  let cursor = 0;
  while (true) {
    const batch = (await ctx.env.DB.prepare('SELECT id,detail,photo_key FROM toy_post_products WHERE line_id=? AND deleted_at IS NULL AND id>? ORDER BY id LIMIT 100').bind(lineId,cursor).all()).results || [];
    products.push(...batch);
    if (batch.length < 100) break;
    cursor = batch.at(-1).id;
  }
  if (!products.length) return json({error:'ไลน์นี้ยังไม่มีสินค้า'},409,noStore);
  if (products.some(row => !row.photo_key)) return json({error:'สินค้าทุกชิ้นต้องมีรูปก่อนประกอบโพสต์'},409,noStore);
  return json({line:{id:line.id,name:line.name,destinations:JSON.parse(line.destinations)},text:[heading,...products.map(row => row.detail)].join('\n\n'),photos:products.map(row => ({product_id:row.id,url:photoUrl(row.id)})),count:products.length,published:false},200,noStore);
}
