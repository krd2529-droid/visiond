import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {analyticsStats,topViewedProducts} from '../../_analytics.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const [stats,products]=await Promise.all([analyticsStats(ctx.env),topViewedProducts(ctx.env,10)]);
  return json({...stats,products});
}
