import { json, requireAdmin } from '../../../_lib.js';
import { requestWorkNotesAI } from '../../../_work-notes-ai.js';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

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

  try {
    const expanded = clean(await requestWorkNotesAI(ctx.env, prompt, { maxTokens: 7000, temperature: .25 }), 30000);
    if (!expanded) return json({ error: 'AI ไม่ได้ส่งเนื้อหากลับมา' }, 502);
    return json({ ok: true, expanded_content: expanded }, 200, { 'cache-control': 'private, no-store' });
  } catch (error) {
    const code = String(error?.message || 'AI_PROVIDER_FAILED');
    if (code === 'AI_NOT_CONFIGURED') return json({ error: 'ยังไม่ได้เชื่อมคีย์ AI สำหรับเติมเนื้อหา' }, 503);
    if (code.includes('HTTP_429')) return json({ error: 'โควตา AI เต็มทุกช่อง กรุณาลองใหม่ภายหลัง' }, 502);
    return json({ error: `AI เติมเนื้อหาไม่สำเร็จ (${code})` }, 502);
  }
}
