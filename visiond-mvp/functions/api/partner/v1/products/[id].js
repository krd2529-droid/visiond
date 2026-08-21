import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requirePartnerScope} from '../../../../_partner_api.js';

const previews=value=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.filter(url=>/^https?:\/\/|^\//.test(String(url))).slice(0,10):[]}catch{return []}};

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requirePartnerScope(ctx,'products:read');
  if(auth.error)return auth.error;
  const raw=String(ctx.params.id||'');
  if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw)))return json({error:'PRODUCT_ID_INVALID',request_id:auth.requestId},400,{'cache-control':'no-store','x-request-id':auth.requestId});
  const item=await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,p.updated_at FROM products p WHERE p.id=? AND p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product') IN ('product','vision7-key') AND p.category<>'resale-rights' LIMIT 1`).bind(Number(raw)).first();
  if(!item)return json({error:'PRODUCT_NOT_FOUND',request_id:auth.requestId},404,{'cache-control':'no-store','x-request-id':auth.requestId});
  return json({website:{id:auth.website.id,name:auth.website.name},item:{...item,price_currency:'THB',preview_urls:previews(item.preview_urls)},request_id:auth.requestId},200,{'cache-control':'private, max-age=60','x-request-id':auth.requestId});
}
