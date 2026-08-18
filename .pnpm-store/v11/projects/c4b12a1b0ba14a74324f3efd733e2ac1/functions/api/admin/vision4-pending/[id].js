import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";

const imageTypes=['image/jpeg','image/png','image/webp'];
const extension=file=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const item=await ctx.env.DB.prepare("SELECT id,preview_urls FROM vision4_pending_files WHERE id=? AND status='waiting_bundle'").bind(ctx.params.id).first();if(!item)return json({error:'ไม่พบไฟล์รอรวมชุด'},404);
  const form=await ctx.request.formData(),urls=[];
  for(const name of ['preview_1','preview_2','preview_3']){const file=form.get(name);if(!file?.size)continue;if(file.size>5*1024*1024||!imageTypes.includes(file.type))return json({error:'รูปตัวอย่างต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB'},400);const key=`vision4-pending-preview-${item.id}-${crypto.randomUUID()}.${extension(file)}`;await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});urls.push('/api/media/'+key)}
  await ctx.env.DB.prepare('UPDATE vision4_pending_files SET preview_urls=? WHERE id=?').bind(JSON.stringify(urls),item.id).run();return json({ok:true,preview_urls:urls});
}
