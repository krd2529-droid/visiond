import {json} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);const {results}=await ctx.env.DB.prepare("SELECT slug,name,parent_slug,file_type FROM categories WHERE active=1 ORDER BY sort_order,id").all();return json({items:results})}
