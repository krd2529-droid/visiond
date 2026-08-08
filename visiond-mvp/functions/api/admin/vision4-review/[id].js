import { json, requireAdmin } from "../../../_lib.js";

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const row=await ctx.env.DB.prepare("UPDATE products SET source='admin',updated_at=CURRENT_TIMESTAMP WHERE id=? AND source='vision4' AND status='draft' AND deleted_at IS NULL RETURNING id").bind(ctx.params.id).first();
  if(!row)return json({error:'ไม่พบร่าง Vision 4'},404);
  return json({ok:true,id:row.id});
}
