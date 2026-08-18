import {json} from '../../_lib.js';
export async function onRequestGet(ctx){return json({turnstile_site_key:String(ctx.env.TURNSTILE_SITE_KEY||'')})}
