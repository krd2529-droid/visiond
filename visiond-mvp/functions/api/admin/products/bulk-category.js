import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

const cleanIds=value=>[...new Set((Array.isArray(value)?value:[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))].slice(0,100);
const escapeRegex=value=>String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const replaceTerm=(text,term,replacement)=>term?String(text||'').replace(new RegExp(escapeRegex(term),'gi'),replacement):String(text||'');
export const alignCategoryText=(text,oldCategory,target,required)=>{let output=String(text||'').trim();for(const term of [oldCategory.name,oldCategory.slug])output=replaceTerm(output,term,target.name);if(required&&!output.toLocaleLowerCase('th-TH').includes(String(target.name).toLocaleLowerCase('th-TH')))output=`${target.name} ${output}`.trim();return output};

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;await ensureDatabase(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),ids=cleanIds(body.ids),targetSlug=String(body.category||'').trim();
  if(body.confirmed!==true)return json({error:'กรุณายืนยันการย้ายหมวด'},400);
  if(!ids.length)return json({error:'กรุณาเลือกตะกร้าอย่างน้อย 1 รายการ'},400);
  const target=await ctx.env.DB.prepare("SELECT slug,name,file_type FROM categories WHERE slug=? AND active=1 AND slug<>'resale-rights' AND slug NOT LIKE 'set-%'").bind(targetSlug).first();
  if(!target)return json({error:'ไม่พบหมวดปลายทางที่เปิดใช้งาน'},400);
  const marks=ids.map(()=>'?').join(','),rows=(await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.short_description,p.description,p.category,c.name category_name,p.source,EXISTS(SELECT 1 FROM bundle_source_allocations a WHERE a.source_product_id=p.id) allocated FROM products p LEFT JOIN categories c ON c.slug=p.category WHERE p.id IN (${marks}) AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product')='product'`).bind(...ids).all()).results||[];
  if(rows.length!==ids.length)return json({error:'มีตะกร้าที่ไม่พบหรือไม่สามารถย้ายได้'},400);
  if(rows.some(row=>row.category===target.slug))return json({error:'มีตะกร้าที่อยู่หมวดปลายทางแล้ว กรุณาติ๊กเฉพาะตะกร้าที่ใส่หมวดผิด'},409);
  if(rows.some(row=>row.source==='bundle'||String(row.category).startsWith('set-')||row.category==='resale-rights'||Number(row.allocated)))return json({error:'ชุดรวม ตะกร้าสิทธิ์ หรือตะกร้าที่ถูกใช้ในชุดอื่นไม่สามารถย้ายหมวดด้วยปุ่มนี้'},409);
  const current=await ctx.env.DB.prepare('SELECT slug FROM products WHERE category=? AND id NOT IN ('+marks+')').bind(target.slug,...ids).all(),history=await ctx.env.DB.prepare('SELECT old_slug slug FROM product_slug_history WHERE old_slug LIKE ?').bind(`${target.slug}-%`).all(),prefix=`${target.slug}-`;
  let next=[...(current.results||[]),...(history.results||[])].reduce((max,row)=>Math.max(max,Number(String(row.slug||'').slice(prefix.length))||0),0)+1;
  const statements=[],items=[];
  for(const row of rows.sort((a,b)=>Number(a.id)-Number(b.id))){const oldCategory={slug:row.category,name:row.category_name||row.category},slug=`${prefix}${String(next++).padStart(3,'0')}`,title=alignCategoryText(row.title,oldCategory,target,true),shortDescription=alignCategoryText(row.short_description,oldCategory,target,true),description=alignCategoryText(row.description,oldCategory,target,false)||`หมวดหมู่: ${target.name}`;if(row.slug!==slug)statements.push(ctx.env.DB.prepare('INSERT OR REPLACE INTO product_slug_history(old_slug,product_id,changed_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(row.slug,row.id));statements.push(ctx.env.DB.prepare('UPDATE products SET slug=?,title=?,short_description=?,description=?,category=?,file_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(slug,title,shortDescription,description,target.slug,target.file_type||'PDF',row.id));items.push({id:row.id,old_slug:row.slug,slug,title,category:target.slug})}
  try{await ctx.env.DB.batch(statements)}catch(error){return json({error:String(error).includes('UNIQUE')?'Slug ใหม่ชนกับสินค้าอื่น กรุณาโหลดรายการใหม่แล้วลองอีกครั้ง':'ย้ายหมวดไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกเปลี่ยน'},409)}return json({ok:true,updated:items.length,items,id_policy:'NUMERIC_PRODUCT_ID_UNCHANGED'});
}
