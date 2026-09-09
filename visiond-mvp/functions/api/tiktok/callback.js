import {requireVxUser,vxRequestAccessStillCurrent,vxChannelInsert,vxChannelRestore} from '../../_vx_access.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {consumeTikTokState,exchangeTikTokCode,fetchTikTokProfile,saveTikTokConnection,syncTikTokConnection,tikTokOAuthConfig} from '../../_tiktok_oauth.js';
import {requireD1DataFetchAvailable} from '../../_d1_quota_breaker.js';

const back=(status,detail='',channelId='')=>Response.redirect(`https://visiondonline.com/tiktok-analyzer?tiktok=${encodeURIComponent(status)}${detail?`&detail=${encodeURIComponent(detail)}`:''}${channelId?`&channel_id=${encodeURIComponent(channelId)}`:''}`,302);
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
async function channelForProfile(ctx,auth,requestedChannelId,profile,limit){
  const env=ctx.env,userId=auth.user.id;
  if(requestedChannelId){
    const channel=await env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(requestedChannelId,userId).first();
    return channel?.id||'';
  }
  const linked=await env.DB.prepare("SELECT c.channel_id FROM tiktok_connections c JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.open_id=? AND ch.created_by=? LIMIT 1").bind(userId,clean(profile.open_id,200),userId).first();
  if(linked?.channel_id){
    if(!await vxRequestAccessStillCurrent(ctx,auth)) throw new Error('VX_ACCESS_EXPIRED');
    const restored=await vxChannelRestore(env,userId,limit,linked.channel_id,clean(profile.display_name,120)||'TikTok Creator').run();
    if(!restored.meta?.changes) throw new Error('VX_ACCOUNT_LIMIT');
    return linked.channel_id;
  }
  const channelId=crypto.randomUUID();
  if(!await vxRequestAccessStillCurrent(ctx,auth)) throw new Error('VX_ACCESS_EXPIRED');
  const added=await vxChannelInsert(env,userId,limit,channelId,clean(profile.display_name,120)||'TikTok Creator').run();
  if(!added.meta?.changes) throw new Error('VX_ACCOUNT_LIMIT');
  return channelId;
}
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireVxUser(ctx);if(auth.error)return back('login_required');
  const url=new URL(ctx.request.url),error=String(url.searchParams.get('error')||'').slice(0,100),code=String(url.searchParams.get('code')||'').trim(),state=String(url.searchParams.get('state')||'').trim();if(!state)return back('invalid_callback');
  const stateRow=await consumeTikTokState(ctx.env,state,auth.user.id);if(!stateRow)return back('invalid_state');
  if(error)return back('denied',error,stateRow.channel_id);if(!code)return back('invalid_callback','',stateRow.channel_id);
  let channelId=stateRow.channel_id;
  try{const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return back('not_configured','',channelId);const token=await exchangeTikTokCode(config,code),profile=await fetchTikTokProfile(token.access_token);if(!profile.open_id)return back('profile_failed','',channelId);if(!await vxRequestAccessStillCurrent(ctx,auth))return back('access_expired','',stateRow.channel_id);channelId=await channelForProfile(ctx,auth,channelId,profile,auth.vx.account_limit);if(!channelId)return back('channel_unavailable','',stateRow.channel_id);if(!await ctx.env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(channelId,auth.user.id).first())return back('channel_unavailable','',channelId);if(!await vxRequestAccessStillCurrent(ctx,auth))return back('access_expired','',channelId);const connectionId=await saveTikTokConnection(ctx.env,auth.user.id,channelId,token,profile),connection=await ctx.env.DB.prepare('SELECT * FROM tiktok_connections WHERE id=?').bind(connectionId).first(),blocked=await requireD1DataFetchAvailable(ctx,'tiktok_oauth_post_connect_sync');if(blocked)return back('connected','sync_deferred_d1_quota',channelId);await syncTikTokConnection(ctx.env,connection);return back('connected','',channelId)}catch(error){if(error?.message==='VX_ACCESS_EXPIRED')return back('access_expired','',stateRow.channel_id);if(error?.message==='VX_ACCOUNT_LIMIT')return back('account_limit','บัญชีครบตามแพ็กเกจแล้ว กรุณาลบช่องเดิมหรือเลือกแพ็กเกจใหม่ที่ Vtools',channelId);if(error?.code==='TIKTOK_ACCOUNT_ALREADY_LINKED')return back('account_already_linked',error.channelName,channelId);if(error?.code==='TIKTOK_CHANNEL_ALREADY_LINKED')return back('channel_already_linked',error.accountName,channelId);console.error('TIKTOK_OAUTH_CALLBACK_FAILED',{message:String(error?.message||error).slice(0,180)});return back('failed','',channelId)}
}
