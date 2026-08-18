import {json} from '../_lib.js';
import {ensureSettings} from '../_payment.js';
const DEFAULT_FACEBOOK_VIDEO_URL='https://www.facebook.com/share/p/1DWnFhv2Ud/';

export async function onRequestGet(ctx){
  await ensureSettings(ctx.env);
  const row=await ctx.env.DB.prepare("SELECT value FROM settings WHERE key='homepage_facebook_video_url'").first();
  return json({homepage_facebook_video_url:row?String(row.value||''):DEFAULT_FACEBOOK_VIDEO_URL},200,{'cache-control':'public, max-age=60'});
}
