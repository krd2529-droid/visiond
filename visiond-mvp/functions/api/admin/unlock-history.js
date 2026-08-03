import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare('SELECT * FROM unlock_logs ORDER BY id DESC LIMIT 200').all();
  return json({items:results});
}
