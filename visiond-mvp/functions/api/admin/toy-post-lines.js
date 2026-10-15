import {json, requireAdmin} from '../../_lib.js';
import {ensureToyPostSchema, noStore} from '../../_toy_post.js';

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const cursor = Number(new URL(ctx.request.url).searchParams.get('cursor') || 0);
  if (!Number.isSafeInteger(cursor) || cursor < 0) return json({error:'cursor ไม่ถูกต้อง'},400,noStore);
  const rows = await ctx.env.DB.prepare('SELECT id,name,destinations FROM toy_post_lines WHERE id>? ORDER BY id LIMIT 25').bind(cursor).all();
  const values = rows.results || [], items = values.slice(0,24).map(row => ({...row,destinations:JSON.parse(row.destinations)}));
  return json({items,next_cursor:values.length > 24 ? items.at(-1).id : null},200,noStore);
}

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const body = await ctx.request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name || name.length > 100) return json({error:'กรุณาระบุชื่อไลน์ ไม่เกิน 100 ตัวอักษร'},400,noStore);
  try {
    const item = await ctx.env.DB.prepare('INSERT INTO toy_post_lines(name) VALUES(?) RETURNING id,name,destinations').bind(name).first();
    return json({item:{...item,destinations:[]}},201,noStore);
  } catch { return json({error:'ชื่อไลน์นี้มีแล้ว'},409,noStore); }
}
