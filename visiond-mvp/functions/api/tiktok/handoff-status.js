import {requireUser,json} from '../../_lib.js';
import {canonicalTikTokProfileSlot} from '../../_tiktok_oauth.js';
export async function onRequestGet(ctx){
 const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
 const id=new URL(ctx.request.url).searchParams.get('id');
 if(!canonicalTikTokProfileSlot(id))return json({error:'invalid request'},400,{'cache-control':'private, no-store'});
 const row=await ctx.env.DB.prepare(`SELECT f.status,CASE WHEN f.status='complete' THEN b.channel_id ELSE '' END channel_id
 FROM tiktok_oauth_handoffs f LEFT JOIN tiktok_browser_profile_bindings b ON b.slot_id=f.slot_id AND b.user_id=f.user_id
 WHERE f.id=? AND f.user_id=? AND f.expires_at>CURRENT_TIMESTAMP`).bind(id,auth.user.id).first();
 return json(row||{status:'expired',channel_id:''},200,{'cache-control':'private, no-store'});
}
