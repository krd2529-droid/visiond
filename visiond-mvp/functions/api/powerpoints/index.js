import { json, requireUser } from '../../_lib.js';
import { ensurePowerpointLibrary, PPTX_MIME, safePptxName, validatedPptx } from '../../_powerpoint-library.js';
import { previewImageKey, previewManifestKey, validatedPowerpointPreview } from '../../_powerpoint-preview.js';
const headers = { 'cache-control': 'private, no-store' };

export async function onRequestGet(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  await ensurePowerpointLibrary(ctx.env);
  const rows = await ctx.env.DB.prepare('SELECT id,source_note_id,title,file_name,file_size,created_at,updated_at FROM powerpoint_library WHERE created_by=? ORDER BY created_at DESC,id DESC').bind(auth.user.id).all();
  return json({ items: rows.results || [] }, 200, headers);
}

export async function onRequestPost(ctx) {
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  if (!ctx.env.FILES) return json({ error: 'ยังไม่ได้เชื่อมพื้นที่เก็บไฟล์' }, 503, headers);
  const form = await ctx.request.formData(), file = form.get('file');
  let bytes; try { bytes = await validatedPptx(file); } catch (error) {
    const message = error.message === 'PPTX_SIZE' ? 'ไฟล์ PowerPoint ต้องไม่เกิน 50 MB' : 'ไฟล์ต้องเป็น PPTX ที่เปิดใช้งานได้';
    return json({ error: message }, 400, headers);
  }
  await ensurePowerpointLibrary(ctx.env);
  const title = String(form.get('title') || file.name || 'PowerPoint').trim().slice(0, 180), fileName = safePptxName(file.name || title), sourceNoteId = Number(form.get('source_note_id')) || null;
  const key = `powerpoints/${auth.user.id}/${crypto.randomUUID()}.pptx`;
  let previewNumbers = [];
  await ctx.env.FILES.put(key, bytes, { httpMetadata: { contentType: PPTX_MIME } });
  try {
    if (form.get('preview') && sourceNoteId) {
      if (!['boss', 'admin'].includes(auth.user.role)) throw new Error('PREVIEW_FORBIDDEN');
      const attachments = (await ctx.env.DB.prepare('SELECT object_key,mime_type FROM admin_work_note_attachments WHERE note_id=? ORDER BY sort_order,id').bind(sourceNoteId).all()).results || [];
      const preview = validatedPowerpointPreview(form.get('preview'), attachments.length), used = [...new Set(preview.pages.flatMap(page => page.bullets.flatMap(bullet => bullet.attachment_numbers)))];
      previewNumbers = used;
      for (const number of used) {
        const source = await ctx.env.FILES.get(attachments[number - 1].object_key); if (!source) throw new Error(`PREVIEW_IMAGE_${number}`);
        await ctx.env.FILES.put(previewImageKey(key, number), await source.arrayBuffer(), { httpMetadata: { contentType: attachments[number - 1].mime_type } });
      }
      preview.images = Object.fromEntries(used.map(number => [number, true]));
      await ctx.env.FILES.put(previewManifestKey(key), JSON.stringify(preview), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    }
    const result = await ctx.env.DB.prepare('INSERT INTO powerpoint_library(created_by,source_note_id,title,file_name,object_key,file_size) VALUES(?,?,?,?,?,?)').bind(auth.user.id, sourceNoteId, title, fileName, key, bytes.length).run();
    const id = result.meta.last_row_id;
    return json({ ok: true, id, title, file_name: fileName, file_size: bytes.length }, 201, headers);
  } catch (error) { await ctx.env.FILES.delete(key).catch(() => {}); await ctx.env.FILES.delete(previewManifestKey(key)).catch(() => {}); for (const number of previewNumbers) await ctx.env.FILES.delete(previewImageKey(key, number)).catch(() => {}); return json({ error: 'บันทึก PowerPoint เข้าคลังไม่สำเร็จ' }, 500, headers); }
}
