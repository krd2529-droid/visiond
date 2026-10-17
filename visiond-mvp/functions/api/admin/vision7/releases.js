import { json, requireAdmin, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { safeVersion } from '../../../_vision7.js';

const safe = (value, max = 500) => String(value || '').normalize('NFKC').trim().slice(0, max);
const hex = (buffer) => [...new Uint8Array(buffer)].map((part) => part.toString(16).padStart(2, '0')).join('');

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const rows = await ctx.env.DB.prepare(`SELECT r.id,r.program_id,r.version,r.minimum_version,r.mandatory,r.file_name,r.file_size,r.sha256,r.release_notes,r.status,r.published_at,p.code program_code FROM vision7_releases r JOIN vision7_programs p ON p.id=r.program_id ORDER BY r.id DESC LIMIT 200`).all();
  return json({ items: rows.results || [] });
}

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const form = await ctx.request.formData();
  const programId = Number(form.get('program_id'));
  const version = safeVersion(form.get('version'));
  const minimum = safeVersion(form.get('minimum_version') || version);
  const file = form.get('file');
  if (!programId || !version || !minimum || !(file instanceof File) || !file.size) return json({ error: 'กรุณาเลือกโปรแกรม เวอร์ชัน และไฟล์ติดตั้ง' }, 400);
  if (file.size > 95 * 1024 * 1024) return json({ error: 'ไฟล์ติดตั้งต้องไม่เกิน 95 MB ต่อรีลีส' }, 413);
  const program = await ctx.env.DB.prepare('SELECT id,code,active FROM vision7_programs WHERE id=?').bind(programId).first();
  if (!program) return json({ error: 'ไม่พบโปรแกรม' }, 404);
  const replaceInactive = form.get('replace_inactive') === '1';
  let previous = null;
  if (replaceInactive) {
    const boss = await requireBoss(ctx);
    if (boss.error) return boss.error;
    if (program.code !== 'v-record' || Number(program.active) !== 0 || version !== '0.6.0' || minimum !== '0.6.0' || form.get('mandatory') === '1' || !/\.zip$/i.test(file.name))
      return json({ error: 'แทนที่ได้เฉพาะ V-Record 0.6.0 ที่ยังไม่เปิดขาย' }, 409);
    previous = await ctx.env.DB.prepare("SELECT id,object_key FROM vision7_releases WHERE program_id=? AND version='0.6.0' AND status='published'").bind(programId).first();
    if (!previous) return json({ error: 'ไม่พบรีลีส V-Record 0.6.0 ที่จะแทนที่' }, 404);
    const issued = await ctx.env.DB.prepare('SELECT id FROM vision7_licenses WHERE program_id=? LIMIT 1').bind(programId).first();
    if (issued) return json({ error: 'มีคีย์ V-Record ที่ออกแล้ว จึงไม่สามารถแทนรีลีสด้วยช่องทางนี้' }, 409);
  }
  const bytes = await file.arrayBuffer();
  const sha256 = hex(await crypto.subtle.digest('SHA-256', bytes));
  const name = safe(file.name, 180).replace(/[\r\n"\\/]/g, '_') || `vision7-${version}.bin`;
  const objectKey = `vision7/releases/${programId}/${version}-${crypto.randomUUID()}`;
  await ctx.env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: file.type || 'application/octet-stream' }, customMetadata: { sha256, version } });
  try {
    if (replaceInactive) {
      const uploaded = await ctx.env.FILES.head(objectKey);
      if (!uploaded || Number(uploaded.size) !== file.size || uploaded.customMetadata?.sha256 !== sha256) throw new Error('VRECORD_RELEASE_UPLOAD_VERIFY_FAILED');
      const result = await ctx.env.DB.prepare("UPDATE vision7_releases SET object_key=?,file_name=?,mime_type=?,file_size=?,sha256=?,release_notes=?,created_by=?,published_at=CURRENT_TIMESTAMP WHERE id=? AND program_id=? AND version='0.6.0' AND status='published' AND object_key=? AND EXISTS (SELECT 1 FROM vision7_programs WHERE id=? AND active=0) AND NOT EXISTS (SELECT 1 FROM vision7_licenses WHERE program_id=? LIMIT 1)")
        .bind(objectKey, name, file.type || 'application/octet-stream', file.size, sha256, safe(form.get('release_notes'), 2000), auth.user.id, previous.id, programId, previous.object_key, programId, programId).run();
      if (Number(result.meta?.changes) !== 1) throw new Error('VRECORD_RELEASE_CHANGED');
      return json({ ok: true, id: Number(previous.id), sha256, replaced: true }, 200);
    }
    const out = await ctx.env.DB.prepare(`INSERT INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(programId, version, minimum, form.get('mandatory') === '1' ? 1 : 0, objectKey, name, file.type || 'application/octet-stream', file.size, sha256, safe(form.get('release_notes'), 2000), auth.user.id).run();
    await ctx.env.DB.prepare(`UPDATE vision7_programs SET current_version=?,minimum_version=?,force_update=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(version, minimum, form.get('mandatory') === '1' ? 1 : 0, programId).run();
    return json({ ok: true, id: Number(out.meta.last_row_id), sha256 }, 201);
  } catch (error) {
    await ctx.env.FILES.delete(objectKey).catch(() => {});
    if (String(error?.message).includes('UNIQUE')) return json({ error: 'เวอร์ชันนี้มีอยู่แล้ว' }, 409);
    if (String(error?.message).includes('VRECORD_RELEASE_CHANGED')) return json({ error: 'รีลีสถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่' }, 409);
    if (String(error?.message).includes('VRECORD_RELEASE_UPLOAD_VERIFY_FAILED')) return json({ error: 'อัปโหลดรีลีสใหม่ไม่ครบ รีลีสเดิมยังอยู่' }, 502);
    throw error;
  }
}
