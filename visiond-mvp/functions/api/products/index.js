import {json} from '../../_lib.js';
import {ensureCatalogProducts} from '../../_catalog.js';
export async function onRequestGet(ctx){await ensureCatalogProducts(ctx.env);const {results}=await ctx.env.DB.prepare("SELECT id,slug,title,short_description,price,cover_url,category FROM products WHERE status='published' ORDER BY id DESC").all();return json({items:results})}
