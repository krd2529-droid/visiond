import {json,requireAdmin} from '../../_lib.js';
import {sellerTokenEncryptionConfigured} from '../../_seller_token.js';

const noStore={'cache-control':'private, no-store'};
const present=value=>Boolean(String(value||'').trim());
const check=(id,label,ok,action,detail='')=>({id,label,status:ok?'ready':'missing',action:ok?'ไม่ต้องดำเนินการ':action,detail});

export async function onRequestGet(ctx){
  if(!ctx.env.DB)return json({error:'ยังไม่ได้เชื่อมฐานข้อมูล'},503,noStore);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(auth.user.role!=='boss')return json({error:'เฉพาะ Boss ตรวจสถานะระบบได้'},403,noStore);
  const required=[],recommended=[];
  required.push(check('db','ฐานข้อมูล D1',true,'เชื่อม D1 binding ชื่อ DB'));
  required.push(check('files','คลังไฟล์ R2',Boolean(ctx.env.FILES),'เชื่อม R2 binding ชื่อ FILES'));
  required.push(check('vision5_encryption','การเข้ารหัส API ผู้ขาย Vision 5',sellerTokenEncryptionConfigured(ctx.env),'เพิ่ม Secret VISION5_TOKEN_ENCRYPTION_KEY อย่างน้อย 32 ตัวอักษร'));
  const requiredTables=['users','sessions','products','orders','order_items','entitlements','courses','course_lessons','course_progress','settings','verified_slips','order_slip_evidence','elon_conversations','elon_messages','password_reset_tokens','page_views','analytics_daily'];
  const requiredIndexes=['idx_users_username','idx_password_reset_user','idx_password_reset_expiry','idx_course_progress_user_course','idx_elon_messages_conversation_created','idx_page_views_time'];
  try{
    const names=[...requiredTables,...requiredIndexes],marks=names.map(()=>'?').join(',');
    const rows=await ctx.env.DB.prepare(`SELECT name,type FROM sqlite_master WHERE name IN (${marks})`).bind(...names).all();
    const found=new Set((rows.results||[]).map(row=>row.name));
    const missingTables=requiredTables.filter(name=>!found.has(name)),missingIndexes=requiredIndexes.filter(name=>!found.has(name));
    required.push(check('migration_tables','ตารางจาก Migration',missingTables.length===0,'รัน Cloudflare D1 migrations ล่าสุด',missingTables.length?`ขาด ${missingTables.length} ตาราง`:`ครบ ${requiredTables.length} ตาราง`));
    required.push(check('migration_indexes','ดัชนีฐานข้อมูล',missingIndexes.length===0,'รัน Migration และตรวจ _schema.js เวอร์ชันล่าสุด',missingIndexes.length?`ขาด ${missingIndexes.length} ดัชนี`:`ครบ ${requiredIndexes.length} ดัชนี`));
  }catch{required.push(check('migration_schema','โครงสร้างฐานข้อมูล',false,'ตรวจสิทธิ์ D1 และรัน Migration ล่าสุด','ตรวจโครงสร้างไม่ได้'));}
  let companyReady=false;
  try{const rows=await ctx.env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('company_bank_name','company_account_name','company_account_number')").all();const settings=Object.fromEntries((rows.results||[]).map(row=>[row.key,row.value]));companyReady=['company_bank_name','company_account_name','company_account_number'].every(key=>present(settings[key]));}catch{}
  recommended.push(check('turnstile','Turnstile ป้องกันบอท',present(ctx.env.TURNSTILE_SITE_KEY)&&present(ctx.env.TURNSTILE_SECRET_KEY),'เพิ่ม TURNSTILE_SITE_KEY และ Secret TURNSTILE_SECRET_KEY'));
  recommended.push(check('company_payment','บัญชีรับเงินของบริษัท',companyReady,'กรอกบัญชีบริษัทใน ตั้งค่าชำระเงิน'));
  recommended.push(check('easyslip','EasySlip ของบริษัท',present(ctx.env.EASYSLIP_API_KEY),'เพิ่ม Secret EASYSLIP_API_KEY เพื่อปลดล็อกอัตโนมัติ'));
  recommended.push(check('elon_ai','ELON AI Provider',present(ctx.env.OPENAI_API_KEY)||present(ctx.env.GEMINI_API_KEY)||present(ctx.env.GEMINI_API_KEY_2),'เพิ่ม OPENAI_API_KEY หรือ GEMINI_API_KEY/GEMINI_API_KEY_2'));
  const emailReady=String(ctx.env.PASSWORD_RESET_EMAIL_PROVIDER||'').toLowerCase()==='resend'&&present(ctx.env.RESEND_API_KEY)&&present(ctx.env.RESET_EMAIL_FROM);
  recommended.push(check('password_email','อีเมลกู้รหัสผ่าน (Resend)',emailReady,'ตั้ง PASSWORD_RESET_EMAIL_PROVIDER=resend, RESEND_API_KEY และ RESET_EMAIL_FROM'));
  recommended.push(check('app_origin','APP_ORIGIN',/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(ctx.env.APP_ORIGIN||'').replace(/\/$/,'')),'ตั้ง APP_ORIGIN เป็น https://visiondonline.com'));
  recommended.push(check('elon_cleanup','งานล้างประวัติ ELON 60 วัน',present(ctx.env.ELON_CLEANUP_TOKEN),'เพิ่ม Secret ELON_CLEANUP_TOKEN และตั้ง Cron เรียก endpoint retention'));
  recommended.push(check('analytics_cleanup','งานสรุป/ล้าง Analytics',present(ctx.env.ANALYTICS_CLEANUP_TOKEN),'เพิ่ม Secret ANALYTICS_CLEANUP_TOKEN และตั้ง Cron เรียก endpoint retention'));
  const summarize=items=>({ready:items.filter(x=>x.status==='ready').length,total:items.length});
  return json({checked_at:new Date().toISOString(),required:{...summarize(required),items:required},recommended:{...summarize(recommended),items:recommended}},200,noStore);
}
