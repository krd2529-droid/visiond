import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {ensureTikTokAnalyzerSchema} from '../../../_tiktok_analyzer.js';
import {revokeTikTokToken,syncTikTokConnection} from '../../../_tiktok_oauth.js';
import {decryptChannelValue} from '../../../_channel_crypto.js';

const headers={'cache-control':'private, no-store'},clean=(v,n=80)=>String(v||'').trim().slice(0,n);
const publicConnection=row=>({id:row.id,channel_id:row.channel_id,display_name:row.display_name,avatar_url:row.avatar_url,profile_url:row.profile_url,bio:row.bio,is_verified:Boolean(row.is_verified),follower_count:Number(row.follower_count)||0,following_count:Number(row.following_count)||0,likes_count:Number(row.likes_count)||0,video_count:Number(row.video_count)||0,scopes:row.scopes,status:row.status,last_synced_at:row.last_synced_at});
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const url=new URL(ctx.request.url),channelId=clean(url.searchParams.get('channel_id'));
  const connections=(await ctx.env.DB.prepare(`SELECT * FROM tiktok_connections WHERE user_id=? AND status='active' AND (?='' OR channel_id=?) ORDER BY updated_at DESC`).bind(auth.user.id,channelId,channelId).all()).results||[];
  let videos=[];if(channelId&&connections[0])videos=(await ctx.env.DB.prepare('SELECT video_id,title,description,create_time,duration,cover_url,embed_link,view_count,like_count,comment_count,share_count,synced_at FROM tiktok_connection_videos WHERE connection_id=? ORDER BY create_time DESC LIMIT 100').bind(connections[0].id).all()).results||[];
  const shopConnections=(await ctx.env.DB.prepare(`SELECT id,channel_id,open_id,scopes,status,created_at,updated_at FROM tiktok_shop_creator_connections WHERE user_id=? AND status='active' AND (?='' OR channel_id=?) ORDER BY updated_at DESC`).bind(auth.user.id,channelId,channelId).all()).results||[];
  return json({configured:Boolean(ctx.env.TIKTOK_CLIENT_KEY&&ctx.env.TIKTOK_CLIENT_SECRET),shop_configured:Boolean(ctx.env.TIKTOK_SHOP_APP_KEY&&ctx.env.TIKTOK_SHOP_APP_SECRET),connections:connections.map(publicConnection),shop_connections:shopConnections,videos},200,headers);
}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({})),id=clean(body.id),action=clean(body.action,30),connection=await ctx.env.DB.prepare("SELECT * FROM tiktok_connections WHERE id=? AND user_id=? AND status='active'").bind(id,auth.user.id).first();if(!connection)return json({error:'ไม่พบบัญชี TikTok ที่เชื่อมอยู่'},404,headers);
  if(action==='sync'){const result=await syncTikTokConnection(ctx.env,connection);return json({ok:true,connection:publicConnection({...connection,...result.profile,last_synced_at:new Date().toISOString()}),video_count:result.videos.length},200,headers)}
  if(action==='disconnect'){const token=await decryptChannelValue(ctx.env,connection.access_token_ciphertext).catch(()=>'');if(token)await revokeTikTokToken(token);await ctx.env.DB.batch([ctx.env.DB.prepare('DELETE FROM tiktok_connection_videos WHERE connection_id=?').bind(id),ctx.env.DB.prepare('DELETE FROM tiktok_connections WHERE id=? AND user_id=?').bind(id,auth.user.id)]);return json({ok:true},200,headers)}
  if(action==='bind'){const channelId=clean(body.channel_id);if(channelId&&!await ctx.env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=?').bind(channelId).first())return json({error:'ไม่พบช่อง'},404,headers);await ctx.env.DB.prepare('UPDATE tiktok_connections SET channel_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(channelId,id,auth.user.id).run();return json({ok:true},200,headers)}
  return json({error:'คำสั่งไม่ถูกต้อง'},400,headers);
}
