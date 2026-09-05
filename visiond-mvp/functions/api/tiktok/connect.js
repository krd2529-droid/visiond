import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {createTikTokState,tikTokAuthorizeUrl,tikTokOAuthConfig} from '../../_tiktok_oauth.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return json({error:'ยังไม่ได้ตั้งค่า TikTok Client key และ Client secret',code:'TIKTOK_OAUTH_NOT_CONFIGURED'},503);
  const url=new URL(ctx.request.url),channelId=String(url.searchParams.get('channel_id')||'').trim().slice(0,80),createNew=url.searchParams.get('create')==='1';
  if(!channelId&&!createNew)return json({error:'กรุณาเลือกช่องหรือเริ่มล็อกอินเพื่อเพิ่มช่องใหม่'},400);
  if(channelId&&!await ctx.env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(channelId,auth.user.id).first())return json({error:'ไม่พบช่องที่ต้องการเชื่อม'},404);
  const state=await createTikTokState(ctx.env,auth.user.id,channelId);
  return Response.redirect(tikTokAuthorizeUrl(config,state),302);
}
