import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare(`SELECT c.*,(SELECT COUNT(*) FROM products p WHERE p.category=c.slug) product_count FROM categories c ORDER BY c.sort_order,c.id`).all();
  return json({items:results});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  let slug=String(body.slug||'').trim().toLowerCase();const name=String(body.name||'').trim();
  if(!name)return json({error:'กรุณากรอกชื่อหมวดหมู่'},400);
  const duplicate=await ctx.env.DB.prepare('SELECT id,name FROM categories WHERE lower(trim(name))=lower(trim(?)) LIMIT 1').bind(name).first();
  if(duplicate)return json({error:`ชื่อหมวดหมู่ “${duplicate.name}” มีอยู่แล้ว กรุณาใช้ชื่ออื่น`},409);
  if(!slug){const last=await ctx.env.DB.prepare("SELECT slug FROM categories WHERE slug GLOB 'category-[0-9]*' ORDER BY CAST(substr(slug,10) AS INTEGER) DESC LIMIT 1").first(),next=(Number(String(last?.slug||'').split('-').pop())||0)+1;slug=`category-${String(next).padStart(3,'0')}`}
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return json({error:'รหัสหมวดหมู่ไม่ถูกต้อง'},400);
  try{const item=await ctx.env.DB.prepare(`INSERT INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES(?,?,?,?,?,?) RETURNING *`).bind(slug,name,String(body.parent_slug||'')||null,String(body.file_type||'PDF'),body.active===false?0:1,Number(body.sort_order)||0).first();return json({item},201)}catch(error){return json({error:String(error).includes('UNIQUE')?'รหัสหมวดนี้ถูกใช้แล้ว':'เพิ่มหมวดไม่สำเร็จ'},400)}
}
