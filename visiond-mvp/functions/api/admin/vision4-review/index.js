import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const drafts=await ctx.env.DB.prepare("SELECT p.id,p.title,p.category,p.file_type,p.pages,p.price,p.cover_url,p.preview_urls,p.short_description,p.description,p.created_at,(SELECT pf.id FROM product_files pf WHERE pf.product_id=p.id ORDER BY pf.id DESC LIMIT 1) file_id FROM products p WHERE p.source='vision4' AND p.status='draft' AND p.deleted_at IS NULL ORDER BY p.id DESC").all();
  const pending=await ctx.env.DB.prepare("SELECT id,file_name,mime_type,file_size,pages,preview_urls,status,created_at FROM vision4_pending_files WHERE status='waiting_bundle' ORDER BY id DESC").all();
  return json({drafts:drafts.results||[],pending:pending.results||[]});
}
