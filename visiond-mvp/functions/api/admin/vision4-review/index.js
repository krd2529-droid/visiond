import { json, requireAdmin } from "../../../_lib.js";
import { ensureAdminCatalogIndexes, ensureDatabase } from "../../../_schema.js";

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;await ensureAdminCatalogIndexes(ctx.env);
  const params=new URL(ctx.request.url).searchParams,limit=Math.min(24,Math.max(1,Number(params.get('limit'))||24)),draftCursor=Math.max(0,Number(params.get('draft_cursor'))||0),pendingCursor=Math.max(0,Number(params.get('pending_cursor'))||0),draftWhere=["p.source='vision4'","p.status='draft'","p.deleted_at IS NULL"],draftBindings=[],pendingWhere=["status='waiting_bundle'"],pendingBindings=[];
  if(draftCursor){draftWhere.push('p.id<?');draftBindings.push(draftCursor)}if(pendingCursor){pendingWhere.push('id<?');pendingBindings.push(pendingCursor)}
  const [drafts,pending]=await Promise.all([ctx.env.DB.prepare(`SELECT p.id,p.title,p.category,p.file_type,p.pages,p.price,p.cover_url,p.preview_urls,p.short_description,p.description,p.created_at,(SELECT pf.id FROM product_files pf WHERE pf.product_id=p.id ORDER BY pf.id DESC LIMIT 1) file_id FROM products p WHERE ${draftWhere.join(' AND ')} ORDER BY p.id DESC LIMIT ?`).bind(...draftBindings,limit+1).all(),ctx.env.DB.prepare(`SELECT id,file_name,mime_type,file_size,pages,preview_urls,status,created_at FROM vision4_pending_files WHERE ${pendingWhere.join(' AND ')} ORDER BY id DESC LIMIT ?`).bind(...pendingBindings,limit+1).all()]);
  const draftItems=(drafts.results||[]).slice(0,limit),pendingItems=(pending.results||[]).slice(0,limit);return json({drafts:draftItems,pending:pendingItems,pagination:{limit,drafts:{has_more:(drafts.results||[]).length>limit,next_cursor:(drafts.results||[]).length>limit?draftItems.at(-1)?.id:null},pending:{has_more:(pending.results||[]).length>limit,next_cursor:(pending.results||[]).length>limit?pendingItems.at(-1)?.id:null}}},200,{'cache-control':'private, no-store'});
}
