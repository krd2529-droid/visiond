import { json, requireUser } from '../../_lib.js';
import { ensurePowerpointLibrary, powerpointHeaders } from '../../_powerpoint-library.js';

const owned = (ctx, user) => ctx.env.DB.prepare('SELECT * FROM powerpoint_library WHERE id=? AND created_by=?').bind(ctx.params.id, user.id).first();
export async function onRequestGet(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  await ensurePowerpointLibrary(ctx.env); const row = await owned(ctx, auth.user);
  if (!row) return json({ error: 'ไม่พบ PowerPoint นี้' }, 404);
  const object = await ctx.env.FILES?.get(row.object_key); if (!object) return json({ error: 'ไม่พบไฟล์ PowerPoint ในพื้นที่จัดเก็บ' }, 404);
  const view = new URL(ctx.request.url).searchParams.get('mode') === 'view';
  return new Response(object.body, { headers: powerpointHeaders(row.file_name, row.file_size, view ? 'inline' : 'attachment') });
}
export async function onRequestDelete(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  await ensurePowerpointLibrary(ctx.env); const row = await owned(ctx, auth.user);
  if (!row) return json({ error: 'ไม่พบ PowerPoint นี้' }, 404);
  await ctx.env.DB.prepare('DELETE FROM powerpoint_library WHERE id=? AND created_by=?').bind(row.id, auth.user.id).run();
  await ctx.env.FILES?.delete(row.object_key).catch(error => console.error('POWERPOINT_LIBRARY_R2_DELETE_FAILED', row.object_key, error));
  return json({ ok: true });
}
