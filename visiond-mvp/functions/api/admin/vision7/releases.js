import { json, requireAdmin, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { safeVersion } from '../../../_vision7.js';

const safe = (value, max = 500) => String(value || '').normalize('NFKC').trim().slice(0, max);
const hex = (buffer) => [...new Uint8Array(buffer)].map((part) => part.toString(16).padStart(2, '0')).join('');
// This digest identifies the APK whose package, versionCode and commercial signer were checked before release.
const approvedVsms055Sha256 = '6aae4a221b58b28146eea5e68e5a35147ef2f97211d2692122625436d9013713';
// Commercial-signed VSMS 0.5.6: com.smsmix.app, versionCode 13, same approved signer.
const approvedVsms056Sha256 = '2427b59b21433381486b06fd6455aeac1ed1638c06e036986785c2abbc5fc666';
// Commercial-signed VSMS 0.5.7: com.smsmix.app, versionCode 14, same approved signer.
const approvedVsms057Sha256 = '8e54310a4ff955e70a1fac689904d9e87de5c9476cf549e576136f36852f9327';
// Commercial-signed VSMS 0.5.8: com.smsmix.app, versionCode 15, same approved signer.
const approvedVsms058Sha256 = '2f90801d6184d26a9be8baf2ae3788f47f8d1d94134bbb140d1ce4671836f21d';
// Commercial-signed VSMS 0.5.9: com.smsmix.app, versionCode 16, same approved signer.
const approvedVsms059Sha256 = '9cbc37bd8740ac4a5eed4d9ad0e6768e393968105579c7bf6d0abc993ab8c52b';

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
  const program = await ctx.env.DB.prepare('SELECT id,code,active,current_version,minimum_version,force_update FROM vision7_programs WHERE id=?').bind(programId).first();
  if (!program) return json({ error: 'ไม่พบโปรแกรม' }, 404);
  const replaceInactive = form.get('replace_inactive') === '1';
  const vsmsUpdate = program.code === 'sms-mix';
  const vsmsRelease = vsmsUpdate && program.current_version === '0.5.4'
    ? { previous: '0.5.4', version: '0.5.5', sha256: approvedVsms055Sha256 }
    : vsmsUpdate && program.current_version === '0.5.5'
      ? { previous: '0.5.5', version: '0.5.6', sha256: approvedVsms056Sha256 }
      : vsmsUpdate && program.current_version === '0.5.6'
        ? { previous: '0.5.6', version: '0.5.7', sha256: approvedVsms057Sha256 }
        : vsmsUpdate && program.current_version === '0.5.7'
          ? { previous: '0.5.7', version: '0.5.8', sha256: approvedVsms058Sha256 }
          : vsmsUpdate && program.current_version === '0.5.8'
            ? { previous: '0.5.8', version: '0.5.9', sha256: approvedVsms059Sha256 } : null;
  if (vsmsUpdate) {
    const boss = await requireBoss(ctx);
    if (boss.error) return boss.error;
    if (replaceInactive || Number(program.active) !== 1 || !vsmsRelease || program.minimum_version !== '0.5.4' || Number(program.force_update) !== 0 || version !== vsmsRelease.version || minimum !== '0.5.4' || form.get('mandatory') === '1' || !/\.apk$/i.test(file.name) || file.size < 10000)
      return json({ error: 'VSMS ต้องอัปเดตตามเวอร์ชันที่ตรวจลายเซ็นแล้ว และไม่บังคับอัปเดต' }, 409, { 'cache-control': 'private, no-store' });
    const current = await ctx.env.DB.prepare("SELECT id FROM vision7_releases WHERE program_id=? AND version=? AND status='published'").bind(programId,vsmsRelease.previous).first();
    if (!current) return json({ error: `ไม่พบรีลีส VSMS ${vsmsRelease.previous} ปัจจุบัน` }, 409, { 'cache-control': 'private, no-store' });
  }
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
  if (vsmsUpdate && sha256 !== vsmsRelease.sha256) return json({ error: `APK นี้ไม่ตรงกับ VSMS ${vsmsRelease.version} ที่ตรวจแพ็กเกจและลายเซ็นแล้ว` }, 409, { 'cache-control': 'private, no-store' });
  const name = safe(file.name, 180).replace(/[\r\n"\\/]/g, '_') || `vision7-${version}.bin`;
  const objectKey = `vision7/releases/${programId}/${version}-${crypto.randomUUID()}`;
  const mimeType = vsmsUpdate ? 'application/vnd.android.package-archive' : file.type || 'application/octet-stream';
  await ctx.env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: mimeType }, customMetadata: { sha256, version } });
  try {
    if (vsmsUpdate) {
      const uploaded = await ctx.env.FILES.head(objectKey);
      if (!uploaded || Number(uploaded.size) !== file.size || uploaded.customMetadata?.sha256 !== sha256 || uploaded.customMetadata?.version !== version) throw new Error('VSMS_RELEASE_UPLOAD_VERIFY_FAILED');
      const insert = ctx.env.DB.prepare(`INSERT INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes,created_by) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM vision7_programs WHERE id=? AND code='sms-mix' AND active=1 AND current_version=? AND minimum_version='0.5.4' AND force_update=0) AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=? AND version=? AND status='published')`)
        .bind(programId, version, minimum, 0, objectKey, name, mimeType, file.size, sha256, safe(form.get('release_notes'), 2000), auth.user.id, programId, vsmsRelease.previous, programId, vsmsRelease.previous);
      const advance = ctx.env.DB.prepare("UPDATE vision7_programs SET current_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code='sms-mix' AND active=1 AND current_version=? AND minimum_version='0.5.4' AND force_update=0 AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=? AND version=? AND status='published' AND object_key=? AND sha256=?)")
        .bind(vsmsRelease.version, programId, vsmsRelease.previous, programId, vsmsRelease.version, objectKey, sha256);
      // A duplicate insert deliberately violates UNIQUE(program_id,version) if the program did not advance.
      // D1 rolls the whole batch back, so cleanup cannot leave a published row pointing at a deleted R2 object.
      const assertAdvanced = ctx.env.DB.prepare("INSERT INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM vision7_releases WHERE object_key=?) AND NOT EXISTS (SELECT 1 FROM vision7_programs WHERE id=? AND current_version=? AND minimum_version='0.5.4' AND force_update=0)")
        .bind(programId, version, minimum, 0, objectKey, name, mimeType, file.size, sha256, '', objectKey, programId, vsmsRelease.version);
      const [created, advanced] = await ctx.env.DB.batch([insert, advance, assertAdvanced]);
      if (Number(created.meta?.changes) !== 1 || Number(advanced.meta?.changes) !== 1) throw new Error('VSMS_RELEASE_CHANGED');
      return json({ ok: true, id: Number(created.meta.last_row_id), sha256 }, 201, { 'cache-control': 'private, no-store' });
    }
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
    if (String(error?.message).includes('VSMS_RELEASE_CHANGED')) return json({ error: 'VSMS ถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่' }, 409, { 'cache-control': 'private, no-store' });
    if (String(error?.message).includes('VSMS_RELEASE_UPLOAD_VERIFY_FAILED')) return json({ error: 'อัปโหลด VSMS ไม่ครบ รีลีสเดิมยังอยู่' }, 502, { 'cache-control': 'private, no-store' });
    throw error;
  }
}
