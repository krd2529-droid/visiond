import {json, requireAdmin} from '../../_lib.js';
import {ensureToyPostSchema, noStore, photoUrl} from '../../_toy_post.js';

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const search = new URL(ctx.request.url).searchParams;
  const lineId = Number(search.get('line_id')), cursor = Number(search.get('cursor') || 0);
  if (!Number.isSafeInteger(lineId) || lineId < 1 || !Number.isSafeInteger(cursor) || cursor < 0) return json({error:'ไลน์หรือ cursor ไม่ถูกต้อง'},400,noStore);
  const rows = await ctx.env.DB.prepare('SELECT id,line_id,detail,photo_key IS NOT NULL has_photo FROM toy_post_products WHERE line_id=? AND deleted_at IS NULL AND id>? ORDER BY id LIMIT 25').bind(lineId,cursor).all();
  const values = rows.results || [], items = values.slice(0,24).map(row => ({id:row.id,line_id:row.line_id,detail:row.detail,photo_url:row.has_photo ? photoUrl(row.id) : null}));
  return json({items,next_cursor:values.length > 24 ? items.at(-1).id : null},200,noStore);
}

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const body = await ctx.request.json().catch(() => ({}));
  const lineId = Number(body.line_id), detail = String(body.detail ?? '');
  if (!Number.isSafeInteger(lineId) || lineId < 1 || !detail.trim() || detail.length > 10000) return json({error:'กรุณาระบุไลน์และรายละเอียดสินค้า'},400,noStore);
  const line = await ctx.env.DB.prepare('SELECT id FROM toy_post_lines WHERE id=?').bind(lineId).first();
  if (!line) return json({error:'ไม่พบไลน์'},404,noStore);
  const item = await ctx.env.DB.prepare('INSERT INTO toy_post_products(line_id,detail) VALUES(?,?) RETURNING id,line_id,detail').bind(lineId,detail).first();
  return json({item:{...item,photo_url:null}},201,noStore);
}
