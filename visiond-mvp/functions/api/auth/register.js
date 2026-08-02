import { json, sha256 } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';

export async function onRequestPost(ctx) {
  try {
    await ensureDatabase(ctx.env);
    const body = await ctx.request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/[^0-9+]/g, '');

    if (!name || username.length < 4 || !email || phone.length < 9 || String(body.password || '').length < 8) {
      return json({ error: 'กรอกข้อมูลไม่ครบ ไอดีอย่างน้อย 4 ตัว เบอร์โทรอย่างน้อย 9 ตัว และรหัสผ่านอย่างน้อย 8 ตัว' }, 400);
    }
    if (!/^[a-z0-9._-]+$/i.test(username)) {
      return json({ error: 'ไอดีใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง' }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, 400);

    const exists = await ctx.env.DB.prepare('SELECT id FROM users WHERE lower(email)=? OR lower(username)=?').bind(email, username).first();
    if (exists) return json({ error: 'ไอดีหรืออีเมลนี้ถูกใช้แล้ว' }, 409);

    const salt = crypto.randomUUID();
    const hash = await sha256(salt + body.password);
    const result = await ctx.env.DB.prepare("INSERT INTO users(email,username,name,phone,password_hash,role) VALUES(?,?,?,?,?,'user')")
      .bind(email, username, name, phone, `${salt}:${hash}`).run();
    const sessionId = crypto.randomUUID();
    await ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))")
      .bind(sessionId, result.meta.last_row_id).run();
    return json({ ok: true }, 200, { 'set-cookie': `vd_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` });
  } catch (error) {
    console.error('register failed', error);
    if (String(error).includes('D1_NOT_CONNECTED')) return json({ error: 'ยังไม่ได้เชื่อมฐานข้อมูล D1 ชื่อ DB ใน Cloudflare' }, 503);
    return json({ error: 'ระบบสมาชิกยังเชื่อมฐานข้อมูลไม่สำเร็จ กรุณาตรวจ D1 Binding ชื่อ DB' }, 500);
  }
}
