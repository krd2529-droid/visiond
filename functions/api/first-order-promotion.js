import {json,requireUser} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
import {firstOrderPromoStatus} from '../_first_order_promo.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  return json({item:await firstOrderPromoStatus(ctx.env,auth.user.id)},200,{'cache-control':'no-store'});
}
