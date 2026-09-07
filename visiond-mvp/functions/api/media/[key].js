import {ensureStorefrontCatalogSchema} from '../../_schema.js';

const notFound=()=>new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const productImage=/^(?:cover-|preview-[23]-|product-image-|course-cover-|user-course-cover-|seller-course-cover-)/;
const pendingPreview=/^vision4-pending-preview-/;
const companyPaymentQr=/^payment-qr-/;
async function isReferenced(env,key){
  const url='/api/media/'+key;
  if(productImage.test(key)){await ensureStorefrontCatalogSchema(env);return Boolean(await env.DB.prepare(`SELECT 1 FROM products WHERE deleted_at IS NULL AND cover_url=? LIMIT 1`).bind(url).first()||await env.DB.prepare(`SELECT 1 FROM products WHERE deleted_at IS NULL AND json_valid(preview_urls) AND (json_extract(preview_urls,'$[0]')=? OR json_extract(preview_urls,'$[1]')=? OR json_extract(preview_urls,'$[2]')=?) LIMIT 1`).bind(url,url,url).first())}
  if(pendingPreview.test(key))return Boolean(await env.DB.prepare(`SELECT 1 FROM vision4_pending_files f WHERE f.status='waiting_bundle' AND EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(f.preview_urls) THEN f.preview_urls ELSE '[]' END) j WHERE j.value=?) LIMIT 1`).bind(url).first());
  if(companyPaymentQr.test(key))return Boolean(await env.DB.prepare("SELECT 1 FROM settings WHERE key='qr_url' AND value=? LIMIT 1").bind(url).first());
  return false;
}
export async function onRequestGet(ctx){
  const key=String(ctx.params.key||'');
  // Only DB-referenced public images are served here. Seller QR, slips, lessons and
  // paid product files use their dedicated authenticated routes and never match.
  if(!await isReferenced(ctx.env,key))return notFound();
  const obj=await ctx.env.FILES.get(key);if(!obj)return notFound();
  const contentType=String(obj.httpMetadata?.contentType||'').toLowerCase();if(!contentType.startsWith('image/'))return notFound();
  const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('cache-control','public, max-age=86400');headers.set('etag',obj.httpEtag);headers.set('x-content-type-options','nosniff');headers.delete('content-disposition');return new Response(obj.body,{headers});
}
