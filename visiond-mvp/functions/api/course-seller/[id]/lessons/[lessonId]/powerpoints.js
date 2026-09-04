import { json, requireUser } from '../../../../../_lib.js';
import { ensureDatabase } from '../../../../../_schema.js';
import { ensurePowerpointLibrary, PPTX_MIME, safePptxName } from '../../../../../_powerpoint-library.js';

const ownedLesson = (ctx, user) => ctx.env.DB.prepare("SELECT l.id,l.course_id,c.edit_expires_at,c.product_id,c.license_entitlement_id FROM course_lessons l JOIN courses c ON c.id=l.course_id JOIN products p ON p.id=c.product_id WHERE l.id=? AND l.course_id=? AND c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL").bind(ctx.params.lessonId, ctx.params.id, user.id).first();
const locked = (ctx, courseId) => ctx.env.DB.prepare("SELECT id FROM orders WHERE seller_course_id=? AND status IN ('pending_review','paid') LIMIT 1").bind(courseId).first();

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env); const auth = await requireUser(ctx); if (auth.error) return auth.error;
  const lesson = await ownedLesson(ctx, auth.user); if (!lesson) return json({ error: 'ไม่พบ EP' }, 404);
  if (await locked(ctx, lesson.course_id)) return json({ error: 'หลังมียอดขาย เปลี่ยนแปลงเนื้อหาไม่ได้' }, 409);
  if (lesson.edit_expires_at && Date.parse(lesson.edit_expires_at) <= Date.now()) return json({ error: 'หมดระยะเวลาแก้ไข 30 วันแล้ว' }, 403);
  const body = await ctx.request.json().catch(() => ({})), powerpointId = Number(body.powerpoint_id);
  if (!Number.isInteger(powerpointId) || powerpointId < 1) return json({ error: 'กรุณาเลือก PowerPoint จากคลัง' }, 400);
  await ensurePowerpointLibrary(ctx.env);
  const source = await ctx.env.DB.prepare('SELECT * FROM powerpoint_library WHERE id=? AND created_by=?').bind(powerpointId, auth.user.id).first();
  if (!source) return json({ error: 'ไม่พบ PowerPoint ในคลังของคุณ' }, 404);
  const object = await ctx.env.FILES?.get(source.object_key); if (!object) return json({ error: 'ไฟล์ PowerPoint ต้นฉบับสูญหาย' }, 404);
  const key = `seller-course-${lesson.course_id}-file-${crypto.randomUUID()}.pptx`, bytes = await object.arrayBuffer();
  await ctx.env.FILES.put(key, bytes, { httpMetadata: { contentType: PPTX_MIME } });
  try {
    const current = await ctx.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM course_lesson_files WHERE lesson_id=?').bind(lesson.id).first();
    const duplicate = await ctx.env.DB.prepare('SELECT id FROM course_lesson_files WHERE lesson_id=? AND file_name=? AND file_size=?').bind(lesson.id, safePptxName(source.file_name), source.file_size).first();
    if (duplicate) { await ctx.env.FILES.delete(key).catch(() => {}); return json({ ok: true, id: duplicate.id, already_attached: true, message: 'PowerPoint นี้แนบใน EP แล้ว' }); }
    const result = await ctx.env.DB.prepare('INSERT INTO course_lesson_files(lesson_id,object_key,file_name,mime_type,file_size,sort_order) VALUES(?,?,?,?,?,?)').bind(lesson.id, key, safePptxName(source.file_name), PPTX_MIME, source.file_size, Number(current.n) + 10).run();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE courses SET review_status=CASE WHEN license_entitlement_id IS NULL THEN 'draft' ELSE 'pending' END,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(lesson.course_id),
      ctx.env.DB.prepare("UPDATE products SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(lesson.product_id),
    ]);
    return json({ ok: true, id: result.meta.last_row_id, message: 'แนบ PowerPoint จากคลังเข้า EP แล้ว' }, 201);
  } catch (error) { await ctx.env.FILES.delete(key).catch(() => {}); return json({ error: 'แนบ PowerPoint เข้า EP ไม่สำเร็จ' }, 500); }
}
