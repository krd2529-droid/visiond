import {cookie,json,sha256} from './_lib.js';
import {requireVxUser,vxAccess} from './_vx_access.js';
import {canonicalTikTokProfileSlot,tikTokAuthorizeUrl,tikTokOAuthConfig} from './_tiktok_oauth.js';
import {tikTokShopCreatorAuthorizeUrl,tikTokShopOAuthConfig} from './_tiktok_shop_oauth.js';

const privateHeaders={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hex=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const fail=(status=400)=>json({error:'คำขอเชื่อมโปรไฟล์ไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่จากหน้าหลัก'},status,privateHeaders);
const nonceName=id=>`__Host-vd_oauth_${id}`;
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin&&['same-origin',null].includes(request.headers.get('sec-fetch-site'))&&request.headers.get('content-type')?.split(';')[0]==='application/json';

// All predicates are also evaluated inside the final D1 batch, after provider awaits.
export const handoffLiveSql=`EXISTS(SELECT 1 FROM tiktok_oauth_handoff_heads h WHERE h.slot_id=f.slot_id AND h.user_id=f.user_id AND h.handoff_id=f.id)
 AND EXISTS(SELECT 1 FROM sessions s WHERE s.id=f.session_id AND s.user_id=f.user_id AND s.expires_at>datetime('now'))
 AND EXISTS(SELECT 1 FROM users u WHERE u.id=f.user_id AND (
 (f.access_source='admin' AND u.role IN ('boss','admin')) OR
 (f.access_source='paid' AND EXISTS(SELECT 1 FROM vx_access_grants g JOIN orders o ON o.id=g.order_id WHERE g.order_id=f.access_id AND g.user_id=u.id AND o.status='paid' AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP)) OR
 (f.access_source='review' AND u.role='user' AND COALESCE(u.is_test_user,0)=0 AND EXISTS(SELECT 1 FROM vx_review_access_grants g WHERE g.id=f.access_id AND g.user_id=u.id AND g.scope='tiktok_app_review' AND g.revoked_at IS NULL AND g.starts_at<=CURRENT_TIMESTAMP AND g.expires_at>CURRENT_TIMESTAMP))))
 AND (f.channel_id='' OR EXISTS(SELECT 1 FROM tiktok_channels ch WHERE ch.id=f.channel_id AND ch.created_by=f.user_id AND ch.archived_at IS NULL))
 AND (f.account_limit IS NULL OR (SELECT COUNT(*) FROM tiktok_channels ch WHERE ch.created_by=f.user_id AND ch.archived_at IS NULL)<=f.account_limit)
 AND (f.provider<>'shop' OR EXISTS(SELECT 1 FROM tiktok_browser_profile_bindings b WHERE b.slot_id=f.slot_id AND b.user_id=f.user_id AND b.channel_id=f.channel_id))`;

export async function issueHandoff(ctx){
 if(!sameOrigin(ctx.request))return fail(403);
 const auth=await requireVxUser(ctx);if(auth.error)return auth.error;
 const body=await ctx.request.json().catch(()=>null);if(!body)return fail();
 const {provider,intent}=body,slotId=canonicalTikTokProfileSlot(body.slot_id),channelId=body.channel_id||'';
 if(!slotId||!['tiktok','shop'].includes(provider)||!['new','reconnect'].includes(intent)||
   (intent==='new'&&(channelId||provider!=='tiktok'))||(intent==='reconnect'&&!canonicalTikTokProfileSlot(channelId)))return fail();
 const config=provider==='tiktok'?tikTokOAuthConfig(ctx.env):tikTokShopOAuthConfig(ctx.env);if(!config.configured)return fail(503);
 if(channelId&&!await ctx.env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL').bind(channelId,auth.user.id).first())return fail(404);
 const binding=await ctx.env.DB.prepare('SELECT user_id,channel_id FROM tiktok_browser_profile_bindings WHERE slot_id=?').bind(slotId).first();
 if(binding&&(Number(binding.user_id)!==Number(auth.user.id)||binding.channel_id!==channelId))return fail(409);
 if(provider==='shop'&&!binding)return json({error:'กรุณาเชื่อม TikTok Login Kit เพื่อผูกโปรไฟล์กับช่องนี้ก่อน',code:'PROFILE_BINDING_REQUIRED'},409,privateHeaders);
 const channelBinding=channelId?await ctx.env.DB.prepare('SELECT slot_id FROM tiktok_browser_profile_bindings WHERE channel_id=?').bind(channelId).first():null;
 if(channelBinding&&channelBinding.slot_id!==slotId)return fail(409);
 const id=crypto.randomUUID(),ticket=random(),source=auth.vx.admin?'admin':auth.vx.access_source;
 let results;try{results=await ctx.env.DB.batch([
 ctx.env.DB.prepare("DELETE FROM tiktok_oauth_handoffs WHERE id IN (SELECT id FROM tiktok_oauth_handoffs WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,id LIMIT 24)"),
 ctx.env.DB.prepare(`INSERT INTO tiktok_oauth_handoffs(id,ticket_hash,user_id,session_id,slot_id,channel_id,provider,intent,access_source,access_id,account_limit,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now','+10 minutes'))`).bind(id,await sha256(ticket),auth.user.id,cookie(ctx.request,'vd_session'),slotId,channelId,provider,intent,source,auth.vx.order_id||auth.vx.id||null,auth.vx.account_limit),
 ctx.env.DB.prepare(`INSERT INTO tiktok_oauth_handoff_heads(slot_id,user_id,handoff_id) VALUES(?,?,?) ON CONFLICT(slot_id) DO UPDATE SET handoff_id=excluded.handoff_id,user_id=excluded.user_id`).bind(slotId,auth.user.id,id)
 ]);}catch(error){if(String(error?.message).includes('HANDOFF_OWNER_CONFLICT'))return fail(409);throw error}
 if(results[2]?.meta?.changes!==1)return fail(409);
 return json({id,ticket,slot_id:slotId},200,privateHeaders);
}

export async function redeemHandoff(ctx){
 if(!sameOrigin(ctx.request))return fail(403);
 const body=await ctx.request.json().catch(()=>null);if(!body||!canonicalTikTokProfileSlot(body.id)||!canonicalTikTokProfileSlot(body.slot_id)||!hex(body.ticket))return fail();
 const row=await ctx.env.DB.prepare(`SELECT f.* FROM tiktok_oauth_handoffs f WHERE f.id=? AND f.ticket_hash=? AND f.slot_id=? AND f.status='issued' AND f.expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}`).bind(body.id,await sha256(body.ticket),body.slot_id).first();if(!row)return fail(409);
 const state='h1'+random(),nonce=random();
 const changed=await ctx.env.DB.prepare(`UPDATE tiktok_oauth_handoffs AS f SET status='redeemed',state_hash=?,nonce_hash=? WHERE id=? AND status='issued' AND expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}`).bind(await sha256(state),await sha256(nonce),row.id).run();if(changed.meta?.changes!==1)return fail(409);
 const config=row.provider==='tiktok'?tikTokOAuthConfig(ctx.env):tikTokShopOAuthConfig(ctx.env);
 const url=row.provider==='tiktok'?tikTokAuthorizeUrl(config,state):tikTokShopCreatorAuthorizeUrl(config,state);
 return json({url},200,{...privateHeaders,'set-cookie':`${nonceName(row.id)}=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`});
}

export async function consumeHandoff(ctx,state,provider){
 if(!/^h1[0-9a-f]{64}$/.test(state))return null;
 const row=await ctx.env.DB.prepare(`SELECT f.* FROM tiktok_oauth_handoffs f WHERE f.state_hash=? AND f.provider=? AND f.status='redeemed' AND f.expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}`).bind(await sha256(state),provider).first();
 if(!row)return null;const nonce=cookie(ctx.request,nonceName(row.id));if(!hex(nonce)||await sha256(nonce)!==row.nonce_hash)return null;
 const changed=await ctx.env.DB.prepare(`UPDATE tiktok_oauth_handoffs AS f SET status='processing' WHERE id=? AND status='redeemed' AND expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}`).bind(row.id).run();if(changed.meta?.changes!==1)return null;
 const user=await ctx.env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(row.user_id).first();
 if(!user)return null;const vx=await vxAccess(ctx.env,user);if(!vx.active)return null;
 return {auth:{user,vx,handoff:row},stateRow:{channel_id:row.channel_id,profile_slot_id:row.slot_id}};
}
export async function handoffStillCurrent(ctx,auth){
 return Boolean(await ctx.env.DB.prepare(`SELECT f.id FROM tiktok_oauth_handoffs f WHERE f.id=? AND f.status='processing' AND f.expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}`).bind(auth.handoff.id).first());
}
export function handoffGuardStatements(env,auth){
 if(!auth.handoff)return [];
 return [env.DB.prepare(`INSERT INTO tiktok_oauth_handoff_guard(id) VALUES((SELECT f.id FROM tiktok_oauth_handoffs f WHERE f.id=? AND f.status='processing' AND f.expires_at>CURRENT_TIMESTAMP AND ${handoffLiveSql}))`).bind(auth.handoff.id),env.DB.prepare("UPDATE tiktok_oauth_handoffs SET status='complete' WHERE id=?").bind(auth.handoff.id),env.DB.prepare('DELETE FROM tiktok_oauth_handoff_guard WHERE id=?').bind(auth.handoff.id)];
}
export function handoffCompletion(status,channelId='',id=''){
 const ok=['connected','permissions_required'].includes(status);
 const text=ok?'บันทึกการอนุญาตแล้ว กลับไปหน้าหลัก VisionD แล้วกดรีเฟรชช่องเพื่อดูสถานะสิทธิ์ API':'ยังเชื่อมไม่สำเร็จ กลับไปหน้าหลัก VisionD แล้วเริ่มใหม่สำหรับช่องเดิม';
 return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VisionD · TikTok</title><body><h1>${text}</h1><p>คุณสามารถปิดแท็บนี้ได้ โปรไฟล์ TikTok เดิมยังคงอยู่</p></body></html>`,{headers:{...privateHeaders,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",...(id?{'set-cookie':`${nonceName(id)}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`}:{})}});
}
