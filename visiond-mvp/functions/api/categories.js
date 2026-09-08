import {json} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
import {loadDigitalStorefrontPaused} from '../_basket_visibility.js';
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);if(await loadDigitalStorefrontPaused(ctx.env))return json({items:[],storefront_closed:true},200,{'cache-control':'private, no-store'});const {results}=await ctx.env.DB.prepare("SELECT slug,name,parent_slug,file_type FROM categories WHERE active=1 ORDER BY sort_order,id").all();return json({items:results})}
