import { json, requireAdmin } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';

const slugify=(v)=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||`course-${Date.now()}`;
const ext=(name,type)=>String(name||'').split('.').pop()?.toLowerCase()||({"image/jpeg":'jpg',"image/png":'png',"image/webp":'webp'}[type]||'bin');

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare(`SELECT c.*,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.status,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count,
    (SELECT COUNT(DISTINCT e.user_id) FROM entitlements e WHERE e.product_id=p.id AND e.active=1) student_count
    FROM courses c JOIN products p ON p.id=c.product_id WHERE p.deleted_at IS NULL ORDER BY c.id DESC`).all();
  return json({items:results});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData(),title=String(form.get('title')||'').trim(),price=Math.round(Number(form.get('price_baht'))*100),courseType=form.get('course_type')==='resale_rights'?'resale_rights':'online_course',licenseDays=courseType==='resale_rights'?[0,30,365].includes(Number(form.get('license_edit_days')))?Number(form.get('license_edit_days')):30:30;
  if(!title)return json({error:'กรุณาใส่ชื่อคอร์ส'},400);if(!Number.isFinite(price)||price<0)return json({error:'ราคาไม่ถูกต้อง'},400);
  let slug=slugify(form.get('slug')||title),n=1;while(await ctx.env.DB.prepare('SELECT id FROM products WHERE slug=?').bind(slug).first())slug=`${slugify(form.get('slug')||title)}-${++n}`;
  let cover='/assets/product-placeholder.svg';const file=form.get('cover');
  if(file?.size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)return json({error:'รูปปกต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB'},400);const key=`course-cover-${crypto.randomUUID()}.${ext(file.name,file.type)}`;await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});cover='/api/media/'+key;}
  const product=await ctx.env.DB.prepare(`INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
    VALUES(?,?,?,?,?,?,?,?,?,0,?,'course-admin',?)`).bind(slug,title,String(form.get('short_description')||''),String(form.get('description')||''),price,cover,JSON.stringify([cover]),courseType==='resale_rights'?'resale-rights':'online-course',courseType==='resale_rights'?'สิทธิ์ใช้งาน':'วิดีโอ + เอกสาร',form.get('active')==='1'?'published':'draft',courseType==='resale_rights'?'product':'course').run();
  const course=await ctx.env.DB.prepare("INSERT INTO courses(product_id,subtitle,teacher_name,active,course_type,license_edit_days,course_origin,review_status,approved_at,approved_by) VALUES(?,?,?,?,?,?,'company','approved',CURRENT_TIMESTAMP,?)").bind(product.meta.last_row_id,String(form.get('subtitle')||''),String(form.get('teacher_name')||''),form.get('active')==='1'?1:0,courseType,licenseDays,auth.user.id).run();
  return json({ok:true,id:course.meta.last_row_id,slug},201);
}
