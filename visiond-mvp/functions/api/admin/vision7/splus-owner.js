import { json, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { grantSplusOwner, normalizeSplusMachine, splusReadySql, splusSigner } from '../../../_splus.js';

const noStore={'cache-control':'private, no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error){auth.error.headers.set('cache-control','private, no-store');return auth.error}
  const body=await ctx.request.json().catch(()=>({}));
  const email=String(body.email||'').trim(),machine=normalizeSplusMachine(body.machine_id);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!machine)return json({error:'ระบุอีเมลผู้รับและรหัสเครื่อง'},400,noStore);
  if(!await ctx.env.DB.prepare(splusReadySql).first())return json({error:'S+ ยังไม่เปิดเผยแพร่ตัวติดตั้งลูกค้า'},409,noStore);
  const recipient=await ctx.env.DB.prepare('SELECT id,name,email FROM users WHERE email=? COLLATE NOCASE LIMIT 1').bind(email).first();
  if(!recipient)return json({error:'ไม่พบบัญชี VisionD ผู้รับ'},404,noStore);
  let signer;try{signer=await splusSigner(ctx.env)}catch{return json({error:'ระบบเซ็นคีย์ S+ ยังไม่พร้อม'},503,noStore)}
  try{
    const result=await grantSplusOwner(ctx.env,{recipient,issuerId:auth.user.id,machine,privateKey:signer});
    if(result.conflict)return json({error:'เครื่องนี้มี OWNER ของบัญชีอื่นแล้ว'},409,noStore);
    return json({ok:true,key:result.key,machine_id:machine,recipient_email:recipient.email,existing:result.existing},200,noStore);
  }catch{return json({error:'ออกคีย์ OWNER ไม่สำเร็จ กรุณาลองใหม่'},503,noStore)}
}
