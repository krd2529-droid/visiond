import {requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {consumeTikTokState,exchangeTikTokCode,fetchTikTokProfile,saveTikTokConnection,syncTikTokConnection,tikTokOAuthConfig} from '../../_tiktok_oauth.js';

const back=(status,detail='',channelId='')=>Response.redirect(`https://visiondonline.com/tiktok-analyzer?tiktok=${encodeURIComponent(status)}${detail?`&detail=${encodeURIComponent(detail)}`:''}${channelId?`&channel_id=${encodeURIComponent(channelId)}`:''}`,302);
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
async function channelForProfile(env,userId,requestedChannelId,profile){
  if(requestedChannelId){
    const channel=await env.DB.prepare("SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL").bind(requestedChannelId,userId).first();
    return channel?.id||'';
  }
  const linked=await env.DB.prepare("SELECT c.channel_id FROM tiktok_connections c JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.open_id=? AND ch.created_by=? LIMIT 1").bind(userId,clean(profile.open_id,200),userId).first();
  if(linked?.channel_id){
    await env.DB.prepare("UPDATE tiktok_channels SET name=?,archived_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND created_by=?").bind(clean(profile.display_name,120)||'TikTok Creator',linked.channel_id,userId).run();
    return linked.channel_id;
  }
  const channelId=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO tiktok_channels(id,name,channel_url,handle,created_by) VALUES(?,?,?,?,?)").bind(channelId,clean(profile.display_name,120)||'TikTok Creator','', '',userId).run();
  return channelId;
}
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return back('login_required');
  const url=new URL(ctx.request.url),error=String(url.searchParams.get('error')||'').slice(0,100),code=String(url.searchParams.get('code')||'').trim(),state=String(url.searchParams.get('state')||'').trim();if(!state)return back('invalid_callback');
  const stateRow=await consumeTikTokState(ctx.env,state,auth.user.id);if(!stateRow)return back('invalid_state');
  if(error)return back('denied',error,stateRow.channel_id);if(!code)return back('invalid_callback','',stateRow.channel_id);
  let channelId=stateRow.channel_id;
  try{const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return back('not_configured','',channelId);const token=await exchangeTikTokCode(config,code),profile=await fetchTikTokProfile(token.access_token);if(!profile.open_id)return back('profile_failed','',channelId);channelId=await channelForProfile(ctx.env,auth.user.id,channelId,profile);if(!channelId)return back('channel_unavailable','',stateRow.channel_id);const connectionId=await saveTikTokConnection(ctx.env,auth.user.id,channelId,token,profile),connection=await ctx.env.DB.prepare('SELECT * FROM tiktok_connections WHERE id=?').bind(connectionId).first();await syncTikTokConnection(ctx.env,connection);return back('connected','',channelId)}catch(error){if(error?.code==='TIKTOK_ACCOUNT_ALREADY_LINKED')return back('account_already_linked',error.channelName,channelId);if(error?.code==='TIKTOK_CHANNEL_ALREADY_LINKED')return back('channel_already_linked',error.accountName,channelId);console.error('TIKTOK_OAUTH_CALLBACK_FAILED',{message:String(error?.message||error).slice(0,180)});return back('failed','',channelId)}
}
