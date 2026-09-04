import { json, requireAdmin } from '../../../_lib.js';
import { requestWorkNotesAI } from '../../../_work-notes-ai.js';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const headers = { 'cache-control': 'private, no-store' };
const parse = text => { try { return JSON.parse(String(text || '').replace(/^```json\s*|\s*```$/g, '')); } catch { return null; } };
const ensureJobs = env => env.DB.prepare(`CREATE TABLE IF NOT EXISTS work_note_ppt_jobs (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  result_text TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`).run();

const normalizeDeck = (result, title, theme, attachmentCount) => {
  if (!result || !Array.isArray(result.slides) || !result.slides.length) throw new Error('AI_INVALID_DECK');
  const slides = result.slides.slice(0, 15).map(slide => ({
    title: clean(slide.title, 120),
    bullets: (Array.isArray(slide.bullets) ? slide.bullets : []).map(value => clean(value, 180)).filter(Boolean).slice(0, 6),
    speaker_notes: clean(slide.speaker_notes, 1200),
    attachment_numbers: (Array.isArray(slide.attachment_numbers) ? slide.attachment_numbers : []).map(Number)
      .filter(number => Number.isInteger(number) && number >= 1 && number <= attachmentCount).slice(0, 2),
  })).filter(slide => slide.title);
  if (!slides.length) throw new Error('AI_INVALID_DECK');
  return { ok: true, status: 'completed', deck_title: clean(result.deck_title, 160) || title, subtitle: clean(result.subtitle, 240), theme, slides };
};

const runJob = async (env, id, payload) => {
  try {
    const text = await requestWorkNotesAI(env, payload.prompt, { jsonMode: true, maxTokens: 2200, temperature: .2, deadlineMs: 25000 });
    const deck = normalizeDeck(parse(text), payload.title, payload.theme, payload.attachmentCount);
    await env.DB.prepare("UPDATE work_note_ppt_jobs SET status='completed',result_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(JSON.stringify(deck), id).run();
  } catch (error) {
    const code = clean(error?.message || 'AI_PROVIDER_FAILED', 300);
    await env.DB.prepare("UPDATE work_note_ppt_jobs SET status='failed',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(code, id).run();
  }
};

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  await ensureJobs(ctx.env);
  const id = clean(new URL(ctx.request.url).searchParams.get('job'), 80);
  if (!id) return json({ error: 'ไม่พบหมายเลขงาน PowerPoint' }, 400, headers);
  const row = await ctx.env.DB.prepare('SELECT status,result_text,error_text FROM work_note_ppt_jobs WHERE id=? AND user_id=?').bind(id, auth.user.id).first();
  if (!row) return json({ error: 'ไม่พบงาน PowerPoint นี้' }, 404, headers);
  if (row.status === 'completed') return json(JSON.parse(row.result_text), 200, headers);
  if (row.status === 'failed') return json({ ok: false, status: 'failed', error: `AI สร้างโครงสไลด์ไม่สำเร็จ (${row.error_text})` }, 200, headers);
  return json({ ok: true, status: row.status }, 200, headers);
}

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const title = clean(body.title, 160);
  const content = clean(body.content, 30000);
  const instructions = clean(body.instructions, 2000);
  const theme = clean(body.theme, 20);
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .map((file, index) => ({ number: index + 1, id: Number(file.id), name: clean(file.file_name, 160) }))
    .filter(file => Number.isInteger(file.id));
  if (!title || !content) return json({ error: 'ไม่พบเนื้อหาโน้ต' }, 400, headers);

  const prompt = `จัดโครง PowerPoint ภาษาไทยจากโน้ตของผู้ใช้ ห้ามแต่งข้อเท็จจริงที่ไม่มีในโน้ต ตอบ JSON เท่านั้น รูปแบบ {"deck_title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"speaker_notes":"...","attachment_numbers":[1]}]} สร้าง 3-15 สไลด์รวมบทสรุป แต่ละสไลด์ไม่เกิน 6 bullet และแต่ละ bullet ไม่เกิน 140 ตัวอักษร หากโน้ตมีป้าย [รูป N] ให้จัดรูปหมายเลข N ลงสไลด์ที่สัมพันธ์กันและห้ามใช้หมายเลขที่ไม่มีจริง
ชื่อเรื่อง: ${title}
ธีมสี: ${theme || 'ค่าเริ่มต้น'}
ความต้องการเพิ่มเติม: ${instructions || 'ไม่มี'}
รูปแนบที่มี: ${JSON.stringify(attachments)}
โน้ต:
${content}`;

  await ensureJobs(ctx.env);
  const id = crypto.randomUUID();
  await ctx.env.DB.prepare('INSERT INTO work_note_ppt_jobs(id,user_id,status) VALUES(?,?,?)').bind(id, auth.user.id, 'queued').run();
  ctx.waitUntil(runJob(ctx.env, id, { prompt, title, theme, attachmentCount: attachments.length }));
  return json({ ok: true, status: 'queued', job_id: id }, 202, headers);
}
