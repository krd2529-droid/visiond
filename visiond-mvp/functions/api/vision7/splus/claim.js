import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { requireVision7User } from '../../../_vision7_auth.js';
import { rateLimitIdentityAtomic } from '../../../_security.js';
import { claimSplusPaid, claimSplusTrial, normalizeSplusMachine, splusPaidPurchase, splusReadySql, splusSigner } from '../../../_splus.js';

const noStore={'cache-control':'private, no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVision7Schema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const machine=normalizeSplusMachine(body.machine_id),kind=String(body.kind||'');
  const orderItemId=Number(body.order_item_id);
  if(!machine||!['paid','trial'].includes(kind)||kind==='paid'&&(!Number.isSafeInteger(orderItemId)||orderItemId<=0))
    return json({error:'กรุณาระบุชนิดคีย์และรหัสเครื่อง XXXX-XXXX-XXXX-XXXX'},400,noStore);
  const limit=await rateLimitIdentityAtomic(ctx.env,'splus_claim',String(auth.user.id),{limit:8,windowMinutes:1,blockMinutes:1});
  if(limit.error)return json({error:'ขอคีย์ถี่เกินไป กรุณาลองใหม่ใน 1 นาที'},429,{'retry-after':String(limit.retryAfter),...noStore});
  if(!await ctx.env.DB.prepare(splusReadySql).first())return json({error:'SP+ ยังไม่เปิดเผยแพร่ตัวติดตั้งลูกค้า'},409,noStore);
  const purchase=kind==='paid'?await splusPaidPurchase(ctx.env,orderItemId,auth.user.id):null;
  if(kind==='paid'&&!purchase)return json({error:'ไม่พบออเดอร์ SP+ ที่ชำระเงินแล้ว'},403,noStore);
  let signer;try{signer=await splusSigner(ctx.env)}catch{return json({error:'ระบบออกคีย์ SP+ ยังไม่พร้อม'},503,noStore)}
  try{
    const result=kind==='paid'?await claimSplusPaid(ctx.env,purchase,machine,signer):await claimSplusTrial(ctx.env,{userId:auth.user.id,name:auth.user.name||auth.user.email,machine,privateKey:signer});
    if(result.conflict)return json({error:'สิทธิ์นี้ผูกกับเครื่องอื่นแล้วหรือเครื่องนี้เคยรับสิทธิ์ทดลอง'},409,noStore);
    return json({ok:true,kind,key:result.key,machine_id:machine,expires_at:result.expires_at||null,existing:result.existing},200,noStore);
  }catch{return json({error:'ออกคีย์ SP+ ไม่สำเร็จ กรุณาลองใหม่ด้วยเครื่องเดิม'},503,noStore)}
}
