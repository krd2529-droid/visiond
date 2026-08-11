import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

const clean=(value,max)=>String(value??'').trim().slice(0,max);
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validUsername=value=>/^[A-Za-z0-9_.-]{4,50}$/.test(value);

export async function onRequestPatch(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id),body=await ctx.request.json().catch(()=>({}));
  if(!Number.isInteger(id)||id<1)return json({error:'รหัสผู้ใช้ไม่ถูกต้อง'},400);
  const old=await ctx.env.DB.prepare('SELECT id,email,username,name,phone,role,is_test_user,vision5_test_account FROM users WHERE id=?').bind(id).first();
  if(!old)return json({error:'ไม่พบบัญชีผู้ใช้'},404);
  if(old.role==='boss')return json({error:'ข้อมูลบัญชี Boss แก้จากตารางนี้ไม่ได้'},403);
  const accountType=clean(body.account_type,20).toLowerCase();
  if(!['user','test','admin'].includes(accountType))return json({error:'ประเภทบัญชีไม่ถูกต้อง'},400);
  let name=clean(body.name,120),email=clean(body.email,160).toLowerCase(),username=clean(body.username,50),phone=clean(body.phone,30);
  if(accountType==='test')name='รัฐสิทธิ ดำรงรถการ';
  if(name.length<2)return json({error:'กรุณากรอกชื่อ–นามสกุล'},400);
  if(!validEmail(email))return json({error:'รูปแบบอีเมลไม่ถูกต้อง'},400);
  if(!validUsername(username))return json({error:'Username ต้องมี 4–50 ตัว และใช้ A–Z, 0–9, จุด, ขีดกลาง หรือขีดล่าง'},400);
  if(phone&&!/^[0-9+ -]{8,20}$/.test(phone))return json({error:'รูปแบบเบอร์โทรไม่ถูกต้อง'},400);
  const duplicate=await ctx.env.DB.prepare('SELECT id FROM users WHERE id<>? AND (lower(email)=? OR lower(username)=?) LIMIT 1').bind(id,email,username.toLowerCase()).first();
  if(duplicate)return json({error:'อีเมลหรือ Username นี้ถูกใช้งานแล้ว'},409);
  if(accountType!=='test'){
    const duplicateName=await ctx.env.DB.prepare('SELECT id FROM users WHERE id<>? AND is_test_user=0 AND lower(trim(name))=lower(?) LIMIT 1').bind(id,name).first();
    if(duplicateName)return json({error:'ชื่อ–นามสกุลนี้ถูกใช้งานแล้ว'},409);
  }
  const role=accountType==='admin'?'admin':'user',isTest=accountType==='test'?1:0;
  const before={name:old.name,email:old.email,username:old.username,phone:old.phone||'',role:old.role,is_test_user:Number(old.is_test_user)||0};
  const after={name,email,username,phone,role,is_test_user:isTest};
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE users SET name=?,email=?,username=?,phone=?,role=?,is_test_user=?,vision5_test_account=0 WHERE id=?').bind(name,email,username,phone,role,isTest,id),
    ctx.env.DB.prepare("INSERT INTO user_activity_log(user_id,event_type,path,metadata) VALUES(?,'admin_user_profile_updated','/admin',?)").bind(auth.user.id,JSON.stringify({target_user_id:id,before,after}))
  ]);
  return json({ok:true,message:'บันทึกข้อมูลผู้ใช้ใหม่แล้ว',item:{id,...after}});
}
