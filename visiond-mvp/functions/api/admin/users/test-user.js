import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {hashPassword,securityLog} from '../../../_security.js';

const TEST_USER_NAME='รัฐสิทธิ ดำรงรถการ';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),username=String(body.username||'').trim().toLowerCase(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').replace(/\D/g,''),password=String(body.password||'');
  if(!/^[a-z0-9._-]{4,}$/.test(username)||!/^\S+@\S+\.\S+$/.test(email)||!/^0\d{8,9}$/.test(phone)||password.length<10)return json({error:'กรอก Username อย่างน้อย 4 ตัว อีเมล เบอร์ไทย และรหัสผ่านอย่างน้อย 10 ตัวให้ครบ'},400);
  const exists=await ctx.env.DB.prepare('SELECT id FROM users WHERE lower(email)=? OR lower(username)=?').bind(email,username).first();
  if(exists)return json({error:'Username หรืออีเมลนี้ถูกใช้แล้ว'},409);
  const hash=await hashPassword(password),row=await ctx.env.DB.prepare("INSERT INTO users(email,username,name,phone,password_hash,role,is_test_user,vision5_test_account) VALUES(?,?,?,?,?,'user',1,1) RETURNING id,email,username,name,phone,role,is_test_user").bind(email,username,TEST_USER_NAME,phone,hash).first();
  await securityLog(ctx.env,ctx.request,'test_user_created','warning',`target_user_id=${row.id}`,auth.user.id);
  return json({ok:true,item:row,message:`สร้างยูสเทส ${username} แล้ว`},201);
}
