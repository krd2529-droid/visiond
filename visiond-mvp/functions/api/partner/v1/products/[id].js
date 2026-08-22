import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requirePartnerScope} from '../../../../_partner_api.js';
import {partnerDelivery} from '../../../../_partner_delivery.js';

const previews=value=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.filter(url=>/^https?:\/\/|^\//.test(String(url))).slice(0,10):[]}catch{return []}};

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requirePartnerScope(ctx,'products:read');
  if(auth.error)return auth.error;
  const raw=String(ctx.params.id||'');
  if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw)))return json({error:'PRODUCT_ID_INVALID',request_id:auth.requestId},400,{'cache-control':'no-store','x-request-id':auth.requestId});
  const item=await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,p.updated_at,(SELECT COUNT(*) FROM product_files own WHERE own.product_id=p.id)+(SELECT COUNT(*) FROM product_bundle_items b JOIN product_files bundled ON bundled.product_id=b.source_product_id WHERE b.bundle_product_id=p.id) delivery_file_count,(SELECT COALESCE(SUM(file_size),0) FROM product_files own WHERE own.product_id=p.id)+(SELECT COALESCE(SUM(bundled.file_size),0) FROM product_bundle_items b JOIN product_files bundled ON bundled.product_id=b.source_product_id WHERE b.bundle_product_id=p.id) delivery_total_size,(SELECT COUNT(*) FROM product_bundle_items b WHERE b.bundle_product_id=p.id) delivery_bundle_item_count FROM products p WHERE p.id=? AND p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product') IN ('product','vision7-key') AND p.category<>'resale-rights' LIMIT 1`).bind(Number(raw)).first();
  if(!item)return json({error:'PRODUCT_NOT_FOUND',request_id:auth.requestId},404,{'cache-control':'no-store','x-request-id':auth.requestId});
  const packageItems=Number(item.delivery_bundle_item_count)?(await ctx.env.DB.prepare(`SELECT source.id,source.title,source.file_type,source.pages,COUNT(pf.id) file_count FROM product_bundle_items b JOIN products source ON source.id=b.source_product_id LEFT JOIN product_files pf ON pf.product_id=source.id WHERE b.bundle_product_id=? GROUP BY source.id,source.title,source.file_type,source.pages,b.sort_order ORDER BY b.sort_order LIMIT 30`).bind(item.id).all()).results||[]:[],delivery=partnerDelivery(item,packageItems);delete item.delivery_file_count;delete item.delivery_total_size;delete item.delivery_bundle_item_count;
  return json({website:{id:auth.website.id,name:auth.website.name},item:{...item,price_currency:'THB',preview_urls:previews(item.preview_urls),delivery},request_id:auth.requestId},200,{'cache-control':'private, max-age=60','x-request-id':auth.requestId});
}
