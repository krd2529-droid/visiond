import {json, requireAdmin} from '../../../_lib.js';
import {ensureToyPostSchema, noStore, photoUrl} from '../../../_toy_post.js';

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const id = Number(ctx.params.id), body = await ctx.request.json().catch(() => ({}));
  const lineId = Number(body.line_id), expectedLineId = Number(body.expected_line_id), detail = String(body.detail ?? '');
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(lineId) || lineId < 1 || !Number.isSafeInteger(expectedLineId) || expectedLineId < 1 || !detail.trim() || detail.length > 10000) return json({error:'ข้อมูลสินค้าไม่ถูกต้อง'},400,noStore);
  const line = await ctx.env.DB.prepare('SELECT id FROM toy_post_lines WHERE id=?').bind(lineId).first();
  if (!line) return json({error:'ไม่พบไลน์'},404,noStore);
  const item = await ctx.env.DB.prepare('UPDATE toy_post_products SET line_id=?,detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND line_id=? AND deleted_at IS NULL RETURNING id,line_id,detail,photo_key').bind(lineId,detail,id,expectedLineId).first();
  return item ? json({item:{id:item.id,line_id:item.line_id,detail:item.detail,photo_url:item.photo_key ? photoUrl(id) : null}},200,noStore) : json({error:'สินค้านี้ถูกย้ายหรือเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่'},409,noStore);
}

export async function onRequestDelete(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const id = Number(ctx.params.id), expectedLineId = Number(new URL(ctx.request.url).searchParams.get('line_id'));
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(expectedLineId) || expectedLineId < 1) return json({error:'รหัสสินค้าหรือไลน์ไม่ถูกต้อง'},400,noStore);
  const item = await ctx.env.DB.prepare('UPDATE toy_post_products SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND line_id=? AND deleted_at IS NULL RETURNING id').bind(id,expectedLineId).first();
  if (!item) return json({error:'สินค้านี้ถูกย้ายหรือเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่'},409,noStore);
  return json({ok:true},200,noStore);
}
