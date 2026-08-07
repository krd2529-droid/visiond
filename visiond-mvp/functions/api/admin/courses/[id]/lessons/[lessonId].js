import { json, requireAdmin } from '../../../../../_lib.js';
import { ensureDatabase } from '../../../../../_schema.js';

export async function onRequestDelete(ctx){await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const lesson=await ctx.env.DB.prepare('SELECT * FROM course_lessons WHERE id=? AND course_id=?').bind(ctx.params.lessonId,ctx.params.id).first();if(!lesson)return json({error:'ไม่พบบทเรียน'},404);if(lesson.video_key)await ctx.env.FILES.delete(lesson.video_key);if(lesson.pdf_key)await ctx.env.FILES.delete(lesson.pdf_key);await ctx.env.DB.prepare('DELETE FROM course_lessons WHERE id=?').bind(lesson.id).run();return json({ok:true});}
