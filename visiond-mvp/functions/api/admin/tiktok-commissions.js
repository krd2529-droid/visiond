import {json} from '../../_lib.js';
import {requireVxUser} from '../../_vx_access.js';
import{ensureDatabase}from'../../_schema.js';
import{ensureTikTokAnalyzerSchema}from'../../_tiktok_analyzer.js';
import{aggregateTikTokCommission,commissionRange}from'../../_tiktok_commission.js';
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);const auth=await requireVxUser(ctx);if(auth.error)return auth.error;const url=new URL(ctx.request.url),channelId=String(url.searchParams.get('channel_id')||'').trim().slice(0,80);if(channelId&&!await ctx.env.DB.prepare('SELECT id FROM tiktok_channels WHERE id=? AND created_by=? AND archived_at IS NULL').bind(channelId,auth.user.id).first())return json({error:'ไม่พบช่อง'},404);try{return json({ok:true,scope:channelId?'channel':'all',...await aggregateTikTokCommission(ctx.env,auth.user.id,{channelId,...commissionRange(url)})},200,{'cache-control':'private, no-store'})}catch(error){return json({error:String(error.message).includes('TOO_LARGE')?'เลือกช่วงวันได้ไม่เกิน 366 วัน':'ช่วงวันที่ไม่ถูกต้อง'},400)}}
