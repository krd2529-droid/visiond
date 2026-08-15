import { json, sha256 } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import {rateLimit,verifyTurnstile,hashPassword,securityLog} from '../../_security.js';
import {requestIp} from '../../_security.js';
import {claimVisitorHistory} from '../../_analytics.js';

const TERMS_VERSION='2026-08-10-v1';

export async function onRequestPost(ctx) {
  try {
    await ensureDatabase(ctx.env);
    const body = await ctx.request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ');
    const lastName = String(body.lastName || '').trim().replace(/\s+/g, ' ');
    const name = `${firstName} ${lastName}`.trim();
    const phone = String(body.phone || '').replace(/\D/g, '');

    if (body.termsAccepted !== true) return json({ error: 'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว' }, 400);

    if (!firstName || !lastName || username.length < 4 || !email || !phone || String(body.password || '').length < 10) {
      return json({ error: 'กรุณากรอกชื่อ นามสกุล เบอร์โทรศัพท์ อีเมล ไอดีสมาชิก และรหัสผ่านให้ครบ' }, 400);
    }
    if (!/^[a-z0-9._-]+$/i.test(username)) {
      return json({ error: 'ไอดีใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง' }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, 400);
    if (!/^0\d{8,9}$/.test(phone)) return json({ error: 'กรุณากรอกเบอร์โทรศัพท์ไทย 9–10 หลัก โดยขึ้นต้นด้วย 0' }, 400);

    // Do not let one customer's mistakes block everyone sharing a mobile,
    // office, shop, or home NAT address. Invalid forms consume no quota;
    // valid attempts are limited by both the source IP and applicant identity.
    const identity = (await sha256(`${email}|${username}`)).slice(0, 24);
    const ipLimited = await rateLimit(ctx.env, ctx.request, 'register-ip-v2', 30, 60, 15);
    if (ipLimited.error) return ipLimited.error;
    const identityLimited = await rateLimit(ctx.env, ctx.request, `register-person-v2-${identity}`, 8, 60, 15);
    if (identityLimited.error) return identityLimited.error;

    const turnstile=await verifyTurnstile(ctx.env,ctx.request,body.turnstile_token);if(turnstile.error)return turnstile.error;

    const exists = await ctx.env.DB.prepare('SELECT id FROM users WHERE lower(email)=? OR lower(username)=?').bind(email, username).first();
    if (exists) return json({ error: 'ไอดีหรืออีเมลนี้ถูกใช้แล้ว' }, 409);
    const duplicateName=await ctx.env.DB.prepare('SELECT id FROM users WHERE lower(trim(name))=lower(trim(?)) LIMIT 1').bind(name).first();
    if(duplicateName)return json({error:'ชื่อ–นามสกุลนี้มีบัญชีอยู่แล้ว หากเป็นยูสเทสให้ Boss กำหนดสถานะจากหลังบ้าน'},409);

    const hash = await hashPassword(body.password);
    const acceptedIpHash=await sha256(`${requestIp(ctx.request)}|visiond-terms-ip-v1`),sessionId=crypto.randomUUID();
    const [result] = await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO users(email,username,name,phone,password_hash,role) VALUES(?,?,?,?,?,'user')").bind(email, username, name, phone, hash),
      ctx.env.DB.prepare('INSERT INTO user_terms_acceptances(user_id,terms_version,accepted_at,ip_hash) SELECT id,?,CURRENT_TIMESTAMP,? FROM users WHERE lower(email)=?').bind(TERMS_VERSION,acceptedIpHash,email),
      ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) SELECT ?,id,datetime('now','+24 hours') FROM users WHERE lower(email)=?").bind(sessionId,email)
    ]);
    const userId=Number(result.meta.last_row_id);
    const claimed=await claimVisitorHistory(ctx.env,ctx.request,userId);
    await ctx.env.DB.prepare(`INSERT INTO customer_events(visitor_key,user_id,event_type,path,metadata) VALUES(?,?,'signup_complete','/register',?)`).bind(claimed.visitor_key,userId,JSON.stringify({claimed_guest_events:claimed.claimed})).run().catch(()=>{});
    await securityLog(ctx.env,ctx.request,'register_success','info',username,userId);
    return json({ ok: true }, 200, { 'set-cookie': `vd_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/` });
  } catch (error) {
    console.error('register failed', error);
    if (String(error).includes('D1_NOT_CONNECTED')) return json({ error: 'ยังไม่ได้เชื่อมฐานข้อมูล D1 ชื่อ DB ใน Cloudflare' }, 503);
    if (String(error).includes('Pbkdf2')) return json({ error: 'ระบบเข้ารหัสรหัสผ่านไม่รองรับบนเซิร์ฟเวอร์ กรุณาอัปเดต VisionD เป็นเวอร์ชันล่าสุด' }, 500);
    return json({ error: 'ระบบสมาชิกยังเชื่อมฐานข้อมูลไม่สำเร็จ กรุณาตรวจ D1 Binding ชื่อ DB' }, 500);
  }
}
