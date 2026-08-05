import {json,requireAdmin} from '../../../_lib.js';
import {putTrash} from '../../../_trash.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const file=await ctx.env.DB.prepare(`SELECT pf.*,p.slug FROM product_files pf JOIN products p ON p.id=pf.product_id WHERE pf.id=?`).bind(ctx.params.id).first();
  if(!file)return json({error:'ไม่พบไฟล์สินค้า'},404);
  const object=await ctx.env.FILES.get(file.object_key);if(!object)return json({error:'ไม่พบไฟล์จริงในพื้นที่จัดเก็บ'},404);
  const extension=file.mime_type==='application/zip'?'zip':'pdf',filename=`${file.slug||'product'}-${file.id}.${extension}`,download=new URL(ctx.request.url).searchParams.get('mode')==='download';
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('content-type',file.mime_type||'application/octet-stream');headers.set('content-disposition',`${download?'attachment':'inline'}; filename="${filename}"`);headers.set('cache-control','private, no-store');
  return new Response(object.body,{headers});
}

export async function onRequestDelete(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const file=await ctx.env.DB.prepare('SELECT * FROM product_files WHERE id=?').bind(ctx.params.id).first();
  if(!file)return json({error:'ไม่พบไฟล์สินค้า'},404);
  await putTrash(ctx.env,{item_type:'product_file',title:file.label||'ไฟล์สินค้า',product_id:file.product_id,object_key:file.object_key,payload:{label:file.label,mime_type:file.mime_type,file_size:file.file_size,version:file.version}});
  await ctx.env.DB.prepare('DELETE FROM downloads WHERE product_file_id=?').bind(file.id).run();
  await ctx.env.DB.prepare('DELETE FROM product_files WHERE id=?').bind(file.id).run();
  return json({ok:true,product_id:file.product_id});
}
