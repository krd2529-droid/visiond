export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
export function cookie(request,name){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
export async function sha256(text){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function currentUser(ctx){const sid=cookie(ctx.request,'vd_session');if(!sid)return null;return await ctx.env.DB.prepare(`SELECT u.id,u.email,u.username,u.name,u.phone,u.role,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>datetime('now')`).bind(sid).first()}
export async function requireUser(ctx){const user=await currentUser(ctx);if(!user)return {error:json({error:'กรุณาเข้าสู่ระบบ'},401)};return {user}}
export async function requireAdmin(ctx){const x=await requireUser(ctx);if(x.error)return x;if(!['boss','admin'].includes(x.user.role))return {error:json({error:'บัญชีนี้ไม่มีสิทธิ์แอดมิน'},403)};return x}
export async function requireBoss(ctx){const x=await requireUser(ctx);if(x.error)return x;if(x.user.role!=='boss')return {error:json({error:'เฉพาะ Boss เท่านั้นที่จัดการระดับสมาชิกได้'},403)};return x}
export const statusLabel=s=>({awaiting_payment:'รอชำระเงิน',pending_review:'รอตรวจสลิป',paid:'ชำระเงินแล้ว',rejected:'สลิปไม่ผ่าน',cancelled:'ยกเลิก'}[s]||s)
