import {mediaUrl} from '../../_toys_center.js';

const csv=value=>`"${String(value??'').replaceAll('"','""')}"`;
const tagColumns=Array.from({length:20},(_,index)=>`product_tags[${index}]`);
const tags=value=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.slice(0,tagColumns.length):[]}catch{return[]}};

export async function getStockFeed(ctx,store){
  const origin=new URL(ctx.request.url).origin;
  // A full feed is a dedicated export, separate from bounded storefront listings.
  const rows=(await ctx.env.DB.prepare("SELECT * FROM toys_center_products WHERE store_id=? AND status='published' ORDER BY id").bind(store).all()).results||[];
  const head=['id','title','description','availability','condition','price','link','image_link','brand','quantity_to_sell_on_facebook','google_product_category','fb_product_category','gtin','item_group_id','gender','color','size','age_group','material','pattern',...tagColumns];
  const path=store==='zippo'?'/zippoudon':'/toyscenter';
  const lines=[head,...rows.map(row=>{const productTags=tags(row.product_tags);return[row.meta_id,row.title,row.description,row.availability,row.condition,`${(Number(row.price_cents)/100).toFixed(2)} ${row.currency}`,`${origin}${path}?product=${encodeURIComponent(row.slug)}`,mediaUrl(origin,row.id,2,store),row.brand,row.quantity,row.google_product_category,row.fb_product_category,row.gtin,row.item_group_id,row.gender,row.color,row.size,row.age_group,row.material,row.pattern,...tagColumns.map((_,index)=>productTags[index]||'')]})].map(row=>row.map(csv).join(','));
  return new Response('\ufeff'+lines.join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`inline; filename="${store}-meta-feed.csv"`,'cache-control':'public, max-age=300'}});
}

export async function onRequestGet(ctx){return getStockFeed(ctx,'toys-center')}
