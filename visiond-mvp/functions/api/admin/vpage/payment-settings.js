import {json,requireBoss} from '../../../_lib.js';
import {ensureSettings,loadVpagePaymentSettings} from '../../../_payment.js';

const headers={'cache-control':'private, no-store'};
export async function onRequestGet(ctx){
  const auth=await requireBoss(ctx);if(auth.error){auth.error.headers.set('cache-control','private, no-store');return auth.error}
  const item=await loadVpagePaymentSettings(ctx.env);
  return json({configured:Boolean(item),item},200,headers);
}
export async function onRequestPut(ctx){
  const auth=await requireBoss(ctx);if(auth.error){auth.error.headers.set('cache-control','private, no-store');return auth.error}
  const body=await ctx.request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'ข้อมูลบัญชี Vpage ไม่ถูกต้อง'},400,headers);
  const bank_name=String(body.bank_name||'').trim(),account_name=String(body.account_name||'').trim(),account_number=String(body.account_number||'').trim();
  if(bank_name.length<2||bank_name.length>100||account_name.length<2||account_name.length>150||!/^[0-9 -]{8,30}$/.test(account_number)||!/^[0-9]{8,20}$/.test(account_number.replace(/[^0-9]/g,'')))return json({error:'กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชี Vpage ให้ถูกต้อง'},400,headers);
  await ensureSettings(ctx.env);
  const values={vpage_bank_name:bank_name,vpage_account_name:account_name,vpage_account_number:account_number};
  try{await ctx.env.DB.batch(Object.entries(values).map(([key,value])=>ctx.env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(key,value)))}catch{return json({error:'บันทึกบัญชี Vpage ไม่สำเร็จ กรุณาลองใหม่'},500,headers)}
  return json({configured:true,item:await loadVpagePaymentSettings(ctx.env)},200,headers);
}
