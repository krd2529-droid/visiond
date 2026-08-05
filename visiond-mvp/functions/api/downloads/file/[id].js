import {json,requireUser} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {rateLimit,securityLog} from '../../../_security.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const limited=await rateLimit(ctx.env,ctx.request,`download-${auth.user.id}`,80,60,60);if(limited.error)return limited.error;
  const file=await ctx.env.DB.prepare(`SELECT pf.* FROM product_files pf WHERE pf.id=? AND (EXISTS(SELECT 1 FROM entitlements e WHERE e.product_id=pf.product_id AND e.user_id=? AND e.active=1) OR EXISTS(SELECT 1 FROM product_bundle_items b JOIN entitlements e ON e.product_id=b.bundle_product_id WHERE b.source_product_id=pf.product_id AND e.user_id=? AND e.active=1))`).bind(ctx.params.id,auth.user.id,auth.user.id).first();
  if(!file){await securityLog(ctx.env,ctx.request,'download_denied','warning',String(ctx.params.id),auth.user.id);return json({error:'ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้'},403)}
  const object=await ctx.env.FILES.get(file.object_key);if(!object)return json({error:'ไม่พบไฟล์'},404);
  const preview=new URL(ctx.request.url).searchParams.get('view')==='1'&&file.mime_type==='application/pdf';
  if(!preview)await ctx.env.DB.prepare('INSERT INTO downloads(user_id,product_file_id,ip) VALUES(?,?,?)').bind(auth.user.id,file.id,ctx.request.headers.get('CF-Connecting-IP')||'').run();
  const safeName=`visiond-${file.id}.${file.mime_type==='application/pdf'?'pdf':file.mime_type==='application/zip'?'zip':'file'}`;
  return new Response(object.body,{headers:{'content-type':file.mime_type,'content-disposition':`${preview?'inline':'attachment'}; filename="${safeName}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
