import {requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../_tiktok_analyzer.js';
import {consumeTikTokState,exchangeTikTokCode,fetchTikTokProfile,saveTikTokConnection,syncTikTokConnection,tikTokOAuthConfig} from '../../_tiktok_oauth.js';

const back=(status,detail='',channelId='')=>Response.redirect(`https://visiondonline.com/tiktok-analyzer.html?tiktok=${encodeURIComponent(status)}${detail?`&detail=${encodeURIComponent(detail)}`:''}${channelId?`&channel_id=${encodeURIComponent(channelId)}`:''}`,302);
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return back('login_required');
  const url=new URL(ctx.request.url),error=String(url.searchParams.get('error')||'').slice(0,100),code=String(url.searchParams.get('code')||'').trim(),state=String(url.searchParams.get('state')||'').trim();if(!state)return back('invalid_callback');
  const stateRow=await consumeTikTokState(ctx.env,state,auth.user.id);if(!stateRow)return back('invalid_state');
  if(error)return back('denied',error,stateRow.channel_id);if(!code)return back('invalid_callback','',stateRow.channel_id);
  try{const config=tikTokOAuthConfig(ctx.env);if(!config.configured)return back('not_configured','',stateRow.channel_id);const token=await exchangeTikTokCode(config,code),profile=await fetchTikTokProfile(token.access_token);if(!profile.open_id)return back('profile_failed','',stateRow.channel_id);const connectionId=await saveTikTokConnection(ctx.env,auth.user.id,stateRow.channel_id,token,profile),connection=await ctx.env.DB.prepare('SELECT * FROM tiktok_connections WHERE id=?').bind(connectionId).first();await syncTikTokConnection(ctx.env,connection);return back('connected','',stateRow.channel_id)}catch(error){console.error('TIKTOK_OAUTH_CALLBACK_FAILED',{message:String(error?.message||error).slice(0,180)});return back('failed','',stateRow.channel_id)}
}
