import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requirePartnerScope} from '../../../../_partner_api.js';
import {partnerDelivery} from '../../../../_partner_delivery.js';
import {ensurePartnerCatalogSchema,partnerAssets,partnerPreviews} from '../../../../_partner_catalog.js';

const integer=(value,fallback,min,max)=>{if(value===null||value==='')return fallback;if(!/^\d+$/.test(value))return fallback;const parsed=Number(value);return Number.isSafeInteger(parsed)?Math.min(max,Math.max(min,parsed)):fallback};

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensurePartnerCatalogSchema(ctx.env);
  const auth=await requirePartnerScope(ctx,'products:read');if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),limit=integer(url.searchParams.get('limit'),100,1,250),cursor=integer(url.searchParams.get('cursor'),0,0,Number.MAX_SAFE_INTEGER);
  const rows=(await ctx.env.DB.prepare(`SELECT c.id change_id,c.product_id,c.action,c.changed_at,p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,p.status,p.deleted_at,p.updated_at,(SELECT COUNT(*) FROM product_files own WHERE own.product_id=p.id)+(SELECT COUNT(*) FROM product_bundle_items b JOIN product_files bundled ON bundled.product_id=b.source_product_id WHERE b.bundle_product_id=p.id) delivery_file_count,(SELECT COALESCE(SUM(file_size),0) FROM product_files own WHERE own.product_id=p.id)+(SELECT COALESCE(SUM(bundled.file_size),0) FROM product_bundle_items b JOIN product_files bundled ON bundled.product_id=b.source_product_id WHERE b.bundle_product_id=p.id) delivery_total_size,(SELECT COUNT(*) FROM product_bundle_items b WHERE b.bundle_product_id=p.id) delivery_bundle_item_count FROM partner_product_changes c LEFT JOIN products p ON p.id=c.product_id WHERE c.id>? ORDER BY c.id LIMIT ?`).bind(cursor,limit+1).all()).results||[];
  const hasMore=rows.length>limit,selected=rows.slice(0,limit),changes=selected.map(row=>{
    const eligible=row.id&&row.status==='published'&&!row.deleted_at&&['product','vision7-key'].includes(row.product_kind||'product')&&row.category!=='resale-rights';
    if(!eligible)return{cursor:row.change_id,product_id:row.product_id,action:'delete',changed_at:row.changed_at};
    const delivery=partnerDelivery(row),item={id:row.id,slug:row.slug,title:row.title,short_description:row.short_description,description:row.description,price:row.price,price_currency:'THB',cover_url:row.cover_url,preview_urls:partnerPreviews(row.preview_urls),assets:partnerAssets(row),category:row.category,file_type:row.file_type,pages:row.pages,product_kind:row.product_kind,updated_at:row.updated_at,delivery};
    return{cursor:row.change_id,product_id:row.product_id,action:'upsert',changed_at:row.changed_at,item};
  }),nextCursor=selected.at(-1)?.change_id??cursor;
  return json({website:{id:auth.website.id,name:auth.website.name},changes,pagination:{limit,has_more:hasMore,next_cursor:nextCursor},sync:{mode:'incremental',recommended_poll_seconds:300,delete_action:'remove local catalog row and mirrored public assets; never delete paid entitlements'},request_id:auth.requestId},200,{'cache-control':'private, no-store','x-request-id':auth.requestId});
}
