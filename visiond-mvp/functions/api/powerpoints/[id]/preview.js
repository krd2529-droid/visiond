import { json, requireUser } from '../../../_lib.js';
import { ensurePowerpointLibrary } from '../../../_powerpoint-library.js';
import { previewManifestKey } from '../../../_powerpoint-preview.js';

export async function onRequestGet(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  await ensurePowerpointLibrary(ctx.env);
  const row = await ctx.env.DB.prepare('SELECT id,object_key FROM powerpoint_library WHERE id=? AND created_by=?').bind(ctx.params.id, auth.user.id).first();
  if (!row) return json({ error: 'ไม่พบ PowerPoint นี้' }, 404);
  const object = await ctx.env.FILES?.get(previewManifestKey(row.object_key));
  if (!object) return json({ error: 'ไฟล์นี้ยังไม่มีตัวอย่างออนไลน์ กรุณาสร้างและบันทึกเข้าคลังใหม่อีกครั้ง', code: 'PREVIEW_NOT_AVAILABLE' }, 404);
  return new Response(object.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
