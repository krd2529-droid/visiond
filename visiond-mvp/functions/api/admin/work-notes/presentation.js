import { json, requireAdmin } from '../../../_lib.js';
import { requestWorkNotesAI } from '../../../_work-notes-ai.js';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const parse = text => {
  try { return JSON.parse(String(text || '').replace(/^```json\s*|\s*```$/g, '')); }
  catch { return null; }
};

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
  if (!title || !content) return json({ error: 'ไม่พบเนื้อหาโน้ต' }, 400);

  const prompt = `จัดโครง PowerPoint ภาษาไทยจากโน้ตของผู้ใช้ ห้ามแต่งข้อเท็จจริงที่ไม่มีในโน้ต ตอบ JSON เท่านั้น รูปแบบ {"deck_title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"speaker_notes":"...","attachment_numbers":[1]}]} สร้าง 3-15 สไลด์รวมบทสรุป แต่ละสไลด์ไม่เกิน 6 bullet และแต่ละ bullet ไม่เกิน 140 ตัวอักษร หากโน้ตมีป้าย [รูป N] ให้จัดรูปหมายเลข N ลงสไลด์ที่สัมพันธ์กันและห้ามใช้หมายเลขที่ไม่มีจริง
ชื่อเรื่อง: ${title}
ธีมสี: ${theme || 'ค่าเริ่มต้น'}
ความต้องการเพิ่มเติม: ${instructions || 'ไม่มี'}
รูปแนบที่มี: ${JSON.stringify(attachments)}
โน้ต:
${content}`;

  let text;
  try {
    text = await requestWorkNotesAI(ctx.env, prompt, { jsonMode: true, maxTokens: 2200, temperature: .2 });
  } catch (error) {
    const code = String(error?.message || 'AI_PROVIDER_FAILED');
    if (code === 'AI_NOT_CONFIGURED') return json({ error: 'ยังไม่ได้เชื่อมคีย์ AI สำหรับสร้างสไลด์' }, 503);
    if (code === 'AI_DEADLINE') return json({ error: 'AI ตอบช้าเกินกำหนด ระบบหยุดก่อนเกิด 502 กรุณากดลองใหม่', code, retryable: true }, 504);
    if (code.includes('HTTP_429')) return json({ error: 'โควตา AI เต็มทุกช่อง กรุณาลองใหม่ภายหลัง' }, 502);
    return json({ error: `AI สร้างโครงสไลด์ไม่สำเร็จ (${code})` }, 502);
  }

  const result = parse(text);
  if (!result || !Array.isArray(result.slides) || !result.slides.length) return json({ error: 'AI ส่งโครงสไลด์ไม่สมบูรณ์' }, 502);
  const slides = result.slides.slice(0, 15).map(slide => ({
    title: clean(slide.title, 120),
    bullets: (Array.isArray(slide.bullets) ? slide.bullets : []).map(value => clean(value, 180)).filter(Boolean).slice(0, 6),
    speaker_notes: clean(slide.speaker_notes, 1200),
    attachment_numbers: (Array.isArray(slide.attachment_numbers) ? slide.attachment_numbers : []).map(Number).filter(number => Number.isInteger(number) && number >= 1 && number <= attachments.length).slice(0, 2),
  })).filter(slide => slide.title);
  return json({ ok: true, deck_title: clean(result.deck_title, 160) || title, subtitle: clean(result.subtitle, 240), theme, slides }, 200, { 'cache-control': 'private, no-store' });
}
