import { json, requireAdmin } from '../../../_lib.js';
import { requestWorkNotesAI } from '../../../_work-notes-ai.js';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const headers = { 'cache-control': 'private, no-store' };
const ensureJobs = env => env.DB.prepare(`CREATE TABLE IF NOT EXISTS work_note_ai_jobs (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  result_text TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`).run();

const runJob = async (env, id, prompt) => {
  try {
    const expanded = clean(await requestWorkNotesAI(env, prompt, { maxTokens: 2200, temperature: .25, deadlineMs: 25000 }), 30000);
    if (!expanded) throw new Error('AI_EMPTY');
    await env.DB.prepare("UPDATE work_note_ai_jobs SET status='completed',result_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(expanded, id).run();
  } catch (error) {
    const code = clean(error?.message || 'AI_PROVIDER_FAILED', 300);
    await env.DB.prepare("UPDATE work_note_ai_jobs SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(code, id).run();
  }
};

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  await ensureJobs(ctx.env);
  const id = clean(new URL(ctx.request.url).searchParams.get('job'), 80);
  if (!id) return json({ error: 'ไม่พบหมายเลขงาน AI' }, 400, headers);
  const row = await ctx.env.DB.prepare('SELECT status,result_text,error_text FROM work_note_ai_jobs WHERE id=? AND user_id=?').bind(id, auth.user.id).first();
  if (!row) return json({ error: 'ไม่พบงาน AI นี้' }, 404, headers);
  if (row.status === 'completed') return json({ ok: true, status: row.status, expanded_content: row.result_text }, 200, headers);
  if (row.status === 'failed') return json({ ok: false, status: row.status, error: `AI เติมเนื้อหาไม่สำเร็จ (${row.error_text})` }, 200, headers);
  return json({ ok: true, status: row.status }, 200, headers);
}

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const title = clean(body.title, 160);
  const content = clean(body.content, 30000);
  const instructions = clean(body.instructions, 2000);
  if (!title || !content) return json({ error: 'ไม่พบเนื้อหาโน้ตต้นฉบับ' }, 400);

  const prompt = `คุณเป็นบรรณาธิการเนื้อหาสำหรับงานนำเสนอภาษาไทย จงเติมและเรียบเรียงโน้ตที่อาจยังไม่สมบูรณ์ให้เป็นต้นฉบับพร้อมทำ PowerPoint โดยรักษาข้อความและป้าย [รูป N] ไว้ ห้ามสร้างตัวเลข ชื่อบุคคล ผลวิจัย เหตุการณ์ หรือข้อเท็จจริงเฉพาะที่ต้นฉบับไม่ได้ให้มา หากจำเป็นต้องเสนอแนวคิดใหม่ ให้ขึ้นต้นย่อหน้านั้นด้วย [ข้อเสนอเพิ่มเติม] หากข้อมูลสำคัญยังขาด ให้เขียน [ข้อมูลที่ต้องเติม: ...] ตอบเป็นข้อความล้วน ไม่ใช้ JSON และไม่พูดถึงกระบวนการของ AI
หัวข้อ: ${title}
ความต้องการของผู้ใช้: ${instructions || 'เรียบเรียงให้ครบและนำเสนอได้'}
โน้ตต้นฉบับ:
${content}`;

  await ensureJobs(ctx.env);
  const id = crypto.randomUUID();
  await ctx.env.DB.prepare('INSERT INTO work_note_ai_jobs(id,user_id,status) VALUES(?,?,?)').bind(id, auth.user.id, 'queued').run();
  ctx.waitUntil(runJob(ctx.env, id, prompt));
  return json({ ok: true, status: 'queued', job_id: id }, 202, headers);
}
