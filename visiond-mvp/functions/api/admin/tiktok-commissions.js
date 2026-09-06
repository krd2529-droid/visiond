import {json} from '../../_lib.js';
import {requireVxUser} from '../../_vx_access.js';
import{ensureDatabase}from'../../_schema.js';
import{ensureTikTokAnalyzerSchema}from'../../_tiktok_analyzer.js';
import{aggregateTikTokCommission,commissionRange}from'../../_tiktok_commission.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireVxUser(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),channelId=String(url.searchParams.get('channel_id')||'').trim().slice(0,80);
  if(channelId&&!await ctx.env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL').bind(channelId,auth.user.id).first())return json({error:'ไม่พบช่อง'},404);
  try{
    const collectorChannels=(await ctx.env.DB.prepare(`SELECT c.id connection_id,c.channel_id,COALESCE(NULLIF(ch.name,''),NULLIF(c.creator_username,''),c.channel_id) channel,c.collector_status status,CASE WHEN c.collector_session_secret_name<>'' THEN 1 ELSE 0 END session_configured,c.collector_last_attempt_at last_attempt_at,c.collector_last_success_at last_success_at,c.collector_last_error last_error FROM tiktok_shop_creator_connections c LEFT JOIN tiktok_channels ch ON ch.id=c.channel_id WHERE c.user_id=? AND c.status='active' AND (?='' OR c.channel_id=?) ORDER BY c.updated_at DESC`).bind(auth.user.id,channelId,channelId).all()).results||[];
    return json({ok:true,scope:channelId?'channel':'all',collector_channels:collectorChannels,...await aggregateTikTokCommission(ctx.env,auth.user.id,{channelId,...commissionRange(url)})},200,{'cache-control':'private, no-store'});
  }catch(error){return json({error:String(error.message).includes('TOO_LARGE')?'เลือกช่วงวันได้ไม่เกิน 366 วัน':'ช่วงวันที่ไม่ถูกต้อง'},400)}
}
