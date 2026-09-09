import {json} from '../../_lib.js';
import {requireVxUser} from '../../_vx_access.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {canonicalTikTokProfileSlot,createTikTokState,tikTokAuthorizeUrl,tikTokOAuthConfig} from '../../_tiktok_oauth.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireVxUser(ctx);if(auth.error)return auth.error;
  const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return json({error:'ยังไม่ได้ตั้งค่า TikTok Client key และ Client secret',code:'TIKTOK_OAUTH_NOT_CONFIGURED'},503);
  const url=new URL(ctx.request.url),channelId=String(url.searchParams.get('channel_id')||'').trim().slice(0,80),createNew=url.searchParams.get('create')==='1',slotInput=url.searchParams.get('profile_slot_id'),profileSlotId=canonicalTikTokProfileSlot(slotInput);
  if(channelId&&createNew)return json({error:'เลือกได้อย่างใดอย่างหนึ่งระหว่างช่องเดิมหรือช่องใหม่'},400);
  if(!channelId&&!createNew)return json({error:'กรุณาเลือกช่องหรือเริ่มล็อกอินเพื่อเพิ่มช่องใหม่'},400);
  if(slotInput!==null&&!profileSlotId)return json({error:'รหัสโปรไฟล์เบราว์เซอร์ไม่ถูกต้อง',code:'TIKTOK_PROFILE_SLOT_INVALID'},400);
  if(channelId&&!await ctx.env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(channelId,auth.user.id).first())return json({error:'ไม่พบช่องที่ต้องการเชื่อม'},404);
  if(profileSlotId){
    const bound=await ctx.env.DB.prepare('SELECT user_id,channel_id FROM tiktok_browser_profile_bindings WHERE slot_id=?').bind(profileSlotId).first();
    if(bound&&(createNew||Number(bound.user_id)!==Number(auth.user.id)||bound.channel_id!==channelId))return json({error:'โปรไฟล์เบราว์เซอร์นี้ถูกผูกแล้ว',code:'TIKTOK_PROFILE_SLOT_CONFLICT'},409);
    if(channelId&&!bound)return json({error:'โปรไฟล์เบราว์เซอร์ไม่ตรงกับช่องนี้',code:'TIKTOK_PROFILE_SLOT_CONFLICT'},409);
  }
  let state='';
  try{state=await createTikTokState(ctx.env,auth.user.id,channelId,profileSlotId)}catch(error){
    const message=String(error?.message||error).toLowerCase();
    if(profileSlotId&&(message.includes('unique')||message.includes('constraint')))return json({error:'โปรไฟล์เบราว์เซอร์นี้กำลังถูกใช้งาน',code:'TIKTOK_PROFILE_SLOT_CONFLICT'},409);
    if(profileSlotId&&message.includes('no such table'))return json({error:'ระบบผูกโปรไฟล์เบราว์เซอร์ยังไม่พร้อม',code:'TIKTOK_PROFILE_BINDING_UNAVAILABLE'},503);
    throw error;
  }
  return Response.redirect(tikTokAuthorizeUrl(config,state),302);
}
