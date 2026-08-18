import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare(`SELECT ul.*,o.total sale_total,o.sale_price_recorded,o.slip_key FROM unlock_logs ul LEFT JOIN orders o ON o.id=ul.order_id ORDER BY ul.id DESC LIMIT 500`).all();
  for(const item of results)item.slip_url=item.slip_key?`/api/admin/slip?key=${encodeURIComponent(item.slip_key)}`:null;
  return json({items:results});
}
