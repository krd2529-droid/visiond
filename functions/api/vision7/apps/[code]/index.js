import { json } from "../../../../_lib.js";
import { ensureDatabase } from "../../../../_schema.js";
import { ensureVision7Schema } from "../../../../_vision7_schema.js";

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env); await ensureVision7Schema(ctx.env);
  const code=String(ctx.params.code||"").toLowerCase();
  if(!/^[a-z0-9_-]{1,50}$/.test(code))return json({error:"ไม่พบแอป"},404);
  const item=await ctx.env.DB.prepare(`SELECT p.id,p.code,p.app_name name,p.app_description description,p.cover_url,p.platform_type,p.current_version,
    (SELECT json_group_array(json_object('id',q.id,'code',q.plan_code,'name',q.name,'duration_days',q.duration_days,'price',q.offer_price,'product_id',q.product_id,'product_slug',x.slug)) FROM vision7_plans q JOIN products x ON x.id=q.product_id WHERE q.program_id=p.id AND q.active=1 AND q.plan_code IN ('monthly','yearly','lifetime') AND q.offer_price>0 AND x.status='published' AND x.product_kind='vision7-key') offers
    FROM vision7_programs p WHERE p.code=? AND p.active=1 AND EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.status='published')`).bind(code).first();
  if(item)item.download_ready=true;
  return item?json({item},200,{"cache-control":"public, max-age=60"}):json({error:"ไม่พบแอป"},404);
}
