import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const drafts=await ctx.env.DB.prepare("SELECT id,title,category,file_type,pages,price,cover_url,preview_urls,short_description,created_at FROM products WHERE source='vision4' AND status='draft' AND deleted_at IS NULL ORDER BY id DESC").all();
  const pending=await ctx.env.DB.prepare("SELECT id,file_name,mime_type,file_size,pages,status,created_at FROM vision4_pending_files WHERE status='waiting_bundle' ORDER BY id DESC").all();
  return json({drafts:drafts.results||[],pending:pending.results||[]});
}
