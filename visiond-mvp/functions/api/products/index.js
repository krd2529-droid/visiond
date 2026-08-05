import {json} from '../../_lib.js';
import {ensureCatalogProducts} from '../../_catalog.js';
import {ensureDatabase} from '../../_schema.js';
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);await ensureCatalogProducts(ctx.env);const {results}=await ctx.env.DB.prepare("SELECT p.id,p.slug,p.title,p.short_description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,c.name category_label FROM products p LEFT JOIN categories c ON c.slug=p.category WHERE p.status='published' ORDER BY p.id DESC").all();return json({items:results})}
