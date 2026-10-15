import {json, requireAdmin} from '../../../_lib.js';
import {ensureToyPostSchema, destinations, noStore} from '../../../_toy_post.js';

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx,{includeCourseOwner:false}); if (auth.error) return auth.error;
  await ensureToyPostSchema(ctx.env);
  const id = Number(ctx.params.id), body = await ctx.request.json().catch(() => ({}));
  const name = String(body.name || '').trim(), targets = destinations(body.destinations);
  if (!Number.isSafeInteger(id) || id < 1 || !name || name.length > 100 || !targets) return json({error:'ข้อมูลไลน์หรือปลายทางไม่ถูกต้อง'},400,noStore);
  try {
    const item = await ctx.env.DB.prepare('UPDATE toy_post_lines SET name=?,destinations=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id,name,destinations').bind(name,JSON.stringify(targets),id).first();
    return item ? json({item:{...item,destinations:targets}},200,noStore) : json({error:'ไม่พบไลน์'},404,noStore);
  } catch { return json({error:'ชื่อไลน์นี้มีแล้ว'},409,noStore); }
}
