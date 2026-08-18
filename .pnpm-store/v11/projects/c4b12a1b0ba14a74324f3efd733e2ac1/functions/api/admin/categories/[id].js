import {json,requireAdmin,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestPut(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const old=await ctx.env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(ctx.params.id).first();if(!old)return json({error:'ไม่พบหมวดหมู่'},404);
  const body=await ctx.request.json().catch(()=>({}));const slug=String(body.slug||'').trim().toLowerCase(),name=String(body.name||'').trim();
  if(!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return json({error:'กรุณากรอกชื่อและรหัสหมวดภาษาอังกฤษให้ถูกต้อง'},400);
  const duplicate=await ctx.env.DB.prepare('SELECT id,name FROM categories WHERE lower(trim(name))=lower(trim(?)) AND id<>? LIMIT 1').bind(name,old.id).first();
  if(duplicate)return json({error:`ชื่อหมวดหมู่ “${duplicate.name}” มีอยู่แล้ว กรุณาใช้ชื่ออื่น`},409);
  try{await ctx.env.DB.prepare(`UPDATE categories SET slug=?,name=?,parent_slug=?,file_type=?,active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(slug,name,String(body.parent_slug||'')||null,String(body.file_type||'PDF'),body.active===false?0:1,Number(body.sort_order)||0,old.id).run();if(old.slug!==slug)await ctx.env.DB.prepare('UPDATE products SET category=? WHERE category=?').bind(slug,old.slug).run();return json({item:await ctx.env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(old.id).first()})}catch(error){return json({error:String(error).includes('UNIQUE')?'รหัสหมวดนี้ถูกใช้แล้ว':'บันทึกหมวดไม่สำเร็จ'},400)}
}

export async function onRequestDelete(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const used=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM products WHERE category=(SELECT slug FROM categories WHERE id=?)').bind(ctx.params.id).first();
  if(Number(used?.count))return json({error:'หมวดนี้มีสินค้าอยู่ ให้ย้ายสินค้าหรือปิดหมวดแทน'},409);
  await ctx.env.DB.prepare('DELETE FROM categories WHERE id=?').bind(ctx.params.id).run();return json({ok:true});
}
