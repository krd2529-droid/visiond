import { json, requireUser } from '../../../../_lib.js';
import { ensurePowerpointLibrary } from '../../../../_powerpoint-library.js';
import { previewImageKey } from '../../../../_powerpoint-preview.js';

export async function onRequestGet(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  const number = Number(ctx.params.number); if (!Number.isInteger(number) || number < 1) return json({ error: 'หมายเลขรูปไม่ถูกต้อง' }, 400);
  await ensurePowerpointLibrary(ctx.env);
  const row = await ctx.env.DB.prepare('SELECT object_key FROM powerpoint_library WHERE id=? AND created_by=?').bind(ctx.params.id, auth.user.id).first();
  if (!row) return json({ error: 'ไม่พบ PowerPoint นี้' }, 404);
  const object = await ctx.env.FILES?.get(previewImageKey(row.object_key, number));
  if (!object) return json({ error: 'ไม่พบรูปตัวอย่าง' }, 404);
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('cache-control', 'private, max-age=3600'); headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}
