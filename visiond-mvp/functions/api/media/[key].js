const notFound=()=>new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const productImage=/^(?:cover-|preview-[23]-|product-image-|course-cover-|user-course-cover-|seller-course-cover-)/;
const pendingPreview=/^vision4-pending-preview-/;
const companyPaymentQr=/^payment-qr-/;
async function isReferenced(env,key){
  const url='/api/media/'+key;
  if(productImage.test(key)){
    const lookup=publishedOnly=>env.DB.prepare(`
      SELECT 1 FROM products WHERE deleted_at IS NULL ${publishedOnly?"AND status='published' ":''}AND cover_url=?
      UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL ${publishedOnly?"AND status='published' ":''}AND json_valid(preview_urls) AND json_extract(preview_urls,'$[0]')=?
      UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL ${publishedOnly?"AND status='published' ":''}AND json_valid(preview_urls) AND json_extract(preview_urls,'$[1]')=?
      UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL ${publishedOnly?"AND status='published' ":''}AND json_valid(preview_urls) AND json_extract(preview_urls,'$[2]')=?
      LIMIT 1`).bind(url,url,url,url).first();
    if(await lookup(true))return 'public';
    return await lookup(false)?'private':'';
  }
  if(pendingPreview.test(key))return await env.DB.prepare(`
    SELECT 1 FROM vision4_pending_files WHERE status='waiting_bundle' AND json_valid(preview_urls) AND json_extract(preview_urls,'$[0]')=?
    UNION ALL SELECT 1 FROM vision4_pending_files WHERE status='waiting_bundle' AND json_valid(preview_urls) AND json_extract(preview_urls,'$[1]')=?
    UNION ALL SELECT 1 FROM vision4_pending_files WHERE status='waiting_bundle' AND json_valid(preview_urls) AND json_extract(preview_urls,'$[2]')=?
    LIMIT 1`).bind(url,url,url).first()?'private':'';
  if(companyPaymentQr.test(key))return await env.DB.prepare("SELECT 1 FROM settings WHERE key='qr_url' AND value=? LIMIT 1").bind(url).first()?'public':'';
  return '';
}
export async function onRequestGet(ctx){
  const key=String(ctx.params.key||'');
  // Only DB-referenced public images are served here. Seller QR, slips, lessons and
  // paid product files use their dedicated authenticated routes and never match.
  const visibility=await isReferenced(ctx.env,key);if(!visibility)return notFound();
  const obj=await ctx.env.FILES.get(key);if(!obj)return notFound();
  const contentType=String(obj.httpMetadata?.contentType||'').toLowerCase();if(!contentType.startsWith('image/'))return notFound();
  const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('cache-control',visibility==='public'?'public, max-age=86400':'private, no-store');headers.set('etag',obj.httpEtag);headers.set('x-content-type-options','nosniff');headers.delete('content-disposition');return new Response(obj.body,{headers});
}
