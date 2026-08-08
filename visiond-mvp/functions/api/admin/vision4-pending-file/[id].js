import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const item=await ctx.env.DB.prepare("SELECT file_name,object_key,mime_type FROM vision4_pending_files WHERE id=? AND status='waiting_bundle'").bind(ctx.params.id).first();if(!item)return json({error:'ไม่พบไฟล์รอรวมชุด'},404);
  const object=await ctx.env.FILES.get(item.object_key);if(!object)return json({error:'ไม่พบไฟล์ในพื้นที่จัดเก็บ'},404);
  const inline=new URL(ctx.request.url).searchParams.get('mode')==='inline';return new Response(object.body,{headers:{'content-type':item.mime_type||'application/octet-stream','content-length':String(object.size||''),'content-disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(item.file_name)}`,'cache-control':'private, no-store'}});
}
