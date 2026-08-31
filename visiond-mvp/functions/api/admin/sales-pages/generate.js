import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {autoSeoDraft,ensureSalesPageSchema,salesPageProductIds} from '../../../_sales_pages.js';
const headers={'cache-control':'private, no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureSalesPageSchema(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),productIds=salesPageProductIds(body.product_ids),keyword=String(body.keyword||'').trim().slice(0,160);
  if(!productIds.length)return json({error:'เลือกสินค้าอย่างน้อย 1 รายการก่อนสร้าง Auto SEO'},400,headers);
  const marks=productIds.map(()=>'?').join(','),rows=(await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.category,c.name category_name FROM products p LEFT JOIN categories c ON c.slug=p.category WHERE p.id IN (${marks}) AND p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product')='product' ORDER BY p.id DESC`).bind(...productIds).all()).results||[];
  if(rows.length!==productIds.length)return json({error:'Auto SEO ใช้ได้เฉพาะสินค้าที่เผยแพร่และพร้อมขาย'},409,headers);
  const draft=autoSeoDraft(rows,keyword),template=await ctx.env.DB.prepare("SELECT id FROM sales_page_templates WHERE page_type='seo_automation' AND status='active' ORDER BY id LIMIT 1").first();
  if(!template)return json({error:'ไม่พบ Template Auto SEO'},500,headers);
  const duplicate=await ctx.env.DB.prepare("SELECT id FROM sales_pages WHERE page_type='seo_automation' AND (slug=? OR lower(json_extract(content_json,'$.keyword'))=lower(?)) LIMIT 1").bind(draft.slug,draft.content.keyword).first();
  if(duplicate)return json({error:'Keyword หรือ Slug นี้มีหน้า Auto SEO อยู่แล้ว',existing_id:duplicate.id},409,headers);
  const id=`sp_${crypto.randomUUID().replaceAll('-','')}`,contentJson=JSON.stringify(draft.content);
  await ctx.env.DB.batch([ctx.env.DB.prepare("INSERT INTO sales_pages(id,page_type,template_id,slug,title,status,robots_index,content_json,created_by,updated_by) VALUES(?,?,?, ?,?,'draft',0,?,?,?)").bind(id,'seo_automation',template.id,draft.slug,draft.title,contentJson,auth.user.id,auth.user.id),ctx.env.DB.prepare("INSERT INTO sales_page_revisions(page_id,revision_no,title,slug,template_id,content_json,product_ids,status_before,change_note,changed_by) VALUES(?,1,?,?,?,?,?,'draft','สร้างร่าง Auto SEO จากข้อมูลสินค้า',?)").bind(id,draft.title,draft.slug,template.id,contentJson,JSON.stringify(productIds),auth.user.id),...productIds.map((productId,index)=>ctx.env.DB.prepare('INSERT INTO sales_page_products(page_id,product_id,sort_order) VALUES(?,?,?)').bind(id,productId,index))]);
  return json({ok:true,id,status:'draft',draft},201,headers);
}
