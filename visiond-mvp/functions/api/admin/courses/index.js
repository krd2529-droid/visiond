import { json, requireAdmin } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import {loadPaymentSettings} from '../../../_payment.js';

const slugify=(v)=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||`course-${Date.now()}`;
const ext=(name,type)=>String(name||'').split('.').pop()?.toLowerCase()||({"image/jpeg":'jpg',"image/png":'png',"image/webp":'webp'}[type]||'bin');

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare(`SELECT c.*,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.status,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count,
    (SELECT COUNT(DISTINCT e.user_id) FROM entitlements e WHERE e.product_id=p.id AND e.active=1) student_count
    FROM courses c JOIN products p ON p.id=c.product_id
    WHERE p.deleted_at IS NULL
      AND c.owner_user_id IS NULL
      AND COALESCE(c.course_origin,'company')='company'
      AND c.course_type='online_course'
    ORDER BY c.id DESC`).all();
  return json({items:results});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData(),title=String(form.get('title')||'').trim(),teacher=String(form.get('teacher_name')||'').trim(),price=Math.round(Number(form.get('price_baht'))*100),courseType=form.get('course_type')==='resale_rights'?'resale_rights':'online_course',licenseDays=30,episodes=Number(form.get('expected_episodes')),contentMinutes=Number(form.get('content_minutes')),paymentMode=String(form.get('payment_account')||'boss_krungsri');
  if(!title)return json({error:'กรุณาใส่ชื่อคอร์ส'},400);if(!Number.isFinite(price)||price<0)return json({error:'ราคาไม่ถูกต้อง'},400);
  if(!teacher)return json({error:'กรุณาใส่ชื่อผู้สอน'},400);if(!Number.isInteger(episodes)||episodes<1||episodes>200)return json({error:'จำนวนบทเรียนต้องอยู่ระหว่าง 1–200 EP'},400);if(!Number.isFinite(contentMinutes)||contentMinutes<1||contentMinutes>100000)return json({error:'เวลาเนื้อหาต้องมากกว่า 0 นาที'},400);if(!['boss_krungsri','visiond'].includes(paymentMode))return json({error:'บัญชีรับเงินไม่ถูกต้อง'},400);
  if(courseType==='resale_rights')return json({error:'ตะกร้าสิทธิ์มีได้เพียงอันเดียว ระบบใช้ “สิทธิ์ลงขายคอร์สออนไลน์ 1 ตะกร้า” อยู่แล้ว'},409);
  let slug=slugify(form.get('slug')||title),n=1;while(await ctx.env.DB.prepare('SELECT id FROM products WHERE slug=?').bind(slug).first())slug=`${slugify(form.get('slug')||title)}-${++n}`;
  let cover='/assets/product-placeholder.svg';const file=form.get('cover');
  if(file?.size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)return json({error:'รูปปกต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB'},400);const key=`course-cover-${crypto.randomUUID()}.${ext(file.name,file.type)}`;await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});cover='/api/media/'+key;}
  const settings=await loadPaymentSettings(ctx.env),account=paymentMode==='visiond'?settings.profiles.company:{bank_name:'ธนาคารกรุงศรีอยุธยา',account_name:'รัฐสิทธิ ดำรงรถการ',account_number:'444-118-1181'};
  if(!account.bank_name||!account.account_name||!account.account_number)return json({error:'บัญชีบริษัท VisionD ยังตั้งค่าไม่ครบ กรุณาตั้งค่าในหลังบ้านก่อน'},409);
  const product=await ctx.env.DB.prepare(`INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
    VALUES(?,?,?,?,?,?,?,?,?,?,'draft','course-admin','course')`).bind(slug,title,String(form.get('short_description')||''),String(form.get('description')||''),price,cover,JSON.stringify([cover]),'online-course','วิดีโอ + เอกสาร',episodes).run();
  const course=await ctx.env.DB.prepare("INSERT INTO courses(product_id,subtitle,teacher_name,total_minutes,active,course_type,license_edit_days,expected_episodes,course_origin,review_status,payment_bank_name,payment_account_name,payment_account_number,course_plan) VALUES(?,?,?,?,0,'online_course',?,?, 'company','draft',?,?,?,'company')").bind(product.meta.last_row_id,String(form.get('short_description')||''),teacher,Math.round(contentMinutes),licenseDays,episodes,account.bank_name,account.account_name,account.account_number).run();
  return json({ok:true,id:course.meta.last_row_id,slug,status:'draft',review_status:'draft',expected_episodes:episodes,payment_account:paymentMode},201);
}
