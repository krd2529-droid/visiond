import { json, requireUser } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';

const slugify=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||`course-${Date.now()}`;
const ext=(name,type)=>String(name||'').split('.').pop()?.toLowerCase()||({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','application/pdf':'pdf'}[type]||'bin');
const imageTypes=['image/jpeg','image/png','image/webp'];
const videoTypes=['video/mp4','video/webm'];
const documentTypes=['application/pdf','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
const expiry=(granted,days)=>Number(days)===0?null:new Date(new Date(String(granted).replace(' ','T')+'Z').getTime()+Number(days)*86400000).toISOString();
const editable=c=>!c.edit_expires_at||Date.parse(c.edit_expires_at)>Date.now();

async function put(env,file,prefix,types,max){
  if(!file?.size)return null;
  if(!types.includes(file.type)||file.size>max)throw new Error('FILE_INVALID');
  const key=`${prefix}-${crypto.randomUUID()}.${ext(file.name,file.type)}`;
  await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
  return key;
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const {results:licenses}=await ctx.env.DB.prepare(`SELECT e.id entitlement_id,e.granted_at,p.title license_title,c.license_edit_days,
    owned.id bound_course_id,op.title bound_course_title,owned.edit_expires_at,op.status bound_status
    FROM entitlements e JOIN products p ON p.id=e.product_id JOIN courses c ON c.product_id=p.id AND c.course_type='resale_rights'
    LEFT JOIN courses owned ON owned.license_entitlement_id=e.id LEFT JOIN products op ON op.id=owned.product_id
    WHERE e.user_id=? AND e.active=1 ORDER BY e.id DESC`).bind(auth.user.id).all();
  licenses.forEach(x=>{x.available=!x.bound_course_id;x.expires_at=expiry(x.granted_at,x.license_edit_days);x.editable=x.bound_course_id?editable(x):(!x.expires_at||Date.parse(x.expires_at)>Date.now())});
  const {results:courses}=await ctx.env.DB.prepare(`SELECT c.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.status,c.teacher_name,c.contact_info,c.payment_bank_name,c.payment_account_name,c.payment_account_number,c.payment_qr_url,c.edit_expires_at,c.license_edit_days,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) episode_count,
    COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid'),0) paid_total,
    COALESCE((SELECT COUNT(*) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid'),0) paid_orders
    FROM courses c JOIN products p ON p.id=c.product_id WHERE c.owner_user_id=? ORDER BY c.id DESC`).bind(auth.user.id).all();
  const {results:sales}=await ctx.env.DB.prepare(`SELECT o.order_no,o.total,o.updated_at,c.id course_id,p.title course_title FROM orders o JOIN courses c ON c.id=o.seller_course_id JOIN products p ON p.id=c.product_id WHERE o.course_owner_user_id=? AND o.status='paid' ORDER BY o.updated_at DESC LIMIT 200`).bind(auth.user.id).all();
  const totals=sales.reduce((a,x)=>{a.amount+=Number(x.total)||0;a.orders++;return a},{amount:0,orders:0});
  return json({licenses,courses,sales,totals},200,{'cache-control':'no-store'});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const form=await ctx.request.formData(),entitlementId=Number(form.get('license_entitlement_id')),title=String(form.get('title')||'').trim(),price=Math.round(Number(form.get('price_baht'))*100),episodes=Math.min(100,Math.max(1,Number(form.get('episode_count'))||1));
  if(!title||!Number.isFinite(price)||price<0)return json({error:'กรุณากรอกชื่อคอร์สและราคาให้ถูกต้อง'},400);
  const license=await ctx.env.DB.prepare(`SELECT e.id,e.granted_at,c.license_edit_days FROM entitlements e JOIN courses c ON c.product_id=e.product_id AND c.course_type='resale_rights' WHERE e.id=? AND e.user_id=? AND e.active=1`).bind(entitlementId,auth.user.id).first();
  if(!license)return json({error:'ไม่พบสิทธิ์ขายคอร์ส'},403);
  if(await ctx.env.DB.prepare('SELECT id FROM courses WHERE license_entitlement_id=?').bind(entitlementId).first())return json({error:'สิทธิ์นี้ผูกกับตะกร้าคอร์สแล้ว ไม่สามารถนำไปสร้างตะกร้าอื่นได้'},409);
  const expiresAt=expiry(license.granted_at,license.license_edit_days);if(expiresAt&&Date.parse(expiresAt)<=Date.now())return json({error:'สิทธิ์นี้หมดระยะเวลาสร้าง/แก้ไขแล้ว'},403);
  const cover=form.get('cover'),qr=form.get('payment_qr');
  let coverKey,qrKey;try{coverKey=await put(ctx.env,cover,'seller-course-cover',imageTypes,8*1024*1024);qrKey=await put(ctx.env,qr,'seller-course-qr',imageTypes,8*1024*1024)}catch{return json({error:'รูปปกหรือ QR ต้องเป็น JPG, PNG, WEBP ไม่เกิน 8 MB'},400)}
  if(!coverKey)return json({error:'กรุณาอัปโหลดรูปปก'},400);
  let slug=slugify(title),i=1;while(await ctx.env.DB.prepare('SELECT id FROM products WHERE slug=?').bind(slug).first())slug=`${slugify(title)}-${++i}`;
  const coverUrl='/api/media/'+coverKey,bank=String(form.get('payment_bank_name')||'').trim(),accountName=String(form.get('payment_account_name')||'').trim(),accountNo=String(form.get('payment_account_number')||'').trim();
  if(!qrKey&&!bank)return json({error:'กรุณาแนบ QR หรือกรอกข้อมูลบัญชีรับเงิน'},400);
  const product=await ctx.env.DB.prepare(`INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) VALUES(?,?,?,?,?,?,?,'online-course','วิดีโอ + เอกสาร',?,'published','course-seller','course')`).bind(slug,title,String(form.get('short_description')||''),String(form.get('description')||''),price,coverUrl,JSON.stringify([coverUrl]),episodes).run();
  let courseId;
  try{const c=await ctx.env.DB.prepare(`INSERT INTO courses(product_id,subtitle,teacher_name,active,course_type,license_edit_days,owner_user_id,license_entitlement_id,edit_expires_at,contact_info,payment_bank_name,payment_account_name,payment_account_number,payment_qr_url) VALUES(?,?,?,1,'online_course',?,?,?,?,?,?,?,?,?)`).bind(product.meta.last_row_id,String(form.get('short_description')||''),String(form.get('teacher_name')||''),license.license_edit_days,auth.user.id,entitlementId,expiresAt,String(form.get('contact_info')||''),bank,accountName,accountNo,qrKey?'/api/course-seller/payment-qr/'+entitlementId:'').run();courseId=c.meta.last_row_id}catch(e){return json({error:'สร้างตะกร้าไม่สำเร็จ หรือสิทธิ์ถูกใช้ไปแล้ว'},409)}
  for(let n=1;n<=episodes;n++){
    const epTitle=String(form.get(`episode_title_${n}`)||'').trim()||`EP.${n}`;
    let videoKey=null,docKey=null;try{videoKey=await put(ctx.env,form.get(`video_${n}`),`seller-course-${courseId}-video`,videoTypes,1024*1024*1024);docKey=await put(ctx.env,form.get(`document_${n}`),`seller-course-${courseId}-document`,documentTypes,1024*1024*1024)}catch{return json({error:`ไฟล์ EP.${n} ไม่รองรับหรือเกิน 1 GB ตะกร้าถูกสร้างแล้ว กรุณาแก้ไขภายหลัง`,course_id:courseId},400)}
    await ctx.env.DB.prepare(`INSERT INTO course_lessons(course_id,title,description,sort_order,video_key,pdf_key,video_mime,pdf_mime,document_name) VALUES(?,?,?,?,?,?,?,?,?)`).bind(courseId,epTitle,String(form.get(`episode_detail_${n}`)||''),n*10,videoKey,docKey,form.get(`video_${n}`)?.type||null,form.get(`document_${n}`)?.type||null,form.get(`document_${n}`)?.name||'').run();
  }
  return json({ok:true,id:courseId,slug},201);
}
